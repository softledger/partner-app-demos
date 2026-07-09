// Partner Login App — the account-linking pattern. This product has its OWN
// (faked) login; the OAuth flow's only job is to collect a SoftLedger access
// token + refresh token so the product can call the SoftLedger API on the
// user's behalf. Compare with the sign-in demo (sign-in-with-softledger/), where the SoftLedger
// login IS the app's login.

import express from 'express';
import session from 'express-session';
import { config } from './config.js';
import {
  accessTokenExpired,
  beginLink,
  buildAuthUrl,
  completeLink,
  type Connection,
  type PendingLink,
  refreshConnection,
} from './oauth.js';
import { dashboardPage, landingPage, LOGIN_APP_LOGO_SVG } from './views.js';

declare module 'express-session' {
  interface SessionData {
    userEmail?: string;
    pendingLink?: PendingLink;
  }
}

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.redirectUri.startsWith('https:'),
      maxAge: 8 * 60 * 60 * 1000,
    },
  }),
);

// The product's "database": SoftLedger connections keyed by our own user id.
// A real product persists these (encrypted) next to the user record.
const connections = new Map<string, Connection>();

app.get(['/logo.svg', '/favicon.ico'], (_req, res) =>
  res.type('image/svg+xml').send(LOGIN_APP_LOGO_SVG),
);

// --- This product's own (fake) auth — SoftLedger is not involved ------------
app.post('/login', (req, res) => {
  req.session.userEmail = 'demo@partnerapp.com';
  res.redirect('/');
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// --- Account linking: OAuth against SoftLedger -------------
app.get('/oauth/connect', async (req, res) => {
  if (!req.session.userEmail) return res.redirect('/');
  const pending = beginLink();
  req.session.pendingLink = pending;
  res.redirect(await buildAuthUrl(pending));
});

app.get('/oauth/callback', async (req, res) => {
  const pending = req.session.pendingLink;
  req.session.pendingLink = undefined;
  if (!req.session.userEmail || !pending) return res.redirect('/');
  try {
    const connection = await completeLink(
      new URL(req.originalUrl, config.redirectUri),
      pending,
    );
    connections.set(req.session.userEmail, connection);
    res.redirect('/');
  } catch (err) {
    console.error(`[account-linking] account link failed: ${(err as Error).message}`);
    res.status(400).send(`Connecting SoftLedger failed: ${(err as Error).message}`);
  }
});

app.post('/oauth/refresh', async (req, res) => {
  const email = req.session.userEmail;
  const connection = email && connections.get(email);
  if (!email || !connection) return res.redirect('/');
  try {
    connections.set(email, await refreshConnection(connection));
  } catch (err) {
    console.error(`[account-linking] token refresh failed: ${(err as Error).message}`);
    connections.delete(email);
  }
  res.redirect('/');
});

app.post('/oauth/disconnect', (req, res) => {
  if (req.session.userEmail) connections.delete(req.session.userEmail);
  res.redirect('/');
});

// --- Pages -------------------------------------------------------------------
app.get('/', (req, res) => {
  const email = req.session.userEmail;
  if (!email) return res.send(landingPage());
  res.send(dashboardPage(email, connections.get(email)));
});

// --- SoftLedger API on the user's behalf, with the granted tokens -----------
app.get('/api/ledger-accounts', async (req, res) => {
  const email = req.session.userEmail;
  let connection = email && connections.get(email);
  if (!email || !connection) {
    return res.status(400).json({ error: 'No SoftLedger connection — connect the account first' });
  }

  if (accessTokenExpired(connection)) {
    try {
      connection = await refreshConnection(connection);
      connections.set(email, connection);
    } catch (err) {
      console.error(`[account-linking] token refresh failed: ${(err as Error).message}`);
      connections.delete(email);
      return res.status(401).json({ error: 'SoftLedger connection expired — reconnect' });
    }
  }

  const upstream = await fetch(`${config.softledgerApiUrl}/v2/ledger-accounts`, {
    headers: {
      authorization: `Bearer ${connection.access_token}`,
      accept: 'application/json',
    },
    signal: AbortSignal.timeout(10_000),
  });
  res
    .status(upstream.status)
    .type(upstream.headers.get('content-type') ?? 'application/json')
    .send(await upstream.text());
});

app.listen(config.port, () => {
  console.log(`[account-linking] demo running at http://localhost:${config.port}`);
});
