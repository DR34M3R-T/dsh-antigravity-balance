/**
 * dsh-antigravity-balance —— 浏览器设置页与图标适配（零构建）
 *
 * 1. 注册到 DSH「设置」左侧导航栏「Antigravity 余额」，用于配置 ANTIGRAVITY_ADMIN_KEY
 *    并写入 DSH 凭证存储与进程环境变量；
 * 2. 为 dsh-model-allowance 的 Antigravity 切换栏与菜单项注入专属矢量小图标。
 */
window.__ModuleLoader__.load({
  id: 'dsh-antigravity-balance',
  factory: (require) => {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useCallback } = React;

    const API = '/api/antigravity-balance';
    const AGY_ICON_SVG = encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="12 17 87 80" fill="none">' +
        '<path d="M89.6992 93.695C94.3659 97.195 101.366 94.8617 94.9492 88.445C75.6992 69.7783 79.7825 18.445 55.8659 18.445C31.9492 18.445 36.0325 69.7783 16.7825 88.445C9.78251 95.445 17.3658 97.195 22.0325 93.695C40.1159 81.445 38.9492 59.8617 55.8659 59.8617C72.7825 59.8617 71.6159 81.445 89.6992 93.695Z" fill="#3186FF"/>' +
        '<mask id="ag_fav_m" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="13" y="18" width="85" height="78">' +
        '<path d="M89.6992 93.695C94.3659 97.195 101.366 94.8617 94.9492 88.445C75.6992 69.7783 79.7825 18.445 55.8659 18.445C31.9492 18.445 36.0325 69.7783 16.7825 88.445C9.78251 95.445 17.3658 97.195 22.0325 93.695C40.1159 81.445 38.9492 59.8617 55.8659 59.8617C72.7825 59.8617 71.6159 81.445 89.6992 93.695Z" fill="black"/>' +
        '</mask>' +
        '<g mask="url(#ag_fav_m)">' +
        '<g filter="url(#ag_fav_f0)"><ellipse cx="22.7873" cy="26.8098" rx="22.7873" ry="26.8098" transform="matrix(-0.112784 0.99362 -0.99362 -0.112781 66.2473 -15.5344)" fill="#FFE432"/></g>' +
        '<g filter="url(#ag_fav_f1)"><ellipse cx="96.491" cy="35.1231" rx="29.5007" ry="30.1492" transform="rotate(76.9243 96.491 35.1231)" fill="#FC413D"/></g>' +
        '<g filter="url(#ag_fav_f2)"><ellipse cx="9.02988" cy="41.6647" rx="30.832" ry="39.9417" transform="rotate(74.1257 9.02988 41.6647)" fill="#00B95C"/></g>' +
        '<g filter="url(#ag_fav_f3)"><ellipse cx="11.2212" cy="42.8915" rx="30.22" ry="33.2695" transform="rotate(45.6065 11.2212 42.8915)" fill="#00B95C"/></g>' +
        '<g filter="url(#ag_fav_f4)"><ellipse cx="75.7546" cy="104.822" rx="29.0177" ry="27.943" transform="rotate(76.9243 75.7546 104.822)" fill="#3186FF"/></g>' +
        '<g filter="url(#ag_fav_f5)"><ellipse cx="33.5661" cy="35.4043" rx="33.5661" ry="35.4043" transform="matrix(-0.409539 0.912293 -0.912294 -0.409537 101.25 -15.1674)" fill="#FBBC04"/></g>' +
        '<g filter="url(#ag_fav_f6)"><path d="M2.56802 149.695C-15.8116 142.48 15.5987 83.1163 23.4093 63.2203C31.22 43.3244 52.4514 33.0447 70.831 40.26C89.2107 47.4753 110.996 87.2162 103.185 107.112C95.3742 127.008 20.9477 156.91 2.56802 149.695Z" fill="#3186FF"/></g>' +
        '<g filter="url(#ag_fav_f7)"><path d="M113.934 75.8079C109.013 81.5509 96.1724 78.6224 85.253 69.2667C74.3335 59.911 69.4704 47.6711 74.391 41.928C79.3116 36.185 92.1525 39.1136 103.072 48.4692C113.991 57.8249 118.855 70.0648 113.934 75.8079Z" fill="#749BFF"/></g>' +
        '<g filter="url(#ag_fav_f8)"><ellipse cx="92.611" cy="23.7962" rx="44.2411" ry="27.5016" transform="rotate(34.0763 92.611 23.7962)" fill="#FC413D"/></g>' +
        '<g filter="url(#ag_fav_f9)"><ellipse cx="23.4949" cy="29.5887" rx="23.7071" ry="13.7869" transform="rotate(112.516 23.4949 29.5887)" fill="#FFEE48"/></g>' +
        '</g>' +
        '<defs>' +
        '<filter id="ag_fav_f0" x="2.49348" y="-26.5423" width="69.0899" height="61.2525" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="3.89034"/></filter>' +
        '<filter id="ag_fav_f1" x="28.7524" y="-32.0333" width="135.477" height="134.313" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="18.8078"/></filter>' +
        '<filter id="ag_fav_f2" x="-62.2884" y="-21.9253" width="142.637" height="127.18" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="15.9884"/></filter>' +
        '<filter id="ag_fav_f3" x="-52.5697" y="-20.8346" width="127.582" height="127.452" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="15.9884"/></filter>' +
        '<filter id="ag_fav_f4" x="17.3619" y="45.4646" width="116.786" height="118.715" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="15.1937"/></filter>' +
        '<filter id="ag_fav_f5" x="-7.44765" y="-60.4737" width="125.303" height="122.858" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="13.7698"/></filter>' +
        '<filter id="ag_fav_f6" x="-27.7086" y="13.3597" width="157.119" height="162.029" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="12.297"/></filter>' +
        '<filter id="ag_fav_f7" x="50.4638" y="16.981" width="87.3973" height="83.7738" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="11.0036"/></filter>' +
        '<filter id="ag_fav_f8" x="34.2604" y="-28.457" width="116.701" height="104.506" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="9.29385"/></filter>' +
        '<filter id="ag_fav_f9" x="-15.1522" y="-15.9493" width="77.2941" height="91.076" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="11.5027"/></filter>' +
        '</defs>' +
        '</svg>',
    );

    async function requestJson(path, options) {
      const res = await fetch(API + path, {
        credentials: 'same-origin',
        ...options,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      return data;
    }

    const CSS = `
[data-agb-page]{display:flex;flex-direction:column;gap:16px;padding:4px 2px 12px;max-width:560px;}
[data-agb-title]{font-size:15px;font-weight:600;}
[data-agb-desc]{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#9aa0a6);}
[data-agb-card]{display:flex;flex-direction:column;gap:12px;padding:14px;border-radius:10px;border:1px solid var(--dsw-alias-border-primary,rgba(128,128,128,0.22));background:var(--dsw-alias-bg-secondary,rgba(128,128,128,0.06));}
[data-agb-row]{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
[data-agb-kv]{display:flex;justify-content:space-between;align-items:center;font-size:12px;gap:12px;}
[data-agb-k]{color:var(--dsw-alias-label-tertiary,#9aa0a6);}
[data-agb-v]{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;word-break:break-all;}
[data-agb-input]{flex:1;min-width:220px;height:34px;padding:0 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-primary,rgba(128,128,128,0.3));background:var(--dsw-alias-bg-primary,transparent);color:inherit;font-size:13px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;outline:none;}
[data-agb-btn]{height:34px;padding:0 14px;border-radius:8px;border:1px solid var(--dsw-alias-border-primary,rgba(128,128,128,0.3));background:transparent;color:inherit;font-size:12px;cursor:pointer;}
[data-agb-btn][data-primary="1"]{background:#2563eb;border-color:#2563eb;color:#fff;font-weight:600;}
[data-agb-btn]:disabled{opacity:0.5;cursor:not-allowed;}
[data-agb-msg]{font-size:12px;line-height:18px;padding:8px 10px;border-radius:8px;}
[data-agb-msg][data-kind="ok"]{background:rgba(34,197,94,0.12);color:#22c55e;}
[data-agb-msg][data-kind="err"]{background:rgba(239,68,68,0.12);color:#ef4444;}
.dsh-model-allowance-tab[aria-label="Antigravity"] .dsh-model-allowance-tab-letter,
.dsh-model-allowance-tab[title="Antigravity"] .dsh-model-allowance-tab-letter{font-size:0!important;color:transparent!important;display:inline-block;width:14px;height:14px;background:url("data:image/svg+xml,${AGY_ICON_SVG}") center/contain no-repeat;}
.dsh-model-allowance-menu-mark[style*="#4285f4"] .dsh-model-allowance-tab-letter,
.dsh-model-allowance-menu-mark[style*="#4285F4"] .dsh-model-allowance-tab-letter,
.dsh-model-allowance-menu-mark[style*="rgb(66, 133, 244)"] .dsh-model-allowance-tab-letter{font-size:0!important;color:transparent!important;display:inline-block;width:12px;height:12px;background:url("data:image/svg+xml,${AGY_ICON_SVG}") center/contain no-repeat;}
`;

    function Panel() {
      const [status, setStatus] = useState(null);
      const [keyInput, setKeyInput] = useState('');
      const [showKey, setShowKey] = useState(false);
      const [busy, setBusy] = useState(false);
      const [msg, setMsg] = useState(null);
      const [appPath, setAppPath] = useState('');
      const [appBusy, setAppBusy] = useState(false);
      const [appMsg, setAppMsg] = useState(null);

      const loadStatus = useCallback(async () => {
        try {
          const data = await requestJson('/status');
          setStatus(data);
          setAppPath(data?.consoleAppPath || '');
        } catch (e) {
          setMsg({ kind: 'err', text: '读取状态失败：' + (e.message || String(e)) });
        }
      }, []);

      useEffect(() => {
        void loadStatus();
      }, [loadStatus]);

      const onSave = async () => {
        const val = keyInput.trim();
        if (!val) {
          setMsg({ kind: 'err', text: '请先输入 ANTIGRAVITY_ADMIN_KEY' });
          return;
        }
        setBusy(true);
        setMsg(null);
        try {
          await requestJson('/key', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ value: val }),
          });
          setKeyInput('');
          await loadStatus();
          setMsg({
            kind: 'ok',
            text: '已保存至 DSH 凭证存储并写入当前环境变量 ANTIGRAVITY_ADMIN_KEY，可直接点击「测试连接」验证。',
          });
        } catch (e) {
          setMsg({ kind: 'err', text: '保存失败：' + (e.message || String(e)) });
        } finally {
          setBusy(false);
        }
      };

      const onClear = async () => {
        setBusy(true);
        setMsg(null);
        try {
          await requestJson('/key', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ clear: true }),
          });
          setKeyInput('');
          await loadStatus();
          setMsg({ kind: 'ok', text: '已清除 ANTIGRAVITY_ADMIN_KEY。' });
        } catch (e) {
          setMsg({ kind: 'err', text: '清除失败：' + (e.message || String(e)) });
        } finally {
          setBusy(false);
        }
      };

      const onTest = async () => {
        setBusy(true);
        setMsg(null);
        try {
          const res = await requestJson('/test', { method: 'POST' });
          setMsg({
            kind: 'ok',
            text: `连接成功！共 ${res.totalAccounts} 个账号（可用 ${res.availableAccounts} 个），主分组已用约 ${res.usedPercent ?? 0}%。`,
          });
        } catch (e) {
          setMsg({ kind: 'err', text: '连接失败：' + (e.message || String(e)) });
        } finally {
          setBusy(false);
        }
      };

      const onPickApp = async () => {
        setAppBusy(true);
        setAppMsg(null);
        try {
          const res = await requestJson('/pick-console-app', { method: 'POST' });
          if (res?.path) {
            setAppPath(res.path);
            const saved = await requestJson('/console-app', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ path: res.path }),
            });
            setStatus((prev) => (prev ? { ...prev, consoleAppPath: saved.consoleAppPath || res.path } : prev));
            setAppMsg({ kind: 'ok', text: '已选择并保存路径，点击 Model Allowance 控制台按钮即可直接拉起程序。' });
          }
        } catch (e) {
          setAppMsg({ kind: 'err', text: '选择程序失败：' + (e.message || String(e)) });
        } finally {
          setAppBusy(false);
        }
      };

      const onSaveApp = async () => {
        setAppBusy(true);
        setAppMsg(null);
        try {
          const res = await requestJson('/console-app', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ path: appPath.trim() }),
          });
          setAppPath(res.consoleAppPath || '');
          setStatus((prev) => (prev ? { ...prev, consoleAppPath: res.consoleAppPath || '' } : prev));
          setAppMsg({
            kind: 'ok',
            text: res.consoleAppPath
              ? '已保存程序路径，点击 Model Allowance 控制台按钮将直接拉起该程序。'
              : '已清空路径，点击控制台按钮将恢复为打开管理网页。',
          });
        } catch (e) {
          setAppMsg({ kind: 'err', text: '保存路径失败：' + (e.message || String(e)) });
        } finally {
          setAppBusy(false);
        }
      };

      const onClearApp = async () => {
        setAppBusy(true);
        setAppMsg(null);
        try {
          await requestJson('/console-app', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ clear: true }),
          });
          setAppPath('');
          setStatus((prev) => (prev ? { ...prev, consoleAppPath: '' } : prev));
          setAppMsg({ kind: 'ok', text: '已清除程序路径，控制台按钮将恢复为打开网页。' });
        } catch (e) {
          setAppMsg({ kind: 'err', text: '清除失败：' + (e.message || String(e)) });
        } finally {
          setAppBusy(false);
        }
      };

      const onLaunchApp = async () => {
        setAppBusy(true);
        setAppMsg(null);
        try {
          const res = await requestJson('/open-console', { method: 'POST' });
          setAppMsg({ kind: 'ok', text: '已触发启动：' + (res.launched || appPath) });
        } catch (e) {
          setAppMsg({ kind: 'err', text: '启动失败：' + (e.message || String(e)) });
        } finally {
          setAppBusy(false);
        }
      };

      const configuredText = status
        ? status.adminConfigured
          ? `已配置（来源：${status.adminSource || 'credentials'}）`
          : `未配置（当前回落 ${status.fallbackKeyEnv || 'ANTIGRAVITY_API_KEY'}）`
        : '加载中…';

      return h(
        'div',
        { 'data-agb-page': '1' },
        h('div', { 'data-agb-title': '1' }, 'Antigravity 余额展示'),
        h(
          'div',
          { 'data-agb-desc': '1' },
          'Antigravity-Manager 的 /api/accounts 管理接口仅接受主 API Key 或 Web 管理密码（不接受「用户 Token」）。在此填写 ANTIGRAVITY_ADMIN_KEY 后会安全写入 DSH 凭证存储并同步环境变量，不影响聊天继续使用你的用户 Token 统计用量。',
        ),
        h(
          'div',
          { 'data-agb-card': '1' },
          h(
            'div',
            { 'data-agb-kv': '1' },
            h('span', { 'data-agb-k': '1' }, '管理接口基址（来自 DSH antigravity baseURL）'),
            h('span', { 'data-agb-v': '1' }, status?.origin || '未检测到'),
          ),
          h(
            'div',
            { 'data-agb-kv': '1' },
            h('span', { 'data-agb-k': '1' }, 'ANTIGRAVITY_ADMIN_KEY 状态'),
            h('span', { 'data-agb-v': '1' }, configuredText),
          ),
        ),
        h(
          'div',
          { 'data-agb-card': '1' },
          h('div', { style: { fontSize: '13px', fontWeight: 600 } }, '设置 ANTIGRAVITY_ADMIN_KEY'),
          h(
            'div',
            { 'data-agb-row': '1' },
            h('input', {
              'data-agb-input': '1',
              type: showKey ? 'text' : 'password',
              placeholder: '粘贴 Antigravity-Manager「API 反代」主 API Key 或管理密码',
              value: keyInput,
              disabled: busy,
              onChange: (e) => setKeyInput(e.target.value),
              onKeyDown: (e) => {
                if (e.key === 'Enter') void onSave();
              },
            }),
            h(
              'button',
              {
                'data-agb-btn': '1',
                type: 'button',
                disabled: busy,
                onClick: () => setShowKey((v) => !v),
              },
              showKey ? '隐藏' : '显示',
            ),
          ),
          h(
            'div',
            { 'data-agb-row': '1' },
            h(
              'button',
              {
                'data-agb-btn': '1',
                'data-primary': '1',
                type: 'button',
                disabled: busy || !keyInput.trim(),
                onClick: onSave,
              },
              busy ? '处理中…' : '保存',
            ),
            h(
              'button',
              {
                'data-agb-btn': '1',
                type: 'button',
                disabled: busy,
                onClick: onTest,
              },
              '测试连接',
            ),
            h(
              'button',
              {
                'data-agb-btn': '1',
                type: 'button',
                disabled: busy || !status?.adminConfigured,
                onClick: onClear,
              },
              '清除',
            ),
          ),
          msg ? h('div', { 'data-agb-msg': '1', 'data-kind': msg.kind }, msg.text) : null,
        ),
        h(
          'div',
          { 'data-agb-card': '1' },
          h('div', { style: { fontSize: '13px', fontWeight: 600 } }, '控制台快捷启动（Antigravity Tools）'),
          h(
            'div',
            { 'data-agb-desc': '1' },
            '配置 Antigravity Tools 的 .exe 或快捷方式路径后，点击 Model Allowance 卡片里的控制台按钮将直接拉起该程序；留空则打开管理网页。',
          ),
          h(
            'div',
            { 'data-agb-row': '1' },
            h('input', {
              'data-agb-input': '1',
              type: 'text',
              placeholder: '选择或粘贴 Antigravity Tools.exe 路径（留空则打开网页）',
              value: appPath,
              disabled: appBusy,
              onChange: (e) => setAppPath(e.target.value),
              onKeyDown: (e) => {
                if (e.key === 'Enter') void onSaveApp();
              },
            }),
            h(
              'button',
              {
                'data-agb-btn': '1',
                type: 'button',
                disabled: appBusy,
                onClick: onPickApp,
              },
              '选择程序…',
            ),
          ),
          h(
            'div',
            { 'data-agb-row': '1' },
            h(
              'button',
              {
                'data-agb-btn': '1',
                'data-primary': '1',
                type: 'button',
                disabled: appBusy,
                onClick: onSaveApp,
              },
              appBusy ? '处理中…' : '保存路径',
            ),
            h(
              'button',
              {
                'data-agb-btn': '1',
                type: 'button',
                disabled: appBusy || !status?.consoleAppPath,
                onClick: onLaunchApp,
              },
              '测试拉起',
            ),
            h(
              'button',
              {
                'data-agb-btn': '1',
                type: 'button',
                disabled: appBusy || (!status?.consoleAppPath && !appPath.trim()),
                onClick: onClearApp,
              },
              '清除',
            ),
          ),
          appMsg ? h('div', { 'data-agb-msg': '1', 'data-kind': appMsg.kind }, appMsg.text) : null,
        ),
      );
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        const style = document.createElement('style');
        style.setAttribute('data-plugin-css', 'dsh-antigravity-balance');
        style.textContent = CSS;
        document.head.appendChild(style);
        ctx.effect(() => () => style.remove());

        const onConsoleClick = (event) => {
          const target = event.target;
          if (!target || typeof target.closest !== 'function') return;
          const anchor = target.closest('a[href]');
          if (!anchor) return;
          const href = anchor.getAttribute('href') || '';
          if (href !== `${API}/open-console` && !href.endsWith(`${API}/open-console`)) return;
          event.preventDefault();
          event.stopPropagation();
          void fetch(`${API}/open-console`, {
            method: 'POST',
            credentials: 'same-origin',
          }).catch((err) => {
            console.error('[dsh-antigravity-balance] open-console failed', err);
          });
        };
        document.addEventListener('click', onConsoleClick, true);
        ctx.effect(() => () => document.removeEventListener('click', onConsoleClick, true));

        const slots = (typeof ctx.get === 'function' ? ctx.get('slots') : undefined) || ctx.slots;
        if (!slots) return;
        slots.inject('settings.section', () =>
          slots.register(
            { name: 'settings.section', id: 'antigravity-balance', order: 45, label: 'Antigravity 余额' },
            () => h(Panel),
          ),
        );
      },
    };
  },
});
