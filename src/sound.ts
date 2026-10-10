import {rescoreLegacySkin} from './audio-skin-score.ts';
import {processBedPCM,readProcessingMode,AUDIO_DSP_ADDON,type AudioProcessingMode} from './audio-processing.ts';
import type { PieceSymbol } from "chess.js";
import type { SkinId } from "./profile";
import { combatProfile } from "./combat-profiles.ts";
import { audioSeed, renderAmbience, renderSoundRecipe, type StereoPCM } from "./audio-synthesis.ts";
import { renderMusic } from "./audio-music.ts";

export type SoundPhase = "lock" | "charge" | "dash" | "impact" | "death" | "check" | "move" | "attack";
type CanonicalPhase = Exclude<SoundPhase, "move" | "attack">;
export type AudioBus = "master" | "music" | "ambience" | "sfx" | "cinematic";
export type MusicState = "menu" | "normal" | "threat" | "check" | "capture" | "ultimate" | "mate" | "victory" | "defeat";
export type CombatSoundCue = "draw" | "charge" | "release" | "clash" | "counter" | "finisher" | "impact" | "armor" | "disintegrate";
export const SOUND_VARIANTS = 4;
export const AUDIO_VOICE_LIMIT = 32;
export const AUDIO_CACHE_LIMIT = 24 * 1024 * 1024;
export const AMBIENCE_PRESETS = ["citadel", "ember", "frost", "astral", "storm", "grove", "reactor", "eclipse"] as const;
export type AmbiencePreset = typeof AMBIENCE_PRESETS[number];

/** Independent bags exhaust all four variants and never repeat across a bag boundary. */
export class SoundVariantBag {
  private bags = new Map<string, number[]>();
  private previous = new Map<string, number>();
  private random: () => number;
  constructor(random: () => number = Math.random) { this.random = random; }
  next(key: string): number {
    let bag = this.bags.get(key);
    if (!bag?.length) {
      bag = Array.from({ length: SOUND_VARIANTS }, (_, index) => index);
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.max(0, Math.min(i, Math.floor(this.random() * (i + 1))));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      if (bag.at(-1) === this.previous.get(key)) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
      this.bags.set(key, bag);
    }
    const variant = bag.pop()!;
    this.previous.set(key, variant);
    return variant;
  }
  peek(key: string): number {
    const previous = this.previous.get(key), variant = this.next(key);
    this.bags.get(key)!.push(variant);
    if (previous === undefined) this.previous.delete(key); else this.previous.set(key, previous);
    return variant;
  }
}

type Envelope = "punch" | "rise" | "swell";
type Texture = "air" | "metal" | "plasma" | "choir" | "brass" | "mechanical" | "glass" | "void";
type LayerBase = { duration: number; level: number; cutoff: number; pan: number; offset: number; envelope: Envelope; texture?: Texture; partials?: number[]; room?:number };
export type SoundLayer = LayerBase & (
  { kind: "tone"; from: number; to: number; fm: number; wave: OscillatorType } |
  { kind: "noise"; filter: BiquadFilterType }
);
export type SoundRecipe = SoundLayer[];
function canonicalPhase(phase: SoundPhase): CanonicalPhase { return phase === "move" ? "dash" : phase === "attack" ? "charge" : phase; }
function composer(pan: number) {
  const layers: SoundRecipe = [];
  const tone = (from: number, to: number, duration: number, level = 0.075, offset = 0, fm = 0.6, cutoff = 2600, envelope: Envelope = "punch", texture: Texture = "plasma", lane = pan, partials?: number[]) => {
    layers.push({ kind: "tone", from, to, duration, level, offset, fm, cutoff, envelope, texture, pan: Math.max(-.75, Math.min(.75, lane)), wave: "sine", partials });
  };
  const noise = (duration: number, cutoff: number, level = 0.06, offset = 0, filter: BiquadFilterType = "bandpass", envelope: Envelope = "punch", lane = pan) => {
    layers.push({ kind: "noise", duration, cutoff, level, offset, filter, envelope, texture: "air", pan: Math.max(-.75, Math.min(.75, lane)) });
  };
  return { layers, tone, noise };
}
const identities = {
  p: { root: 196, weight: .7, texture: "plasma", fm: 1.2, band: 2100, tail: .34 },
  n: { root: 110, weight: 1.15, texture: "metal", fm: 3.8, band: 1650, tail: .5 },
  b: { root: 293.66, weight: .75, texture: "choir", fm: .6, band: 3000, tail: .72 },
  r: { root: 73.416, weight: 1.45, texture: "brass", fm: 1.9, band: 680, tail: .8 },
  q: { root: 440, weight: 1.1, texture: "metal", fm: .85, band: 3400, tail: .78 },
  k: { root: 146.83, weight: 1.4, texture: "brass", fm: .42, band: 1300, tail: .85 },
} as const;

/** Four arranged takes per class/action. Variation changes rhythm, texture and orchestration.
 * No square waves, pitched UI beeps or chiptune sequences are synthesized. */
export function pieceSoundRecipe(piece: PieceSymbol, requestedPhase: SoundPhase, variant: number, duration = .3, capture = false, pan = 0): SoundRecipe {
  const phase = canonicalPhase(requestedPhase), v = ((Math.floor(variant) % 4) + 4) % 4;
  const length = Math.max(.16, Math.min(1.05, duration)), id = identities[piece];
  const { layers, tone: t, noise: n } = composer(pan);
  const stagger = [.0, .032, .068, .016][v], texture = id.texture;
  const root = id.root * [1, .94, 1.025, .975][v];
  if (phase === "lock") {
    // Mechanical draw and pressure intake: predominantly noise/formants, never a tonal ping.
    n(.09 + v * .02, id.band, .04, 0, "bandpass", v === 2 ? "swell" : "punch");
    t(root * .65, root * .5, .15 + stagger, .025, stagger, id.fm, 1600, "punch", texture);
    if (v !== 0) n(.04, 3200, .022, .055 + stagger, "highpass");
    if (v === 3) t(root * 1.5, root, .12, .012, .04, 2.2, 2400, "swell", "metal");
  } else if (phase === "charge") {
    n(length, id.band, .047, 0, piece === "r" ? "lowpass" : "bandpass", "rise");
    t(root * .55, root * (piece === "r" ? 1.1 : 1.7), length, .075 * id.weight, stagger, id.fm + v * .23, id.band, v === 2 ? "swell" : "rise", texture);
    t(root * 1.5, root * 2, length * .74, .032, length * .13 + stagger, id.fm * .3, Math.min(4400, id.band * 1.2), "rise", piece === "b" ? "choir" : texture, -pan);
    if (v === 1 || v === 3) n(.055 + stagger, id.band * .8, .04, length * .5, "bandpass");
    if (v === 3) t(root * 2.756, root * 2, length * .45, .022, length * .35, 1.8, 3600, "swell", "metal");
  } else if (phase === "dash") {
    n(piece === "n" ? .36 : .2 + stagger, id.band, .12, 0, "bandpass", piece === "n" ? "swell" : "punch");
    t(root * (piece === "n" ? 3 : 1.8), root * .46, .22 + stagger, .085 * id.weight, .01 + stagger, id.fm, id.band, "punch", texture);
    if (piece === "n" || v === 1) n(.12, 2800, .064, .14 + stagger, "highpass", "swell", -pan);
    if (piece === "b" || piece === "q") t(root * 1.5, root * 1.43, .38, .04, stagger, .5, 3600, "swell", "choir", -pan);
    if (v === 2) t(root * .6, root * .42, .15, .035, .1, id.fm * .8, 1400, "punch", texture);
    if (v === 3) n(.075, 2200, .044, .2, "bandpass");
  } else if (phase === "impact") {
    // Crack + phone-audible body + low weight + class-specific resonant aftermath.
    n(.042 + stagger * .3, Math.min(4400, id.band * 1.25), .13, 0, "highpass");
    t(piece === "r" ? 130 : 210, 52, .24 + stagger, .137 * id.weight, .005, .6 + v * .17, 950, "punch", "brass", pan, [.48, .2, .065]);
    n(.24 + stagger, id.band * .65, .075, .022 + stagger, piece === "r" ? "lowpass" : "bandpass", v === 2 ? "swell" : "punch");
    t(root * 1.1, root * .85, id.tail, .07, .035 + stagger, id.fm, id.band, "punch", texture, -pan);
    if (v === 1 || v === 3) t(root * 2.756, root * 2, .16 + stagger, .029, .1, 1.5, 3400, "punch", "metal");
    if (v === 3) n(.05, 2900, .04, .18, "highpass");
    if (!capture) for (const layer of layers) layer.level *= .32;
  } else if (phase === "death") {
    n(.5 + stagger, piece === "r" ? 800 : 2600, .08, 0, "bandpass", "swell");
    t(root, root * .2, .64 + stagger, .075 * id.weight, .04, id.fm, id.band, "punch", texture);
    t(root * 2.756, root * 1.41, .44, .033, .16 + stagger, .9, 3600, "swell", "metal", -pan);
    if (v === 1 || v === 2) n(.08, 3200, .035, .25 + stagger, "highpass");
    if (v === 2) t(root * .5, 35, .55, .04, .2, .4, 900, "swell", "brass");
    if (v === 3) { n(.05, 2400, .032, .12); n(.06, 3000, .024, .31); }
  } else {
    // King danger: a low dissonant pressure chord rather than an alarm beep.
    t(146.83, 138.6, .68, .065, 0, .35, 1600, "swell", "brass");
    t(155.56, 146.83, .58, .043, .035 + stagger, .7, 1700, "swell", "choir", -pan);
    n(.22 + stagger, 1300, .037, .025, "bandpass", v === 2 ? "swell" : "punch");
    if (v === 1 || v === 3) t(73.416, 55, .48, .056, .1 + stagger, .5, 800, "punch", "brass");
    if (v === 2) t(220, 207.65, .53, .024, .13, .6, 2400, "swell", "choir");
    if (v === 3) n(.05, 2600, .027, .18, "highpass");
  }
  for(const [i,layer] of layers.entries()) {
    layer.room=phase==='lock'||phase==='dash'?.05:piece==='r'?.1:piece==='b'||piece==='q'?.32:.18;
    if(layer.kind==='tone'){
      if(piece==='p'&&phase==='lock')layer.texture='mechanical';
      if(piece==='n'&&phase==='dash'){layer.texture='metal';layer.partials=[.22,.11,.04];layer.offset+=i*.009;}
      if(piece==='r'&&(phase==='lock'||phase==='impact')){layer.texture='mechanical';layer.partials=[.5,.22,.08];}
      if(piece==='q')layer.texture='glass';
      if(piece==='b'&&phase==='death')layer.texture='void';
    }
  }
  return layers;
}

export function eventSoundRecipe(event: string, variant: number, pan = 0): SoundRecipe {
  const v = ((Math.floor(variant) % 4) + 4) % 4;
  const { layers, tone: t, noise: n } = composer(pan);
  const feedback=['ui','ui-hover','ui-select','ui-back','ui-confirm','ui-error','purchase','ready','join','leave','turn','timer-low','portal-enter','portal-exit'];
  if(feedback.includes(event)) {
    const warning=event==='ui-error'||event==='timer-low',portal=event.startsWith('portal-');
    const length=portal?.52:event==='purchase'?.36:event==='ui-hover'?.05:.11;
    n(length*.7,warning?850:portal?2100:1800,.035+v*.003,0,'bandpass',portal?'swell':'punch');
    t(portal?90:warning?140:260,portal?(event==='portal-enter'?42:180):warning?105:240,length,.028, [.004,.016,.032,.008][v],.25,portal?1800:1200,portal?'swell':'punch',portal?'void':'mechanical');
    if(event==='purchase'||event==='ui-confirm'||event==='ready')t(520,510,.17,.018,.07+v*.012,.1,3000,'punch','glass',-.2);
    else if(v===1||v===3)n(.035,2300,.016,.045+v*.008,'highpass');
    if(v===2)t(180,150,.08,.016,.03,.1,900,'punch','mechanical');
    for(const layer of layers)layer.room=portal?.5:.02;
    return layers;
  }
  const warning = ["check", "double-check", "discovered-check", "queen-fallen", "defeat"].includes(event);
  const closing = ["mate", "victory", "defeat"].includes(event);
  const short = event === "ui";
  const seed = audioSeed(event), root = short ? 110 : 146.83 * [1, 1.189207, 1.5][seed % 3];
  const duration = short ? .16 : closing ? .98 : .52;
  const offset = [.0, .04, .085, .022][v];
  const chords = warning ? [1, 1.05946, 1.5] : event === "promotion" || event === "victory" ? [1, 1.189207, 1.5, 2] : [1, 1.33484, 1.5];
  n(short ? .04 : .065, short ? 1700 : 2600, short ? .016 : .047, 0, "bandpass", v === 2 ? "swell" : "punch");
  for (let i = 0; i < chords.length; i++) {
    t(root * chords[i], root * chords[i] * (warning ? .97 : 1), duration * (v === 2 ? .8 : 1), short ? .012 : .032, i * (v === 1 ? .025 : .009) + offset, .28 + v * .12, warning ? 1700 : 2800, v === 3 ? "rise" : "swell", warning || closing ? "brass" : "choir", i % 2 ? -pan - .2 : pan + .2);
  }
  if (closing) t(98, event === "defeat" ? 49 : 73.416, 1.08, .082, .015, .4, 1000, "punch", "brass");
  if (event === "fork" || event === "double-check") { n(.06, 2400, .035, .1 + offset, "highpass", "punch", -.65); n(.06, 2400, .035, .22 + offset, "highpass", "punch", .65); }
  else if (v === 1 || v === 3) n(.06, 2100, short ? .012 : .032, .14 + offset, "bandpass");
  if (v === 2) t(root * .5, root * .4, duration * .6, short ? .01 : .028, .16, .7, 1000, "punch", "brass");
  const material=event==='castle'?'mechanical':event==='promotion'?'glass':event==='escape'||event==='en-passant'?'void':warning?'brass':'choir';
  const eventIndex=seed%7;
  for(const [i,layer] of layers.entries()){
    layer.room=closing?.3:.1;
    if(layer.kind==='tone'){layer.texture=material;layer.offset+=i*(eventIndex*.006);}
  }
  return layers;
}

/** Skins alter material, articulation rhythm, spectral shape and final flourish. */
export function combatSoundRecipe(piece: PieceSymbol, skin: SkinId, cue: CombatSoundCue, variant: number, duration = .3, pan = 0, ultimate = false): SoundRecipe {
  const mapped: Record<CombatSoundCue, SoundPhase> = { draw: "lock", charge: "charge", release: "dash", clash: "impact", counter: "dash", finisher: "charge", impact: "impact", armor: "lock", disintegrate: "death" };
  const recipe = pieceSoundRecipe(piece, mapped[cue], variant, duration, true, pan);
  if (cue === "clash" || cue === "armor") {
    for (const layer of recipe) {
      if (layer.kind === "tone") { layer.texture = "metal"; layer.fm = 2.5; layer.from *= 1.8; layer.to *= 1.4; }
      layer.duration *= .7; layer.level *= .68;
    }
  }
  if (cue === "counter") for (const layer of recipe) { layer.pan *= -1; layer.level *= .74; layer.duration *= .8; }
  if (cue === "finisher") for (const layer of recipe) { layer.level *= 1.12; if (layer.kind === "tone") layer.fm *= 1.35; }
  return applySkinSoundProfile(recipe, skin, cue, ultimate, piece, variant);
}
function applySkinSoundProfile(recipe: SoundRecipe, skin: SkinId, cue: string, ultimate: boolean, piece: PieceSymbol, variant=0): SoundRecipe {
  if(['nova','phantom','dragon'].includes(skin)) {
    const c=composer(0),v=variant%4,root=identities[piece].root;
    const charging=cue==='charge'||cue==='finisher',hit=cue==='impact'||cue==='clash',death=cue==='death'||cue==='disintegrate';
    const duration=charging?.45:death?.65:.24;
    if(skin==='nova'){
      c.noise(charging?duration:.06,2400,.065,0,'bandpass',charging?'rise':'punch');
      c.tone(charging?root*.5:root*2,charging?root*2.3:root*.55,duration,.07,v*.009,.8,3200,charging?'rise':'punch','plasma');
      c.tone(root*1.5,root*1.51,.28,.026,.055+v*.014,.2,3600,'swell','glass');
      if(hit)c.tone(160,52,.28,.12,.005,.3,1100,'punch','brass');
    }else if(skin==='phantom'){
      c.noise(duration,1700,.055,0,'bandpass','swell');
      c.tone(root*.7,charging?root*.8:root*.35,duration,.055,.016+v*.011,1.1,1900,'swell','void',-.5);
      c.noise(.1,3200,.07,charging?.3:.08+v*.013,'highpass','punch',.5);
      if(hit)c.tone(140,60,.18,.085,.04,.1,1000,'punch','mechanical');
    }else{
      c.tone(root*.55,root*.3,duration,.085,0,2.3,1600,charging?'rise':'punch','brass');
      c.noise(.14,1000,.075,.01+v*.012,'lowpass','punch');
      c.tone(root*1.4,root*.65,.24,.045,.07,3.2,2300,'punch','metal');
      if(hit){c.noise(.04,3600,.1,0,'highpass');c.tone(180,48,.35,.12,.012,.6,1100,'punch','brass');}
    }
    if(v===1||v===3)c.noise(.045,2200,.026,.15+v*.012,'bandpass');
    if(v===2)c.tone(root*1.9,root*1.3,.11,.022,.13,.7,2800,'swell','glass');
    // One class accent survives the skin score: a spear, blade, spell or artillery body.
    if(piece==='p')c.noise(.055,3000,.022,.035,'highpass');
    else if(piece==='n')c.noise(.09,2600,.028,.11+v*.009,'bandpass','swell');
    else if(piece==='b')c.tone(root*1.5,root*1.49,.32,.025,.08,.3,2800,'swell','choir');
    else if(piece==='r')c.tone(95,80,.18,.038,.045,.1,900,'punch','mechanical');
    else if(piece==='q')c.tone(root*2.756,root*2,.22,.024,.095,.2,3600,'swell','glass');
    else c.tone(75,45,.3,.04,.02,.3,950,'punch','brass');
    recipe=c.layers;
    for(const layer of recipe)layer.room=skin==='phantom'?.45:skin==='dragon'?.16:.23;
  }
  const scored=rescoreLegacySkin(recipe,skin,cue,piece,variant);if(scored)recipe=scored;
  const signature = combatProfile(piece, skin).sound;
  const weight = Math.max(.88, Math.min(1.12, 1 + (signature.body - .8) * .12));
  const pitch = 1 + (signature.pitch - 1) * .2;
  const tail = Math.max(.9, Math.min(1.12, 1 + (signature.tail - 1) * .15));
  for (let i = 0; i < recipe.length; i++) {
    const layer = recipe[i];
    layer.level *= weight;
    if (layer.kind === "tone") { layer.from *= pitch; layer.to *= pitch; }
    // Profile tails affect aftermath; anticipation stays on the shared score.
    if (["impact", "death", "disintegrate", "armor"].includes(cue)) layer.duration *= tail;
    if (ultimate) { layer.level *= 1.22; if (layer.kind === "tone") layer.partials = [.5, .24, .08]; }
    layer.level = Math.min(.24, layer.level); layer.pan = Math.max(-.75, Math.min(.75, layer.pan));
  }
  return recipe;
}

export function soundPriority(key:string,bus:string){return bus==="music"||bus==="ambience"?0:/event:(mate|check|defeat|timer-low|double-check|queen-fallen|discovered-check)/.test(key)?100:/:check:/.test(key)?100:/:(impact|finisher):/.test(key)?90:bus==="cinematic"?70:/event:ui/.test(key)?20:50;}

type Voice = { priority:number; source: AudioBufferSourceNode; gain: GainNode; stereo?: StereoPannerNode; bus: Exclude<AudioBus, "master">; key: string; buffer: AudioBuffer; ended: boolean };
type CacheEntry = { buffer: AudioBuffer; bytes: number };
type MusicJob = { state?: MusicState; ambience?: AmbiencePreset; recipe?: SoundRecipe; processing:AudioProcessingMode; key: string; resolve: () => void };
const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const busIds = ["music", "ambience", "sfx", "cinematic"] as const;

/** The game's single audio engine. Heavy long-form synthesis runs in a reusable worker;
 * attacks use cached, cancellable PCM voices instead of real-time oscillator graphs. */
export class SpaceAudio {
  readonly context: BaseAudioContext;
  private output: GainNode;
  private gate: GainNode;
  private pauseGate: GainNode;
  private mix: GainNode;
  private musicDuck: GainNode;
  private ambienceDuck: GainNode;
  private dimension=false;
  private feedbackAt=-Infinity;
  private nodes: AudioNode[] = [];
  private buses = {} as Record<Exclude<AudioBus, "master">, GainNode>;
  private levels: Record<AudioBus, number> = { master: .35, music: .38, ambience: .28, sfx: .82, cinematic: .9 };
  private sources = new Map<AudioBufferSourceNode, Voice>();
  private cache = new Map<string, CacheEntry>();
  private bytes = 0;
  private variants: SoundVariantBag;
  private muted = false;
  private paused = false;
  private disposed = false;
  private state: MusicState | null = null;
  private bedState: MusicState = "normal";
  private musicVoice: Voice | null = null;
  private ambienceVoice: Voice | null = null;
  private ambiencePreset: AmbiencePreset = "citadel";
  private worker: Worker | null = null;
  private workerFailed=false;
  private processing:AudioProcessingMode='cinematic';
  private jobs: MusicJob[] = [];
  private activeJob: MusicJob | null = null;
  private waiting = new Map<string, Promise<void>>();
  private fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private duckDb = 0;
  private closingPlayed: MusicState | null = null;
  private maxSynthesisMs = 0;
  private musicOrigin: number | null = null;
  lastVariant: { key: string; variant: number } | null = null;
  constructor(context: BaseAudioContext, random: () => number = Math.random) {
    this.context = context; this.variants = new SoundVariantBag(random);
    const c = context;
    this.mix = c.createGain(); this.output = c.createGain(); this.gate = c.createGain(); this.pauseGate = c.createGain(); this.musicDuck = c.createGain(); this.ambienceDuck=c.createGain();
    const highpass = c.createBiquadFilter(); highpass.type = "highpass"; highpass.frequency.value = 28; highpass.Q.value = .7;
    const compressor = c.createDynamicsCompressor();
    compressor.threshold.value = -14; compressor.knee.value = 8; compressor.ratio.value = 5;
    compressor.attack.value = .003; compressor.release.value = .14;
    this.mix.connect(highpass).connect(compressor);
    if (typeof c.createWaveShaper === "function") {
      const limiter = c.createWaveShaper(), curve = new Float32Array(4097);
      for (let i = 0; i < curve.length; i++) { const x = i / (curve.length - 1) * 2 - 1; curve[i] = .85 * Math.tanh(x / .85); }
      limiter.curve = curve; limiter.oversample = "2x";
      compressor.connect(limiter).connect(this.pauseGate); this.nodes.push(limiter);
    } else compressor.connect(this.pauseGate);
    this.pauseGate.connect(this.gate).connect(this.output).connect(c.destination);
    this.output.gain.value = this.levels.master;
    for (const id of busIds) {
      const bus = c.createGain(); bus.gain.value = this.levels[id];
      if (id === "music") bus.connect(this.musicDuck).connect(this.mix); else if(id === "ambience")bus.connect(this.ambienceDuck).connect(this.mix); else bus.connect(this.mix);
      this.buses[id] = bus;
    }
    this.nodes.push(highpass, compressor, this.mix, this.output, this.gate, this.pauseGate, this.musicDuck,this.ambienceDuck, ...Object.values(this.buses));
  }
  get activeVoices() { return this.sources.size; }
  get diagnostics() {
    const unique = new Set([...this.cache.values()].map((entry) => entry.buffer));
    for (const voice of this.sources.values()) unique.add(voice.buffer);
    return {
      voices: this.activeVoices, voiceLimit: AUDIO_VOICE_LIMIT, cacheBytes: this.bytes, cacheEntries: this.cache.size,
      residentBytes: [...unique].reduce((sum, buffer) => sum + buffer.length * buffer.numberOfChannels * 4, 0),
      cacheLimit: AUDIO_CACHE_LIMIT, musicState: this.state, ambiencePreset: this.ambiencePreset,
      dimension:this.dimension, busLevels: { ...this.levels }, muted: this.muted, paused: this.paused, duckDb: this.duckDb,
      worker: !!this.worker, processing:this.processing, addon:AUDIO_DSP_ADDON, maxSynthesisMs: this.maxSynthesisMs,
    };
  }
  setProcessingMode(value:AudioProcessingMode){
    const mode=readProcessingMode(value);if(this.disposed||mode===this.processing)return;
    this.cancelEffects();this.processing=mode;
    // Let queued beds warm once requested in the new mode; voices from the old mix fade.
    if(this.musicVoice)this.stopVoice(this.musicVoice,.08);if(this.ambienceVoice)this.stopVoice(this.ambienceVoice,.08);
    this.musicVoice=null;this.ambienceVoice=null;if(this.state)this.updateBeds();
  }
  setVolume(value: number) { this.setBusVolume("master", value); }
  setBusVolume(bus: AudioBus, value: number) {
    if (this.disposed) return;
    this.levels[bus] = clamp(value);
    (bus === "master" ? this.output : this.buses[bus]).gain.setTargetAtTime(this.levels[bus], this.context.currentTime, .025);
    if (this.state && (bus === "music" || bus === "ambience" || bus === "master")) this.updateBeds();
  }
  setMuted(muted: boolean) {
    if (this.disposed || this.muted === muted) return;
    this.muted = muted; this.gate.gain.setTargetAtTime(muted ? 0 : 1, this.context.currentTime, .015);
    if (muted) { this.stopVoices(() => true); this.musicVoice = null; this.ambienceVoice = null; }
    else if (this.state) this.updateBeds();
  }
  setPaused(paused: boolean) {
    if (this.disposed || this.paused === paused) return;
    this.paused = paused; this.pauseGate.gain.setTargetAtTime(paused ? 0 : 1, this.context.currentTime, .04);
    if (paused) this.cancelEffects();
  }
  private stopVoice(voice: Voice, fade = .025) {
    const now = this.context.currentTime;
    voice.gain.gain.cancelScheduledValues(now); voice.gain.gain.setTargetAtTime(0, now, .006);
    try { voice.source.stop(now + fade); } catch {}
  }
  private stopVoices(predicate: (voice: Voice) => boolean) { for (const voice of this.sources.values()) if (predicate(voice)) this.stopVoice(voice); }
  setDimension(active:boolean){
    if(this.disposed||this.dimension===active)return;this.dimension=active;
    this.ambienceDuck.gain.setTargetAtTime(active?.28:1,this.context.currentTime,.045);
    this.playEvent(active?'portal-enter':'portal-exit');
  }
  anticipateImpact() {
    if(this.disposed||this.paused||this.muted)return;
    // Make a short space before contact; following impact restores normal cue gain.
    this.stopVoices(v=>(v.bus==="cinematic"||v.bus==="sfx")&&v.priority<95);
    this.duckMusic(18,.15);
  }
  cancelCinematic() {
    this.stopVoices((voice) => voice.bus === "cinematic");
    this.restoreDuck();
  }
  cancelEffects() {
    this.stopVoices((voice) => voice.bus === "cinematic" || voice.bus === "sfx");
    // Rapid Skip/preview changes must not leave hundreds of obsolete warm-up jobs.
    // The one active worker task may finish caching, but cannot start an effect.
    const keep: MusicJob[] = [];
    for (const job of this.jobs) {
      if (job.recipe) { this.waiting.delete(`${job.processing}|${job.key}`); job.resolve(); }
      else keep.push(job);
    }
    this.jobs = keep;
    this.restoreDuck();
  }
  cancel() {
    this.dimension=false;this.ambienceDuck.gain.setTargetAtTime(1,this.context.currentTime,.04);
    this.cancelEffects();
    this.stopVoices(() => true); this.musicVoice = null; this.ambienceVoice = null; this.state = null; this.closingPlayed = null;
    this.restoreDuck();
  }
  dispose() {
    if (this.disposed) return;
    this.cancel(); this.disposed = true;
    for (const voice of this.sources.values()) { voice.source.onended = null; voice.source.disconnect(); voice.gain.disconnect(); voice.stereo?.disconnect(); }
    this.sources.clear(); this.nodes.forEach((node) => node.disconnect()); this.cache.clear(); this.bytes = 0;
    this.worker?.terminate(); this.worker = null;
    if (this.fallbackTimer) clearTimeout(this.fallbackTimer);
    for (const job of [this.activeJob, ...this.jobs]) job?.resolve();
    this.activeJob = null; this.jobs = []; this.waiting.clear();
  }
  private remember(key: string, pcm: StereoPCM): AudioBuffer {
    // A cold cue may already have rendered before its worker preparation returns.
    // Reuse that take without replacing it or counting its bytes twice.
    const existing = this.cached(key); if (existing) return existing;
    const buffer = this.context.createBuffer(2, pcm.left.length, pcm.sampleRate);
    buffer.getChannelData(0).set(pcm.left); buffer.getChannelData(1).set(pcm.right);
    const bytes = pcm.left.byteLength + pcm.right.byteLength;
    while (this.bytes + bytes > AUDIO_CACHE_LIMIT && this.cache.size) {
      const first = this.cache.entries().next().value!;
      this.cache.delete(first[0]); this.bytes -= first[1].bytes;
    }
    if (bytes <= AUDIO_CACHE_LIMIT) { this.cache.set(`${this.processing}|${key}`, { buffer, bytes }); this.bytes += bytes; }
    return buffer;
  }
  private cached(key: string): AudioBuffer | null {
    const qualified=`${this.processing}|${key}`;
    const entry = this.cache.get(qualified);
    if (!entry) return null;
    this.cache.delete(qualified); this.cache.set(qualified, entry); return entry.buffer;
  }
  private voice(buffer: AudioBuffer, key: string, bus: Voice["bus"], loop = false, fade = .006, pan = 0): Voice | null {
    if (this.disposed || this.muted || this.levels[bus] === 0 || this.paused && bus !== "music" && bus !== "ambience") return null;
    // Fade the oldest expendable effect. Beds are never evicted by a loud attack.
    if (this.sources.size >= AUDIO_VOICE_LIMIT) {
      const priority=soundPriority(key,bus);
      const oldest = [...this.sources.values()].filter(voice=>voice.bus==='sfx'||voice.bus==='cinematic').sort((a,b)=>a.priority-b.priority)[0];
      if(oldest&&oldest.priority>priority)return null;
      if (oldest) {
        // Disconnect before admitting a replacement: the cap also bounds live nodes,
        // rather than merely hiding still-fading voices from the diagnostics.
        oldest.source.onended = null; try { oldest.source.stop(this.context.currentTime); } catch {}
        oldest.source.disconnect(); oldest.gain.disconnect(); oldest.stereo?.disconnect();
        oldest.ended = true; this.sources.delete(oldest.source);
      } else return null;
    }
    const source = this.context.createBufferSource(), gain = this.context.createGain();
    const now = this.context.currentTime;
    source.buffer = buffer; source.loop = loop;
    gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(1, now + fade);
    const stereo = this.context.createStereoPanner(); stereo.pan.value = Math.max(-.75, Math.min(.75, pan));
    source.connect(gain).connect(stereo).connect(this.buses[bus]);
    const voice: Voice = { priority:soundPriority(key,bus),source, gain, stereo, bus, key, buffer, ended: false };
    this.sources.set(source, voice);
    source.onended = () => {
      voice.ended = true; this.sources.delete(source); source.disconnect(); gain.disconnect(); stereo.disconnect();
      if (this.musicVoice === voice) this.musicVoice = null;
      if (this.ambienceVoice === voice) this.ambienceVoice = null;
    };
    if (bus === "music" && loop) {
      this.musicOrigin ??= now;
      source.start(now, (now - this.musicOrigin) % buffer.duration);
    } else source.start(now);
    if (!loop) source.stop(now + buffer.duration + .01);
    return voice;
  }
  private render(recipe: SoundRecipe, key: string, bus: Voice["bus"], pan = 0) {
    if (this.disposed || this.muted || this.paused) return;
    let buffer = this.cached(key);
    if (!buffer) {
      const start = typeof performance === "undefined" ? 0 : performance.now();
      buffer = this.remember(key, renderSoundRecipe(recipe, 24000, audioSeed(key),this.processing,key));
      if (typeof performance !== "undefined") this.maxSynthesisMs = Math.max(this.maxSynthesisMs, performance.now() - start);
    }
    this.voice(buffer, key, bus, false, .006, pan);
  }
  play(piece: PieceSymbol, phase: SoundPhase, duration = .3, capture = false, pan = 0, skin: SkinId = "classic", ultimate = false) {
    const key = `${piece}:${canonicalPhase(phase)}${skin === "classic" ? "" : `:${skin}`}`, variant = this.variants.next(key);
    this.lastVariant = { key, variant };
    const quantized = Math.round(duration * 20) / 20;
    const recipe = applySkinSoundProfile(pieceSoundRecipe(piece, phase, variant, quantized, true, 0), skin, canonicalPhase(phase), ultimate, piece, variant);
    if(canonicalPhase(phase)==="impact"&&!capture)for(const layer of recipe)layer.level*=.32;
    this.render(recipe, `${key}:${variant}:${quantized}:${capture}:${ultimate}`, "sfx", pan);
    return variant;
  }
  playEvent(event: string, pan = 0) {
    if(event==='ui'||event.startsWith('ui-')){
      const now=this.context.currentTime;if(now-this.feedbackAt<.065)return -1;this.feedbackAt=now;
    }
    const key = `event:${event}`, variant = this.variants.next(key);
    this.lastVariant = { key, variant };
    this.render(eventSoundRecipe(event, variant, 0), `${key}:${variant}`, "sfx", pan);
    return variant;
  }
  playCombatCue(piece: PieceSymbol, skin: SkinId, cue: CombatSoundCue, duration = .3, pan = 0, ultimate = false) {
    const key = `combat:${piece}:${skin}:${cue}`, variant = this.variants.next(key);
    this.lastVariant = { key, variant };
    this.renderCombatCue(piece, skin, cue, variant, duration, pan, ultimate);
    return variant;
  }
  auditionCombatCue(piece: PieceSymbol, skin: SkinId, cue: CombatSoundCue, variant = 0) {
    const chosen = ((Math.floor(variant) % SOUND_VARIANTS) + SOUND_VARIANTS) % SOUND_VARIANTS;
    this.lastVariant = { key: `combat:${piece}:${skin}:${cue}`, variant: chosen };
    this.renderCombatCue(piece, skin, cue, chosen, .3, 0, false); return chosen;
  }
  auditionPiece(piece: PieceSymbol, skin: SkinId, phase: SoundPhase, variant = 0, duration = .4) {
    const chosen = ((Math.floor(variant) % SOUND_VARIANTS) + SOUND_VARIANTS) % SOUND_VARIANTS;
    const key = `${piece}:${canonicalPhase(phase)}${skin === "classic" ? "" : `:${skin}`}`;
    const quantized = Math.round(duration * 20) / 20;
    const recipe = applySkinSoundProfile(pieceSoundRecipe(piece, phase, chosen, quantized, true, 0), skin, canonicalPhase(phase), false, piece, chosen);
    this.lastVariant = { key, variant: chosen };
    this.render(recipe, `${key}:${chosen}:${quantized}:true:false`, "sfx");
    return chosen;
  }
  /** Queue the next take of every capture cue off the animation thread. Call at face-off. */
  prepareCombat(piece: PieceSymbol, skin: SkinId, duration = 2600, ultimate = false): Promise<void> {
    const cues: CombatSoundCue[] = ["draw", "charge", "release", "clash", "counter", "finisher", "impact", "armor", "disintegrate"];
    return Promise.all(cues.map((cue) => {
      const key = `combat:${piece}:${skin}:${cue}`, variant = this.variants.peek(key);
      const requested = cue === "charge" ? .53 * duration / 2600 : cue === "finisher" ? .33 * duration / 2600 : .3;
      const quantized = Math.round(requested * 20) / 20;
      const cacheKey = `${key}:${variant}:${quantized}:${ultimate}`;
      return this.requestRecipe(cacheKey, combatSoundRecipe(piece, skin, cue, variant, quantized, 0, ultimate));
    })).then(() => undefined);
  }
  private requestRecipe(key: string, recipe: SoundRecipe): Promise<void> {
    if (this.cached(key) || this.disposed) return Promise.resolve();
    const qualified=`${this.processing}|${key}`;
    const waiting = this.waiting.get(qualified); if (waiting) return waiting;
    const promise = new Promise<void>((resolve) => { const position = this.jobs.findIndex((job) => !!job.state);
      this.jobs.splice(position < 0 ? this.jobs.length : position, 0, { recipe, key, processing:this.processing, resolve }); });
    this.waiting.set(qualified, promise); this.processMusicJob(); return promise;
  }
  private renderCombatCue(piece: PieceSymbol, skin: SkinId, cue: CombatSoundCue, variant: number, duration: number, pan: number, ultimate: boolean) {
    const quantized = cue === "charge" || cue === "finisher" ? Math.round(duration * 20) / 20 : .3;
    this.render(combatSoundRecipe(piece, skin, cue, variant, quantized, 0, ultimate), `combat:${piece}:${skin}:${cue}:${variant}:${quantized}:${ultimate}`, "cinematic", pan);
    if (cue === "impact" || cue === "finisher") this.duckMusic(ultimate ? 6 : 4.5, .7);
  }
  private duckMusic(db: number, seconds: number) {
    if (!this.state || this.disposed) return;
    const now = this.context.currentTime, gain = this.musicDuck.gain;
    this.duckDb = db; gain.cancelScheduledValues(now); gain.setTargetAtTime(10 ** (-db / 20), now, .012);
    if (this.state !== "capture") gain.setTargetAtTime(1, now + seconds, .12);
  }
  private restoreDuck() {
    this.duckDb = 0; const now = this.context.currentTime;
    this.musicDuck.gain.cancelScheduledValues(now); this.musicDuck.gain.setTargetAtTime(1, now, .07);
  }
  setMusicState(state: MusicState) {
    if (this.disposed) return;
    const changed = this.state !== state; this.state = state;
    if (state === "capture") { this.duckMusic(5, 1); this.updateBeds(); return; }
    if (changed) { this.restoreDuck(); this.closingPlayed = null; }
    this.bedState = state === "check" ? "threat" : state;
    this.updateBeds();
  }
  setAmbiencePreset(preset: AmbiencePreset) {
    if (!AMBIENCE_PRESETS.includes(preset) || this.disposed || preset === this.ambiencePreset) return;
    this.ambiencePreset = preset;
    if (this.ambienceVoice) this.stopVoice(this.ambienceVoice, .12);
    this.ambienceVoice = null;
    if (this.state) this.updateBeds();
  }
  /** Used by the audio harness to await asynchronous long-form PCM preparation. */
  prepareMusic(states: MusicState[] = ["menu", "normal", "threat", "ultimate"]): Promise<void> {
    return Promise.all([this.requestAmbience(this.ambiencePreset), ...states.map((state) => this.requestMusic(state === "capture" ? this.bedState : state === "check" ? "threat" : state))]).then(() => undefined);
  }
  private updateBeds() {
    if (!this.state || this.muted || this.disposed) return;
    if (!this.ambienceVoice && !["mate", "victory", "defeat"].includes(this.state)) {
      const key = `ambience:${this.ambiencePreset}`;
      const buffer = this.cached(key);
      if (buffer) this.ambienceVoice = this.voice(buffer, key, "ambience", true, .15);
      else void this.requestAmbience(this.ambiencePreset);
    }
    const wanted = this.state === "capture" ? this.bedState : this.state === "check" ? "threat" : this.state;
    const key = `music:${wanted}`;
    if (["mate", "victory", "defeat"].includes(wanted) && this.closingPlayed === wanted) return;
    if (this.musicVoice?.key === key && !this.musicVoice.ended) return;
    const ready = this.cached(key);
    if (!ready) { void this.requestMusic(wanted); return; }
    if (this.musicVoice) this.stopVoice(this.musicVoice, .16);
    const closing = ["mate", "victory", "defeat"].includes(wanted);
    this.musicVoice = this.voice(ready, key, "music", !closing, .2);
    if (closing) this.closingPlayed = wanted;
    if (closing && this.ambienceVoice) { this.stopVoice(this.ambienceVoice, .18); this.ambienceVoice = null; }
  }
  private requestMusic(state: MusicState): Promise<void> {
    const key = `music:${state}`;
    if (this.cached(key) || this.disposed) return Promise.resolve();
    const qualified=`${this.processing}|${key}`;
    const waiting = this.waiting.get(qualified); if (waiting) return waiting;
    const promise = new Promise<void>((resolve) => { this.jobs.push({ state, key, processing:this.processing, resolve }); });
    this.waiting.set(qualified, promise); this.processMusicJob(); return promise;
  }
  private requestAmbience(ambience: AmbiencePreset): Promise<void> {
    const key = `ambience:${ambience}`;
    if (this.cached(key) || this.disposed) return Promise.resolve();
    const qualified=`${this.processing}|${key}`;
    const waiting = this.waiting.get(qualified); if (waiting) return waiting;
    const promise = new Promise<void>((resolve) => { this.jobs.push({ ambience, key, processing:this.processing, resolve }); });
    this.waiting.set(qualified, promise); this.processMusicJob(); return promise;
  }
  private processMusicJob() {
    if (this.activeJob || !this.jobs.length || this.disposed) return;
    this.activeJob = this.jobs.shift()!;
    if(!this.worker&&!this.workerFailed&&typeof Worker!=='undefined'&&typeof URL.createObjectURL==='function'){
      // Imported lazily so native tests and unsupported browsers keep the synchronous fallback.
      // Vite bundles the addon into this inline worker, including the single-file build.
      void import('./audio-worker-loader').then(({createAudioWorker})=>{
        if(this.disposed)return;
        try{this.worker=createAudioWorker();this.worker.onmessage=(event:MessageEvent<StereoPCM>)=>this.completeMusicJob(event.data);
          this.worker.onerror=()=>{this.worker?.terminate();this.worker=null;this.workerFailed=true;this.fallbackMusicJob();};this.sendWorkerJob();
        }catch{this.workerFailed=true;this.fallbackMusicJob();}
      }).catch(()=>{this.workerFailed=true;this.fallbackMusicJob();});
      return;
    }
    this.sendWorkerJob();
  }
  private sendWorkerJob(){
    if(!this.activeJob||this.disposed)return;
    if(this.worker)this.worker.postMessage({state:this.activeJob.state,ambience:this.activeJob.ambience,recipe:this.activeJob.recipe,seed:audioSeed(this.activeJob.key),key:this.activeJob.key,processing:this.activeJob.processing});
    else this.fallbackMusicJob();
  }
  private fallbackMusicJob() {
    // Worker support is available on current Safari/Chromium. The fallback stays asynchronous
    // and runs only on a state request, never inside a combat cue or animation frame callback.
    if (!this.activeJob || this.disposed) return;
    this.fallbackTimer = setTimeout(() => {
      this.fallbackTimer = null;
      if (!this.activeJob || this.disposed) return;
      this.completeMusicJob(this.activeJob.recipe ? renderSoundRecipe(this.activeJob.recipe, 24000, audioSeed(this.activeJob.key),this.activeJob.processing,this.activeJob.key)
        : processBedPCM(this.activeJob.ambience ? renderAmbience(audioSeed(this.activeJob.key), 12000, 31.7, this.activeJob.ambience)
        : renderMusic(this.activeJob.state!, audioSeed(this.activeJob.key)),this.activeJob.processing));
    }, 0);
  }
  private completeMusicJob(pcm: StereoPCM) {
    const job = this.activeJob;
    if (!job || this.disposed) return;
    if(job.processing===this.processing)this.remember(job.key, pcm); this.waiting.delete(`${job.processing}|${job.key}`); this.activeJob = null; job.resolve();
    this.updateBeds(); this.processMusicJob();
  }
}
