# Private friend duels on GitHub Pages

The Pages game now includes **ท้าดวลกับเพื่อน**. Offline games still load and play without network requests. Only choosing the online room attempts a connection. This first release uses standard chess, personal cosmetic loadouts, a five-minute server clock, and an explicit ready button on both devices. Special Duel/Draft/field rules remain offline/local until their server rules are added.

## Deploy the test service

1. Sign into Render and connect GitHub repository `Knight1598/IAHCARUS-Idle`.
2. Create a **Blueprint**, select this repository, and review `render.yaml`. It requests one Docker web service on the free plan; review current Render terms and quotas before confirming. No disk or paid database is requested.
3. Wait until the service is healthy. Copy its actual HTTPS service URL, such as `https://<your-service>.onrender.com`. The service name is assigned by Render; do not assume the example URL exists.
4. Visit `<actual-service-url>/health`: it should return `{"ok":true}`.
5. Set `server` in the root `online-config.json` to that actual HTTPS URL, commit and push `main`. The existing Pages action copies this config beside the embedded game. The JSON contains only a public address, never a token or password.
6. When Pages deploy finishes, open `https://knight1598.github.io/IAHCARUS-Idle/`, choose **ท้าดวลกับเพื่อน**, select skins/arena, and start. Create a room and copy its invitation link.
7. Your friend opens the link on another device, enters the room, and both press **พร้อมประลอง**. The board opens and the server clock starts.

Before updating the config, you can test the service via **การเชื่อมต่อห้อง** inside the room screen. Save the actual HTTPS URL there, then create a room. Invitation links include the public server endpoint and room code, so friends can connect without typing an address. They never contain the private resume token. Only launch an invitation from a server you trust; the service hostname is visible in the lobby.

## Hosting and reconnect behavior

- The free test service can sleep when idle; first connection may take time. The client retries with bounded backoff. For dependable public service, choose a host/plan with the uptime you need.
- One instance owns all rooms. Rooms and running matches are in memory: a restart/deploy removes them. Reconnect resumes from the same browser while that server is alive, not across server restarts. Do not scale above one instance without shared room state.
- If disconnected before start, ready resets; press ready again after reconnect. After start the clock continues during disconnect, menus and cutscenes. Resume restores authoritative moves and clocks. Opening the same seat in another tab replaces the old connection.
- Leaving a running match is resignation. Leaving a waiting room frees that seat; abandoned empty rooms are removed. Finished seats are reserved until expiry. Create a fresh room for another match.
- `DUEL_ALLOWED_ORIGINS` is a comma-separated list of frontend **origins**, without paths. For this Pages deployment use `https://knight1598.github.io`. A custom frontend domain requires adding its origin. This WebSocket allowlist does not grant cookie/account cross-origin access.
- `GUEST_DUEL_ONLY=true` skips account APIs and SQLite. Pages players keep their local profile and cosmetic choices; no cross-device account or progression sync is claimed. The existing account deployment with a persistent volume remains a separate option.
- Public endpoints must use HTTPS/WSS; HTTP/WS are accepted only for localhost development. Saved resume tokens are bound to a server, never sent to a different invitation's endpoint.

## Local verification

`npm test` tests readiness, legality, reconnect, stale revisions, origin rejection and accounts. `npm run build:pages && npm run test:friend-duel` uses two isolated browser contexts loading the embedded Pages HTML from one origin, connected to an actual server on another port. It checks readiness, matching moves, refresh reconnect and lobby layouts. `npm run build` verifies the normal frontend too.

For Docker verification, build `docker build -t iahcarus-friend:test .` then run `npm run test:friend-deploy`. The test starts only an isolated temporary guest container, checks two-player play and non-root execution, and removes it afterward.
