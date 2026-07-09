// Account-linking OAuth against SoftLedger's authorization server. This app does NOT use
// SoftLedger for its own login — the flow's only job is to collect a
// SoftLedger access token + refresh token for the already-signed-in user, so
// this product can call the SoftLedger API on their behalf.

import * as jose from 'jose';
import * as client from 'openid-client';
import { config } from './config.js';

export type Connection = {
  access_token: string;
  refresh_token?: string;
  // Unix seconds
  expires_at: number;
  claims: jose.JWTPayload & { org_id?: string };
  connectedAt: string;
  refreshCount: number;
};

export type PendingLink = { state: string; codeVerifier: string };

const oidc = await client.discovery(
  new URL(config.authDomain),
  config.clientId,
  config.clientSecret,
);

const meta = oidc.serverMetadata();
if (!meta.jwks_uri) throw new Error('OIDC discovery document has no jwks_uri');
const jwks = jose.createRemoteJWKSet(new URL(meta.jwks_uri));
console.log(`[account-linking] discovered OIDC config (issuer: ${meta.issuer})`);

// Offline verification of the granted access token — issuer and audience (the
// SoftLedger ENVIRONMENT's client id, which the token is addressed to) pinned.
const verifyAccessToken = async (token: string) => {
  const { payload } = await jose.jwtVerify(token, jwks, {
    issuer: meta.issuer,
    algorithms: ['RS256'],
  });
  return payload as Connection['claims'];
};

export const beginLink = () => {
  const pending: PendingLink = {
    state: client.randomState(),
    codeVerifier: client.randomPKCECodeVerifier(),
  };
  return pending;
};

export const buildAuthUrl = async (pending: PendingLink) =>
  client
    .buildAuthorizationUrl(oidc, {
      redirect_uri: config.redirectUri,
      response_type: 'code',
      // offline_access is the point: it makes the token endpoint return a
      // refresh_token alongside the access token
      scope: 'openid offline_access',
      state: pending.state,
      code_challenge: await client.calculatePKCECodeChallenge(pending.codeVerifier),
      code_challenge_method: 'S256',
    })
    .toString();

const toConnection = async (
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
  previous?: Connection,
): Promise<Connection> => ({
  access_token: tokens.access_token,
  refresh_token: tokens.refresh_token ?? previous?.refresh_token,
  expires_at: Math.floor(Date.now() / 1000) + (tokens.expiresIn() ?? 300),
  claims: await verifyAccessToken(tokens.access_token),
  connectedAt: previous?.connectedAt ?? new Date().toISOString(),
  refreshCount: previous ? previous.refreshCount + 1 : 0,
});

export const completeLink = async (callbackUrl: URL, pending: PendingLink) => {
  const tokens = await client.authorizationCodeGrant(oidc, callbackUrl, {
    pkceCodeVerifier: pending.codeVerifier,
    expectedState: pending.state,
  });
  return toConnection(tokens);
};

// Refresh tokens rotate — always store the returned one.
export const refreshConnection = async (connection: Connection): Promise<Connection> => {
  if (!connection.refresh_token) throw new Error('connection has no refresh token');
  const tokens = await client.refreshTokenGrant(oidc, connection.refresh_token);
  return toConnection(tokens, connection);
};

export const accessTokenExpired = (connection: Connection) =>
  connection.expires_at * 1000 < Date.now() + 30_000;
