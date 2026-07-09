import express from 'express';
import session from 'express-session';
import type { JWTPayload } from 'jose';
import passport from 'passport';
import { accessTokenExpired, refreshTokens, strategy, type Tokens, verifyIdToken } from './auth.js';
import { config } from './config.js';
import { dashboardPage, identityPage, marketDataPage, PARTNER_APP_LOGO_SVG } from './views.js';

declare global {
  namespace Express {
    interface Locals {
      claims: JWTPayload;
      // Only present for browser sessions — API callers authenticate with an
      // id_token and bring no SoftLedger access token of their own.
      accessToken?: string;
    }
  }
}

const app = express();

// The session cookie is the browser's only credential; the claims and the
// tokenset live server-side in the session store. (In-memory — a restart
// signs everyone out; a real deployment would use Redis or a database.)
app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      // False only because the localhost demo serves plain http — anything
      // deployed must send its cookies with Secure.
      secure: config.redirectUri.startsWith('https:'),
      // Outlives the access token so an expired session can still be renewed
      // via the refresh token; matches a typical refresh-token lifetime.
      maxAge: 8 * 60 * 60 * 1000,
    },
  }),
);
app.use(passport.initialize());
app.use(passport.session());

// Both auth routes run the same strategy: with no code/state in the URL it
// starts the redirect to the IdP, on the callback it exchanges the code for
// the tokenset (state, PKCE, and id_token checks happen inside).
app.get('/auth/login', passport.authenticate(strategy.name));
app.get(
  '/auth/callback',
  passport.authenticate(strategy.name, { successRedirect: '/', failureRedirect: '/auth/login' }),
);

app.get('/auth/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => res.send('Signed out of the demo. Sign back in at /auth/login'));
  });
});

// Logo + favicon, served before the login gate so they load on every page.
app.get(['/logo.svg', '/favicon.ico'], (_req, res) =>
  res.type('image/svg+xml').send(PARTNER_APP_LOGO_SVG),
);

// Single-flight: parallel requests refreshing the same session share one
// refresh call, so a rotated refresh token is never spent twice.
const refreshing = new Map<string, Promise<Tokens>>();
const refreshSession = (sessionId: string, tokens: Tokens): Promise<Tokens> => {
  let inflight = refreshing.get(sessionId);
  if (!inflight) {
    inflight = refreshTokens(tokens).finally(() => refreshing.delete(sessionId));
    refreshing.set(sessionId, inflight);
  }
  return inflight;
};

// Auth middleware: API callers present their id_token in the Authorization
// header; it's verified offline against the JWKS. The browser presents only
// its session cookie; when the session's access token has expired it is
// swapped via the refresh token. A dead refresh means a 401 (API) or a
// redirect back through login (browser).
app.use(async (req, res, next) => {
  const fromHeader = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (fromHeader) {
    try {
      res.locals.claims = await verifyIdToken(fromHeader);
      return next();
    } catch (err) {
      console.error(`[partner-app] token verification failed: ${(err as Error).message}`);
      return res.status(401).json({ error: 'Invalid token' });
    }
  }

  const user = req.user;
  if (!user) return res.redirect('/auth/login');

  if (accessTokenExpired(user.tokens)) {
    try {
      user.tokens = await refreshSession(req.session.id, user.tokens);
    } catch (err) {
      console.error(`[partner-app] token refresh failed: ${(err as Error).message}`);
      return req.session.destroy(() => res.redirect('/auth/login'));
    }
  }

  res.locals.claims = user.claims;
  res.locals.accessToken = user.tokens.access_token;
  next();
});

app.get('/', (_req, res) => res.send(dashboardPage(res.locals.claims)));

app.get('/identity', (_req, res) => res.send(identityPage(res.locals.claims)));

app.get('/market-data', (_req, res) => res.send(marketDataPage(res.locals.claims)));

// The session's SoftLedger access token IS the API credential — forward it as
// a Bearer token to query this org's ledger accounts.
app.get('/api/ledger-accounts', async (_req, res) => {
  if (!res.locals.accessToken) {
    return res.status(400).json({
      error: 'No SoftLedger access token in this auth context — sign in via the browser flow',
    });
  }

  const upstream = await fetch(`${config.softledgerApiUrl}/v2/ledger-accounts`, {
    headers: {
      authorization: `Bearer ${res.locals.accessToken}`,
      accept: 'application/json',
    },
    signal: AbortSignal.timeout(10_000),
  });
  res
    .status(upstream.status)
    .type(upstream.headers.get('content-type') ?? 'application/json')
    .send(await upstream.text());
});

// A protected route in front of a public, keyless API — the middleware gates
// access with the login check; the upstream itself needs no credential.
const MARKET_INDICES = [
  { symbol: '^GSPC', name: 'S&P 500' },
  { symbol: '^DJI', name: 'Dow Jones' },
  { symbol: '^IXIC', name: 'Nasdaq' },
];

app.get('/api/public/markets', async (_req, res) => {
  try {
    const quotes = await Promise.all(
      MARKET_INDICES.map(async ({ symbol, name }) => {
        const upstream = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
          { headers: { 'user-agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10_000) },
        );
        if (!upstream.ok) throw new Error(`quote for ${symbol} returned ${upstream.status}`);
        const meta = (await upstream.json()).chart.result[0].meta;
        return { name, price: meta.regularMarketPrice, previousClose: meta.chartPreviousClose };
      }),
    );
    res.json(quotes);
  } catch (err) {
    console.error(`[partner-app] market data fetch failed: ${(err as Error).message}`);
    res.status(502).json({ error: 'market data unavailable' });
  }
});

app.listen(config.port, () => {
  console.log(`[partner-app] demo running at http://localhost:${config.port}`);
});
