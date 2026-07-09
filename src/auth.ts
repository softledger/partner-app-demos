// "Sign in with SoftLedger" via WorkOS Connect, wired the way the Connect
// docs show for Passport: openid-client discovery + the openid-client/passport
// strategy. The strategy handles state/nonce/PKCE and id_token validation;
// the verify callback persists the tokenset as the session user. The access
// and refresh tokens never reach the browser — they live in the server-side
// session store, and the cookie only carries the session id.

import * as jose from 'jose';
import * as client from 'openid-client';
import { Strategy as OidcStrategy } from 'openid-client/passport';
import passport from 'passport';
import { config } from './config.js';

export type Tokens = {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  // Unix seconds; derived from the token response's expires_in so the auth
  // middleware knows when to refresh without re-verifying our own copy.
  expires_at: number;
};

export type SessionUser = { claims: jose.JWTPayload; tokens: Tokens };

declare global {
  namespace Express {
    interface User extends SessionUser {}
  }
}

export const oidc = await client.discovery(
  new URL(config.authkitDomain),
  config.clientId,
  config.clientSecret,
);

const meta = oidc.serverMetadata();
if (!meta.jwks_uri) throw new Error('OIDC discovery document has no jwks_uri');
const jwks = jose.createRemoteJWKSet(new URL(meta.jwks_uri));
console.log(`[partner-app] discovered OIDC config (issuer: ${meta.issuer})`);

const toTokens = (
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
): Tokens => {
  const t: Tokens = {
    access_token: tokens.access_token,
    expires_at: Math.floor(Date.now() / 1000) + (tokens.expiresIn() ?? 300),
  };
  if (tokens.refresh_token) t.refresh_token = tokens.refresh_token;
  if (tokens.id_token) t.id_token = tokens.id_token;
  return t;
};

export const strategy = new OidcStrategy(
  {
    config: oidc,
    // offline_access is what makes the IdP return a refresh_token.
    scope: 'openid profile email offline_access',
    callbackURL: config.redirectUri,
  },
  (tokens, done) => {
    const claims = tokens.claims();
    if (!claims) return done(new Error('token response has no id_token'));
    done(null, { claims, tokens: toTokens(tokens) });
  },
);

passport.use(strategy);

// The whole user (id_token claims + tokenset) round-trips through the session
// store as-is; nothing user-shaped ever goes to the browser.
passport.serializeUser<SessionUser>((user, done) => done(null, user));
passport.deserializeUser<SessionUser>((user, done) => done(null, user));

// A refresh response may omit id_token/refresh_token — keep the old ones.
export const refreshTokens = async (tokens: Tokens): Promise<Tokens> => {
  if (!tokens.refresh_token) throw new Error('session has no refresh token');
  return { ...tokens, ...toTokens(await client.refreshTokenGrant(oidc, tokens.refresh_token)) };
};

export const accessTokenExpired = (tokens: Tokens) =>
  tokens.expires_at * 1000 < Date.now() + 30_000;

// id_token verification for API callers presenting one as a Bearer token:
// offline against the advertised JWKS, with the issuer and audience (the
// Connect app's own client id) pinned. The SoftLedger access token is never
// verified here — it's an opaque credential for SoftLedger's API, not ours.
export const verifyIdToken = async (token: string) => {
  const { payload } = await jose.jwtVerify(token, jwks, {
    issuer: meta.issuer,
    audience: config.clientId,
    algorithms: ['RS256'],
  });
  return payload;
};
