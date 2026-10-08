# Special Chess 3D

A playable fantasy army chess game with a 3D commander lobby, individual piece cosmetics, spectral combat avatars, signature finishers, eight reactive arenas, tactical chapters and Thai UI. All piece geometry, textures, effects and synthesized sounds are generated in code. No external art or model downloads.

## Browser link (GitHub Pages)

The **Deploy IAHCARUS to GitHub Pages** workflow (`.github/workflows/deploy-pages.yml`) publishes the committed `offline/Special-Chess-Offline.html` directly. It copies that file to `_site/index.html`, checks that the bytes match, adds `.nojekyll`, then uploads and deploys with GitHub's Pages actions. It does not rebuild or modify the game. No Node/WebSocket server is needed at runtime.

One-time repository setup (requires permission to manage Pages):

1. Open **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**.
2. Open **Actions → Deploy IAHCARUS to GitHub Pages → Run workflow** on `main` if the latest deployment has not succeeded.
3. Open the deployment URL reported by that workflow. The expected default URL is `https://knight1598.github.io/IAHCARUS-Idle/`; it is not proof of an active deployment until GitHub reports success.

Every push to `main` triggers automatic deployment to the same URL. To publish a new game version, update `offline/Special-Chess-Offline.html` and push it to `main`. Repository visibility and account plan can affect Pages availability; do not change repository visibility to enable it without the owner's instruction.

```sh
node scripts/package-pages.mjs
npm run test:pages
```

The Pages smoke test serves the game from `/IAHCARUS-Idle/`, loads the real browser page, then disconnects networking and verifies all three bot levels. Embedded workers use local blob URLs and make no external requests.

## Standalone offline test edition

Download [`offline/Special-Chess-Offline.html`](offline/Special-Chess-Offline.html) using GitHub's **Download raw file** button, then open it in desktop Chrome/Edge. This single-file edition opens a title screen with bot play (Easy/Medium/Hard), three tactical chapters, same-device two-player play, training and a per-piece armory. It includes all procedural 3D effects, skins and local RPG progression, requires no Node server or Internet connection, and excludes online rooms. See the [Thai offline guide](offline/README.md).

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

- Start in the commander lobby: inspect your real 3D army, choose a rival/mode, visit the armory or resume the saved match. The lobby reuses the arena’s WebGL context. **หน้าหลัก** returns here and stops bot work; only the visible army preview continues rendering. Active online matches must finish or be resigned first; online clocks continue while disconnected.
- The arena fits the viewport on desktop and portrait/landscape mobile layouts. The bottom HUD keeps new game, undo, view, skip, 2D and quick sound controls on screen. Settings, training, missions, history and online rooms open separate drawers; close with **✕** or Escape. Drawers do not resize the board. Portrait framing uses a higher camera angle and distance-aware fog so both armies remain readable.
- **เล่นกับบอต**: choose white or black against a worker-based bot; choose one of three search depths.
- **สองคน**: share one device; white moves first.
- **ออนไลน์**: create a private room and share its invite link/code. The creator is white; the guest is black. Both players need to reach the same running server.
- Select a piece, then a highlighted destination. Drag to orbit and scroll to zoom. Use the 2D board for keyboard play or when WebGL is unavailable.
- Every move has a ground aura, selection rune, target lock, charge, energy trail and slow final approach. Standing auras rotate and breathe softly. Energy fractures appear behind movement and fade over seven seconds; at most four fracture trails remain. Captures approach outside the defender, wind up, strike, hold contact, animate defeat and only then occupy the square. Summoned fighters now bend at the hips, torso, head, elbows and knees, with moving capes, weight shifts, follow-through and recovery. Pawns thrust spears, knights twist into diagonal cuts, bishops gather and release spells, rooks brace against cannon recoil, queens command sweeping blades and kings deliver heavy overhead cleaves. Each defender guards and staggers according to its class. Flowing aura filaments, charge helixes, layered rune seals, soft-edged attack ribbons, pressure waves, motes and prismatic fragments have distinct class/skin signatures. Shields have translucent rims and energy grids. Cinematic cameras frame both fighters, weapons and auras on wide and portrait screens. Skip any sequence or reduce effects; sound is opt-in.
- Choose **โลกแห่งการประลอง** in the lobby or **สนามประลอง** in settings: Star Citadel, Ember Forge, Frost Sanctum, Astral Rift, Storm Spire, Moonlit Grove, Neon Reactor and Eclipse Dunes. Each has procedural structures, board colors, lighting, ambient particles and a distinct impact field (royal seal, lava burst, ice spokes, dimensional spiral, branching lightning, leaf spiral, reactor grid or sandstorm). All eight are available immediately. Your field choice persists locally and applies to the lobby and game; online players can choose their own cosmetic field.
- Bot play supports either color, automatic camera orientation, saved side selection and undo back to your previous turn. Capture lists and material advantage help you read the match; illegal destinations keep your piece selected and explain what to check.
- Cinematic pacing defaults to key moments (checks, royal defense, major captures, forks, castling and promotion). Choose **ทุกท่าสเปเชียล** for the full anime treatment on every special event. Ordinary moves take 780 ms; short captures take 1,400 ms, including approach, windup, strike, defender defeat and final occupation; other short special moves take 1,150 ms. Full cinematic sequences last 2.8 seconds (mate 3.8). Reduced effects uses 180 ms moves.
- **เสียงอวกาศ · ไซไฟอนิเมะ** uses six sound families: a dry plasma needle for pawns, torn-space double pulses for knights, sustained harmonic beams for bishops, reactor motors and bass cannon bursts for rooks, cascading stereo crystal chords for queens and broad brass/shield chords for kings. Movement, charge/attack, impact, death and check each have four recipe variants per class, selected from a shuffle bag without immediate repeats. Event sounds cover forks, mate, royal defense, promotion, castling and match stories. Waveforms, rhythms and layers differ by family. The volume slider is saved; compression controls overlapping layers. Quick mute stops sound without skipping the attack. Skip, reset and menu return stop outstanding voices.
- Bots think during your animation and apply their reply when it finishes. Iterative searches target depths 1/2/3 with thinking budgets of 150/700/1,800 ms; a slow device uses the last completed depth. Idle auras refresh at up to 20 FPS (8 in Smoothest graphics); reduced effects renders idle boards on demand. Movement/camera interaction targets 60 FPS and heavy narrow-screen cinematic sequences 30. Actual frame rate depends on hardware.
- **กราฟิก** offers Auto, Smoothest (lower resolution, no shadows), and Sharp. Auto starts at a modest pixel ratio and lowers it under sustained slow frames. Orbit rotation follows display frames without a second 60 Hz limiter. Instanced board tiles, cached merged piece meshes and a single instanced particle burst reduce rendering/allocation work. Ground auras use per-piece colors in two shader batches; hidden paused scenes stop drawing, while the visible lobby preview reuses the same scene. The isolated Chromium fixture measured orbit drawing batches falling from 286 to 106 including the four new environment batches, before fracture trails; this measures workload, not a guaranteed FPS on phones.
- **อีเวนท์และภารกิจระหว่างเล่น** adds first blood, immediate recapture, capture streaks, queen loss, material comebacks and the transition to endgame. Counterattacks get crossing slashes, queen-loss energy is purple and comeback energy gold. Three optional match missions award stars for checking, taking a major piece and castling. Event history and stars resume with the game and roll back on undo. These are visual/story objectives; legal chess moves and victory conditions stay standard.
- Key-moment cinematics wait four plies between regular camera cuts. Mate, promotion, royal rescue, queen loss and comebacks bypass the interval. All-specials mode keeps every special-event cutscene available.
- **สนามฝึกท่าสเปเชียล** provides eleven scenarios to try every attack, royal rescue, blocking check, double check, a knight fork and promotion immediately.
- Local games and settings resume from browser storage. Online sessions reconnect from the same browser using a private reconnect token. A shared invite link never includes that token.

## RPG progression and skins

The commander profile earns a level every **200 XP**. Royal Origin, Ember Knights and Frost Guard are available immediately; Astral Order unlocks at **Lv.2 / 200 XP** and Golden Sovereign at **Lv.4 / 600 XP**. Choose a skin independently for each physical piece in either army, including all eight pawns. Origin-square identities follow moves, captures, castling, en passant, promotion and undo. A whole-army selection resets individual overrides. Themes change every class’s geometry, summoned avatar and effect family, with cosmetic rarity and named skills. All shapes are procedural; skins preserve the same chess rules.

The three tactical chapters teach royal rescue, a two-target fork, and a forced mate in two player moves. They use legal chess moves with a turn budget and actual objective detection; the opponent replies through the normal bot. First clears award 60 / 80 / 100 XP. Custom chapter/training positions deploy your equipped class skins. The result panel shows rewards, a physical piece MVP and a brief victory pose; its replay restores the actual board without changing history or claiming XP again. The three standard bot difficulties are named rival armies (Ignis, Selene and Astra).

Completing each training scenario's indicated move awards **40 XP once**. A completed standard bot match awards **80 / 110 / 150 XP** for an Easy/Medium/Hard victory, **35 XP** for a draw or **20 XP** for a loss, plus **20 XP per mission star** (up to three). Completed online matches use the Medium reward and require at least four plies. Same-device two-player matches do not award match XP. Rewards are claimed once per match; undo or reload does not award them again or remove already-earned XP.

Levels, unlocked skins, match records and reward claims are saved in this browser's local storage. The full and offline editions share a profile when served from the same origin; different browsers/origins have separate profiles. Online rooms exchange each owner’s selected army and preserve it through reconnect. Cosmetic unlock ownership remains browser-local; accounts and cloud profile synchronization are future work.

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
npm run test:render
npm run build:offline
npm run test:title
npm run test:hud
npm run test:army
npm run test:audio
```

The browser suite exercises the production build. If system Chromium exists at `/usr/bin/chromium`, it uses that; otherwise it uses Playwright's installed Chromium. Set `CHROMIUM_PATH` to override. Screenshots go into ignored `test-results/`. GitHub Actions runs build, rules/events/server tests and browser smoke tests.

## Implemented gameplay

- Legal moves, castling, en passant, promotion to any legal piece, checkmate and draw detection through chess.js.
- All six procedural 3D pieces, camera controls, board coordinates, selection, last-move and check indicators.
- Unique finisher choreography: pawn spear, knight dash cut, bishop beam, rook cannon, queen blade cage and king sword; defender guard, recoil and death before square occupation.
- Event analysis for check, checkmate, actual checking-piece capture (royal rescue), interposition, king escape, discovered/double check, forks, promotion and castling.
- Anime-style choreography: energy charge and lightning, dash, held impact frame, subtle edge speed lines, explosive rings/slashes, close-up camera cuts and return to the board. Attack/story names use compact side ribbons that slide in/out; large central title panels are removed.
- Letterbox, particles, threat beams, protective king shields and synchronized synthesized charge/impact sounds. Sequences are skippable; reduced effects removes the dramatic choreography.
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

This release is an unranked game, not a persistent competitive platform. There are no accounts, matchmaking, ratings, store, payments or spectators. Bots use a small minimax evaluator rather than Stockfish. Combat avatars are stylized procedural silhouettes with animated weapons, rather than imported character models or hand-authored skeletal animation.

Draws use chess.js automatic threefold/fifty-move detection instead of a tournament claim flow. Timeout awards the other player a win; full FIDE impossible-mate adjudication is not implemented. Add persistent rooms/accounts and refine adjudication before ranked play. See `DEVELOPMENT.md` for architecture and follow-up work.
