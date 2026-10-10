# Open-source UI and tactical composition

IAHCARUS keeps its procedural 3D board and custom geometric game interface.
Two small open-source libraries support interface motion and contextual
positioning; the existing chess engine supports tactical inspection.

## Selected libraries and provenance

| Library | Resolved version | License | Use in this project |
| --- | --- | --- | --- |
| [Anime.js](https://github.com/juliangarnier/anime) | `animejs` 4.5.0 | MIT | Short, cancellable interface transitions through its WAAPI API. |
| [Floating UI](https://github.com/floating-ui/floating-ui) | `@floating-ui/dom` 1.8.0 | MIT | Contextual interactive details positioned beside their trigger and constrained by the viewport. |
| [chess.js](https://github.com/jhlywa/chess.js) | 1.4.0, already present | BSD-2-Clause | Legal move generation and position inspection; no additional chess engine. |

Evidence was checked on 2026-10-10 against the installed published packages:
their `package.json`, license texts, exports and implementation/type files.
Package versions and integrity hashes are recorded in `package-lock.json`.
This does not claim that remote documentation pages were successfully opened.

Anime.js has no runtime package dependencies in this release. Floating UI DOM
resolves `@floating-ui/core` 1.8.0 and `@floating-ui/utils` 0.2.12; all three
published licenses are MIT and their license texts are identical. Retained
copies and exact copyright notices are available in
[Anime.js attribution](../third-party/animejs/NOTICE),
[its license](../third-party/animejs/LICENSE),
[Floating UI attribution](../third-party/floating-ui/NOTICE) and
[its license](../third-party/floating-ui/LICENSE).

The exact primary published source packages are
[Anime.js 4.5.0](https://registry.npmjs.org/animejs/-/animejs-4.5.0.tgz) and
[Floating UI DOM 1.8.0](https://registry.npmjs.org/@floating-ui/dom/-/dom-1.8.0.tgz).
The upstream library code is used through its public APIs without modification.
Game-specific visuals and rules remain project code.

## Interface motion

`src/game-motion.ts` imports the narrow `animejs/waapi` API. Page entry uses a
200 ms opacity transition and 210 ms card opacity/translation transitions,
limited to 12 visible cards with stagger capped at 144 ms. Reward entry uses
a 160 ms container transition and 260 ms card transitions, limited to 10 cards
with stagger capped at 315 ms. Cards outside these small sets remain static.
The library delegates the transitions to the browser's Web Animations API;
the Three.js rendering loop and combat timeline are unchanged.

The operating system's `prefers-reduced-motion` setting and the game's
`#reduced` checkbox both disable this nonessential motion. Changing either
preference cancels active transitions. Navigation, superseding transitions
and backgrounding the document also cancel animations and restore the
original theme styles. There is no persistent UI animation loop. Buttons
and rewards are actionable immediately, and these transitions do not change
chess timing, move legality or the online protocol.

## Contextual information and tactical inspection

`src/game-help.ts` provides one shared, click-operated help panel for setup
chapters, per-piece skill comparisons and the tactical inspector's explanation.
Floating UI's `computePosition` uses offset, flip and shift middleware to place
the panel beside its trigger with viewport padding. CSS bounds its size and
allows longer descriptions to scroll. `autoUpdate` observes only the open
trigger/panel pair; closing or switching the panel runs its cleanup. Outside
interaction, navigation and document backgrounding also close the panel.
Escape is handled before the underlying menu's navigation handler, dismisses
the panel and restores focus to its trigger. A keyboard-opened panel focuses
its close control. There is no permanent per-frame positioning loop.

Selecting a piece now immediately shows the tactical inspector with either
mouse or touch. Selection does not add a new two-tap move confirmation flow.
It counts the legal destinations and captures exposed by the active game's
rules, including an armed ultimate's allowed moves. Expanded details name
opposing and friendly controllers with their board coordinates. Destination
previews update that information for the resulting position; when the king
is in check, the inspector names the checking pieces and indicates a preview
that resolves check.

The `#arena-intel` rail stacks variant rules, field forecasts and tactical
inspection beside the board. Tactical detail is initially collapsed, the rail's scrolling is
bounded, and combat cinematics or an open pause drawer hide the rail. This
organizes the existing information without adding a new game mode.

Controller lists describe ordinary piece geometry and include pinned pieces.
They do not guarantee a legal recapture, establish that a square is safe,
or model ultimate/field-event threat patterns. The inspector is gameplay
assistance, not an automated move chooser or a Stockfish evaluation. chess.js
remains the source of ordinary chess legality; special variants and online
matches keep their existing authoritative rules. Inspection and move previews
do not consume skills or mutate the authoritative board.

No stock icons, character assets, external fonts or remote stylesheets are
provided by these libraries. Buttons and diagrams retain the game's own
geometric design rather than importing a dashboard theme.

## Distribution and verification

Vite bundles the library code into the game; there is no runtime CDN or plugin
download. `scripts/package-offline.mjs` embeds Anime.js, all three Floating UI
packages, and the existing chess.js license notices into
`offline/Special-Chess-Offline.html`. The source license copies also remain in
the repository. Build the distribution with `npm run build:pages`.

Verified in this workspace:

- `npm test`: 220 passing tests, including named controllers, pinned pieces,
  check escapes, en passant, promotion, and immutable special/variant previews.
- `npm run build` and `npm run build:pages`: type checking and both distributions.
- `test:title`, `test:tactics`, `test:hud`, `test:gacha` and `test:freestyle`:
  menu flow, existing gameplay controls, preview state, rewards and skin filters.
- `test:modes`: six board modes, objective results, save/reload/undo/replay,
  Rush clock and restart, Mirror color swaps, Chaos actions and variant bot
  difficulties 1–3. Rush fixtures pause their previous session before replacing
  its save so an active timer cannot overwrite the test position during reload.
- `test:pages`: the `/IAHCARUS-Idle/` subpath loads the packaged game and all
  three bot levels work after disconnecting the browser from the network.
- `test:ui-addons`: real WAAPI creation/cancellation and zero remaining managed
  animations; both reduced-motion controls; touch/keyboard help, focus and
  dismissal; real Floating UI flip/shift within 320/390/844 pixel viewports;
  controller identities and preview save immutability; separate field/variant
  and inspection rows at 320/390/844/1100 pixels. The exact packaged HTML loads in an offline browser
  context without external requests or page errors.

In this managed cloud environment, Chromium blocks
`file://` navigation. Offline tests can load the exact packaged HTML bytes
with `OFFLINE_TEST_TRANSPORT=memory`; that verifies the bundled game without
claiming successful direct local-file navigation here.
