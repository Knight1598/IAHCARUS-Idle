# Special Chess 3D

A playable, procedural 3D chess game with signature attacks, cinematic camera sequences and Thai UI. All piece geometry, textures, effects and synthesized sounds are generated in code. No external art or model downloads.

## Standalone offline test edition

Download [`offline/Special-Chess-Offline.html`](offline/Special-Chess-Offline.html) using GitHub's **Download raw file** button, then open it in desktop Chrome/Edge. This separate single-file edition starts directly against a local bot with Easy/Medium/Hard difficulty. It includes all procedural 3D effects and training scenes, has no multiplayer UI, and requires no Node server or Internet connection. See the [Thai offline guide](offline/README.md).

```sh
npm run build:offline
npm run test:offline
```

Use `npm run dev:offline` and the `/offline.html` page while developing the standalone edition. Rebuild the committed HTML whenever shared source changes. The original multiplayer build below remains available.

## Play

Use Node.js **24** and npm.

```sh
npm ci
npm run build
npm start
```

The server serves the built game on port **3000**. Open that port's address in your browser. For another device, use your machine's reachable hostname/IP, with appropriate port access. A loopback address only works on the same machine.

- **เล่นกับบอต**: play white against a worker-based bot; choose one of three search depths.
- **สองคน**: share one device; white moves first.
- **ออนไลน์**: create a private room and share its invite link/code. The creator is white; the guest is black. Both players need to reach the same running server.
- Select a piece, then a highlighted destination. Drag to orbit and scroll to zoom. Use the 2D board for keyboard play or when WebGL is unavailable.
- Every capture has a piece-specific effect. Special events have cinematic camera movement. Skip any sequence or reduce effects; sound is opt-in.
- **สนามฝึกท่าสเปเชียล** provides eleven scenarios to try every attack, royal rescue, blocking check, double check, a knight fork and promotion immediately.
- Local games and settings resume from browser storage. Online sessions reconnect from the same browser using a private reconnect token. A shared invite link never includes that token.

## Development

Run these in separate terminals:

```sh
npm run server
npm run dev
```

Vite proxies `/ws` to the server on port 3000. Restart the server after changing server code. Production uses one Node process for both HTTP and WebSocket, so the client uses the same host and selects `wss` automatically under HTTPS.

```sh
npm run build
npm test
npx playwright install chromium
npm run test:browser
```

The browser suite exercises the production build. If system Chromium exists at `/usr/bin/chromium`, it uses that; otherwise it uses Playwright's installed Chromium. Set `CHROMIUM_PATH` to override. Screenshots go into ignored `test-results/`. GitHub Actions runs build, rules/events/server tests and browser smoke tests.

## Implemented gameplay

- Legal moves, castling, en passant, promotion to any legal piece, checkmate and draw detection through chess.js.
- All six procedural 3D pieces, camera controls, board coordinates, selection, last-move and check indicators.
- Unique capture visuals: pawn spear, knight phantom, bishop prism beam, rook cannon, queen blades and king sword.
- Event analysis for check, checkmate, actual checking-piece capture (royal rescue), interposition, king escape, discovered/double check, forks, promotion and castling.
- Cinematic camera movement, letterbox, shockwaves, particles, threat beams, protective king shields, optional synthesized sound.
- Local undo, persistent games, PGN export, promotion dialog, mobile layout and 2D fallback.
- Server-authoritative private PvP rooms, legal turn validation, revision checking, five-minute clocks, resignation and reconnect. Clocks continue through animations and disconnects; their outcome is decided by the server.

## Hosting

The game is implemented and runnable; pushing code to GitHub does **not** publish a playable website. Online play requires hosting the Node server with WebSocket support.

A Dockerfile is included:

```sh
docker build -t special-chess .
docker run --rm -p 3000:3000 special-chess
```

Deploy one instance on a Node/container host, terminate HTTPS at the host's reverse proxy, and forward WebSocket upgrades for `/ws`. Environment variable `PORT` defaults to `3000`. `/health` returns JSON readiness. Rooms are in memory and disappear when the server restarts; disconnected rooms expire after one hour. Multi-instance deployment requires shared room storage/routing and is not implemented.

`CHESS_CLOCK_MS` optionally changes each player's starting time (100–3,600,000 ms; default 300,000). It is primarily useful for automated clock tests. The normal UI describes the default five-minute game.

## Scope and next steps

This release is an unranked game, not a persistent competitive platform. There are no accounts, matchmaking, ratings, store, payments or spectators. Bots use a small minimax evaluator rather than Stockfish. Attack cinematics are stylized procedural sequences, not animated humanoid combat.

Draws use chess.js automatic threefold/fifty-move detection instead of a tournament claim flow. Timeout awards the other player a win; full FIDE impossible-mate adjudication is not implemented. Add persistent rooms/accounts and refine adjudication before ranked play. See `DEVELOPMENT.md` for architecture and follow-up work.
