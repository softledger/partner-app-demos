// Shares the repo root .env with the portal demo — same WorkOS Connect app,
// different redirect URI (both URIs are registered on the app).

const required = (name: string) => {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var: ${name} — see README "Run it".`);
    process.exit(1);
  }
  return value;
};

export const config = {
  port: Number(process.env.LOGIN_APP_PORT ?? 4002),

  authkitDomain: required('WORKOS_AUTHKIT_DOMAIN').replace(/\/$/, ''),
  clientId: required('PARTNER_APP_CLIENT_ID'),
  clientSecret: required('PARTNER_APP_CLIENT_SECRET'),
  redirectUri: process.env.LOGIN_APP_REDIRECT_URI ?? 'http://localhost:4002/oauth/callback',

  sessionSecret: process.env.SESSION_SECRET ?? 'login-app-demo-only-not-a-secret',

  softledgerApiUrl: (process.env.SOFTLEDGER_API_URL ?? 'https://api.softledger.com').replace(
    /\/$/,
    '',
  ),
};
