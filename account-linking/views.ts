// Views for the account-linking demo. The framing everywhere: this product
// has its OWN login (faked here); SoftLedger is a CONNECTED ACCOUNT whose
// tokens were granted through OAuth.

import type { Connection } from './oauth.js';

export const LOGIN_APP_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#4C2E83"/>
  <g fill="none" stroke-width="11" stroke-linecap="round">
    <rect x="20" y="50" width="50" height="30" rx="15" stroke="#FFFFFF" transform="rotate(-25 45 65)"/>
    <rect x="58" y="50" width="50" height="30" rx="15" stroke="#F4B942" transform="rotate(-25 83 65)"/>
  </g>
</svg>`;

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const CSS = `
  * { box-sizing: border-box; margin: 0; }
  body { font: 14px/1.5 -apple-system, 'Segoe UI', Roboto, sans-serif; background: #f6f5f9; color: #221a33; }
  header { background: #4C2E83; color: #fff; }
  .bar { max-width: 860px; margin: 0 auto; padding: 10px 24px; display: flex; align-items: center; gap: 12px; }
  .bar img { width: 34px; height: 34px; border-radius: 8px; }
  .bar .name { font-weight: 700; font-size: 16px; }
  .who { margin-left: auto; display: flex; align-items: center; gap: 10px; font-size: 12px; color: #d9d2ea; }
  .who a { color: #d9d2ea; }
  main { max-width: 860px; margin: 0 auto; padding: 24px; }
  .card { background: #fff; border: 1px solid #e5e2ee; border-radius: 10px; padding: 20px; margin-bottom: 18px; }
  .card h2 { font-size: 17px; margin-bottom: 4px; }
  .card .sub { color: #6b6480; font-size: 13px; margin-bottom: 14px; }
  .callout { background: #f4f0fb; border: 1px solid #ddd2f0; border-radius: 8px; padding: 10px 14px; font-size: 13px; margin-bottom: 14px; }
  .btn { display: inline-block; background: #4C2E83; color: #fff; border: none; cursor: pointer; padding: 10px 18px; border-radius: 8px; font-weight: 600; font-size: 14px; text-decoration: none; }
  .btn.secondary { background: #fff; color: #4C2E83; border: 1px solid #4C2E83; }
  .btn.danger { background: #fff; color: #b91c1c; border: 1px solid #fca5a5; }
  .btn:disabled { opacity: .6; cursor: wait; }
  .row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
  .chip { border-radius: 99px; padding: 3px 12px; font-weight: 700; font-size: 12px; }
  .chip.ok { background: #ecfdf5; color: #047857; }
  .chip.off { background: #f1f5f9; color: #64748b; }
  table { border-collapse: collapse; width: 100%; margin-top: 14px; }
  th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #efedf5; font-size: 13px; }
  th { background: #faf9fc; color: #6b6480; font-size: 12px; }
  td code { font-size: 12px; word-break: break-all; }
  .muted { color: #6b6480; font-size: 12px; margin-top: 10px; }
  .status { font-size: 13px; color: #6b6480; margin-top: 12px; }
  .signin { min-height: 65vh; display: grid; place-items: center; text-align: center; }
`;

const shell = (title: string, who: string | null, body: string) => `<!doctype html>
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
    <img src="/logo.svg" alt="Partner Login App">
    <span class="name">Partner Login App</span>
    <span class="who">${
      who
        ? `<span>signed in with this product's own login: <b>${esc(who)}</b></span><a href="/logout">Sign out</a>`
        : '<span>own login, own users — SoftLedger not involved</span>'
    }</span>
  </div></header>
  <main>${body}</main>
</body>
</html>`;

export const landingPage = () =>
  shell(
    'Partner Login App',
    null,
    `
  <div class="signin"><div>
    <h2 style="margin-bottom:6px">Welcome back</h2>
    <p class="sub" style="margin-bottom:16px">
      This product has its <b>own</b> authentication — no SoftLedger here.<br>
      (Demo: the login is faked with one click.)
    </p>
    <form method="post" action="/login">
      <button class="btn" type="submit">Sign in as demo@partnerapp.com</button>
    </form>
  </div></div>`,
  );

const fmtExpiry = (connection: Connection) => {
  const secs = Math.round(connection.expires_at - Date.now() / 1000);
  if (secs <= 0) return 'expired';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

export const dashboardPage = (who: string, connection: Connection | undefined) =>
  shell(
    'Partner Login App — Dashboard',
    who,
    connection
      ? `
  <div class="card">
    <div class="row" style="justify-content:space-between">
      <h2>SoftLedger <span class="chip ok">Connected</span></h2>
      <form method="post" action="/oauth/disconnect"><button class="btn danger" type="submit">Disconnect</button></form>
    </div>
    <p class="sub">
      Your user granted this product access to their SoftLedger organization through
      OAuth — we hold an <b>access token</b> and a <b>refresh token</b>, no SoftLedger password.
    </p>
    <table>
      <tr><th>Organization</th><td><code>${esc(connection.claims.org_id)}</code></td></tr>
      <tr><th>App (appClientId claim)</th><td><code>${esc(connection.claims['https://api.softledger.com/appClientId'])}</code></td></tr>
      <tr><th>Access token expires in</th><td>${esc(fmtExpiry(connection))}</td></tr>
      <tr><th>Refresh token</th><td>${connection.refresh_token ? 'stored server-side' : '— none —'}</td></tr>
      <tr><th>Connected</th><td>${esc(connection.connectedAt)} · refreshed ${connection.refreshCount}×</td></tr>
    </table>
    <div class="row" style="margin-top:14px">
      <button class="btn" id="query-btn">Query the SoftLedger API</button>
      <form method="post" action="/oauth/refresh"><button class="btn secondary" type="submit">Refresh the access token now</button></form>
    </div>
    <div id="result"></div>
  </div>
  <script>
    const btn = document.getElementById('query-btn');
    const out = document.getElementById('result');
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      out.innerHTML = '<p class="status">GET /api/ledger-accounts → SoftLedger /v2/ledger-accounts (Bearer: the granted access token; auto-refreshed if expired)…</p>';
      try {
        const res = await fetch('/api/ledger-accounts');
        if (!res.ok) throw new Error('SoftLedger API returned ' + res.status);
        const body = await res.json();
        const rows = body.data ?? body;
        out.innerHTML = '<table><tr><th>Number</th><th>Name</th><th>Type</th><th>Subtype</th></tr>' +
          rows.map((a) => '<tr><td>' + [a.number, a.name, a.type, a.subtype]
            .map((v) => String(v ?? '—').replace(/</g, '&lt;')).join('</td><td>') + '</td></tr>').join('') +
          '</table><p class="muted">' + rows.length + ' accounts from the connected org.</p>';
      } catch (err) {
        out.innerHTML = '<p class="status">Failed: ' + err.message + '</p>';
      } finally {
        btn.disabled = false;
      }
    });
  </script>`
      : `
  <div class="card">
    <div class="row" style="justify-content:space-between">
      <h2>SoftLedger <span class="chip off">Not connected</span></h2>
    </div>
    <p class="sub">Connect your customer's SoftLedger organization to pull their accounting data into this product.</p>
    <div class="callout">
      Clicking Connect runs a standard <b>OAuth authorization</b> against SoftLedger: the user approves access, and this product receives an
      <b>access token + refresh token</b> to call the SoftLedger API on their behalf —
      no SoftLedger credentials are ever entered here.
    </div>
    <a class="btn" href="/oauth/connect">Connect SoftLedger account</a>
  </div>`,
  );
