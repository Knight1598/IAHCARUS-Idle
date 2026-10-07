# Special Chess 3D

Browser chess prototype built in the IAHCARUS-Idle repository. All board and piece geometry is generated in code; no external models or textures.

## Run

Requires Node.js 22.12+ (tested with Node 24).

```sh
npm ci --cache /tmp/special-chess-npm
npm run dev
```

Open the address printed by Vite. Select a piece, then a highlighted destination. Drag to orbit; scroll to zoom. Two people play locally on the same device.

```sh
npm run build
node --test tests/rules.test.mjs
npm run preview
```

## Implemented

- Procedural 3D models for all six piece types, lighting and shadows.
- Legal chess moves through chess.js, promotion picker, castling, en passant, checkmate and draw detection.
- Move animation (including knight jump), capture particles, event banners, history, reset and skip animation.
- Responsive layout and orbit camera.

## Next milestones

1. Distinct attack animations for every piece (currently attack names share the same capture particles).
2. Cinematic camera sequences for check, royal rescue and checkmate; current implementation uses banners, not complete cutscenes.
3. Better event classification: blocking check, forks, discovered checks and double checks.
4. Synthesized audio, reduced-motion setting and mobile performance testing.
5. Server-authoritative PvP rooms with Colyseus, clocks and reconnect support.
6. Accounts, ratings and cosmetic purchases after multiplayer validation.

No online multiplayer, AI opponent, payment system or sound is included yet. Animation is cosmetic and does not alter chess rules. Threefold repetition and fifty-move outcomes currently follow chess.js automatic draw detection rather than a player claim UI.
