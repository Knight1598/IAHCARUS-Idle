# Account server and character saves

The full Node edition has real username/password registration, login, logout, and durable character/profile saves. Passwords are salted with Node's scrypt; only the derived password hash is stored. Login creates an opaque seven-day session in an HttpOnly, SameSite=Strict cookie. SQLite stores the session token's SHA-256 hash, so the raw token is never written to the account database. Logging out revokes that session on the server.

Private online rooms display the signed-in player's character name and username, resolved from that cookie during a same-origin WebSocket connection. The room keeps its original names through reconnects; sending a name in a client room payload cannot impersonate another account. Guests can still create and join rooms without signing in. Room state exposes those public names only, never account IDs, passwords, or account session tokens.

GitHub Pages and the single-file offline edition cannot run this server. They offer a local guest character and local saves. The account interface probes the same-origin `/api/account/me` endpoint; a static host without that endpoint cannot register or sync accounts. No account hosting service has been provisioned by this change.

## Local development

Use Node **24**, which includes `node:sqlite`:

```sh
npm ci
npm run build
npm start
```

Open `http://localhost:3000`. The default database is `data/accounts.sqlite`, including SQLite WAL journal files. This directory and SQLite files are ignored by Git and Docker build context. Keep that directory if you want accounts to survive server restarts. Use a different directory with `ACCOUNT_DB_PATH=/path/to/accounts.sqlite`.

To test the frontend during development, run the Node server and use the Vite `/api` proxy. Local HTTP uses cookies without `Secure`; production HTTPS uses `Secure` cookies by default.

## Production hosting

The repository includes a provider-neutral deployment kit: `Dockerfile`, `compose.yml`, `.env.example`, and `deploy/Caddyfile.example`. No hosting account or domain is required to prepare these files; deploying them requires a Node/container host and a real domain.

When a host is available:

1. Point the game domain's DNS at the host and allow HTTPS traffic.
2. Copy `.env.example` to `.env`, replace the example origin with that domain, and choose the local port if necessary.
3. Run `docker compose up --build -d`. Compose keeps account data in a named volume and checks `/health`; the Node port binds to the host's loopback interface.
4. Configure an HTTPS reverse proxy. The supplied Caddy example forwards the frontend, API and WebSocket upgrades together; replace its hostname and use the actual chosen port.
5. Open the HTTPS game URL and create a test account. Restart the service and confirm login/character persistence before inviting players. Check `docker compose ps` and `docker compose logs game` when diagnosing startup.

The `.env` file is ignored. Keep the `accounts` volume across releases; recreating the container does not reset accounts. The kit is prepared, and the Node build/API have been tested; a public HTTPS host has not been provisioned.

Deploy one Node 24 process with its built frontend and a persistent writable database volume. The server must serve the frontend and account API from the **same origin**. Configure the external HTTPS origin explicitly when a reverse proxy terminates TLS:

```sh
NODE_ENV=production \
ACCOUNT_PUBLIC_ORIGIN=https://game.example.com \
ACCOUNT_DB_PATH=/persistent/iahcarus/accounts.sqlite \
PORT=3000 npm start
```

`ACCOUNT_PUBLIC_ORIGIN` is an origin only, with no URL path. Forward HTTP requests and WebSocket upgrades for `/ws`; publish `/api/account/*` through the same host. The API compares browser mutation origins against the configured origin and accepts JSON only. It never trusts `X-Forwarded-For` or `X-Forwarded-Proto` from arbitrary requests. Apply the hosting provider's IP rate limiter at the trusted edge as well: behind a proxy, the built-in IP limiter sees the proxy's address.

The Docker image creates `/app/data` owned by the runtime `node` user. Mount a persistent volume there, or configure `ACCOUNT_DB_PATH` to a writable mounted path. Do not rely on a disposable container filesystem. Production cookies are secure by default; `ACCOUNT_COOKIE_SECURE=true` also enables secure cookies explicitly. `ACCOUNT_COOKIE_SECURE=false` is for deliberate local HTTP testing.

Back up SQLite with its online backup mechanism or stop the process before copying the database and journals. Do not commit account data, include it in image layers, or make the data directory publicly accessible. The server's static root is `dist`, separate from account storage. Rooms remain in memory; account persistence does not add multi-instance room routing.

## API contract

Every account response includes `available: true`. Successful responses include `user`, either `null` or:

```json
{
  "id": "opaque-account-id",
  "username": "Commander_01",
  "character": {
    "name": "Commander",
    "crest": "crown",
    "accent": "cyan",
    "silhouette": "sentinel"
  },
  "progression": null
}
```

- `GET /api/account/me`: discover server availability and current session.
- `POST /api/account/register`: `{username, password, character, progression?}`; creates the account and signs in. Optional `progression` copies a cosmetic save only when the player explicitly chooses it.
- `POST /api/account/login`: `{username, password}`; signs in and rotates the browser's current session.
- `POST /api/account/logout`: `{}`; revokes the current session and clears its cookie.
- `PUT /api/account/profile`: `{character?, progression?}`; updates the authenticated account only.

Mutation requests need `Content-Type: application/json` and the same-origin browser `Origin`. Use same-origin fetch credentials; JavaScript cannot read the session cookie. Usernames are 3–24 ASCII letters, digits, or underscores, with case-insensitive uniqueness. Passwords are 10–128 Unicode code points and at most 512 UTF-8 bytes. Character names are 2–24 Unicode code points after trimming; crests are `crown`, `wing`, `blade`, or `prism`; accents are `cyan`, `violet`, `amber`, or `rose`; silhouettes are `sentinel`, `striker`, or `oracle`.

`progression` is a bounded backup of the existing cosmetic profile (`version`, `xp`, `matches`, `wins`, `skin`, `arena`, `loadouts`, and `claimed`). It is **client-owned save data**, not a trusted competitive ranking, purchase balance, or proof of ownership. This implementation does not add payments, trading, email verification, password recovery, or authoritative competitive progression.

Errors return `{available:true,error:"CODE",message:"human-readable message"}` with appropriate HTTP status codes. Login failures do not reveal whether the username exists. The API limits authentication attempts, bounds request sizes, uses random salts and session tokens, expires sessions, and rejects cross-origin or non-JSON mutations. Test with `node --test tests/accounts.test.mjs`; the suite checks registration, hashed persistence, restart survival, user isolation, login/logout/rotation, expiry, CSRF checks, validation, and rate limiting.

## Verify the prepared image locally

```sh
docker compose --env-file .env.example config --quiet
docker build -t iahcarus-deploy:test .
npm run test:deploy
```

The smoke test creates its own temporary container and account volume, registers a synthetic test user, checks secure cookies and the served frontend, then recreates the container and logs into the same account. It removes only its test container and volume. It does not start the production Compose service, obtain a certificate, publish a host, or touch real account data.

For a development network with an installed private proxy CA, BuildKit accepts an optional `npm_ca` secret. Supply only the network's already trusted PEM CA bundle, for example `docker build --secret id=npm_ca,src=/etc/ssl/certs/ca-certificates.crt -t iahcarus-deploy:test .`. The CA is mounted only during dependency installation; TLS and package checksum verification stay enabled, and the certificate is not copied into the resulting image. Ordinary public hosts do not require this option.
