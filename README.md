# SoftLedger Partner App Demos

Two minimal Express + TypeScript apps showing how a partner product integrates
with SoftLedger identity and data via OAuth / OpenID Connect.

| App | Port | Pattern |
|---|---|---|
| **`sign-in-with-softledger/`** | 4001 | The SoftLedger login **is** the app's login |
| **`account-linking/`** | 4002 | The app keeps its own login; OAuth links a SoftLedger account and grants an access + refresh token |

## Setup

1. **Contact SoftLedger support** to register your application. You'll receive
   an authorization domain, a client id, and a client secret; provide your
   redirect URIs (for these demos: `http://localhost:4001/auth/callback` and
   `http://localhost:4002/oauth/callback`).
2. `cp .env.example .env` and fill in the values.

```bash
npm install
npm run start:sign-in          # :4001
npm run start:account-linking  # :4002
```

## How it works

**Sign in with SoftLedger.** OIDC authorization code + PKCE via
`openid-client`'s Passport strategy. The id_token claims become the session
user (`org_id` = the SoftLedger organization); the access + refresh tokens
stay server-side and are rotated on expiry. The access token is forwarded as
a Bearer to the SoftLedger API (`/api/ledger-accounts`).

**Account linking.** The app's own login is faked with one click.
"Connect SoftLedger account" runs the same OAuth flow with `offline_access`
and stores the granted **access + refresh token** against the user — then
queries the SoftLedger API on their behalf, auto-refreshing on expiry.
Buttons to force a refresh (refresh tokens rotate) and disconnect.

## The rules

1. Resolve endpoints from `/.well-known/openid-configuration` on the
   authorization domain; verify tokens offline against its JWKS with issuer
   pinned.
2. Access tokens are addressed to the SoftLedger platform (`aud`) — use them
   only as Bearer credentials toward the SoftLedger API, never as your own
   session. Establish your own session/cookie after verification.
3. Tenant context = the `org_id` claim. Scope everything by it.
4. Store tokens server-side only; refresh tokens rotate — always persist the
   newest one.

Demo-grade by design: in-memory sessions and token storage, plain-HTTP
cookies. Anything deployed needs a real session store, `Secure` cookies, and
encrypted token persistence.
