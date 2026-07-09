// .env is loaded by the start script (`node --env-file=.env`).

const required = (name: string) => {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var: ${name} — see README "Run it".`);
    process.exit(1);
  }
  return value;
};

export const config = {
  port: Number(process.env.SIGN_IN_PORT ?? 4001),

  // SoftLedger as the identity provider. The authorization domain and the client
  // id must belong to the SAME SoftLedger environment.
  authDomain: required('SOFTLEDGER_AUTH_DOMAIN').replace(/\/$/, ''),
  clientId: required('PARTNER_APP_CLIENT_ID'),
  clientSecret: required('PARTNER_APP_CLIENT_SECRET'),
  redirectUri: process.env.SIGN_IN_REDIRECT_URI ?? 'http://localhost:4001/auth/callback',

  // Signs the express-session cookie; the default is fine only for local demos.
  sessionSecret: process.env.SESSION_SECRET ?? 'demo-only-not-a-secret',

  // SoftLedger API base — requests authenticate with the session's stored
  // access token.
  softledgerApiUrl: (process.env.SOFTLEDGER_API_URL ?? 'https://api.softledger.com').replace(
    /\/$/,
    '',
  ),
};
