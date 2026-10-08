# Anime Cinematic Combat v2

The combat presentation uses the existing `ChessScene`, renderer, avatar rig and
audio engine. A capture is committed by the game before its presentation starts.
The defender's block, retreat or counter is visual: it cannot change the captured
piece, legal destination, turn, score or ultimate rules.

## Playback

Captures use a 2.6-second score by default. Settings offer 2, 2.6 and 3 seconds;
the scene clamps custom durations to 2–3 seconds. The same normalized clock drives
poses, camera, effects and cue dispatch. Reduced effects uses a 180 ms settlement.
The cinematic toggle controls the dramatic camera and overlay; capture avatars
still follow the combat score when reduced effects is off.

| Phase | Time at the default duration | Presentation |
| --- | --- | --- |
| Faceoff | 0–0.4 s | Reveal both actors and enter the combat framing |
| Opening | 0.4–1.0 s | First class-specific attack and approach |
| Defense | 1.0–1.5 s | Seeded guard, parry, barrier, dodge or brace; visual counter |
| Finisher | 1.5–2.1 s | Final windup, decisive strike at 1.85 s and recoil |
| Defeat | 2.1–2.6 s | Disintegration and return to the saved camera |

The attacker stops outside the defender. Legal board occupation starts at 2.33 s,
after the defender's fade is mostly complete, and ends at 2.55 s. This avoids
sliding the board mesh through the victim during the fight. En passant uses the
event's captured square for the victim rather than assuming it is the destination.

## Class and skin identities

`src/combat-profiles.ts` caches all 30 actual class/skin profiles. Their nested
motion, VFX, sound and camera data is immutable. Motion uses class building blocks
and additional skin gestures; effects use the same existing shader batches.

| Piece | Choreography identity | VFX signature |
| --- | --- | --- |
| Pawn | Plasma spear combination and planted thrust | Piercing lance |
| Knight | Flanking warp gesture and diagonal sword slash | Crossing crescents |
| Bishop | Gathering seal gesture and two-handed spell release | Spiral seal and beam |
| Rook | Wide brace, cannon release and recoil | Reactor cannon |
| Queen | Orbiting blade/crystal gathering and sweeping release | Orbital vortex |
| King | Heavy overhead blade windup and downward cleave | Crown judgement |

| Existing skin | Motion style | Shape/flourish identity |
| --- | --- | --- |
| Royal Origin (`classic`) | Disciplined stance and controlled stroke | Clean energy paths |
| Ember Knights (`ember`) | Lower anticipation and explosive follow-through | Combustion, broader trails and sparks |
| Frost Guard (`frost`) | Precise stance and crystalline guard | Fracture facets, extra shards and seals |
| Astral Order (`astral`) | Lateral phase gesture and turning mantle | Dimensional rifts, additional rings and reverse orbit |
| Golden Sovereign (`royal`) | Ceremonial raised guard and weighty finish | Judgement rings and royal wave shapes |

`resolveDefense(attacker, defender, seed)` considers attack type, defender class
and defender skin. For example, casters answer spell/storm attacks with barriers;
rooks keep a shield or braced silhouette; an Astral defender can retreat through
a phase gesture. The seed makes a replay deterministic. No random choice enters
the chess result.

## Shared contact and sound landmarks

`captureCuePoints` in `src/combat.ts` is the single ordered cue list. The scene
dispatches a cue when a rendered frame first crosses its normalized position.
It retains a per-sequence cursor so repeated frames cannot repeat that cue.

| Cue | Default time | Actor |
| --- | --- | --- |
| Draw | 0.09 s | Attacker |
| Charge | 0.23 s | Attacker |
| Release | 0.76 s | Attacker |
| Clash | 1.12 s | Defender |
| Counter | 1.34 s | Defender |
| Finisher | 1.57 s | Attacker |
| Impact | 1.85 s | Attacker |
| Armor | 1.91 s | Defender |
| Disintegrate | 2.10 s | Defender |

At other sequence lengths these positions scale with the sequence. The first
clash and final impact have short particle holds; pose progress remains based on
elapsed time. Sound synthesis and mix controls are described separately by the
audio implementation.

## Camera, cancellation and resources

Both actors, their weapons and auras contribute to the camera fit bounds. The
camera tracks their current positions, uses a class-weighted contact shake, and
returns to the saved camera/target during the defeat phase. Portrait framing uses
the actual camera aspect ratio rather than a fixed desktop shot.

`skip()` settles the already committed board immediately and uses a 150 ms camera
return. `finish()` first invalidates the active animation through board rendering;
calling skip repeatedly therefore cannot capture or finish a second time. The
scene checks sequence identity after cue and impact callbacks, including reentrant
skip/reset. Cancellation clears active actors, temporary effects, overlay state
and all current effect voices (including event SFX); a new sequence owns its own cue cursor.
Hand-bound melee weapons are guided toward the current opponent at contact.
Native geometry checks verify intersection for pawn, knight and king across all five skins.
Hidden tabs freeze the same timeline, including menu previews. Resume preserves
the current phase; a fresh online presentation received while hidden starts
immediately on return without inheriting the entire earlier pause.

The showcase moves the existing renderer into its preview host. Its attacker,
defender, two skins and arena operate on disposable presentation boards and do
not update the active match, XP or save history. Previewing a king's defeat in
this room is an illustration; ordinary chess still ends by checkmate.

| VFX quality | Shader batches | Motes | Instanced shards |
| --- | ---: | ---: | ---: |
| Low | 4 | 32 | 0 |
| Auto | 5 | 64 | 16 |
| High | 5 | 96 | 24 |

These budgets cover the `CombatVFX` group, not total scene draw calls. Avatars,
their aura batches, optional guard and the bounded defeat burst are separate.
Compact effects use the low budget. Automatic quality can also reduce pixel ratio
without changing the timeline or imposing a second motion frame-rate gate.
Avatar templates cache CPU vertex data for the finite 30 profiles; live geometry
wrappers and fading materials remain independently disposable. `avatarResourceStats()`
reports template counts and stored vertex bytes.

## Verification and limits

The native core checks cover all 30 profile identities, immutable caching,
deterministic defense choices, the nine cue landmarks, bounded monotonic progress,
and duration clamps:

```sh
node --test tests/combat.test.mjs tests/combat-profiles.test.mjs
```

The rendering suite exercises camera framing, actual-frame cues, capture phase
progression, reduced effects, repeat-capture resource cleanup and repeated/reentrant
skip, plus hidden-tab preview resume and fresh online updates during a pause.
The offline and Pages suites exercise the packaged game entry points.

```sh
npm run test:render
npm run build:offline
OFFLINE_TEST_TRANSPORT=memory npm run test:offline
npm run test:pages
```

Viewport emulation and software Chromium rendering are useful regression checks;
they do not establish real iPhone 13 Pro Max frame rate, Safari audio latency or
subjective cinematic quality. Poses, contacts and silhouettes remain stylized
procedural animation, with no imported animation clips or physical combat solver.
