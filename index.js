/**
 * dsh-pet 余额展示适配插件：Antigravity-Manager
 *
 * 通过 Cordis 服务 `petApi7340.balance.register` 为 provider id `antigravity`
 * 提供余额/配额查询与 3 页自定义气泡展示，无需修改 dsh-pet 源码。
 *
 * 连接信息全部从 DSH 运行环境动态获取，不读取任何本地应用文件：
 * 1. 通过 `ctx.llm` + `ctx.settings` 读取 `antigravity` 配置的 `baseURL` 与 `apiKeyEnv`；
 * 2. 密钥优先从 DSH 凭证/环境变量读取 `ANTIGRAVITY_ADMIN_KEY`（可在设置页填写并持久化），
 *    未配置时回落到 `apiKeyEnv`（默认 `ANTIGRAVITY_API_KEY`）；
 * 3. 调用 `<origin>/api/accounts` 拉取实时账号池配额，失败时显式抛错。
 *
 * @module dsh-pet-antigravity-balance
 */

import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const name = 'dsh-antigravity-balance';

const PROVIDER_ID = 'antigravity';
const ADMIN_KEY_ENV = 'ANTIGRAVITY_ADMIN_KEY';
const DEFAULT_API_KEY_ENV = 'ANTIGRAVITY_API_KEY';
const API_TIMEOUT_MS = 10_000;
const SETTINGS_API_PREFIX = '/api/antigravity-balance';
const CONSOLE_OPEN_PATH = `${SETTINGS_API_PREFIX}/open-console`;
const PLUGIN_CONFIG_PATH = path.join(os.homedir(), '.dsh', 'antigravity-balance-config.json');
const MODEL_ALLOWANCE_BRAND_COLOR = '#4285f4';
const MODEL_ALLOWANCE_BACKOFF_MIN_FAILURES = 2;
const MODEL_ALLOWANCE_MAX_BACKOFF_MS = 30 * 60 * 1000;

/** 读取本插件自身的非敏感配置（例如控制台程序路径）。 */
function readPluginConfig() {
  try {
    if (!fs.existsSync(PLUGIN_CONFIG_PATH)) return {};
    const raw = fs.readFileSync(PLUGIN_CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** 写入本插件自身的非敏感配置。 */
function writePluginConfig(patch) {
  const next = { ...readPluginConfig(), ...patch };
  if (!next.consoleAppPath) delete next.consoleAppPath;
  fs.mkdirSync(path.dirname(PLUGIN_CONFIG_PATH), { recursive: true });
  fs.writeFileSync(PLUGIN_CONFIG_PATH, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

/** 获取已配置的 Antigravity Tools 程序路径（未配置返回空串）。 */
function getConsoleAppPath() {
  const cfg = readPluginConfig();
  return typeof cfg.consoleAppPath === 'string' ? cfg.consoleAppPath.trim() : '';
}

/** 计算 dsh-model-allowance 的 consoleUrl：配了本地程序路径走拉起路由，否则回退网页 origin。 */
function resolveConsoleUrl(origin) {
  return getConsoleAppPath() ? CONSOLE_OPEN_PATH : origin;
}

/** 启动已配置的本地可执行文件或快捷方式。 */
function launchConsoleApp(appPath) {
  const target = String(appPath || '').trim();
  if (!target) {
    throw new Error('尚未配置 Antigravity Tools 程序路径');
  }
  if (!fs.existsSync(target)) {
    throw new Error(`找不到指定程序：${target}`);
  }
  if (process.platform === 'win32' && /\.lnk$/i.test(target)) {
    const child = spawn('cmd.exe', ['/c', 'start', '', target], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();
    return target;
  }
  const child = spawn(target, [], {
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  });
  child.unref();
  return target;
}

/** 弹出系统原生文件选择对话框选择 .exe / .lnk（仅 Windows）。 */
function pickConsoleAppPath(initialPath) {
  if (process.platform !== 'win32') {
    return Promise.reject(new Error('当前系统不支持文件选择框，请直接手动粘贴路径'));
  }
  const initDir =
    initialPath && fs.existsSync(path.dirname(initialPath)) ? path.dirname(initialPath) : '';
  const escapedDir = initDir.replace(/'/g, "''");
  const psScript = [
    'Add-Type -AssemblyName System.Windows.Forms',
    '$dlg = New-Object System.Windows.Forms.OpenFileDialog',
    "$dlg.Title = '选择 Antigravity Tools 可执行文件'",
    "$dlg.Filter = '应用程序 (*.exe;*.lnk)|*.exe;*.lnk|所有文件 (*.*)|*.*'",
    escapedDir ? `$dlg.InitialDirectory = '${escapedDir}'` : '',
    '$top = New-Object System.Windows.Forms.Form',
    '$top.TopMost = $true',
    'if ($dlg.ShowDialog($top) -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dlg.FileName }',
  ]
    .filter(Boolean)
    .join('; ');

  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-STA', '-Command', psScript],
      { timeout: 120_000, windowsHide: true },
      (err, stdout) => {
        if (err) {
          reject(new Error(err.message || '打开文件选择框失败'));
          return;
        }
        resolve(String(stdout || '').trim());
      },
    );
  });
}

/** 从 DSH 运行环境的 llm / settings 中读取当前 provider 的 baseURL 与 apiKeyEnv。 */
function resolveDshProviderProfile(ctx, providerId) {
  const llm = ctx.get('llm', false);
  const settings = ctx.get('settings', false);
  if (!llm || !settings) return {};

  try {
    const meta = llm.listConfigurableProviders?.().find((p) => p.provider === providerId);
    const namespaces = settings.describe?.({ redactSecrets: true }) ?? [];

    let profile;
    if (meta) {
      profile = namespaces.find((ns) => ns.ns === meta.settingsNs)?.value;
      for (const key of meta.settingsPath ?? []) {
        profile = profile && typeof profile === 'object' ? Reflect.get(profile, key) : undefined;
      }
    } else {
      const piAi = namespaces.find((ns) => ns.ns === 'llm-pi-ai')?.value;
      profile = piAi?.providers?.[providerId];
    }

    if (!profile || typeof profile !== 'object') return {};
    return {
      baseURL: typeof profile.baseURL === 'string' ? profile.baseURL.trim() : '',
      apiKeyEnv: typeof profile.apiKeyEnv === 'string' ? profile.apiKeyEnv.trim() : '',
    };
  } catch {
    return {};
  }
}

/** 从 DSH 凭证服务（或进程环境变量）解析单个凭证引用。 */
async function resolveSingleCredential(ctx, ref) {
  if (!ref) return '';
  const credentials = ctx.get('credentials', false);
  if (credentials?.resolve) {
    try {
      const hit = await credentials.resolve(ref);
      if (hit?.value) return String(hit.value);
    } catch {
      // 忽略凭证引用格式异常，继续回落环境变量
    }
  }
  return process.env[ref] || '';
}

/** 优先解析 ANTIGRAVITY_ADMIN_KEY，未配置时回落到 provider 自身的 apiKeyEnv。 */
async function resolveAdminOrApiKey(ctx, apiKeyEnv) {
  const adminKey = await resolveSingleCredential(ctx, ADMIN_KEY_ENV);
  if (adminKey) return { key: adminKey, ref: ADMIN_KEY_ENV };

  const fallbackRef = apiKeyEnv || DEFAULT_API_KEY_ENV;
  const fallbackKey = await resolveSingleCredential(ctx, fallbackRef);
  return { key: fallbackKey, ref: fallbackRef };
}

/** 从 baseURL 提取管理接口 origin（例如 http://127.0.0.1:8080/v1 -> http://127.0.0.1:8080）。 */
function extractOrigin(baseURL) {
  if (!baseURL) throw new Error('DSH 未配置 antigravity 的 baseURL');
  try {
    return new URL(baseURL).origin;
  } catch {
    throw new Error(`antigravity 的 baseURL 无效: ${baseURL}`);
  }
}

/** 从 Antigravity-Manager 管理 API 获取账号列表。 */
async function fetchAccountsFromApi(origin, apiKey, keyRef) {
  const headers = { Accept: 'application/json' };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
    headers['x-api-key'] = apiKey;
  }

  const res = await fetch(`${origin}/api/accounts`, {
    headers,
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });
  if (res.status === 401) {
    throw new Error(
      `HTTP 401（当前使用 ${keyRef}，请在「设置 → Antigravity 余额」填入主 API Key 或 Web 管理密码）`,
    );
  }
  if (!res.ok) throw new Error(`Antigravity 接口返回 HTTP ${res.status}`);
  const body = await res.json();

  if (Array.isArray(body)) return { accounts: body, currentId: null };
  if (Array.isArray(body?.accounts)) {
    return { accounts: body.accounts, currentId: body.current_account_id ?? null };
  }
  if (Array.isArray(body?.data?.accounts)) {
    return { accounts: body.data.accounts, currentId: body.data.current_account_id ?? null };
  }
  if (Array.isArray(body?.data)) return { accounts: body.data, currentId: null };
  throw new Error('未知的 /api/accounts 响应结构');
}

/** 通过 DSH 运行环境的 baseURL 与密钥拉取实时账号池。 */
async function loadAccountPool(ctx, providerId) {
  const profile = resolveDshProviderProfile(ctx, providerId);
  const origin = extractOrigin(profile.baseURL);
  const { key, ref } = await resolveAdminOrApiKey(ctx, profile.apiKeyEnv);

  const apiResult = await fetchAccountsFromApi(origin, key, ref);
  if (apiResult.accounts.length === 0) {
    throw new Error('Antigravity 账号池为空');
  }
  return { ...apiResult, source: '实时' };
}

/** 判断账号是否可用。 */
function isAccountAvailable(acc) {
  if (!acc || typeof acc !== 'object') return false;
  if (acc.disabled || acc.banned || acc.proxy_disabled || acc.manual_proxy_disabled) return false;
  if (acc.quota?.is_forbidden) return false;
  return true;
}

/** 将配额分组名归一化为简短标签。 */
function shortGroupName(displayName) {
  const s = String(displayName || '').trim();
  const lower = s.toLowerCase();
  if (lower.includes('argon')) return 'Argon';
  if (lower.includes('neon')) return 'Neon';
  if (lower.includes('claude') || lower.includes('gpt')) return 'Claude·GPT';
  if (lower.includes('gemini')) return 'Gemini';
  return s.slice(0, 12) || 'Models';
}

/** 判断是否为主分组（用于驱动桌宠 6 档动画的已用百分比）。 */
function isPrimaryGroup(shortName) {
  return shortName === 'Gemini' || shortName === 'Claude·GPT';
}

/** 从单个账号提取分组配额信息。 */
function extractAccountGroups(acc) {
  const groups = Array.isArray(acc?.quota?.quota_groups) ? acc.quota.quota_groups : [];
  if (groups.length > 0) {
    return groups.map((g) => {
      const buckets = Array.isArray(g.buckets) ? g.buckets : [];
      const b5h = buckets.find((b) => String(b.window).toLowerCase() === '5h');
      const bWeekly = buckets.find((b) => String(b.window).toLowerCase() === 'weekly');

      const fractions = buckets
        .map((b) => Number(b.remaining_fraction))
        .filter((n) => Number.isFinite(n));
      const minRemaining = fractions.length > 0 ? Math.max(0, Math.min(1, Math.min(...fractions))) : null;

      return {
        name: shortGroupName(g.display_name),
        minRemaining,
        h5: b5h && Number.isFinite(Number(b5h.remaining_fraction)) ? clamp01(Number(b5h.remaining_fraction)) : null,
        h5Reset: b5h?.reset_time || '',
        weekly:
          bWeekly && Number.isFinite(Number(bWeekly.remaining_fraction))
            ? clamp01(Number(bWeekly.remaining_fraction))
            : null,
        weeklyReset: bWeekly?.reset_time || '',
      };
    }).filter((g) => g.name !== 'Argon');
  }

  const models = Array.isArray(acc?.quota?.models) ? acc.quota.models : [];
  const geminiPcts = [];
  const claudePcts = [];
  for (const m of models) {
    const pct = Number(m?.percentage);
    if (!Number.isFinite(pct)) continue;
    const n = String(m?.name || '').toLowerCase();
    if (n.includes('claude') || n.includes('gpt')) claudePcts.push(pct / 100);
    else if (n.includes('gemini')) geminiPcts.push(pct / 100);
  }
  const fallback = [];
  if (geminiPcts.length > 0) {
    fallback.push({
      name: 'Gemini',
      minRemaining: clamp01(Math.min(...geminiPcts)),
      h5: null,
      h5Reset: '',
      weekly: clamp01(Math.min(...geminiPcts)),
      weeklyReset: '',
    });
  }
  if (claudePcts.length > 0) {
    fallback.push({
      name: 'Claude·GPT',
      minRemaining: clamp01(Math.min(...claudePcts)),
      h5: null,
      h5Reset: '',
      weekly: clamp01(Math.min(...claudePcts)),
      weeklyReset: '',
    });
  }
  return fallback;
}

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

function toPct(fraction) {
  return Math.round(clamp01(fraction) * 100);
}

/** 剩余比例对应的颜色（绿 / 黄 / 红）。 */
function remainingColor(pct) {
  if (pct >= 50) return '#22c55e';
  if (pct >= 20) return '#f59e0b';
  return '#ef4444';
}

/** 格式化重置倒计时（如 2h44m、6d1h）。 */
function formatResetCountdown(isoStr) {
  if (!isoStr) return '';
  const ts = Date.parse(isoStr);
  if (!Number.isFinite(ts)) return '';
  const diffMs = ts - Date.now();
  if (diffMs <= 0) return '已重置';
  const totalMin = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days}d${hours}h`;
  if (hours > 0) return `${hours}h${mins}m`;
  return `${Math.max(1, mins)}m`;
}

/** 格式化更新时间（如 3m前）。 */
function formatAgo(unixSec) {
  if (!Number.isFinite(unixSec) || unixSec <= 0) return '';
  const diffMin = Math.max(0, Math.floor((Date.now() - unixSec * 1000) / 60_000));
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin}m前`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `${h}h前`;
  return `${Math.floor(h / 24)}d前`;
}

/** 订阅等级徽标文本。 */
function tierBadge(acc) {
  const raw = String(acc?.quota?.subscription_tier || '').toUpperCase();
  if (raw.includes('ULTRA') || raw.includes('HELIUM')) return 'ULTRA';
  if (raw.includes('PRO')) return 'PRO';
  if (raw.includes('ENTERPRISE')) return 'ENT';
  return 'FREE';
}

/** 构造进度条节点（仅使用 dsh-pet 白名单内的 tag 与 style 键）。 */
function progressBarNode(pct) {
  const safePct = Math.max(0, Math.min(100, pct));
  return {
    tag: 'div',
    style: {
      width: '100%',
      height: '6px',
      backgroundColor: 'rgba(128,128,128,0.25)',
      borderRadius: '3px',
      overflow: 'hidden',
      marginTop: '3px',
    },
    children: [
      {
        tag: 'div',
        style: {
          width: `${safePct}%`,
          height: '6px',
          backgroundColor: remainingColor(safePct),
          borderRadius: '3px',
        },
      },
    ],
  };
}

/** 聚合所有可用账号的分组配额，生成 3 页 custom 视图与档位百分比。 */
function buildCustomBalance({ accounts, currentId, source }) {
  const available = accounts.filter(isAccountAvailable);
  const activePool = available.length > 0 ? available : accounts;
  if (activePool.length === 0) {
    throw new Error('Antigravity 账号池为空');
  }

  const groupMap = new Map();
  let latestUpdate = 0;

  for (const acc of activePool) {
    const lu = Number(acc?.quota?.last_updated || 0);
    if (lu > latestUpdate) latestUpdate = lu;

    for (const g of extractAccountGroups(acc)) {
      if (!groupMap.has(g.name)) {
        groupMap.set(g.name, {
          name: g.name,
          minList: [],
          h5List: [],
          weeklyList: [],
          h5Reset: '',
          weeklyReset: '',
        });
      }
      const agg = groupMap.get(g.name);
      if (g.minRemaining !== null) agg.minList.push(g.minRemaining);
      if (g.h5 !== null) agg.h5List.push(g.h5);
      if (g.weekly !== null) agg.weeklyList.push(g.weekly);
      if (g.h5Reset && (!agg.h5Reset || Date.parse(g.h5Reset) < Date.parse(agg.h5Reset))) {
        agg.h5Reset = g.h5Reset;
      }
      if (g.weeklyReset && (!agg.weeklyReset || Date.parse(g.weeklyReset) < Date.parse(agg.weeklyReset))) {
        agg.weeklyReset = g.weeklyReset;
      }
    }
  }

  const avg = (arr) => (arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  const summaryGroups = [...groupMap.values()]
    .map((agg) => ({
      name: agg.name,
      remaining: avg(agg.minList),
      h5: avg(agg.h5List),
      weekly: avg(agg.weeklyList),
      h5Reset: agg.h5Reset,
      weeklyReset: agg.weeklyReset,
    }))
    .slice(0, 4);

  const primaryRemainings = summaryGroups
    .filter((g) => isPrimaryGroup(g.name) && g.remaining !== null)
    .map((g) => g.remaining);
  const allRemainings = summaryGroups.filter((g) => g.remaining !== null).map((g) => g.remaining);
  const targetPool = primaryRemainings.length > 0 ? primaryRemainings : allRemainings;
  const usedPercent =
    targetPool.length > 0 ? Math.round((1 - Math.min(...targetPool)) * 100) : undefined;

  const currentAcc = activePool.find((a) => a.id === currentId) ?? activePool[0];
  const headerBadge = `${available.length}/${accounts.length} · ${tierBadge(currentAcc)}`;
  const ago = formatAgo(latestUpdate);
  const footerText = ago ? `${source} · ${ago} · 点击翻页` : `${source} · 点击翻页`;

  const page1 = {
    tag: 'div',
    style: { display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '180px', lineHeight: '1.35' },
    children: [
      {
        tag: 'div',
        style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' },
        children: [
          { tag: 'b', style: { fontSize: '15px' }, text: 'Antigravity' },
          { tag: 'span', style: { fontSize: '12px', opacity: '0.78' }, text: headerBadge },
        ],
      },
      ...summaryGroups.map((g) => {
        const pct = g.remaining !== null ? toPct(g.remaining) : 0;
        return {
          tag: 'div',
          style: { display: 'flex', flexDirection: 'column' },
          children: [
            {
              tag: 'div',
              style: { display: 'flex', justifyContent: 'space-between', fontSize: '14px', gap: '10px' },
              children: [
                { tag: 'span', text: g.name },
                { tag: 'b', style: { color: remainingColor(pct) }, text: `${pct}%` },
              ],
            },
            progressBarNode(pct),
          ],
        };
      }),
      {
        tag: 'div',
        style: { fontSize: '12px', opacity: '0.68', textAlign: 'right', marginTop: '2px' },
        text: footerText,
      },
    ],
  };

  const page2 = {
    tag: 'div',
    style: { display: 'flex', flexDirection: 'column', gap: '7px', minWidth: '180px', lineHeight: '1.35' },
    children: [
      {
        tag: 'div',
        style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' },
        children: [
          { tag: 'b', style: { fontSize: '15px' }, text: '窗口与重置' },
          { tag: 'span', style: { fontSize: '12px', opacity: '0.75' }, text: '2/3' },
        ],
      },
      ...summaryGroups.slice(0, 3).map((g) => {
        const parts = [];
        if (g.h5 !== null) {
          const cd = formatResetCountdown(g.h5Reset);
          parts.push(`5h ${toPct(g.h5)}%${cd ? '(' + cd + ')' : ''}`);
        }
        if (g.weekly !== null) {
          const cd = formatResetCountdown(g.weeklyReset);
          parts.push(`周 ${toPct(g.weekly)}%${cd ? '(' + cd + ')' : ''}`);
        }
        return {
          tag: 'div',
          style: { display: 'flex', flexDirection: 'column', gap: '2px' },
          children: [
            { tag: 'b', style: { fontSize: '14px' }, text: g.name },
            {
              tag: 'span',
              style: { fontSize: '13px', opacity: '0.88' },
              text: parts.join(' · ') || '暂无窗口数据',
            },
          ],
        };
      }),
    ],
  };

  const page3 = {
    tag: 'div',
    style: { display: 'flex', flexDirection: 'column', gap: '7px', minWidth: '180px', lineHeight: '1.35' },
    children: [
      {
        tag: 'div',
        style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' },
        children: [
          { tag: 'b', style: { fontSize: '15px' }, text: '账号池明细' },
          { tag: 'span', style: { fontSize: '12px', opacity: '0.75' }, text: '3/3' },
        ],
      },
      ...accounts.slice(0, 4).map((acc) => {
        const isCurrent = acc.id === currentId;
        const ok = isAccountAvailable(acc);
        const label = String(acc.custom_label || acc.name || acc.email?.split('@')[0] || acc.id).slice(0, 48);
        const groups = extractAccountGroups(acc);
        const gGem = groups.find((g) => g.name === 'Gemini')?.minRemaining;
        const gCla = groups.find((g) => g.name === 'Claude·GPT')?.minRemaining;
        const statText = !ok
          ? '不可用'
          : [
              gGem !== null && gGem !== undefined ? `Gemini ${toPct(gGem)}%` : '',
              gCla !== null && gCla !== undefined ? `Claude ${toPct(gCla)}%` : '',
            ]
              .filter(Boolean)
              .join(' · ');
        const minPct =
          !ok
            ? 0
            : toPct(Math.min(...[gGem, gCla].filter((v) => v !== null && v !== undefined), 1));

        return {
          tag: 'div',
          style: { display: 'flex', flexDirection: 'column', gap: '2px' },
          children: [
            {
              tag: 'b',
              style: { fontSize: '14px', opacity: ok ? '1' : '0.55' },
              text: `${isCurrent ? '★' : '·'} ${label}`,
            },
            {
              tag: 'span',
              style: { fontSize: '13px', color: ok ? remainingColor(minPct) : '#ef4444' },
              text: statText || tierBadge(acc),
            },
          ],
        };
      }),
    ],
  };

  return {
    percent: usedPercent,
    views: [page1, page2, page3],
  };
}

/** 将 ISO 重置时间解析为 epoch ms。 */
function parseResetMs(isoStr) {
  if (!isoStr) return undefined;
  const ts = Date.parse(isoStr);
  return Number.isFinite(ts) ? ts : undefined;
}

/** 将 Antigravity 账号池聚合结果投影为 dsh-model-allowance 的标准 BalanceView。 */
function buildModelAllowanceView({ accounts }, consoleUrl) {
  const available = accounts.filter(isAccountAvailable);
  const activePool = available.length > 0 ? available : accounts;
  if (activePool.length === 0) {
    return {
      provider: PROVIDER_ID,
      status: 'failed',
      kind: 'quota',
      error: 'Antigravity 账号池为空',
      ...(consoleUrl ? { consoleUrl } : {}),
    };
  }

  const groupMap = new Map();
  for (const acc of activePool) {
    for (const g of extractAccountGroups(acc)) {
      if (!groupMap.has(g.name)) {
        groupMap.set(g.name, {
          name: g.name,
          minList: [],
          h5List: [],
          weeklyList: [],
          h5Reset: '',
          weeklyReset: '',
        });
      }
      const agg = groupMap.get(g.name);
      if (g.minRemaining !== null) agg.minList.push(g.minRemaining);
      if (g.h5 !== null) agg.h5List.push(g.h5);
      if (g.weekly !== null) agg.weeklyList.push(g.weekly);
      if (g.h5Reset && (!agg.h5Reset || Date.parse(g.h5Reset) < Date.parse(agg.h5Reset))) {
        agg.h5Reset = g.h5Reset;
      }
      if (g.weeklyReset && (!agg.weeklyReset || Date.parse(g.weeklyReset) < Date.parse(agg.weeklyReset))) {
        agg.weeklyReset = g.weeklyReset;
      }
    }
  }

  const avg = (arr) => (arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  const windows = [];

  for (const agg of groupMap.values()) {
    const slug = agg.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'group';
    const h5Avg = avg(agg.h5List);
    const weeklyAvg = avg(agg.weeklyList);

    if (h5Avg !== null) {
      const resetAt = parseResetMs(agg.h5Reset);
      windows.push({
        id: `${slug}-5h`,
        unit: 'hour',
        count: 5,
        label: { zh: `${agg.name} 5小时`, en: `${agg.name} 5h` },
        remainingPercent: toPct(h5Avg),
        ...(resetAt === undefined ? {} : { resetAt }),
      });
    }
    if (weeklyAvg !== null) {
      const resetAt = parseResetMs(agg.weeklyReset);
      windows.push({
        id: `${slug}-weekly`,
        unit: 'week',
        label: { zh: `${agg.name} 周配额`, en: `${agg.name} Weekly` },
        remainingPercent: toPct(weeklyAvg),
        ...(resetAt === undefined ? {} : { resetAt }),
      });
    }
    if (h5Avg === null && weeklyAvg === null) {
      const minAvg = avg(agg.minList);
      if (minAvg !== null) {
        windows.push({
          id: slug,
          unit: 'unknown',
          label: { zh: agg.name, en: agg.name },
          remainingPercent: toPct(minAvg),
        });
      }
    }
  }

  if (windows.length === 0) {
    return {
      provider: PROVIDER_ID,
      status: 'failed',
      kind: 'quota',
      error: 'Antigravity 未返回有效配额窗口',
      ...(consoleUrl ? { consoleUrl } : {}),
    };
  }

  const binding = windows.reduce((cur, cand) => {
    const a = cur?.remainingPercent ?? Number.POSITIVE_INFINITY;
    const b = cand.remainingPercent ?? Number.POSITIVE_INFINITY;
    return b < a ? cand : cur;
  }, undefined);

  return {
    provider: PROVIDER_ID,
    status: 'ready',
    kind: 'quota',
    ...(binding?.remainingPercent === undefined ? {} : { percent: binding.remainingPercent }),
    ...(binding?.resetAt === undefined ? {} : { resetsAt: binding.resetAt }),
    windows,
    ...(consoleUrl ? { consoleUrl } : {}),
    updatedAt: Date.now(),
  };
}

/** 计算与上次已发布读数之间的变化量（与 dsh-model-allowance 的 consumption 结构一致）。 */
function withModelAllowanceConsumption(view, before) {
  if (!before || view.status !== 'ready' || before.status !== 'ready') return view;
  const prevMap = new Map(
    (Array.isArray(before.windows) ? before.windows : [])
      .filter((w) => typeof w.remainingPercent === 'number')
      .map((w) => [w.id, w.remainingPercent]),
  );
  let largest;
  for (const w of Array.isArray(view.windows) ? view.windows : []) {
    const was = prevMap.get(w.id);
    if (was === undefined || typeof w.remainingPercent !== 'number') continue;
    const delta = Math.round((w.remainingPercent - was) * 100) / 100;
    if (largest === undefined || Math.abs(delta) > Math.abs(largest)) largest = delta;
  }
  const finalDelta =
    largest !== undefined
      ? largest
      : typeof view.percent === 'number' && typeof before.percent === 'number'
        ? Math.round((view.percent - before.percent) * 100) / 100
        : undefined;
  if (finalDelta === undefined) return view;
  return {
    ...view,
    consumption: { kind: 'percent', delta: finalDelta, at: Date.now() },
  };
}

/** 非侵入式桥接 dsh-model-allowance 的 BalanceService，卸载时完整还原。 */
function registerModelAllowanceBridge(ctx) {
  ctx.inject(['modelAllowance'], (scoped) => {
    const service = scoped.get('modelAllowance', false);
    const balance = service?.balance;
    if (!balance || typeof balance.read !== 'function' || typeof balance.available !== 'function') {
      return;
    }

    const hasOwnRead = Object.prototype.hasOwnProperty.call(balance, 'read');
    const hasOwnAvailable = Object.prototype.hasOwnProperty.call(balance, 'available');
    const rawRead = balance.read;
    const rawAvailable = balance.available;
    const origRead = rawRead.bind(balance);
    const origAvailable = rawAvailable.bind(balance);

    const publishToListeners = (key, view) => {
      const listeners = balance.listeners?.get?.(key);
      if (!listeners) return;
      for (const fn of listeners) {
        try {
          fn(view);
        } catch (err) {
          console.error('[dsh-pet-antigravity-balance] modelAllowance listener failed', err);
        }
      }
    };

    const queryAntigravityView = async () => {
      const profile = resolveDshProviderProfile(scoped, PROVIDER_ID);
      if (!profile.baseURL) {
        return {
          provider: PROVIDER_ID,
          status: 'unconfigured',
          kind: 'quota',
        };
      }
      let origin = '';
      try {
        origin = extractOrigin(profile.baseURL);
      } catch (err) {
        return {
          provider: PROVIDER_ID,
          status: 'failed',
          kind: 'quota',
          error: err instanceof Error ? err.message : String(err),
        };
      }
      const consoleUrl = resolveConsoleUrl(origin);
      try {
        const pool = await loadAccountPool(scoped, PROVIDER_ID);
        return buildModelAllowanceView(pool, consoleUrl);
      } catch (err) {
        return {
          provider: PROVIDER_ID,
          status: 'failed',
          kind: 'quota',
          error: err instanceof Error ? err.message : String(err),
          consoleUrl,
        };
      }
    };

    balance.read = async (route, options = {}) => {
      if (route !== PROVIDER_ID) {
        return await origRead(route, options);
      }
      const key = PROVIDER_ID;
      const ttlMs = typeof balance.ttlMs === 'number' ? balance.ttlMs : 5 * 60 * 1000;
      const cached = balance.cache?.get?.(key);
      if (!options.force && cached && Date.now() - cached.at < ttlMs) {
        return cached.view;
      }
      if (
        options.force &&
        !options.bypassBackoff &&
        cached &&
        (cached.failures ?? 0) >= MODEL_ALLOWANCE_BACKOFF_MIN_FAILURES &&
        cached.failedAt !== undefined
      ) {
        const backoff = Math.min(ttlMs * 2 ** ((cached.failures ?? 0) - 1), MODEL_ALLOWANCE_MAX_BACKOFF_MS);
        if (Date.now() - cached.failedAt < backoff) {
          return cached.view;
        }
      }

      const pending = balance.inflight?.get?.(key);
      if (pending) return await pending;

      const req = queryAntigravityView()
        .then((view) => {
          const anchor = balance.lastPublished?.get?.(key);
          const published = anchor ? withModelAllowanceConsumption(view, anchor) : view;
          const prior = balance.cache?.get?.(key);
          const failureState =
            view.status === 'failed'
              ? { failures: (prior?.failures ?? 0) + 1, failedAt: Date.now() }
              : view.status === 'ready'
                ? { failures: 0 }
                : { failures: prior?.failures ?? 0, failedAt: prior?.failedAt };
          balance.cache?.set?.(key, { view, at: Date.now(), ...failureState });
          if (view.status === 'ready') balance.lastPublished?.set?.(key, view);
          else balance.lastPublished?.delete?.(key);
          publishToListeners(key, published);
          return published;
        })
        .finally(() => {
          balance.inflight?.delete?.(key);
        });

      balance.inflight?.set?.(key, req);
      return await req;
    };

    balance.available = async () => {
      const list = await origAvailable();
      const idx = list.findIndex(
        (entry) => entry.route === PROVIDER_ID || entry.aliases?.includes?.(PROVIDER_ID),
      );
      if (idx >= 0) {
        const cur = list[idx];
        list[idx] = {
          ...cur,
          name: { zh: 'Antigravity', en: 'Antigravity' },
          color: MODEL_ALLOWANCE_BRAND_COLOR,
        };
        return list;
      }
      const profile = resolveDshProviderProfile(scoped, PROVIDER_ID);
      if (profile.baseURL) {
        list.push({
          route: PROVIDER_ID,
          configured: true,
          name: { zh: 'Antigravity', en: 'Antigravity' },
          color: MODEL_ALLOWANCE_BRAND_COLOR,
        });
      }
      return list;
    };

    const statusService = service?.statusService;
    const hasStatus = Boolean(statusService && typeof statusService.read === 'function');
    const hasOwnStatusRead = hasStatus
      ? Object.prototype.hasOwnProperty.call(statusService, 'read')
      : false;
    const rawStatusRead = hasStatus ? statusService.read : undefined;
    const origStatusRead = hasStatus ? rawStatusRead.bind(statusService) : undefined;

    if (hasStatus) {
      const statusCacheKey = `${PROVIDER_ID}:status`;

      const queryAntigravityStatus = async () => {
        const profile = resolveDshProviderProfile(scoped, PROVIDER_ID);
        if (!profile.baseURL) {
          return { provider: PROVIDER_ID, state: 'unknown' };
        }
        let origin = '';
        try {
          origin = extractOrigin(profile.baseURL);
        } catch (err) {
          return {
            provider: PROVIDER_ID,
            state: 'unknown',
            error: err instanceof Error ? err.message : String(err),
            updatedAt: Date.now(),
          };
        }
        const healthUrl = 'https://aistudio.google.com/status';
        try {
          const pool = await loadAccountPool(scoped, PROVIDER_ID);
          const total = pool.accounts.length;
          const avail = pool.accounts.filter(isAccountAvailable).length;
          if (avail === total && total > 0) {
            return {
              provider: PROVIDER_ID,
              state: 'operational',
              url: healthUrl,
              updatedAt: Date.now(),
            };
          }
          if (avail > 0) {
            return {
              provider: PROVIDER_ID,
              state: 'degraded',
              summary: `${avail}/${total} 账号可用`,
              url: healthUrl,
              updatedAt: Date.now(),
            };
          }
          return {
            provider: PROVIDER_ID,
            state: 'major-outage',
            summary: '无可用账号',
            url: healthUrl,
            updatedAt: Date.now(),
          };
        } catch (err) {
          const reason = err instanceof Error ? err.message : String(err);
          return {
            provider: PROVIDER_ID,
            state: 'major-outage',
            summary: reason,
            url: healthUrl,
            updatedAt: Date.now(),
          };
        }
      };

      statusService.read = async (provider) => {
        if (provider !== PROVIDER_ID) {
          return await origStatusRead(provider);
        }
        const ttlMs = typeof statusService.ttlMs === 'number' ? statusService.ttlMs : 60 * 1000;
        const failureTtlMs =
          typeof statusService.failureTtlMs === 'number' ? statusService.failureTtlMs : 30 * 1000;
        const cached = statusService.cache?.get?.(statusCacheKey);
        if (cached) {
          const ttl = cached.failed ? failureTtlMs : ttlMs;
          if (Date.now() - cached.at < ttl) return { ...cached.view, provider: PROVIDER_ID };
        }
        const pending = statusService.inflight?.get?.(statusCacheKey);
        if (pending) return { ...(await pending), provider: PROVIDER_ID };

        const req = queryAntigravityStatus()
          .then((view) => {
            const failed = view.state !== 'operational';
            statusService.cache?.set?.(statusCacheKey, { view, at: Date.now(), failed });
            return view;
          })
          .finally(() => {
            statusService.inflight?.delete?.(statusCacheKey);
          });
        statusService.inflight?.set?.(statusCacheKey, req);
        return await req;
      };
    }

    scoped.effect(() => () => {
      if (hasOwnRead) balance.read = rawRead;
      else delete balance.read;
      if (hasOwnAvailable) balance.available = rawAvailable;
      else delete balance.available;
      balance.invalidate?.(PROVIDER_ID);
      if (hasStatus) {
        if (hasOwnStatusRead) statusService.read = rawStatusRead;
        else delete statusService.read;
        statusService.cache?.delete?.(`${PROVIDER_ID}:status`);
      }
    });
  });
}

/** 读取 HTTP 请求体 JSON。 */
async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  return raw ? JSON.parse(raw) : {};
}

/** 发送 JSON 响应。 */
function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(body);
}

/** 注册设置页所需的后端路由（状态查询 / 保存清除密钥 / 连接测试）。 */
function registerSettingsRoutes(ctx) {
  const webServer = ctx.get('webServer', false);
  if (!webServer?.register) return;

  ctx.effect(() =>
    webServer.register({
      kind: 'prefix',
      path: SETTINGS_API_PREFIX,
      async handler(req, res) {
        try {
          const url = new URL(req.url || '/', 'http://127.0.0.1');
          const sub = url.pathname.slice(SETTINGS_API_PREFIX.length).replace(/^\/+/, '');
          const method = (req.method || 'GET').toUpperCase();

          // GET /status：查询配置状态（绝不返回明文密钥）
          if (sub === 'status' && method === 'GET') {
            const profile = resolveDshProviderProfile(ctx, PROVIDER_ID);
            let origin = '';
            try {
              origin = profile.baseURL ? extractOrigin(profile.baseURL) : '';
            } catch {
              origin = profile.baseURL || '';
            }

            const credentials = ctx.get('credentials', false);
            let adminConfigured = false;
            let adminSource = '';
            if (credentials?.describe) {
              try {
                const info = await credentials.describe(ADMIN_KEY_ENV);
                adminConfigured = Boolean(info?.configured);
                adminSource = info?.source || '';
              } catch {
                // ignore
              }
            }
            if (!adminConfigured && process.env[ADMIN_KEY_ENV]) {
              adminConfigured = true;
              adminSource = 'env';
            }

            return sendJson(res, 200, {
              ok: true,
              providerId: PROVIDER_ID,
              origin,
              adminKeyEnv: ADMIN_KEY_ENV,
              adminConfigured,
              adminSource,
              fallbackKeyEnv: profile.apiKeyEnv || DEFAULT_API_KEY_ENV,
              consoleAppPath: getConsoleAppPath(),
            });
          }

          // POST /console-app：保存或清除 Antigravity Tools 本地程序路径
          if (sub === 'console-app' && method === 'POST') {
            const body = await readJsonBody(req);
            if (body?.clear) {
              writePluginConfig({ consoleAppPath: '' });
              ctx.get('modelAllowance', false)?.balance?.invalidate?.(PROVIDER_ID);
              return sendJson(res, 200, { ok: true, cleared: true, consoleAppPath: '' });
            }
            const rawPath = typeof body?.path === 'string' ? body.path.trim().replace(/^"(.*)"$/, '$1') : '';
            if (!rawPath) {
              writePluginConfig({ consoleAppPath: '' });
              ctx.get('modelAllowance', false)?.balance?.invalidate?.(PROVIDER_ID);
              return sendJson(res, 200, { ok: true, cleared: true, consoleAppPath: '' });
            }
            if (!fs.existsSync(rawPath)) {
              return sendJson(res, 400, { ok: false, error: `路径不存在：${rawPath}` });
            }
            writePluginConfig({ consoleAppPath: rawPath });
            ctx.get('modelAllowance', false)?.balance?.invalidate?.(PROVIDER_ID);
            return sendJson(res, 200, { ok: true, saved: true, consoleAppPath: rawPath });
          }

          // POST /pick-console-app：弹出系统文件选择框选取 Antigravity Tools
          if (sub === 'pick-console-app' && method === 'POST') {
            const picked = await pickConsoleAppPath(getConsoleAppPath());
            return sendJson(res, 200, { ok: true, path: picked });
          }

          // POST / GET /open-console：拉起已配置的 Antigravity Tools 程序
          if (sub === 'open-console' && (method === 'POST' || method === 'GET')) {
            const launched = launchConsoleApp(getConsoleAppPath());
            return sendJson(res, 200, { ok: true, launched });
          }

          // POST /key：保存或清除 ANTIGRAVITY_ADMIN_KEY（同时写入 DSH 凭证与当前进程环境变量）
          if (sub === 'key' && method === 'POST') {
            const body = await readJsonBody(req);
            const credentials = ctx.get('credentials', false);

            if (body?.clear) {
              if (credentials?.unset) await credentials.unset(ADMIN_KEY_ENV);
              delete process.env[ADMIN_KEY_ENV];
              ctx.get('modelAllowance', false)?.balance?.invalidate?.(PROVIDER_ID);
              return sendJson(res, 200, { ok: true, cleared: true });
            }

            const value = typeof body?.value === 'string' ? body.value.trim() : '';
            if (!value) {
              return sendJson(res, 400, { ok: false, error: '请输入有效的 ANTIGRAVITY_ADMIN_KEY' });
            }

            if (credentials?.set) {
              await credentials.set(ADMIN_KEY_ENV, value);
            }
            process.env[ADMIN_KEY_ENV] = value;
            ctx.get('modelAllowance', false)?.balance?.invalidate?.(PROVIDER_ID);
            return sendJson(res, 200, { ok: true, saved: true });
          }

          // POST /test：立刻测试一次连接并回传结果摘要
          if (sub === 'test' && method === 'POST') {
            const pool = await loadAccountPool(ctx, PROVIDER_ID);
            const available = pool.accounts.filter(isAccountAvailable);
            const built = buildCustomBalance(pool);
            return sendJson(res, 200, {
              ok: true,
              totalAccounts: pool.accounts.length,
              availableAccounts: available.length,
              usedPercent: built.percent,
            });
          }

          return sendJson(res, 404, { ok: false, error: 'Not found' });
        } catch (e) {
          return sendJson(res, 500, {
            ok: false,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      },
    }),
  );
}

export function apply(ctx) {
  // 0. 等待 webServer 就绪后再注册设置页后端路由（避免启动顺序导致 404）
  ctx.inject(['webServer'], (scoped) => {
    registerSettingsRoutes(scoped);
  });

  // 启动时将已存储的 ANTIGRAVITY_ADMIN_KEY 同步到当前进程环境变量
  void resolveSingleCredential(ctx, ADMIN_KEY_ENV).then((val) => {
    if (val && !process.env[ADMIN_KEY_ENV]) {
      process.env[ADMIN_KEY_ENV] = val;
    }
  });

  // 1. 适配 dsh-pet 桌宠余额气泡（可选，安装 dsh-pet 时自动挂载）
  ctx.inject(['petApi7340'], (scoped) => {
    const balance = scoped.get('petApi7340', false)?.balance;
    if (!balance) return;

    scoped.effect(() =>
      balance.register({
        id: PROVIDER_ID,
        async fetch({ provider }) {
          const pool = await loadAccountPool(scoped, provider);
          const data = buildCustomBalance(pool);
          return {
            ok: true,
            provider,
            shape: 'custom',
            data,
          };
        },
      }),
    );
  });

  // 2. 适配 dsh-model-allowance 输入框额度卡片（可选，安装 dsh-model-allowance 时自动挂载）
  registerModelAllowanceBridge(ctx);
}
