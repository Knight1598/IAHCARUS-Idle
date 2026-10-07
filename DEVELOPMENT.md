# Resume development

Use the existing checkout in the isolated workspace. Do not create a worktree unless requested. Start from README commands and run the build and tests after changes.

## Architecture

- `src/main.ts`: local/bot/online state, Thai interface, move submission, settings/storage, promotion, accessible board and room reconnect.
- `src/scene.ts`: procedural models, renderer, board interaction, per-piece capture effects and camera timelines. Idle scenes render on demand; active effects are capped at 30 rendered frames per second.
- `src/bot.ts`: worker-based minimax with alpha-beta pruning. Terminate the worker on mode/reset/undo changes.
- `src/training.ts`: eleven reproducible special-move scenarios, including the white-knight/black-king rescue requested in the design.
- `shared/events.js`: pure before/after move classifier; typed declaration in `shared/events.d.ts`. Capturing an actual previous checker is required for royal rescue. Check/mate takes precedence over defensive events.
- `server/index.mjs`: same-origin HTTP/static and WebSocket service. Owns room games, turn validation, revision numbers, clocks and outcomes; credentials are generated reconnect tokens, not external API keys.

## State and animation contracts

Commit only legal moves. In online mode, wait for server-confirmed state; rebuild Chess from the full history to preserve repetition detection. Use the supplied previous FEN to animate the last confirmed move. Periodic clock snapshots with unchanged revision must not restart animation. Reconnect receives a fresh snapshot with no replay requirement.

Animation displays the previous board, moves the attacker, resolves capture at impact, then rebuilds from the authoritative board. Castling also moves the rook. Promotion geometry is replaced at completion. Skipping any sequence restores the camera and authoritative board immediately. A mated king falls cosmetically but is retained in chess state.

## Validation

`npm test` covers rules, contextual events, room ownership/turns, illegal moves, stale revisions, reconnect token rejection, history restoration, resignation and timeout. `npm run test:browser` starts an isolated production server and verifies real 3D picking, local play, undo/storage, castling, promotion selection, all training effects, worker bot, two-browser PvP, reconnect, resignation and mobile overflow.

Headless software WebGL is slower than hardware rendering. Browser tests use 2D square buttons for most scenarios, with an explicit 3D raycast test. Screenshots are generated into `test-results/`, not committed.

## Priorities after this release

1. Test on real Android/iOS devices and tune cinematic framing, audio and GPU budgets.
2. Improve knight silhouette, impact choreography and promotion transformation; add recapture storytelling and event combinations.
3. Persistent rooms/results, disconnect grace policy, shared server storage and accounts before ratings.
4. Complete FIDE timeout/draw claims and add agreed draws for competitive play.
5. Better bot engine and difficulty progression.
6. Cosmetic themes with equal gameplay; no paid power changes.

Rooms currently live in a single server's memory. Hosting/snapshots preserve files, not ongoing room sessions. Public deployment is separate from a GitHub push.

## Standalone offline edition

`vite.offline.config.ts` defines `__OFFLINE__` and uses vite-plugin-singlefile to inline all application JS and CSS. The bot worker is imported with `?worker&inline`, embedding its code in both builds. `scripts/package-offline.mjs` copies the built HTML to `offline/Special-Chess-Offline.html`, which is deliberately committed as a ready-to-download test artifact. Do not hand-edit this generated HTML.

Offline defaults to bot play, hides mode switching/room UI, ignores room query parameters and online session storage, and saves its game/difficulty under separate keys. Training temporarily switches to a local sandbox; New Game always returns to bot mode. Easy/Medium/Hard use search depths 1/2/3.

After shared source changes, run `npm run build:offline` and `npm run test:offline`. The default test opens the delivered file via file URL with networking disabled, checks every difficulty, and rejects any attempted WebSocket connection. This cloud machine blocks file navigation by managed Chromium policy; the verified local run used `OFFLINE_TEST_TRANSPORT=memory`, fulfilling only the main document from the delivered HTML in memory while networking remained disabled. Do not claim file-origin behavior verified from that run. CI keeps the default file-URL test. Rebuild the normal app and run its browser suite after changing shared code.
