import type { PieceSymbol } from "chess.js";
import type { SkinId } from "./profile";
import type { SoundLayer, SoundRecipe } from "./sound.ts";

type Envelope = SoundLayer["envelope"];
type Texture = NonNullable<SoundLayer["texture"]>;
type Gesture = "draw" | "build" | "travel" | "hit" | "break" | "danger";
const roots: Record<PieceSymbol, number> = { p: 196, n: 110, b: 293.66, r: 73.416, q: 440, k: 146.83 };
const supported = new Set<SkinId>(["ember", "frost", "astral", "royal", "storm", "void", "prism"]);

function gestureFor(cue: string): Gesture {
  if (["charge", "attack", "finisher"].includes(cue)) return "build";
  if (["release", "dash", "move", "counter"].includes(cue)) return "travel";
  if (["impact", "clash"].includes(cue)) return "hit";
  if (["death", "disintegrate"].includes(cue)) return "break";
  return cue === "check" ? "danger" : "draw";
}

/** Material scores replace the old recolored class score. Each take changes articulation,
 * onset spacing and the excitation layers; weapon accents still identify the six classes.
 * All layers belong to one cancellable PCM voice, including the short room aftermath. */
export function rescoreLegacySkin(recipe: SoundRecipe, skin: SkinId, cue: string, piece: PieceSymbol, variant: number): SoundRecipe | null {
  if (!supported.has(skin)) return null;
  const v = ((Math.floor(variant) % 4) + 4) % 4, gesture = gestureFor(cue);
  const build = gesture === "build", hit = gesture === "hit", gone = gesture === "break", travel = gesture === "travel";
  const root = roots[piece], incomingPan = recipe[0]?.pan ?? 0;
  const pan = Math.max(-.65, Math.min(.65, incomingPan)) * (cue === "counter" ? -1 : 1);
  const span = build ? Math.max(.25, Math.min(.8, Math.max(...recipe.map(l => l.duration), .25))) :
    gone ? [.55, .63, .5, .6][v] : gesture === "danger" ? .58 : travel ? [.2, .24, .18, .27][v] : hit ? .3 : .13;
  const stagger = [.012, .03, .006, .046][v], late = [.11, .17, .08, .21][v];
  const layers: SoundRecipe = [];
  const room = gesture === "draw" || travel ? .055 : skin === "void" ? .36 : skin === "astral" ? .3 : skin === "royal" ? .12 : .19;
  const tone = (from: number, to: number, duration: number, level: number, offset: number, texture: Texture,
    envelope: Envelope = "punch", cutoff = 2600, fm = .6, lane = pan, partials?: number[]) => {
    layers.push({ kind: "tone", from, to, duration, level, offset, texture, envelope, cutoff, fm,
      pan: lane, wave: "sine", room, ...(partials ? { partials } : {}) });
  };
  const noise = (duration: number, cutoff: number, level: number, offset = 0,
    filter: BiquadFilterType = "bandpass", envelope: Envelope = "punch", lane = pan) => {
    layers.push({ kind: "noise", duration, cutoff, level, offset, filter, envelope, pan: lane, texture: "air", room });
  };
  const tension: Envelope = build ? "rise" : gone || gesture === "danger" ? "swell" : "punch";

  if (skin === "ember") {
    // Combustion pressure is mostly low/mid noise, followed by irregular dry crackles.
    noise(span * .92, 1050, hit ? .09 : build ? .044 : .038, 0, "lowpass", tension);
    tone(build ? root * .35 : root * 1.1, build ? root * 1.15 : root * .3, span,
      hit ? .095 : .052, stagger, "plasma", tension, 1850, 1.7 + v * .18, pan, [.38, .12]);
    const cracks = [[.015, .074, .16], [.023, .048, .128, .195], [.006, .091], [.01, .042, .101, .178]][v];
    for (const [i, onset] of cracks.entries()) noise(.022 + i * .007, 2000 + i * 310, .025 - i * .003,
      build ? span * .28 + onset : onset, "highpass", "punch", i % 2 ? -pan - .12 : pan + .12);
    if (gone || v === 2) noise(.18, 650, .025, late, "lowpass", "swell");
  } else if (skin === "frost") {
    // A brittle fracture opens immediately. Inharmonic glass splits continue independently.
    noise(build ? span * .65 : .037, 3650, hit ? .084 : .037, 0, "highpass", build ? "rise" : "punch");
    tone(root * 2.07, root * (gone ? .73 : 1.68), span * .9, .044, stagger,
      "glass", build ? "rise" : v === 2 ? "swell" : "punch", 3650, .16, -.35 + pan * .3);
    tone(root * 2.756, root * (travel ? 1.17 : 2.21), span * .64, .027,
      build ? span * .24 : .021 + late * .3, "metal", build ? "rise" : "punch", 3200, .23, .35 + pan * .3, [.19, .07]);
    noise(hit ? .16 : .09, 1100, hit ? .056 : .019, .011, "lowpass", "punch");
    const splits = v % 2 && gesture !== "danger" ? [.075, .12, .23] : [.04, .18];
    for (const [i, onset] of splits.entries()) noise(.025 + v * .002, 2800 + i * 220, .019 - i * .003,
      build ? span * .45 + onset * .4 : onset, "highpass", "punch", i % 2 ? -.45 : .45);
  } else if (skin === "astral") {
    // A seal blooms through two moving formants; no stepped note or notification melody.
    noise(build ? span : .07, 1900, hit ? .064 : .033, 0, "bandpass", tension);
    tone(root * .64, root * (build ? .98 : gone ? .28 : .58), span, .057, stagger,
      "choir", build ? "rise" : "swell", 2100, .33, -.45 + pan * .2, [.22, .05]);
    tone(root * 1.48, root * (build ? 1.52 : 1.43), span * [.72, .88, .6, .8][v], .027,
      build ? span * .19 : late * .5, "choir", "swell", 2850, .19, .45 + pan * .2, [.12, .04]);
    tone(root * .91, root * .44, .17 + v * .018, .023, hit ? .018 : .035 + late,
      "metal", "punch", 1700, .52, pan, [.15]);
    if (v === 1 || v === 3) noise(.085, 2700, .02, build ? span * .62 : late, "bandpass", "swell", -.3);
  } else if (skin === "royal") {
    // Damped brass pressure and a mechanical armor closure carry weight without a fanfare.
    noise(build ? span : hit ? .09 : .05, 720, hit ? .086 : .034, 0, "lowpass", tension);
    tone(build ? root * .3 : Math.min(180, root * .92), build ? root * .58 : 48, span,
      hit ? .116 : .067, stagger * .25, "brass", tension, 1250, .34, pan, [.41, .12, .025]);
    tone(root * .88, root * .65, span * .63, .028, build ? span * .28 : late * .4,
      "mechanical", build ? "rise" : "punch", 1850, .12, -pan);
    noise(.033, 2600, .027, build ? span * .72 : .032 + stagger, "highpass");
    if (v === 1 || v === 2) tone(96, 58, .14 + v * .025, .027,
      build ? span * .48 : late, "brass", "punch", 1000, .28, -.3);
    if (v === 3) noise(.055, 1100, .025, late, "bandpass", "swell", .3);
  } else if (skin === "storm") {
    // Electrical excitation arrives as interrupted arcs, never a continuous buzzer.
    noise(build ? span : .027, 2500, hit ? .072 : .034, 0, "bandpass", build ? "rise" : "punch");
    tone(root * (travel ? 2.3 : .83), root * (build ? 1.43 : .42), span * .75, .049,
      stagger, "plasma", tension, 2900, 2.4 + v * .14, pan, [.27, .085]);
    const arcs = [[.02, .11], [.009, .052, .14], [.031, .086, .173], [.006, .047, .09, .184]][v];
    for (const [i, onset] of arcs.entries()) noise(.018 + i * .003, 1800 + i * 480, .028 - i * .003,
      build ? span * .31 + onset : onset, i % 2 ? "highpass" : "bandpass", "punch", i % 2 ? -.35 : .35);
    if (hit || gone) tone(140, 58, .2, .065, .003, "mechanical", "punch", 1100, .13, pan);
    else if (v === 2) noise(.08, 1000, .022, late, "lowpass", "swell");
  } else if (skin === "void") {
    // Reverse intake surrounds a quiet immediate pressure hit, then collapses into vacuum.
    noise(hit ? .06 : span, hit ? 900 : 1250, hit ? .068 : .041, 0,
      hit ? "lowpass" : "bandpass", build ? "rise" : "swell", -.4 + pan * .2);
    tone(root * .43, root * (build ? .65 : gone ? .18 : .27), span, .057,
      hit ? .005 : stagger, "void", build ? "rise" : "swell", 1200, .41, .4 + pan * .2, [.17, .045]);
    noise(span * .58, 2400, .025, build ? span * .22 : late * .35, "bandpass", "rise", -.35);
    if (hit) tone(125, 43, .23, .068, 0, "brass", "punch", 700, .08, pan, [.23]);
    else tone(root * 1.009, root * .65, span * .48, .016, late * .4, "void", "swell", 1750, .15, .35);
    if (v === 1 || v === 3) noise(.045, 1800, .022, build ? span * .76 : late, "bandpass", "punch");
    if (v === 2) noise(.06, 700, .024, late + .09, "lowpass", "swell");
  } else {
    // Prism fragments form an overlapping inharmonic cluster, not a sequence of bell notes.
    noise(build ? span * .65 : .032, 3300, hit ? .062 : .027, 0, "highpass", build ? "rise" : "punch");
    const clusters = [[1, 1.414, 2.17], [1.189, 1.53], [.89, 1.732, 2.03], [1.07, 1.29, 1.91]][v];
    for (const [i, ratio] of clusters.entries()) tone(root * ratio, root * ratio * (gone ? .56 : travel ? .71 : .92),
      span * (.74 - i * .12), i ? .022 : .037, build ? span * (.11 + i * .14) : stagger + i * .014,
      i === 1 ? "metal" : "glass", build ? "rise" : "punch", 3350, .16 + i * .12,
      [-.45, .45, .08][i], [.12, .045]);
    noise(.045 + v * .009, 2600, .021, build ? span * .65 : late, "highpass", v === 2 ? "swell" : "punch", -.3);
    if (hit || gone) noise(.12, 1050, .032, .012, "lowpass", "punch", pan);
  }

  // Per-class weapons remain audible under the skin material rather than becoming a tint.
  const accentAt = build ? span * .31 : hit ? .005 : .022 + stagger;
  if (piece === "p") noise(.045, 2900, .018, accentAt, "highpass");
  else if (piece === "n") tone(root * 1.6, root * .47, .13, .025, accentAt,
    "metal", build ? "rise" : "punch", 2200, 1.1, pan, [.2, .06]);
  else if (piece === "b") tone(root * 1.5, root * 1.48, .26, .019, accentAt,
    "choir", "swell", 2500, .17, -pan, [.11]);
  else if (piece === "r") tone(98, 57, .17, .031, accentAt, "mechanical", "punch", 950, .1, pan);
  else if (piece === "q") tone(root * 2.756, root * 1.41, .18, .018, accentAt,
    "glass", "punch", 3600, .15, -pan);
  else tone(83, 45, .24, .03, accentAt, "brass", "punch", 900, .17, pan, [.3, .08]);

  // Cue distinctions keep shield contact, counter and final anticipation off the draw score.
  if (cue === "armor") for (const layer of layers) { layer.duration *= .7; layer.level *= .72; }
  if (cue === "clash") for (const layer of layers) { layer.duration *= .82; layer.level *= .82; }
  if (cue === "counter") for (const layer of layers) { layer.offset += .009; layer.duration *= .86; layer.level *= .85; }
  if (cue === "finisher") for (const layer of layers) { layer.duration *= 1.1; layer.level *= 1.06; }
  if (gesture === "danger") noise(.11, 850, .024, .19 + stagger, "bandpass", "swell");
  for (const layer of layers) {
    layer.duration = Math.max(.015, Math.min(1.15, layer.duration));
    layer.offset = Math.max(0, Math.min(.48, layer.offset));
    layer.pan = Math.max(-.75, Math.min(.75, layer.pan));
    layer.level = Math.max(.006, Math.min(.16, layer.level));
  }
  return layers;
}
