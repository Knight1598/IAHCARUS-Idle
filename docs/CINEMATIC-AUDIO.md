# Cinematic Sci-Fi Fantasy Audio

The single `SpaceAudio` engine receives actual rendered combat cue crossings from
`ChessScene`. Chess results and movement rules remain outside the sound engine.
Audio is created only after the player explicitly enables sound or auditions a
skill. Reloading never automatically creates an AudioContext. Current Safari's
AudioContext (with the webkit fallback) and Blob workers are supported by code;
no real iPhone/Safari run has been performed in this cloud environment.

## Sound identities

| Class | Material and body |
| --- | --- |
| Pawn | Focused plasma spear transient and short piercing pressure |
| Knight | Dimensional tearing, crossing sword transients and displaced stereo air |
| Bishop | Harmonic seal resonance, ritual buildup and beam release |
| Rook | Reactor pressure, armored metal and heavy cannon weight |
| Queen | Metallic crystal partials and cascading storm texture |
| King | Astral blade, low brass/shield resonance and deliberate impact weight |

Each action has four shuffled takes without consecutive repeats. Skins change
material, envelopes, layer articulation and timbre: Ember adds saturated plasma;
Frost uses crystalline metal and swells; Astral uses FM/choir displacement; Royal
uses heavier brass partials. Ultimate cues strengthen the body and spectral energy.
The nine capture cues are documented in [the combat score](CINEMATIC-COMBAT.md).
A/B auditions fix the take so changes in skin can be compared consistently.

Recipes contain a transient, a resonant/FM body with phone-audible harmonics,
filtered noise texture and stereo reflections. Runtime synthesis generates PCM
buffers; playback uses one cancellable buffer source for each complete cue.
No external recordings, downloads, CDN or commercial audio services are required.
No square/chiptune melodies are used. These are procedural sounds, not recorded
orchestral performances or studio-finished anime sound libraries.

## Soundtrack and mix

The 70 BPM soundtrack uses D minor/Phrygian harmony over a D/A pedal. A 16-bar
arrangement lasts about 54.86 seconds and evolves through four voiced sections,
slow stereo pads, low pressure, metallic bells and orchestral pulses. Threat/check
adds the minor second and rhythmic pressure; ultimate increases pulse density.
Capture reuses the current bed while leaving space for the fight. Mate/victory/
defeat have finite 3.4-second closing arrangements. Music state transitions share
a transport position and fade between prepared buffers.

Eight ambience presets have different roots, spectral air, metallic harmonics,
warping and pressure: citadel, ember, frost, astral, storm, grove, reactor, eclipse.
Ambience is a separate 31.7-second bed. The arrangements have faded loop seams;
they are long generated arrangements, not an unlimited music composer.

The five controls are Master, Music, Ambience, SFX and Cinematic, plus mute. Levels
and mute persist independently. The soundtrack ducks 3–6 dB around powerful cues;
Skip cancels effect voices and restores the soundtrack gain. A high-pass filter,
compressor and soft limiter retain mix headroom. Stereo early reflections are
embedded in each effect, so no feedback tail survives cancellation.

## Lifetime and performance

A reusable worker prepares long music, ambience and capture takes off the drawing
thread. `prepareCombat` prewarms each actor's next shuffled take without consuming
it. An uncached short cue can still synthesize synchronously if preparation has
not arrived. Worker fallback is asynchronous but runs on the main thread; its
mobile performance remains a device check. No new AudioContext is created for
music, repeated captures or the showcase.

The LRU PCM cache is capped at **24 MiB**. Up to **32** live sources are admitted;
old expendable effects disconnect before replacement while music beds are
protected. Live sources may retain an evicted buffer until their tail ends,
so `residentBytes` can exceed `cacheBytes`. Worker output and buffer copies also
create temporary memory during preparation. `diagnostics` reports these limits,
levels, state, worker status and maximum cold synthesis time.

`cancelEffects` stops both SFX and cinematic voices; `cancelCinematic` is narrower.
Pause cancels effect voices and gates beds. Reset/menu/skip preserve continuous
beds, clear the current fight's tails and discard queued obsolete capture takes. Disabling sound cancels all voices.
`dispose` disconnects nodes, releases cache, terminates the worker, revokes its
Blob URL and resolves pending preparation jobs. Race-safe cache insertion avoids
counting a take twice when a cold frame and worker completion overlap.

## Verification

`npm run test:audio` checks 232 ordinary/event takes and 1,080 combat takes,
waveform fingerprints, finite samples, duration, envelope, spectrum, peak/RMS,
headroom, nine music states, eight ambience beds, actual worker preparation,
independent bus silence, duck restoration, cancellation and disposal. It writes
`test-results/audio-v2-analysis.json` for the current run. Native tests additionally
check shuffle bags, cache/source bounds and the cold-frame/preparation race.

The measured full-volume five-event mix peaked at **0.328**, ordinary/event takes
at **0.123**; combat PCM peaked at **0.320** before master mixing. These values
show digital headroom, not a subjective listening-quality guarantee. Use Main
menu → ห้องทดลองการต่อสู้ → เสียงและบรรยากาศ for A/B listening on the intended
headphones, speakers and phone. No real iPhone or acoustic speaker measurement
is claimed.
