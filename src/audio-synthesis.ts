import type { SoundLayer, SoundRecipe } from "./sound.ts";

export type StereoPCM = { left: Float32Array; right: Float32Array; sampleRate: number; duration: number };
const TAU = Math.PI * 2;
export function audioSeed(key: string): number {
  let seed = 2166136261;
  for (let i = 0; i < key.length; i++) seed = Math.imul(seed ^ key.charCodeAt(i), 16777619);
  return seed >>> 0;
}
export function seededAudioRandom(seed: number) {
  let value = seed >>> 0;
  return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
}
/** One PCM voice contains the transient, weight, formants, spectral texture and room tail.
 * Rendering happens once per cached recipe; combat frames never allocate oscillator graphs. */
export function renderSoundRecipe(recipe: SoundRecipe, sampleRate = 24000, seed = 2027): StereoPCM {
  const TAU = Math.PI * 2;
  let value = seed >>> 0;
  const random = () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
  function envelope(layer: SoundLayer, t: number): number {
    const u = Math.max(0, Math.min(1, t / layer.duration));
    const attack = Math.min(0.012, layer.duration * 0.09);
    const edge = Math.min(1, t / attack) * Math.min(1, (layer.duration - t) / Math.min(0.035, layer.duration * 0.14));
    if (layer.envelope === "rise") return edge * (0.12 + 0.88 * u ** 1.5);
    if (layer.envelope === "swell") return edge * Math.sin(Math.PI * u) ** 1.2;
    return edge * Math.exp(-u * (layer.texture === "choir" ? 2.2 : 4.2));
  }
  
  const bodyDuration = Math.max(...recipe.map((layer) => layer.offset + layer.duration));
  const room = Math.max(0,Math.min(.6,recipe.reduce((sum,l)=>sum+(l.room??.18),0)/Math.max(1,recipe.length)));
  const tail = room<.06?.06:.3, length = Math.ceil((bodyDuration + tail) * sampleRate);
  const left = new Float32Array(length), right = new Float32Array(length);
  for (const layer of recipe) {
    const start = Math.floor(layer.offset * sampleRate), count = Math.ceil(layer.duration * sampleRate);
    const pan = Math.max(-0.75, Math.min(0.75, layer.pan));
    const gainL = Math.cos((pan + 1) * Math.PI / 4), gainR = Math.sin((pan + 1) * Math.PI / 4);
    let phase = 0, modulation = 0, low = 0, band = 0, dc = 0;
    const cutoff = Math.min(sampleRate * 0.17, Math.max(100, layer.cutoff));
    const filter = Math.min(0.8, 2 * Math.sin(Math.PI * cutoff / sampleRate));
    const damping = layer.kind === "noise" && layer.filter === "bandpass" ? 0.66 : 1.25;
    for (let i = 0; i < count && start + i < length; i++) {
      const t = i / sampleRate, u = i / count, air = random() * 2 - 1;
      let value: number;
      if (layer.kind === "tone") {
        const frequency = layer.from * Math.exp(Math.log(layer.to / layer.from) * u);
        phase += TAU * frequency / sampleRate;
        modulation += TAU * frequency * (layer.texture === "metal" ? 2.731 : 1.414 + layer.fm * 0.07) / sampleRate;
        const index = layer.fm * (layer.envelope === "rise" ? 0.3 + u : Math.exp(-u * 4));
        value = Math.sin(phase + Math.sin(modulation) * index);
        const partials = layer.partials ?? [0.32, 0.13];
        for (let h = 0; h < partials.length; h++) {
          const ratio = layer.texture === "metal" ? [2.756, 4.071, 5.43][h % 3] : h + 2;
          value += partials[h] * Math.sin(phase * ratio + Math.sin(modulation * 0.73) * index * 0.3);
        }
        if(layer.texture==='mechanical') {
          value=0;
          for(const [h,ratio] of [1,2.41,3.87,5.19].entries())value+=Math.sin(phase*ratio)*Math.exp(-t*(18+h*9))*(1/(h+1));
          value+=air*Math.exp(-t*55)*.18;
        } else if(layer.texture==='glass') {
          value=Math.sin(phase)+Math.sin(phase*2.756)*.28*Math.exp(-t*8)+Math.sin(phase*5.43)*.12*Math.exp(-t*14);
        } else if(layer.texture==='void') {
          value=(Math.sin(phase)+Math.sin(phase*1.009)*.6)*(.55+.45*Math.sin(t*17+u*8)) + air*.08;
        }
        if (layer.texture === "choir") value += Math.sin(phase * 2.001 + Math.sin(t * 4.2) * 0.08) * 0.24;
        if (layer.texture === "plasma") value = Math.tanh(value * 1.65) * 0.82 + air * 0.11;
        if (layer.texture === "brass") value = Math.tanh(value * 1.35) * 0.9 + Math.sin(phase * 5) * 0.04;
        value *= 0.7;
      } else value = air;
      low += filter * band;
      const high = value - low - damping * band;
      band += filter * high;
      const filtered = layer.kind === "noise" ? layer.filter === "highpass" ? high : layer.filter === "lowpass" ? low : band : low;
      // Remove DC introduced by saturation before summing the phone-audible mid harmonics.
      dc += 0.004 * (filtered - dc);
      const amplitude = (filtered - dc) * envelope(layer, t) * layer.level;
      const movement = layer.texture === "air" ? Math.sin(u * Math.PI) * 0.12 : 0;
      left[start + i] += amplitude * (gainL + movement);
      right[start + i] += amplitude * (gainR - movement);
    }
  }
  // Bounded early reflections and a diffuse stereo hall tail, included in the cancellable PCM.
  // No feedback network can continue after skip or collect tails between captures.
  const reflections = [[0.037, 0.17], [0.071, 0.11], [0.113, 0.075], [0.179, 0.047], [0.263, 0.028]];
  const dryL = left.slice(), dryR = right.slice();
  for (const [seconds, amount] of reflections) {
    const delay = Math.floor(seconds * sampleRate);
    for (let i = delay; i < length; i++) {
      left[i] += dryR[i - delay] * amount*(room/.18);
      right[i] += dryL[i - delay] * amount * 0.93*(room/.18);
    }
  }
  for (let i = 0; i < length; i++) {
    left[i] = Math.tanh(left[i] * 1.5) * 0.75;
    right[i] = Math.tanh(right[i] * 1.5) * 0.75;
  }
  return { left, right, sampleRate, duration: length / sampleRate };
}

/** Lightweight stereo impulse-like pressure room for the independent ambience bed. */
export function renderAmbience(seed = 417, sampleRate = 12000, duration = 31.7, preset = "citadel"): StereoPCM {
  // Self-contained for the synthesis worker; every arena has a different pressure,
  // harmonic bed and material texture, not only another noise seed.
  const TAU = Math.PI * 2;
  let value = seed >>> 0;
  const random = () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
  const settings: Record<string, { root: number; air: number; pulse: number; metal: number; warp: number }> = {
    citadel: { root: 73.416, air: .052, pulse: .0, metal: .002, warp: .35 },
    ember: { root: 61.735, air: .082, pulse: .7, metal: .001, warp: .18 },
    frost: { root: 146.832, air: .025, pulse: .1, metal: .008, warp: .12 },
    astral: { root: 73.416, air: .043, pulse: .05, metal: .003, warp: 2.3 },
    storm: { root: 55, air: .095, pulse: .45, metal: .004, warp: .85 },
    grove: { root: 110, air: .039, pulse: .0, metal: .002, warp: .3 },
    reactor: { root: 49, air: .04, pulse: 1, metal: .005, warp: .1 },
    eclipse: { root: 69.296, air: .047, pulse: .25, metal: .001, warp: 1.6 },
  };
  const config = settings[preset] || settings.citadel;
  const length = Math.ceil(sampleRate * duration), left = new Float32Array(length), right = new Float32Array(length);
  let wind = 0, cloud = 0;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate, u = t / duration;
    wind += 0.035 * (random() * 2 - 1 - wind);
    cloud += 0.002 * (wind - cloud);
    const breathing = 0.7 + 0.3 * Math.cos(TAU * u * 3);
    const drone = Math.sin(TAU * config.root * t + Math.sin(TAU * u * 2) * config.warp) * 0.012;
    const air = (wind - cloud) * config.air * breathing;
    const harmonic = Math.sin(TAU * config.root * 2.756 * t + Math.sin(t * .6)) * config.metal * (.6 + .4 * Math.sin(t * .37));
    const pressure = Math.sin(TAU * config.root * .5 * t) * config.pulse * .006 * Math.max(0, Math.sin(t * .85));
    const gust=Math.max(0,Math.sin(t*(preset==='storm'?.19:.09)+1))**4;
    const crackle=preset==='ember'?(wind-cloud)*Math.max(0,Math.sin(t*17))*0.012:
      preset==='reactor'?Math.sin(TAU*config.root*3*t)*Math.exp(-(t%3.7)*12)*.005:
      preset==='frost'?Math.sin(TAU*config.root*4.071*t)*Math.sin(t*.6)**8*.002:
      preset==='astral'||preset==='eclipse'?Math.sin(TAU*config.root*t+wind*12)*gust*.004:
      preset==='storm'?(wind+cloud)*gust*.045:preset==='grove'?(wind-cloud)*Math.sin(t*.7)*.009:cloud*.008;
    const seam = Math.min(1, t / 0.8, (duration - t) / 0.8);
    left[i] = (drone + air + harmonic + pressure + crackle + Math.sin(TAU * 110 * t) * 0.005) * seam;
    right[i] = (drone + air * 0.91 - harmonic * .7 + pressure + crackle*.87 + Math.sin(TAU * 110.09 * t) * 0.005) * seam;
  }
  return { left, right, sampleRate, duration: length / sampleRate };
}
