# Private friend duels on GitHub Pages

The Pages game now includes **ท้าดวลกับเพื่อน**. Offline games still load and play without network requests. Only choosing the online room attempts a connection. Hosts can choose Classic, Three Check, King of the Hill, First Capture or Special Duel; set 1/3/5/10/15/30 minutes plus 0/2/3/5/10 seconds per move; choose their side (white/black/random) and a shared battlefield; and allow or disallow draw offers. Both players can equip their unlocked army skins or individual starting pieces in the room before pressing ready. Online Special Duel uses the full starting board and the same ultimate engine as local play. Custom formations, bans and live field events remain local/offline.

## Deploy the test service

1. Sign into Render and connect GitHub repository `Knight1598/IAHCARUS-Idle`.
2. Create a **Blueprint**, select this repository, and review `render.yaml`. It requests one Docker web service on the free plan; review current Render terms and quotas before confirming. No disk or paid database is requested.
3. Wait until the service is healthy. Copy its actual HTTPS service URL, such as `https://<your-service>.onrender.com`. The service name is assigned by Render; do not assume the example URL exists.
4. Visit `<actual-service-url>/health`: it should return `{"ok":true}`.
5. Set `server` in the root `online-config.json` to that actual HTTPS URL, commit and push `main`. The existing Pages action copies this config beside the embedded game. The JSON contains only a public address, never a token or password.
6. When Pages deploy finishes, open `https://knight1598.github.io/IAHCARUS-Idle/`, choose **ท้าดวลกับเพื่อน**, select skins/arena, and start. Set the room rules and create a room. Copy its six-character code or invitation link.
7. Your friend opens the same Pages game on another device, selects online, types the room code and presses **จอยห้อง** (or uses the invitation link). Each player equips their own pieces in the room; both then press **พร้อมประลอง**. The board opens and the server clock starts.

Before updating the config, you can test the service via **การเชื่อมต่อห้อง** inside the room screen. Save the actual HTTPS URL there, then create a room. Invitation links include the public server endpoint and room code, so friends can connect without typing an address. They never contain the private resume token. Only launch an invitation from a server you trust; the service hostname is visible in the lobby.

## Room rules and preparation

- Special Duel lets each player choose signature/alternate/off skills for all six classes within a 12-point budget. The host sets 1/3/5/9 charges and one-use/reusable pieces. The server verifies ultimate paths, king safety, charge consumption, promotions and mate escapes.
- Classic uses normal chess victory/draw rules. Three Check adds victory after checking the opposing king on three separate legal moves. King of the Hill adds victory when your king legally reaches d4, e4, d5 or e5. First Capture adds victory on the first captured piece. Checkmate remains a win in every mode; normal draws still apply if no special objective wins first.
- The server enforces every mode, host permissions, legal moves, timer/increment, results and room updates. A guest cannot edit room rules or the opponent's cosmetics. Settings and skins lock when play begins.
- Unsaved rule edits disable the host's ready button until saved. Saving rules or equipping a skin clears both ready flags and changes the setup revision. An outdated ready command is rejected. The time control does not run in the lobby; the increment is added only after a successful legal move.
- Draw offers require the opponent's explicit acceptance; either side can decline/cancel. Playing a move clears a pending offer. Rematches require both players' agreement and a fresh ready gate.
- If the host leaves before play, the remaining player becomes host. Browser refresh/reconnect retains the host seat and cosmetics. Skin rarity affects presentation only. Local unlocks are not server-verified paid ownership.
- When updating an existing Render deployment, wait for both Pages and Render to deploy the same `main` revision (protocol 3). The lobby warns when connected to the older server version and disables the new settings until Render is updated. With Render auto-deploy enabled, pushing `main` updates the service; otherwise use **Manual Deploy → Deploy latest commit** on the existing service.

## Armies, communication and replay

- The room shows both procedural 3D armies and a larger selected-piece avatar. Select a piece and press the preview button to see its attack motion. This preview never changes the game or spends charges. Both sides pressing ready opens a VS introduction.
- During play, the geometric signal bar offers five predefined messages. The server attributes the sender and limits each player to one signal every five seconds; a small side callout and the existing UI sound show the message.
- Completed online matches with moves are kept in the browser's last-ten-match archive. Open **รีเพลย์การแข่งขัน** from the history drawer or **รีเพลย์ · ดูหรือรับบันทึกจากเพื่อน** from the main menu. Step forward/back, scrub the timeline, autoplay, jump to the next capture or change camera angle. Replays do not award XP/credits or modify the saved match; viewing during a running online match is blocked.
- Copy a replay link or replay code. Links use `#replay=...`, contain validated rules, teams, cosmetics and legal move history only, and remove invitation query parameters. No session token, account identity or server credential is included. Friends can open the recorded match without a server connection. Imported records are bounded to 512 plies and reconstructed legally; the code input is capped at 32 KiB.
- The archive is local to the browser. It is not a public replay database, and generated links may be long. To stop playback, press **ปิดรีเพลย์**; accepting a new round also closes playback automatically.

## Hosting and reconnect behavior

- The free test service can sleep when idle; first connection may take time. The client retries with bounded backoff. For dependable public service, choose a host/plan with the uptime you need.
- One instance owns all rooms. Rooms and running matches are in memory: a restart/deploy removes them. Reconnect resumes from the same browser while that server is alive, not across server restarts. Do not scale above one instance without shared room state.
- If disconnected before start, ready resets; press ready again after reconnect. After start the clock continues during disconnect, menus and cutscenes. Resume restores authoritative moves and clocks. Opening the same seat in another tab replaces the old connection.
- Leaving a running match is resignation. Leaving a waiting room frees that seat; abandoned empty rooms are removed. After a result, both players can request a rematch in the same room. Once both agree, the board, clocks, check counts and ready flags reset; rules and cosmetics remain and can be edited before another ready confirmation. The host can enable alternating colors: seats, host ownership, score, skills and cosmetics follow the person when colors swap; individual-piece loadouts are remapped to the opposite starting rank. A best-of-three series needs two wins; draws do not add a win and may require additional rounds. Rules lock between rounds until a series winner is decided. A new series starts after both accept another rematch following the series result. Changing a participant in a waiting room resets the series score.
- `DUEL_ALLOWED_ORIGINS` is a comma-separated list of frontend **origins**, without paths. For this Pages deployment use `https://knight1598.github.io`. A custom frontend domain requires adding its origin. This WebSocket allowlist does not grant cookie/account cross-origin access.
- `GUEST_DUEL_ONLY=true` skips account APIs and SQLite. Pages players keep their local profile and cosmetic choices; no cross-device account or progression sync is claimed. The existing account deployment with a persistent volume remains a separate option.
- Public endpoints must use HTTPS/WSS; HTTP/WS are accepted only for localhost development. Saved resume tokens are bound to a server, never sent to a different invitation's endpoint.

## Local verification

`npm test` tests readiness, legality, reconnect, stale revisions, origin rejection and accounts. `npm run build:pages && npm run test:friend-duel` uses two isolated browser contexts loading the embedded Pages HTML from one origin, connected to an actual server on another port. It checks host settings, read-only guest rules, personal piece cosmetics, manual code joining, readiness resets, matching moves, draw agreement, same-room rematch, a first-capture victory, refresh reconnect and lobby layouts. `npm run test:duel-expansion` additionally checks a charged online ultimate, skill selection, the two-army 3D preview, signals, series score/color swaps, archive playback and a shared replay in a fresh context with WebSocket disabled. `npm run build` verifies the normal frontend too.

For Docker verification, build `docker build -t iahcarus-friend:test .` then run `npm run test:friend-deploy`. The test starts only an isolated temporary guest container, checks two-player play and non-root execution, and removes it afterward.

The Docker runtime uses Node 24 to load the three pure TypeScript rules files (`special.ts`, `duel-draft.ts`, `field-events.ts`) directly. The Dockerfile includes these alongside the server so online and offline Special Duel use one rules implementation.
