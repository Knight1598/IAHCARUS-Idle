# Open-source audio DSP for IAHCARUS

## Selected add-on and verified evidence

The selected library is **`@thi.ng/dsp` 4.7.123**, licensed under **Apache-2.0**. It provides composable sample-by-sample signal processing, allowing the game's existing procedural sounds to gain better material resonance, filtering and bounded room reflections without replacing its Web Audio mixer.

Research on 2026-10-10 used the npm registry metadata and downloaded the exact published package tarballs for `@thi.ng/dsp`, Tone.js and TunaJS into a temporary directory. Their published README files, implementation files, TypeScript declarations and license texts were inspected directly. This is evidence from published upstream packages; it does not claim that remote documentation webpages were successfully opened or that listening tests prove subjective sound quality.

- [Published DSP package](https://www.npmjs.com/package/@thi.ng/dsp)
- [Exact 4.7.123 source tarball](https://registry.npmjs.org/@thi.ng/dsp/-/dsp-4.7.123.tgz)
- [Upstream source repository](https://codeberg.org/thi.ng/umbrella/src/branch/develop/packages/dsp)
- [Upstream API documentation](https://docs.thi.ng/umbrella/dsp/)
- [License retained in this repository](../third-party/thi-ng-dsp/LICENSE)
- [Package and dependency attribution](../third-party/thi-ng-dsp/NOTICE)

The package metadata reports 163,301 bytes unpacked and `sideEffects: false`. A separate esbuild browser probe using the filter, filtered delay and DSF APIs below produced **4,968 bytes minified**, including the small probe loop. That figure measures the probe, not the final game or the entire DSP package. A one-second 24 kHz probe generated finite samples with peak 0.0845 and RMS 0.0129; it establishes that these APIs run without a browser AudioContext, not that a finished mix is safe under every combination.

## Libraries compared

| Library and inspected version | License | Relevant capabilities | Fit for this game |
| --- | --- | --- | --- |
| `@thi.ng/dsp` 4.7.123 | Apache-2.0 | Biquad filters, delay lines, filtered feedback, waveshaping, oscillators | Selected: synchronous PCM processing works in a synthesis worker and in native tests. Narrow module imports keep the bundled code small. |
| `tone` 15.1.22 | MIT | Effects, synthesis, musical scheduling, native Web Audio routing | Capable option for a music production system. It brings `standardized-audio-context` and scheduling/context abstractions; its Freeverb implementation uses AudioWorklet, while the project's current need is cached PCM material processing. |
| `tunajs` 1.1.3 | MIT | Chorus, phaser, delay, distortion and convolution effects | Its inspected Chorus/Phaser LFO implementation uses `createScriptProcessor`; construction also patches the AudioNode connection prototype and stores a shared module-level context. Those choices add integration and performance concerns for the existing mixer and offline tests. |
| `howler` 2.2.4 | MIT, registry metadata | Sample playback, audio sprites, volume and spatial playback | Useful for a recorded sound library; the project already has PCM playback, voice limits and buses. It would not by itself improve procedural sound material quality. Its source tarball was not inspected in this comparison. |

Published tarballs inspected for comparison: [Tone.js](https://registry.npmjs.org/tone/-/tone-15.1.22.tgz), [TunaJS](https://registry.npmjs.org/tunajs/-/tunajs-1.1.3.tgz). Tone's published `LICENSE.md` contains the MIT license and Yotam Mann copyright. Tuna's published source contains its full MIT license header and DinahMoe AB / Oskar Eriksson copyright. No impulse responses or test audio from those packages are used.

## Integration boundaries

Use the DSP as a **sound generator/processor**, retaining the existing AudioContext, mixer buses, mute preferences, voice priorities, cinematic timing and cancellation. Processing happens while preparing cached PCM; playing a sound should still require only the existing buffer-source graph. A library processor should never be allocated per render frame.

Narrow ESM imports are supported by the published package exports:

```ts
import { biquadHP, biquadLP, biquadPeak } from '@thi.ng/dsp/biquad';
import { filterFeedbackDelay } from '@thi.ng/dsp/filter-delay';
import { dsfHOF } from '@thi.ng/dsp/osc-dsf';

const sampleRate = 24_000;
const rumbleFilter = biquadHP(80 / sampleRate);
const bodyFilter = biquadPeak(800 / sampleRate, 0.7, 1.5);
const reflection = filterFeedbackDelay(
  Math.round(sampleRate * 0.037),
  biquadLP(2_500 / sampleRate),
  0.34,
);
const plasma = dsfHOF(0.3, 1.414);

// Biquad frequencies are normalized as Hz / sampleRate, below Nyquist (0.5).
// Delay length is samples, not milliseconds. `.next(sample)` advances state.
const dry = plasma(timeInSeconds, 110, 0.08);
const shaped = bodyFilter.next(rumbleFilter.next(dry));
const wet = reflection.next(dry) * 0.15;
const sample = shaped + wet;
```

DSF's first argument is phase/time and its second is frequency. With the game's existing accumulated phase in radians, use `plasma(phase / (2 * Math.PI), 1, amplitude)` to preserve pitch. The upstream documentation warns that increasing DSF `alpha` produces larger peaks; keep `alpha < 1`, limit amplitude and test the resulting PCM. Each independent channel/voice needs its own filter and delay state; do not reuse a processed state across unrelated sounds or variants.

A worker created by serializing `renderSoundRecipe.toString()` cannot access imported library closures. Integrating an external DSP requires a bundled inline module worker or another explicit way of bundling those imports; a silent fallback to main-thread-only processing would lose the existing performance benefit. The same renderer should remain usable in Node and worker tests.

This approach requires no runtime CDN, sample download, remote plugin loader, account service or paid audio asset. The published library code is bundled with the game. Retain the dependency license and notices in distribution, including the standalone offline HTML, so offline copies preserve attribution.

## Intended sound identities

The DSP supports stronger contrast in timbre; it does not automatically make a sound cinematic. Combine short, readable transients with material body, movement and a controlled aftermath:

- **Nova / plasma:** bright harmonic energy that rises under charging, then a short broadband release and warm pressure body. Control DSF peaks and high-frequency content rather than making every cue louder.
- **Phantom / void:** reverse pressure, hollow spectral notches and spatially offset reflections. Keep the attack moment clear even when the tail feels otherworldly.
- **Dragon / heavy armor:** several damped metallic resonances, low-mid impact weight and noisy fractures. Preserve phone-audible body rather than relying only on sub bass.
- **Frost / crystal:** sparse inharmonic resonances and sharp, short ice fractures; reduce low-frequency room buildup.
- **Movement and UI:** mostly dry, short feedback. Large room tails belong to major combat or dimension events, not every button.

Maintain the piece-class weapon accents and four nonrepeating takes already in the game. Changes in pitch alone do not create a new material identity; envelope, resonances, rhythm and texture should also differ.

## Verification and budgets

Keep the existing 32-voice and 24 MiB PCM-cache limits. Material processing must preserve finite stereo PCM, silence at the end of a bounded tail, useful phone-range energy and headroom. Recommended checks include:

1. Deterministic same-seed PCM, distinct variants and nonidentical skin/material signatures.
2. Native and worker output agreement, and worker fallback after worker creation fails.
3. Stress-mix peak measurement with UI, ambience, music and cinematic layers together.
4. Skip/mute/pause/dispose behavior, including cancelled delayed cues and reverb tails.
5. Offline HTML loading without runtime network requests for audio code or assets.
6. Actual listening on headphones and phone speakers for harshness, transient clarity, fatigue and whether skins feel different.

These are implementation requirements and recommended checks, not a claim that every item has already passed for the current change. Final validation results belong in the implementation report.

## Implemented integration

`src/audio-processing.ts` uses the published biquad HP/LP/Peak and
filtered-feedback delay APIs. `src/audio-synthesis.ts` applies them to whole
cancellable effects; beds receive gentle tonal shaping. The DSF example above
is a verified available API, not a claim that the game uses that oscillator.
`src/audio-worker.ts` bundles the same DSP imports in a lazily created inline
worker. The runtime keeps one AudioContext, its existing mixer and source/cache
limits. No live ScriptProcessor or remote impulse response is added.

`src/audio-skin-score.ts` replaces seven legacy skin source scores with distinct
material articulations and keeps weapon accents. Processing presets persist in
the existing audio preferences; dry is available for comparison. The offline
packager embeds the upstream Apache-2.0 license and all dependency attribution.

Validation commands: `npm test`, `npm run build:pages`, `npm run test:audio`, and
`AUDIO_ADDON_OFFLINE_TEST=1 npm run test:audio-addon`.

In this managed cloud environment, Chromium blocks `file://` navigation. Use
`OFFLINE_TEST_TRANSPORT=memory AUDIO_ADDON_OFFLINE_TEST=1 npm run test:audio-addon`
to test exact packaged bytes with network disabled. This does not claim that
direct local-file navigation was successfully tested here.
