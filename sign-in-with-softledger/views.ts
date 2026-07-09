// Server-rendered views. The layout carries the persistent "Signed in with
// SoftLedger" header so it's always visible that the session came from the
// SoftLedger login, not a partner-app account.

import type { JWTPayload } from 'jose';

export const PARTNER_APP_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#1E3A5F"/>
  <rect x="26" y="70" width="17" height="32" rx="3" fill="#7FA8CF"/>
  <rect x="52" y="56" width="17" height="46" rx="3" fill="#B7D0E8"/>
  <rect x="78" y="40" width="17" height="62" rx="3" fill="#FFFFFF"/>
  <path d="M28 52 L58 38 L74 44 L100 24" stroke="#F4B942" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M88 20 L104 22 L100 36 Z" fill="#F4B942"/>
</svg>`;

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const CSS = `
  * { box-sizing: border-box; margin: 0; }
  body { font: 14px/1.5 -apple-system, 'Segoe UI', Roboto, sans-serif; background: #f4f6f8; color: #1a2733; }
  header { background: #1E3A5F; color: #fff; }
  .bar { max-width: 900px; margin: 0 auto; padding: 10px 24px; display: flex; align-items: center; gap: 12px; }
  .bar img { width: 34px; height: 34px; border-radius: 8px; }
  .bar .name { font-weight: 700; font-size: 16px; }
  nav { margin-left: 18px; display: flex; gap: 4px; }
  nav a { color: #cfdcec; text-decoration: none; padding: 6px 12px; border-radius: 6px; font-size: 13px; }
  nav a.on { background: rgba(255,255,255,.16); color: #fff; font-weight: 600; }
  .who { margin-left: auto; display: flex; align-items: center; gap: 10px; font-size: 12px; }
  .chip { background: #fff; color: #1E3A5F; border-radius: 99px; padding: 3px 12px; font-weight: 700; white-space: nowrap; }
  .who a { color: #cfdcec; }
  main { max-width: 900px; margin: 0 auto; padding: 24px; }
  .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin-bottom: 18px; }
  .card h2 { font-size: 17px; margin-bottom: 4px; }
  .card .sub { color: #64748b; font-size: 13px; margin-bottom: 14px; }
  .callout { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 10px 14px; font-size: 13px; margin-bottom: 14px; }
  button.go { background: #1E3A5F; color: #fff; border: none; cursor: pointer; padding: 10px 18px; border-radius: 8px; font-weight: 600; font-size: 14px; }
  button.go:disabled { opacity: .6; cursor: wait; }
  table { border-collapse: collapse; width: 100%; margin-top: 14px; }
  th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #eef2f6; font-size: 13px; }
  th { background: #f8fafc; color: #475569; font-size: 12px; }
  td code { font-size: 12px; word-break: break-all; }
  .muted { color: #64748b; font-size: 12px; margin-top: 10px; }
  .links { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .links a.card { display: block; text-decoration: none; color: inherit; margin: 0; }
  .links a.card:hover { border-color: #1E3A5F; }
  .status { font-size: 13px; color: #64748b; margin-top: 12px; }
  .up { color: #047857; } .down { color: #b91c1c; }
`;

export const layout = (title: string, active: string, claims: JWTPayload, body: string) => {
  const who = esc((claims.email as string) ?? claims.sub);
  const tab = (href: string, label: string) =>
    `<a href="${href}" class="${active === href ? 'on' : ''}">${label}</a>`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <link rel="icon" type="image/svg+xml" href="/logo.svg">
  <style>${CSS}</style>
</head>
<body>
  <header><div class="bar">
    <img src="/logo.svg" alt="Partner App">
    <span class="name">Partner App</span>
    <nav>
      ${tab('/', 'Dashboard')}
      ${tab('/identity', 'Identity')}
      ${tab('/market-data', 'Market Data')}
    </nav>
    <span class="who">
      <span class="chip">Signed in with SoftLedger</span>
      <span>${who}</span>
      <a href="/auth/logout">Sign out</a>
    </span>
  </div></header>
  <main>${body}</main>
</body>
</html>`;
};

export const dashboardPage = (claims: JWTPayload) =>
  layout(
    'Partner App — Dashboard',
    '/',
    claims,
    `
  <div class="card">
    <h2>Chart of accounts — live from SoftLedger</h2>
    <p class="sub">Tenant <code>${esc(claims.org_id)}</code></p>
    <div class="callout">
      This queries the <b>SoftLedger API</b> using the <b>same login token</b> you got by
      signing in with SoftLedger — this app holds no separate SoftLedger credential.
    </div>
    <button class="go" id="query-btn">Query the SoftLedger API</button>
    <div id="result"></div>
  </div>
  <div class="links">
    <a class="card" href="/identity"><h2>Identity</h2>
      <p class="sub">The verified id_token claims behind this session.</p></a>
    <a class="card" href="/market-data"><h2>Market Data</h2>
      <p class="sub">A keyless public market-data API behind the same login gate.</p></a>
  </div>
  <script>
    const btn = document.getElementById('query-btn');
    const out = document.getElementById('result');
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      out.innerHTML = '<p class="status">GET /api/ledger-accounts → SoftLedger /v2/ledger-accounts (Bearer: your login token)…</p>';
      try {
        const res = await fetch('/api/ledger-accounts');
        if (!res.ok) throw new Error('SoftLedger API returned ' + res.status);
        const body = await res.json();
        const rows = body.data ?? body;
        out.innerHTML = '<table><tr><th>Number</th><th>Name</th><th>Type</th><th>Subtype</th></tr>' +
          rows.map((a) => '<tr><td>' + [a.number, a.name, a.type, a.subtype]
            .map((v) => String(v ?? '—').replace(/</g, '&lt;')).join('</td><td>') + '</td></tr>').join('') +
          '</table><p class="muted">' + rows.length + ' accounts, scoped to your tenant and your permissions ∩ the app\\u2019s grant.</p>';
      } catch (err) {
        out.innerHTML = '<p class="status">Failed: ' + err.message + '</p>';
      } finally {
        btn.disabled = false;
      }
    });
  </script>`,
  );

export const identityPage = (claims: JWTPayload) =>
  layout(
    'Partner App — Identity',
    '/identity',
    claims,
    `
  <div class="card">
    <h2>Who SoftLedger says you are</h2>
    <p class="sub">
      These are the <b>id_token</b> claims issued by SoftLedger when you signed in with
      SoftLedger — verified at login (signature, issuer, audience, nonce). This app created no
      account and stored no password; this assertion <i>is</i> the identity.
    </p>
    <table>
      <tr><th>Claim</th><th>Value</th></tr>
      ${Object.entries(claims)
        .map(
          ([k, v]) =>
            `<tr><td><code>${esc(k)}</code></td><td><code>${esc(JSON.stringify(v))}</code></td></tr>`,
        )
        .join('')}
    </table>
    <p class="muted">Tenant context = <code>org_id</code> (the SoftLedger organization).</p>
  </div>`,
  );

export const marketDataPage = (claims: JWTPayload) =>
  layout(
    'Partner App — Market Data',
    '/market-data',
    claims,
    `
  <div class="card">
    <h2>Market data — no SoftLedger involved</h2>
    <p class="sub">
      For contrast: this button calls a keyless public market-data API (Yahoo Finance).
      The only auth here is this app's own login gate — the SoftLedger token is not used.
    </p>
    <button class="go" id="markets-btn">Fetch market indices</button>
    <div id="markets"></div>
  </div>
  <script>
    const btn = document.getElementById('markets-btn');
    const out = document.getElementById('markets');
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      out.innerHTML = '<p class="status">GET /api/public/markets…</p>';
      try {
        const res = await fetch('/api/public/markets');
        if (!res.ok) throw new Error('market data API returned ' + res.status);
        const rows = await res.json();
        out.innerHTML = '<table><tr><th>Index</th><th>Last</th><th>Change</th></tr>' +
          rows.map((q) => {
            const change = q.price - q.previousClose;
            const pct = ((change / q.previousClose) * 100).toFixed(2);
            const cls = change >= 0 ? 'up' : 'down';
            const sign = change >= 0 ? '+' : '';
            return '<tr><td>' + q.name + '</td><td>' + q.price.toLocaleString() +
              '</td><td class="' + cls + '">' + sign + change.toFixed(2) + ' (' + sign + pct + '%)</td></tr>';
          }).join('') + '</table>';
      } catch (err) {
        out.innerHTML = '<p class="status">Failed: ' + err.message + '</p>';
      } finally {
        btn.disabled = false;
      }
    });
  </script>`,
  );
