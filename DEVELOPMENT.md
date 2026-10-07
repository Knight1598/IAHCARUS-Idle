# Resume development

Use the existing checkout in the isolated workspace. Do not create a worktree unless requested. Start from README commands and run the build and tests after changes.

## Architecture

- `src/main.ts`: local/bot/online state, Thai interface, move submission, settings/storage, promotion, accessible board and room reconnect.
- `src/title.ts` / `src/lobby.css`: commander lobby, named rival/mode options, tactical chapter selection, individual armory and saved-game resume. `preview` delegates to the scene’s single WebGL context; `audition` runs a read-only training finisher and restores the army.
- `src/profile.ts` / `src/cosmetics.ts`: local profile migration, per-color origin-square loadouts, rarity catalog, 30 avatar/skill names and history-rebuilt appearances. `scenarioLoadout` deploys class-matched equipment for custom training/chapter positions without changing saved origin slots. `equipArmy` resets overrides; launch/resume must not call it when the fallback skin is unchanged. Cosmetic progression preserves chess rules.
- `src/avatar.ts`: pure geometry summons with distinct class silhouettes and animated weapons.
- `src/progression.ts`: named rivals, three legal tactical trials with player-move budgets, and MVP tracking per physical piece.
- `src/presentation.ts`: skippable intro and match results; results appear after animation resolves. Capture replays are visual only and restore the authoritative game.
- `src/hud.ts`: fixed-viewport arena HUD, compact player/status cards, always-visible controls, 2D overlay and utility drawers. Reparents existing controls without changing IDs or gameplay handlers; drawers do not resize the WebGL stage. Offline hides room access; the full build opens it when entering online mode.
- `src/cinematic.ts`: pure phase timing and subtle procedural edge overlay. No chess mutation; charge/dash/impact/aftermath/return phases. Attack/story labels use sliding DOM ribbons, with no central manga/text panel.
- `src/combat.ts`: per-piece visual identity and short-move choreography, including slow approach and held contact.
- `src/sound.ts`: four shuffle-bag recipe variants per class/phase and contextual event cues, built from six independent sound families using different waveforms, rhythms, harmonics and noise filters; shared stereo echo, compressor and volume control. Delayed carriers/modulators are tracked and stopped on cancellation, including voices whose start time has not arrived. Mute affects sound alone.
- `src/scene.ts`: procedural models, renderer, board interaction, per-piece capture effects and camera timelines. Idle aura pulses target 20 FPS (8 on Low); reduced effects returns to on-demand idle rendering. Movement/camera interaction targets 60 FPS, with heavy cinematic sequences capped at 30 on narrow stages. Camera motion reuses the board shadow map; moves/board rebuilds invalidate it. These are render targets, not measured hardware guarantees.
- `src/gameplay.ts`: capture history, material balance and cinematic pacing decisions. Material comes from the current board, so promotions and custom training positions work correctly; captured pieces come only from actual history.
- `src/battle.ts`: deterministic match stories and per-color mission stars, reconstructed from verbose move history. Recapture requires immediately capturing the preceding attacker on its destination; a comeback requires material to flip from behind to ahead. Queen loss and endgame thresholds are separate from check/mate classification. Story/UI snapshots are cached until game state changes.
- `src/bot.ts`: worker-based iterative minimax with alpha-beta pruning, depths 1/2/3 and thinking budgets 150/700/1,800 ms. Keep the last completed depth when the deadline interrupts a deeper search. Terminate the worker on mode/reset/undo/side/difficulty changes.
- `src/training.ts`: eleven reproducible special-move scenarios, including the white-knight/black-king rescue requested in the design.
- `shared/events.js`: pure before/after move classifier; typed declaration in `shared/events.d.ts`. Capturing an actual previous checker is required for royal rescue. Check/mate takes precedence over defensive events.
- `server/index.mjs`: same-origin HTTP/static and WebSocket service. Owns room games, turn validation, revision numbers, clocks and outcomes; credentials are generated reconnect tokens, not external API keys.

## State and animation contracts

Commit only legal moves. In online mode, wait for server-confirmed state; rebuild Chess from the full history to preserve repetition detection. Use the supplied previous FEN to animate the last confirmed move. Periodic clock snapshots with unchanged revision must not restart animation. Reconnect receives a fresh snapshot with no replay requirement.

Unchanged revision/presence snapshots update clocks without rebuilding the UI, preserving keyboard focus and avoiding needless history/board work once per second. Presence changes still refresh player labels.

Animation displays the previous board. Captures stop outside the defender, wind up and strike; impact and death have separate once-only callbacks, the defender reacts and fades, then the attacker occupies the destination. `setAppearances(beforeMap, afterMap)` promotes the after map only on finish, so the victim and attacker retain the correct skins. Completion rebuilds the authoritative board. Castling also moves the rook. Promotion geometry is replaced at completion. Skipping any sequence restores the camera and authoritative board immediately. A mated king falls cosmetically but is retained in chess state.

Bot searches start during the human move's animation. Replies carry the position FEN and wait until the animation completes; worker identity and FEN checks prevent stale replies. Finish callbacks queue the next action in a microtask so camera/settings handlers can complete before another animation begins. Human color is saved with local history; old saves default to white. A black-side opening cannot be undone until a human move exists, and normal bot undo removes the human turn plus any bot reply.

Boot restores the game behind the title screen without starting a bot or connecting a room. Launch/resume shows the existing scene and enables rendering; returning to the title finishes the current animation, clears selection and terminates the bot. `setShowcase(host)` reparents the existing canvas and renders the visible lobby while menu-paused; `setShowcase(null)` returns it to the arena. No additional WebGL context is created. Keep one scene/context for repeated menu visits. Active online matches cannot return to the menu because server clocks continue. Clear training/local reward context when a room snapshot becomes the active game.

`special-chess-profile` stores XP, fallback skin, per-color origin-square loadouts, completed-match counts and claimed reward IDs. Local saves carry a stable `matchId`; training uses `training:<scenario>` and online uses `room:<code>`. Reward checks run before the result UI refresh. Undo rolls back history/mission stars but never XP or claims. Trial context is saved as `activeTrial` and validated against its initial FEN; first clears use `trial:<key>`. Win/loss is reconstructed from history and stops bot scheduling immediately when the player budget expires. Training context is restored from its initial FEN; only standard-start bot matches earn match rewards. The profile is browser-local, not a server-authoritative economy.

## Validation

`npm test` covers rules, contextual events, room ownership/turns, illegal moves, stale revisions, reconnect token rejection, history restoration, resignation and timeout. `npm run test:browser` starts an isolated production server and verifies real 3D picking, local play, undo/storage, castling, promotion selection, all training effects, worker bot, two-browser PvP, reconnect, resignation and mobile overflow.

Profile tests cover malformed saves, level unlocks and claim deduplication. After building the offline artifact, `npm run test:title` checks desktop/mobile menus, starter skins, first-clear XP, bot launch as black, paused menus, saved-game resume and an unlock after a completed match. It serves the single-file document from memory with networking disabled and makes no external requests.

`npm run test:hud` checks bot controls and all available drawers at desktop, portrait and landscape sizes, no page overflow, stable stage bounds while opening drawers, Escape, quick mute during an ongoing attack, compact event dimensions and shader compilation without console errors. Gameplay browser tests open utility panels through the real HUD; close the 2D overlay before testing direct 3D picking.

Headless software WebGL is slower than hardware rendering. Browser tests use 2D square buttons for most scenarios, with an explicit 3D raycast test. Screenshots are generated into `test-results/`, not committed.

`npm run test:render` creates an isolated Vite renderer fixture without a second game loop. It drags the actual OrbitControls, checks drawing/geometry budgets, repeated board rebuilds, camera-preserving quality changes, an instanced particle burst, opaque cached pieces after a phantom attack, cinematic cooldown and the mate exception. Baseline orbit batches were 286; the current fixture draws 102, with 45 uploaded geometries rather than 270. These are workload measurements in software Chromium, not device FPS benchmarks.

The same fixture checks every-move lock/charge/slow approach/contact callbacks, all six charge identities and reduced-effects cleanup. OfflineAudioContext renders six full lock/charge/dash/contact sequences and verifies non-silent distinct signals, headroom, source cleanup and silent cancellation. It writes an ignored `test-results/space-audio-six-pieces.wav` preview in pawn/knight/bishop/rook/queen/king order.

`npm run test:audio` uses a separate isolated Vite audio fixture to render all 144 piece variants (lock, charge, movement, impact, death and check for six classes) and 88 contextual event variants. It checks four distinct rendered waveforms per action, non-silent output, headroom, source cleanup, a combined combat/check/story mix at full volume and cancellation of future FM/event layers. `tests/sound.test.mjs` additionally verifies shuffle-bag exhaustion and no immediate repeats across bag boundaries, structural differences beyond pitch, level/timing bounds and cancellation scheduling. These checks validate synthesis and output behavior, not subjective sound quality or phone loudness.

Board squares use two instanced batches; raycasting maps `instanceId` back to a square. Piece body/accent meshes are merged per type/color and cached. Shared geometry/material flags prevent board resets or capture cleanup from disposing the cache. Phantom copies clone their materials before adjusting transparency. Spark particles use one instanced mesh; cancellation disposes its instance buffers too. Quality changes resize only the render buffer and preserve camera/animation; Auto reduces pixel ratio after sustained slow frames, Low removes shadow rendering, High restores the sharper resolution. Normal/orbit rendering follows the browser's display callback directly; only heavy narrow-screen cinematics retain a 30 Hz limiter.

Online snapshot `cosmetics` freezes each owner’s sanitized starting loadout at create/join; reconnect keeps it. Skin ownership/XP remains local and is not an authoritative economy.

`npm run test:army` exercises per-piece equip/reload, read-only armory audition, all tactical chapters, failure/undo, first-clear reward deduplication and capture replay restoring results.

Piece caches include the skin ID. Mixed indexed/non-indexed primitives (the Ember pawn's octahedron, for example) are normalized before merging into the same two material batches. Renderer tests build all five armies, check actual pawn geometry/colors and board positions, and verify that a paused title draws no GPU frames.

## Priorities after this release

1. Test on real Android/iOS devices and tune cinematic framing, audio and GPU budgets.
2. Refine procedural character faces, weapon motion, camera composition and promotion transformations with real-player feedback.
3. Persistent rooms/results, disconnect grace policy, shared server storage and accounts before ratings.
4. Complete FIDE timeout/draw claims and add agreed draws for competitive play.
5. Better bot engine and difficulty progression.
6. Expand the cosmetic collection and RPG campaign; keep competitive rules equal.

Rooms currently live in a single server's memory. Hosting/snapshots preserve files, not ongoing room sessions. Public deployment is separate from a GitHub push.

## Standalone offline edition

`vite.offline.config.ts` defines `__OFFLINE__` and uses vite-plugin-singlefile to inline all application JS and CSS. The bot worker is imported with `?worker&inline`, embedding its code in both builds. `scripts/package-offline.mjs` copies the built HTML to `offline/Special-Chess-Offline.html`, which is deliberately committed as a ready-to-download test artifact. Do not hand-edit this generated HTML.

Offline starts at the title screen, offers bot/local/training modes there, hides in-match mode tabs/room UI, ignores room query parameters and online session storage, and saves its game/difficulty under separate keys. Training temporarily switches to a local sandbox; New Game from training returns to bot mode, while a regular local game stays local. Easy/Medium/Hard target search depths 1/2/3 with bounded thinking time.

After shared source changes, run `npm run build:offline` and `npm run test:offline`. The default test opens the delivered file via file URL with networking disabled, checks every difficulty, and rejects any attempted WebSocket connection. This cloud machine blocks file navigation by managed Chromium policy; the verified local run used `OFFLINE_TEST_TRANSPORT=memory`, fulfilling only the main document from the delivered HTML in memory while networking remained disabled. Do not claim file-origin behavior verified from that run. CI keeps the default file-URL test. Rebuild the normal app and run its browser suite after changing shared code.

## Anime cinematic update

Dramatic capture/special-event sequences last 2.8 seconds (mate 3.8); normal moves take 780 ms and non-dramatic specials 1,150 ms. All non-reduced moves charge, launch, slow their final approach, hold at contact and release. Key-moment pacing controls camera cuts; checks, royal defense, major captures, forks, promotion, castling and en passant retain dramatic scenes. The all-events setting restores dramatic scenes for every special event. `onDash` and `onImpact` trigger sound at actual visual boundaries. Particles stop at contact, move slowly during early release, then resume full speed. `onCancel` fades/stops outstanding sounds. Skip, reset, resize and effect-setting changes must restore the authoritative board, camera, overlay and controls.

Ground runes and radial glow merge into two additive single-pass shader meshes, one per army. A shared clock rotates each piece's rune around its center and pulses its glow; low-rate idle redraws stop when the scene is paused. Moving pieces get a procedural charge group and one dynamic line-segment trail. Floor fractures reveal behind travel using geometry draw ranges, persist through board rebuilds, then fade over seven seconds. The pool is capped at four trails and is cleared on reset/undo/training or reduced effects. Dark ribbons and colored crack cores use two batches per trail. Shape counts, heights and trajectories vary by piece. Capture defenders clone their materials before recoil and fading; shared cached geometry stays valid and later pieces remain opaque. Reduced effects rebuilds the board without runes and uses the existing 180 ms move path.

In key-moment mode, regular camera cuts have a four-ply interval; mate/promotion/rescue and urgent queen-loss/comeback stories bypass it. New game, undo and training reset pacing. Strong stories replace the capture title while preserving contextual check/mate/rescue names and per-piece attack visuals. The toast sits above the bottom controls during a cinematic to keep the main title readable. Turning off match events hides stories/missions and removes story-driven camera cuts while retaining classic special-move effects. Stars are derived from real move history, so undo, saved games and online snapshots agree.

Only cinematic + non-reduced mode enables camera cuts, shaking and subtle edge overlays. Event/attack ribbons slide from the side and expire after 2.2/1.6 seconds; a story ribbon suppresses the duplicate attack label. Reduced mode stays at 180 ms with no overlay. The single soft impact pulse is tested to avoid repeating flashes. Disposal handles mesh, line and point geometry; particles belong to `fx` and are disposed there on cancellation.

Offline browser tests execute black-side play, undo/save restoration, illegal-move feedback, capture tracking, pacing and thinking during animation, plus a full charge-to-return sequence with sound enabled. They capture screenshots, make a real 3D move after camera return, and exercise skip plus non-cinematic/reduced modes. Keep the WebGL canvas selector specific (`canvas.first()`) because the effects overlay adds a second canvas.

## Static web deployment

`npm run build:pages` builds the offline edition and packages it as `dist-pages/index.html` plus `.nojekyll`. `.github/workflows/pages.yml` builds, tests the real Pages subpath, uploads the static artifact and deploys via GitHub Pages. Permissions are limited to contents read for build and pages/id-token write for deployment.

One-time Pages source configuration requires repository settings access. This cloud instance denies the `api.github.com` and `knight1598.github.io` network destinations, so API enablement and public URL verification cannot be performed here. Do not claim the site live solely from a Git push or predict a successful deployment; check the workflow's published URL and deployment outcome. Do not request a new token merely because API access is blocked by networking.
