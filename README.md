# Special Chess 3D

A playable tactical chess board game with six additional board modes, an original geometric UI, player character creation, optional server accounts and a 3D duel lobby, individual piece cosmetics, spectral combat avatars, signature finishers, eight reactive arenas, tactical chapters, rotating daily challenges and Thai UI. All piece geometry, textures, effects and synthesized sounds are generated in code. No external art or model downloads.

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

Download [`offline/Special-Chess-Offline.html`](offline/Special-Chess-Offline.html) using GitHub's **Download raw file** button, then open it in desktop Chrome/Edge. This single-file edition opens a title screen with bot play (Easy/Medium/Hard), three tactical chapters, same-device two-player play, training and a per-piece armory. It includes all procedural 3D effects, skins and local cosmetic progression, requires no Node server or Internet connection, and excludes online rooms. See the [Thai offline guide](offline/README.md).

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

- Start at the 3D **Title → Main menu → Mode → Battle rules → Skills (Special Duel) → Skins → Arena → Battle** flow. Enter or **เริ่มดวล** opens the main menu. Choose a rival, chapter or training scenario, equip your army, then confirm the field to start. Each screen shows one decision; Back/Escape and completed step buttons preserve your choices. The main menu also offers the armory, settings, help and saved-match resume. The menu reuses the arena’s single WebGL context and only rebuilds its army preview when cosmetics or the previewed piece change.
- The arena fills the viewport on desktop and portrait/landscape mobile layouts. The bottom HUD keeps undo, view, flip, skip, 2D and quick sound controls on screen. **☰ เมนู** or Escape opens pause; new game, bot difficulty, missions, history, settings, training and room controls live there. Offline pause stops the bot and freezes combat animation time; resuming continues that animation. Online matches and clocks continue, with a notice in the menu. Panels do not resize the board and keep keyboard focus inside them. **กลับเมนูหลัก** preserves the saved match and returns directly to the main menu; active online matches must finish or be resigned first. Match results offer XP/MVP, replay, retry/next chapter and return to camp.
- **เล่นกับบอต**: choose white or black against a worker-based bot; choose one of three search depths.
- **สองคน**: share one device; white moves first.
- **ออนไลน์**: create a private room and share its invite link/code. The creator is white; the guest is black. Both players need to reach the same running server.
- Select a piece, then a highlighted destination. Drag to orbit and scroll to zoom. Use the 2D board for keyboard play or when WebGL is unavailable.
- Every move has a ground aura, selection rune, target lock, charge, energy trail and slow final approach. Standing auras rotate and breathe softly. Energy fractures appear behind movement and fade over seven seconds; at most four fracture trails remain. Captures approach outside the defender, wind up, strike, hold contact, animate defeat and only then occupy the square. Summoned fighters now bend at the hips, torso, head, elbows and knees, with moving capes, weight shifts, follow-through and recovery. Pawns thrust spears, knights twist into diagonal cuts, bishops gather and release spells, rooks brace against cannon recoil, queens command sweeping blades and kings deliver heavy overhead cleaves. Each defender guards and staggers according to its class. Flowing aura filaments, charge helixes, layered rune seals, soft-edged attack ribbons, pressure waves, motes and prismatic fragments have distinct class/skin signatures. Shields have translucent rims and energy grids. Cinematic cameras frame both fighters, weapons and auras on wide and portrait screens. Skip any sequence or reduce effects; sound is opt-in.
- Choose **โลกแห่งการประลอง** in the lobby or **สนามประลอง** in settings: Star Citadel, Ember Forge, Frost Sanctum, Astral Rift, Storm Spire, Moonlit Grove, Neon Reactor and Eclipse Dunes. Each has procedural structures, board colors, lighting, ambient particles and a distinct impact field (royal seal, lava burst, ice spokes, dimensional spiral, branching lightning, leaf spiral, reactor grid or sandstorm). All eight are available immediately. Your field choice persists locally and applies to the lobby and game; online players can choose their own cosmetic field.
- Bot play supports either color, automatic camera orientation, saved side selection and undo back to your previous turn. Capture lists and material advantage help you read the match; illegal destinations keep your piece selected and explain what to check.
- **Duel Draft + Living Field** adds separate 12-point skill budgets, one opponent ban per side, and a public reveal before launch. Deterministic energy nodes and portals announce their squares two rounds ahead. Storm, Void and Prism captures have procedural execution sequences with a short audio anticipation pause. [Rules and testing](docs/DUEL-DRAFT.md).
- **Freestyle Special Duel** selects two real ultimates per class, three starting formations, 0/1/3/5/9 team charges and one-use/reusable pieces in a dedicated skill preparation screen. Both bots and saved matches use these rules. Eight cosmetic sets now include Storm Circuit, Void Reaper and mythic Prism Ascendant, with unique aura shapes, choreography and audio. Filter the armory by owned skins or rarity. See [freestyle rules and skins](docs/FREESTYLE.md).
- **Anime Cinematic Combat v2** gives every capture a five-phase 2.6-second exchange: face-off, opening attack, reactive defense/counter, decisive strike and dissolution/return. Settings offer 2 or 3 seconds. Six classes and all eight skins have distinct procedural motion, weapon/aura shapes and finishes; defense is cosmetic and cannot change the committed chess result. Paired cameras fit both actors in portrait and landscape. Skip settles the board once and eases the camera home in 150 ms. Ordinary moves remain 780 ms; other dramatic events remain 2.8 seconds (mate 3.8). Reduced effects uses 180 ms moves. See [combat design and limits](docs/CINEMATIC-COMBAT.md).
- **เสียงอวกาศ · ไซไฟอนิเมะ** now uses layered, cached PCM: material transients, FM/resonant body, phone-audible weight, spectral textures and controlled stereo hall reflections. Each class/action has four shuffled takes, and skins change material/rhythm. Nine frame-driven capture cues follow the actual choreography. A 70 BPM D-minor/Phrygian score evolves over sixteen bars with D/A drones, pads, metallic bells and orchestral pressure pulses; threat/check, ultimate and result states change the arrangement, while impact ducks the soundtrack by 3–6 dB. Eight arenas have distinct ambience beds. Master, Music, Ambience, SFX, Cinematic and mute controls persist. Audio starts only after an explicit sound gesture; one context owns all voices. Skip/reset cancels effect voices and their embedded room tails while music/ambience continue. See [audio architecture and checks](docs/CINEMATIC-AUDIO.md).
- Bots think during your animation and apply their reply when it finishes. Iterative searches target depths 1/2/3 with thinking budgets of 150/700/1,800 ms; a slow device uses the last completed depth. Idle auras refresh at up to 20 FPS (8 in Smoothest graphics); reduced effects renders idle boards on demand. Movement and cinematic cameras follow display frames; Auto uses the smaller effects budget on narrow screens before reducing animation quality. Actual frame rate depends on hardware.
- **กราฟิก** offers Auto, Smoothest (lower resolution, no shadows), and Sharp. Auto starts at a modest pixel ratio and lowers it under sustained slow frames. Orbit rotation follows display frames without a second 60 Hz limiter. Instanced board tiles, cached merged piece meshes and a single instanced particle burst reduce rendering/allocation work. Ground auras use per-piece colors in two shader batches; hidden paused scenes stop drawing, while the visible lobby preview reuses the same scene. The isolated Chromium fixture measured orbit drawing batches falling from 106 to 77 after the coordinate atlas and luminous board rails, including the four environment batches, before fracture trails; this measures workload, not a guaranteed FPS on phones.
- **อีเวนท์และภารกิจระหว่างเล่น** adds first blood, immediate recapture, capture streaks, queen loss, material comebacks and the transition to endgame. Counterattacks get crossing slashes, queen-loss energy is purple and comeback energy gold. Three optional match missions award stars for checking, taking a major piece and castling. Event history and stars resume with the game and roll back on undo. These are visual/story objectives; legal chess moves and victory conditions stay standard.
- Every enabled capture bypasses the camera cooldown. Non-capture key-moment cuts still wait four plies unless mate, promotion, royal rescue, queen loss or a comeback; All-specials mode keeps every special-event cutscene available. Cinematic and reduced-effects controls remain available.
- **ห้องทดลองการต่อสู้** in the main menu selects any attacker/defender class, both skins and an arena without changing the match or XP. Its Audio tab offers controlled A/B skin auditions, fourteen actions, twenty-two events and nine soundtrack states. The preview reuses the same renderer and audio context.
- **คลังสมบัติและสุ่มสกิน** adds saved play credits, duplicate shards, a chosen-skin forge and daily provisions. Capsules cost 150 credits; the next pull's odds and an eight-pull Golden Sovereign guarantee are visible. Collected skins equip on individual pieces immediately; existing XP unlocks persist. Five economic modes offer capture bounties, control-point rewards, draft savings, higher stakes against bots and free Puzzle Payday. Entry and result settlement persist without duplicate payment. See [rules, prices and save behavior](docs/ECONOMY.md).
- **สนามฝึกท่าสเปเชียล** provides eleven scenarios to try every attack, royal rescue, blocking check, double check, a knight fork and promotion immediately.
- Local games and settings resume from browser storage. Online sessions reconnect from the same browser using a private reconnect token. A shared invite link never includes that token.

## Special Duel — ultimate board combat

Choose **Special Duel** in the mode screen, then select a bot (three levels) or two players on the same device. Each side has **3 shared ultimate charges**; each physical piece can use an ultimate **once per match**, including after promotion. An ultimate replaces one ordinary move and does not grant a second move or a permanent change to the piece's attack pattern.

| Piece | Ultimate movement for one turn |
| --- | --- |
| Knight | Queen lines, with no jumping over blockers |
| Bishop | Orthogonal movement/capture up to two squares |
| Rook | Diagonal movement/capture up to two squares |
| Queen | A knight jump |
| Pawn | Capture one square directly ahead, including promotion |
| King | Move two orthogonal squares through empty, unattacked squares; no capture |

Select a piece → press its ultimate → preview the colored targets → select a destination → **confirm**. Cancel before confirmation to keep the charge. Both sides see reserve diamonds; small board diamonds identify pieces that retain their ultimate. The skill guide can inspect an opponent's currently legal ultimate destinations without submitting a move. Those destinations may change after your move; they are potential skill moves, not continuous check attacks.

Own-king safety remains mandatory. Check uses the piece's normal attack pattern after the move, while checkmate and stalemate also consider available ultimate escapes. The bot searches both ordinary moves and ultimates using the same reserve rules. Undo, save/reload, per-piece skins, capture replay and the result MVP preserve special moves and their physical identities. Results offer a color-swapped rematch. Variant exports use a `Variant "Special Duel"` header and `U:` notation; they are not standard chess PGNs. Private online rooms continue to use standard chess.

## Tactical board and cosmetic collection

Board tiles have procedural brushed plates, corner etchings and shared luminous edge rails. All sixteen coordinate labels use one texture atlas and drawing batch. Quiet moves use small green dots; captures use pink hexagonal reticles and tile corner brackets. These destinations are instanced in separate move/capture batches, including a single marker for promotion destinations. Hover a legal target in 3D, or hover/focus a 2D square, to preview the route, actual capture (including en passant), castling, promotion, check/mate and enemy control of the destination. The preview reads a disposable chess position and never commits a move. Mouse drag, leaving the board, pause and completed moves clear the preview. The 2D board also marks last moves and the checked king.

The duel UI uses cyan, violet and orange accents, distinct colors and emblems for each mode, skin-colored collection cards and arena-colored selections. Its menu ornaments animate transforms and opacity only; reduced effects disables them. Duel setup is the main action; daily tactics sits below the duel controls and cosmetic XP is shown in the armory. A compact objective button on the battlefield shows progress and opens the mission drawer without covering the board with a central panel.

**ศึกประจำวัน / Daily Rift** is available from the main menu or mode selection, including offline. Four tactical objectives (royal rescue, knight fork, mate in one and forced mate in two) rotate through sixteen legal mirrored/color-swapped positions, with a recommended arena that you can change. The calendar resets at **00:00 UTC / 07:00 Thailand time** using the device clock. A clear awards **80 XP**, plus **10 XP per consecutive previously completed day**, capped at **120 XP**; retries, undo and reload cannot claim that date twice. A missed day resets the streak. An unfinished saved puzzle retains its original date and board after midnight; selecting a new daily challenge uses today's puzzle. Claims and streaks use the existing browser-local profile and require no network or extra assets.

The commander profile earns a level every **200 XP**. Royal Origin, Ember Knights and Frost Guard are available immediately; Astral Order unlocks at **Lv.2 / 200 XP**, Storm Circuit at **Lv.2 / 200 XP**, Golden Sovereign at **Lv.4 / 600 XP**, Void Reaper at **Lv.6 / 1000 XP** and Prism Ascendant at **Lv.8 / 1400 XP**. Choose a skin independently for each physical piece in either army, including all eight pawns. Origin-square identities follow moves, captures, castling, en passant, promotion and undo. A whole-army selection resets individual overrides. Themes change every class’s geometry, summoned avatar and effect family, with cosmetic rarity and named skills. All shapes are procedural; skins preserve the same chess rules.

The three tactical chapters teach royal rescue, a two-target fork, and a forced mate in two player moves. They use legal chess moves with a turn budget and actual objective detection; the opponent replies through the normal bot. First clears award 60 / 80 / 100 XP. Custom chapter/training positions deploy your equipped class skins. The result panel shows rewards, a physical piece MVP and a brief victory pose; its replay restores the actual board without changing history or claiming XP again. The three standard bot difficulties are named rival armies (Ignis, Selene and Astra).

Completing each training scenario's indicated move awards **40 XP once**. A completed standard bot match awards **80 / 110 / 150 XP** for an Easy/Medium/Hard victory, **35 XP** for a draw or **20 XP** for a loss, plus **20 XP per mission star** (up to three). Completed online matches use the Medium reward and require at least four plies. Same-device two-player matches do not award match XP. Rewards are claimed once per match; undo or reload does not award them again or remove already-earned XP.

Levels, unlocked skins, match records and reward claims are saved in this browser's local storage. The full and offline editions share a profile when served from the same origin; different browsers/origins have separate profiles. Online rooms exchange each owner’s selected army and preserve it through reconnect. Cosmetic progress remains browser-owned. The Node edition now supports durable username/password accounts, a saved player character and explicit cosmetic-profile backup/restore. GitHub Pages and the standalone file provide a local guest profile and do not run an account server. See [account deployment](ACCOUNT_DEPLOYMENT.md).

## Additional board modes and player identity

The mode screen groups battles into **Duel / Arena / Tactics**. Each new mode has its own rules, objective HUD, saved match, undo and replay. Draft, Score, Control, Mirror and Chaos support three bot difficulties or two players on the same device; private online rooms continue to use ordinary chess.

| Mode | Rules |
| --- | --- |
| Draft Arena | Choose one king and 2–8 other pieces with at most 24 material points. The opposing roster uses exactly the spent budget. Your chosen roster belongs to your selected color; castling is disabled. |
| Score Clash | Capture values: pawn 1, knight/bishop 3, rook 5, queen 9. After both players have made 12 moves, the higher capture score wins. Checkmate wins immediately. |
| Control Arena | Occupy d4/e4/d5/e5. After each complete round, each side occupying at least one central square gets one point. First to 5 wins; reaching 5 together draws. Checkmate wins immediately. |
| Mirror Duel | A deterministic compact army is mirrored for both sides. Play two rounds from the same starting position, swapping colors. Wins give one point, draws half a point; the final panel totals the original players' scores. |
| Puzzle Rush | Three minutes of active play, mate-in-one puzzles and three misses. Next Puzzle records the attempt once; undo before advancing rolls it back. Pause, the title screen and a hidden browser tab stop the timer. The best completed-run score is stored locally. |
| Chaos Arena | A forecasted three-phase cycle changes after every full round: ordinary movement, extra one-square diagonal knight movement, extra one-square orthogonal bishop movement. Additional actions must keep the king safe. Continuous attacks/check still use the piece's ordinary pattern. |

The **challenge code** carries a version, mode, seed, Draft roster and arena. Copy it into a friend's game to reproduce the setup or puzzle sequence. This is a shared configuration, not an online room or authenticated result. Draft and Mirror display the actual starting army in setup.

**Create Your Player** opens a procedural character designer with three silhouettes, four crests, four accent palettes and a display name. These are cosmetics. Every interface uses the same original SVG logo, geometric piece symbols, angular controls and button feedback; there are no icon-font, emoji, external image or font downloads. Reduced-motion preferences suppress button effects.

On the Node-hosted edition, the player window also offers real registration/login, HttpOnly sessions and durable SQLite accounts. Save/load cosmetic progress explicitly from the profile screen. The Pages build creates a local profile without password storage. To activate public accounts, deploy the Node server with a persistent data volume and HTTPS as documented in [ACCOUNT_DEPLOYMENT.md](ACCOUNT_DEPLOYMENT.md).

## Development

Run these in separate terminals:

```sh
npm run server
npm run dev
```

Vite proxies `/ws` and `/api` to the server on port 3000. Restart the server after changing server code. Production uses one Node process for both HTTP and WebSocket, so the client uses the same host and selects `wss` automatically under HTTPS.

```sh
npm run build
npm test
npx playwright install chromium
npm run test:browser
npm run test:render
npm run build:offline
npm run test:title
npm run test:daily
npm run test:tactics
npm run test:special
npm run test:modes
npm run test:player
npm run test:hud
npm run test:army
npm run test:audio
npm run test:showcase
npm run test:economy
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

This release is an unranked game, not a persistent competitive platform. Username/password accounts and cosmetic backups are supported on the Node server. There is no matchmaking, ratings, store, payments or spectators. Bots use a small minimax evaluator rather than Stockfish. Combat avatars are stylized procedural silhouettes with animated weapons, rather than imported character models or hand-authored skeletal animation.

Draws use chess.js automatic threefold/fifty-move detection instead of a tournament claim flow. Timeout awards the other player a win; full FIDE impossible-mate adjudication is not implemented. Add persistent rooms and refine adjudication before ranked play. Accounts already use SQLite; their cosmetic backups are not an authoritative economy. See `DEVELOPMENT.md` for architecture and follow-up work.
