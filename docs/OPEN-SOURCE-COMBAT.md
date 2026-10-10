# Open-source support for dimensional combat

The game's existing procedural 3D renderer and skeleton remain in use. The combat
upgrade uses the already installed open-source animation and rendering libraries
instead of importing another game engine or character asset collection.

| Package | Installed version | License | Relevant capability |
| --- | --- | --- | --- |
| [Anime.js](https://github.com/juliangarnier/anime) | `animejs` 4.5.0 | MIT | Numeric object keyframes and a seekable timeline |
| [Three.js](https://github.com/mrdoob/three.js) | `three` 0.180.0 | MIT | Procedural geometry, articulated transforms, reusable dimension rendering and camera bounds |

Evidence was checked on 2026-10-10 in the published installed packages:
`package.json`, the actual license texts, exports, type declarations and source.
Versions and published-package integrity hashes are recorded in
`package-lock.json`. This does not claim that inaccessible remote documentation
pages were opened. Exact package source archives are
[Anime.js 4.5.0](https://registry.npmjs.org/animejs/-/animejs-4.5.0.tgz) and
[Three.js 0.180.0](https://registry.npmjs.org/three/-/three-0.180.0.tgz).

Anime.js's published `LICENSE.md` grants MIT use, modification and distribution
under Julian Garnier's copyright. Its retained license and attribution are in
[third-party/animejs/LICENSE](../third-party/animejs/LICENSE) and
[third-party/animejs/NOTICE](../third-party/animejs/NOTICE). Three.js's published
`LICENSE` grants the same MIT permissions under the three.js authors' copyright.
`scripts/package-offline.mjs` already embeds both exact license texts into the
standalone game's third-party notice. Library source is used through public APIs
without upstream modifications.

## Animation ownership

The narrow `animejs/timeline` export supplies `createTimeline`. Its implementation
supports plain object targets and `autoplay: false`; its inherited `seek(time,
muteCallbacks)` samples the timeline while paused. `cancel()` removes animation
composition state and pauses the timer. Those APIs allow one scene-owned clock
to sample combat tracks without starting a second live animation loop.

`src/duel-choreography.ts` implements that contract: two reusable actor-state
objects receive explicit keyframes for position, lateral movement, lift, charge,
strike, guard, recoil and contact aiming. `DuelChoreography.sample(progress)` seeks
the paused timeline to the five-second score; `dispose()` cancels its tracks.
The scene maps those canonical coordinates into the dimension rather than
stretching the original chess-square travel path into a fight.

The integration contract is deliberate:

- Timeline tracks describe only presentation values: stance, attack, guard,
  recoil, position offsets and camera/effect weights.
- Chess commits the capture first. Animation callbacks cannot decide a winner,
  move a piece legally, spend an ultimate or award a reward.
- The render clock samples the score; audio landmarks use the same elapsed
  progress, with sequence identity checked after callbacks.
- Pause freezes the scene-owned timeline; skip, finish, online replacement and
  mode change terminate the presentation and restore the previously visible board
  state.
- The alternate arena reuses the Three.js renderer and bounded geometry; it does
  not create a second WebGL context or fetch runtime assets.

This is open-source animation support, not an imported fighting-game ruleset or
automatic cinematic generator. Class choreography, alternate dimensions,
geometric avatars, camera direction, effects and synthesized sound design remain
IAHCARUS code. See [the five-second combat score](CINEMATIC-COMBAT.md) for the
gameplay contract and regression commands.
