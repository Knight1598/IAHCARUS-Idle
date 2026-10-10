# Anime dimensional duels

A capture is committed by the chess rules before its cinematic starts. The two
procedural avatars enter an isolated battle dimension, exchange attacks, guards
and a counter, then resolve the already committed capture with a finisher and
return to the board. Cosmetic defense never changes the legal destination,
captured piece, turn, score, ultimate reserve or online result.

## One five-second score

The default full presentation lasts 5,000 ms. Compact settings remain available;
custom timings are bounded to 2,000–5,000 ms. Reduced effects settles the move in
180 ms and keeps the board visible. The cinematic preference continues to control
dramatic presentation. Poses, camera, effects and cue dispatch sample the same
normalized scene clock rather than independent timers.

| Full-duel time | Presentation |
| --- | --- |
| 0.00–0.45 s | Enter the dimension and establish two opposing silhouettes |
| 0.45–1.40 s | Class-specific opening attack; defender guards the first clash |
| 1.40–2.12 s | Defender counters; attacker absorbs or deflects the counter |
| 2.12–3.12 s | Attacker answers with two distinct combination contacts |
| 3.12–3.85 s | Charge and release the finishing skill |
| 3.85–4.25 s | Decisive impact and visible recoil |
| 4.25–4.65 s | Defeated avatar disintegrates |
| 4.65–5.00 s | Return to the board and complete legal square occupation |

The first clash occurs at 1.08 s, counter clash at 1.86 s, and combination clashes
at 2.48 and 2.83 s. Contact poses and particles hold briefly to make the impacts
readable. The final impact remains a single callback at 3.85 s; defeat remains a
single callback at 4.25 s. The attacker occupies its chess destination only after
the defender has almost fully faded. En passant uses the actual captured square
for its victim, independently of the attacker's empty destination square.

## Open-source choreography and rendering

[Open-source combat provenance](OPEN-SOURCE-COMBAT.md) records the verified
Anime.js and Three.js packages, licenses and manual-playback contract. They are
bundled into the game, including the standalone HTML; no animation model,
downloaded character pack or remote runtime script is required.

The procedural rig, class weapons and skin geometry remain project code. The
six classes have 11 skin families, giving 66 class/skin profile identities. Their
cached motion, VFX, sound and camera settings are immutable.

| Piece | Choreography identity | VFX signature |
| --- | --- | --- |
| Pawn | Planted spear jabs and finishing thrust | Piercing lance |
| Knight | Flanking warp and diagonal sword combination | Crossing crescents |
| Bishop | Seal gathering and two-handed spell release | Spiral seal and beam |
| Rook | Heavy brace, cannon burst and recoil | Reactor cannon |
| Queen | Orbiting blades and sweeping crystal release | Orbital vortex |
| King | Heavy blade anticipation and overhead cleave | Crown judgement |

Classic, Ember, Frost, Astral, Royal, Storm, Void, Prism, Nova, Phantom and Dragon
retain their individual silhouettes, material gestures, aura patterns and effect
shapes. Rarity adds bounded ornament and effect detail without granting stronger
chess rules. `resolveDefense(attacker, defender, seed)` chooses a replay-stable
visual response from the defender's class and skin.

## Synchronized cues and cancellation

`captureCuePoints` in `src/combat.ts` is the ordered 18-cue score. Additional
releases and clashes accompany the opening, counter and combination rather than
playing only one attack sound. Each point records its actor; the sound engine
uses that actor's piece class and equipped skin. Impact and disintegration each
appear once. Cue dispatch uses a per-sequence cursor and occurs when actual render
frames cross a landmark, avoiding independent timeout queues.

The existing renderer draws the alternate set. Board geometry, board pieces,
markers, ground effects and the original arena are hidden while the dimension
is active; their saved visibility, background and fog return afterward. Both
fighters, weapons and auras contribute to camera-fit bounds on desktop and
portrait screens. The full pair remains the framing reference during attacks.

`skip()` immediately renders the authoritative result and uses the existing
150 ms camera return. Repeated skip calls cannot capture or finish twice. Cue and
impact callbacks check sequence identity so a reentrant reset or skip invalidates
the remaining frame. Cancel, finish, superseding online updates and mode changes
restore dimension state and remove temporary avatars, effects and voices.
The online server's rules and clocks remain authoritative throughout the visual
duel; a newer revision rebuilds its board even during an unfinished cinematic.

Hidden tabs and pause freeze the scene clock. Resume retains the current phase;
a new online presentation received while hidden starts immediately on return
without inheriting the full earlier pause. Showcase/replay use disposable boards
and do not alter the live match, saved history, XP or economy. A showcased king
defeat is an illustration; ordinary chess still ends by checkmate.

## Resources and verification

Combat retains one WebGL context and bounded effect batches. Avatar templates
cache the finite class/skin geometry data; live geometry wrappers and fading
materials remain independently disposable. Low/compact quality reduces shader
motes and instanced shards. Adaptive resolution never changes move outcomes or
imposes an additional motion frame-rate gate.

Relevant regression checks:

```sh
node --test tests/combat.test.mjs tests/combat-profiles.test.mjs tests/motion.test.mjs tests/duel-draft.test.mjs
npm run test:cinematic-duel
npm run test:render
npm run test:dimension
npm run test:execution
npm run test:showcase
npm run build:pages
npm run test:pages
```

Native checks cover timed contacts, actor identities, cue ordering and procedural
poses. Browser checks cover framing, isolated scene state, skip/cancel/finish,
actual-frame cue delivery, en passant, resource cleanup, pause/resume and preview
save immutability. Packaged-game checks exercise the Pages subpath and offline
bot play. Software Chromium and viewport emulation are regression tools; they
do not measure a physical phone's frame rate or Safari audio latency.
