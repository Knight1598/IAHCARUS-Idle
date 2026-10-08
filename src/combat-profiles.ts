import type { PieceSymbol } from "chess.js";
import type { SkinId } from "./profile.ts";

/** Presentation data only: none of these values change chess or special rules. */
export type CombatPhase = "faceoff" | "opening" | "defense" | "finisher" | "defeat";
export type DefenseReaction = "parry" | "shield" | "barrier" | "dodge" | "brace";
export type CombatCue = "draw" | "charge" | "release" | "clash" | "counter" | "finisher" | "impact" | "armor" | "disintegrate";
export type AttackType = "pierce" | "slash" | "spell" | "heavy" | "storm" | "royal";
type MotionPattern = "spear-combo" | "warp-slash" | "seal-beam" | "siege-cannon" | "crystal-storm" | "astral-cleave";

export interface CombatProfile {
  readonly id: `${PieceSymbol}:${SkinId}`;
  readonly piece: PieceSymbol;
  readonly skin: SkinId;
  readonly attackType: AttackType;
  readonly motion: Readonly<{
    opening: MotionPattern; finisher: MotionPattern;
    skinStyle: "disciplined" | "explosive" | "precise" | "phase" | "ceremonial";
    tempo: number; reach: number; lift: number; twist: number; weight: number;
    recoil: number; anticipation: number; followThrough: number; counterReach: number;
  }>;
  readonly vfx: Readonly<{
    signature: "lance" | "crescent" | "seal" | "cannon" | "orbit" | "crown";
    flourish: "clean" | "combustion" | "fracture" | "rift" | "judgement";
    lobes: number; rings: number; shards: number; trailWidth: number;
    burstScale: number; orbitSpeed: number;
  }>;
  readonly sound: Readonly<{
    timbre: "plasma" | "dimension" | "arcane" | "siege" | "crystal" | "astral-blade";
    texture: "energy" | "fire" | "ice" | "space" | "gold";
    pitch: number; body: number; tail: number;
  }>;
  readonly camera: Readonly<{ weight: number; side: number; entry: number; shake: number }>;
}

type ClassIdentity = Omit<CombatProfile, "id" | "piece" | "skin">;
const classes: Record<PieceSymbol, ClassIdentity> = {
  p: {
    attackType: "pierce",
    motion: { opening: "spear-combo", finisher: "spear-combo", skinStyle: "disciplined", tempo: 1.2, reach: 1.15, lift: .1, twist: .32, weight: .6, recoil: .24, anticipation: .32, followThrough: .46, counterReach: .55 },
    vfx: { signature: "lance", flourish: "clean", lobes: 3, rings: 1, shards: 8, trailWidth: .08, burstScale: .75, orbitSpeed: 1.4 },
    sound: { timbre: "plasma", texture: "energy", pitch: 1.12, body: .64, tail: .7 },
    camera: { weight: .55, side: .92, entry: .86, shake: .018 },
  },
  n: {
    attackType: "slash",
    motion: { opening: "warp-slash", finisher: "warp-slash", skinStyle: "disciplined", tempo: 1.3, reach: 1.1, lift: .65, twist: 1.1, weight: .85, recoil: .3, anticipation: .5, followThrough: .9, counterReach: .9 },
    vfx: { signature: "crescent", flourish: "clean", lobes: 2, rings: 1, shards: 10, trailWidth: .16, burstScale: 1, orbitSpeed: 2.1 },
    sound: { timbre: "dimension", texture: "energy", pitch: 1.04, body: .8, tail: 1 },
    camera: { weight: .8, side: 1.18, entry: 1.12, shake: .025 },
  },
  b: {
    attackType: "spell",
    motion: { opening: "seal-beam", finisher: "seal-beam", skinStyle: "disciplined", tempo: .92, reach: .92, lift: .25, twist: .5, weight: .7, recoil: .18, anticipation: .65, followThrough: .55, counterReach: .75 },
    vfx: { signature: "seal", flourish: "clean", lobes: 3, rings: 3, shards: 6, trailWidth: .2, burstScale: .9, orbitSpeed: .9 },
    sound: { timbre: "arcane", texture: "energy", pitch: .96, body: .65, tail: 1.35 },
    camera: { weight: .65, side: 1, entry: .78, shake: .02 },
  },
  r: {
    attackType: "heavy",
    motion: { opening: "siege-cannon", finisher: "siege-cannon", skinStyle: "disciplined", tempo: .72, reach: .8, lift: .04, twist: .28, weight: 1.6, recoil: .68, anticipation: .86, followThrough: .72, counterReach: .4 },
    vfx: { signature: "cannon", flourish: "clean", lobes: 4, rings: 2, shards: 14, trailWidth: .32, burstScale: 1.4, orbitSpeed: .65 },
    sound: { timbre: "siege", texture: "energy", pitch: .72, body: 1.5, tail: .95 },
    camera: { weight: 1.55, side: .8, entry: .65, shake: .045 },
  },
  q: {
    attackType: "storm",
    motion: { opening: "crystal-storm", finisher: "crystal-storm", skinStyle: "disciplined", tempo: 1.04, reach: 1.05, lift: .42, twist: .78, weight: 1.05, recoil: .25, anticipation: .58, followThrough: .8, counterReach: .8 },
    vfx: { signature: "orbit", flourish: "clean", lobes: 6, rings: 3, shards: 18, trailWidth: .14, burstScale: 1.2, orbitSpeed: 1.7 },
    sound: { timbre: "crystal", texture: "energy", pitch: 1.06, body: .85, tail: 1.4 },
    camera: { weight: 1, side: 1.12, entry: .92, shake: .027 },
  },
  k: {
    attackType: "royal",
    motion: { opening: "astral-cleave", finisher: "astral-cleave", skinStyle: "disciplined", tempo: .8, reach: 1.24, lift: .12, twist: .64, weight: 1.35, recoil: .4, anticipation: .92, followThrough: 1.12, counterReach: .65 },
    vfx: { signature: "crown", flourish: "clean", lobes: 8, rings: 2, shards: 12, trailWidth: .24, burstScale: 1.3, orbitSpeed: .8 },
    sound: { timbre: "astral-blade", texture: "energy", pitch: .8, body: 1.25, tail: 1.3 },
    camera: { weight: 1.3, side: .88, entry: .75, shake: .038 },
  },
};

interface SkinIdentity {
  style: CombatProfile["motion"]["skinStyle"];
  flourish: CombatProfile["vfx"]["flourish"];
  texture: CombatProfile["sound"]["texture"];
  tempo: number; reach: number; lift: number; twist: number; recoil: number;
  anticipation: number; followThrough: number; counterReach: number;
  lobes: number; rings: number; shards: number; trail: number; burst: number; orbit: number;
  pitch: number; body: number; tail: number; camera: number;
}

// These skins change choreography, shapes and timbre, rather than only hue.
// Their intensity is cosmetic: duration, outcome and legal destinations agree.
const skinIdentities: Record<SkinId, SkinIdentity> = {
  classic: { style: "disciplined", flourish: "clean", texture: "energy", tempo: 1, reach: 1, lift: 1, twist: 1, recoil: 1, anticipation: 1, followThrough: 1, counterReach: 1, lobes: 0, rings: 0, shards: 0, trail: 1, burst: 1, orbit: 1, pitch: 1, body: 1, tail: 1, camera: 1 },
  ember: { style: "explosive", flourish: "combustion", texture: "fire", tempo: 1.13, reach: 1.08, lift: 1.18, twist: 1.12, recoil: 1.28, anticipation: .78, followThrough: 1.25, counterReach: 1.12, lobes: 1, rings: 0, shards: 6, trail: 1.28, burst: 1.16, orbit: 1.2, pitch: .94, body: 1.15, tail: .84, camera: 1.12 },
  frost: { style: "precise", flourish: "fracture", texture: "ice", tempo: .9, reach: .98, lift: .8, twist: .78, recoil: .84, anticipation: 1.15, followThrough: .86, counterReach: .8, lobes: 3, rings: 1, shards: 10, trail: .82, burst: .94, orbit: .7, pitch: 1.12, body: .92, tail: 1.2, camera: .86 },
  astral: { style: "phase", flourish: "rift", texture: "space", tempo: 1.06, reach: 1.16, lift: 1.38, twist: 1.4, recoil: .7, anticipation: 1.12, followThrough: 1.18, counterReach: 1.25, lobes: 0, rings: 2, shards: 2, trail: 1.06, burst: 1.07, orbit: -1.15, pitch: .88, body: 1.05, tail: 1.35, camera: 1.06 },
  royal: { style: "ceremonial", flourish: "judgement", texture: "gold", tempo: .86, reach: 1.06, lift: .92, twist: .9, recoil: 1.12, anticipation: 1.28, followThrough: 1.32, counterReach: .94, lobes: 2, rings: 2, shards: 4, trail: 1.2, burst: 1.18, orbit: .82, pitch: .9, body: 1.2, tail: 1.3, camera: 1.08 },
};

function buildProfile(piece: PieceSymbol, skin: SkinId): CombatProfile {
  const c = classes[piece], s = skinIdentities[skin];
  return Object.freeze({
    id: `${piece}:${skin}` as const, piece, skin, attackType: c.attackType,
    motion: Object.freeze({ ...c.motion, skinStyle: s.style,
      tempo: c.motion.tempo * s.tempo, reach: c.motion.reach * s.reach,
      lift: c.motion.lift * s.lift, twist: c.motion.twist * s.twist,
      recoil: c.motion.recoil * s.recoil, anticipation: c.motion.anticipation * s.anticipation,
      followThrough: c.motion.followThrough * s.followThrough, counterReach: c.motion.counterReach * s.counterReach }),
    vfx: Object.freeze({ ...c.vfx, flourish: s.flourish,
      lobes: c.vfx.lobes + s.lobes, rings: c.vfx.rings + s.rings,
      shards: c.vfx.shards + s.shards, trailWidth: c.vfx.trailWidth * s.trail,
      burstScale: c.vfx.burstScale * s.burst, orbitSpeed: c.vfx.orbitSpeed * s.orbit }),
    sound: Object.freeze({ ...c.sound, texture: s.texture,
      pitch: c.sound.pitch * s.pitch, body: c.sound.body * s.body, tail: c.sound.tail * s.tail }),
    camera: Object.freeze({ ...c.camera, weight: c.camera.weight * s.camera,
      entry: c.camera.entry * s.tempo, shake: c.camera.shake * s.camera }),
  });
}

/** Thirty cached, immutable profiles keep the render loop allocation-free. */
export const combatProfiles: Readonly<Record<PieceSymbol, Readonly<Record<SkinId, CombatProfile>>>> = Object.freeze(
  Object.fromEntries((Object.keys(classes) as PieceSymbol[]).map(piece => [piece,
    Object.freeze(Object.fromEntries((Object.keys(skinIdentities) as SkinId[]).map(skin => [skin, buildProfile(piece, skin)]))),
  ])) as Record<PieceSymbol, Record<SkinId, CombatProfile>>,
);

export function combatProfile(piece: PieceSymbol, skin: SkinId): CombatProfile {
  const profile = combatProfiles[piece]?.[skin];
  if (!profile) throw new RangeError(`Unknown combat profile: ${piece}:${skin}`);
  return profile;
}

function seedIndex(seed: number, salt: string, length: number) {
  let hash = Number.isFinite(seed) ? Math.trunc(seed) >>> 0 : 0;
  for (let i = 0; i < salt.length; i++) hash = Math.imul(hash ^ salt.charCodeAt(i), 16777619) >>> 0;
  hash ^= hash >>> 16;
  return (hash >>> 0) % length;
}

/** A visual answer to an already committed move; it never decides the winner. */
export function resolveDefense(attacker: CombatProfile, defender: CombatProfile, seed: number): DefenseReaction {
  const magical = attacker.attackType === "spell" || attacker.attackType === "storm";
  const heavy = attacker.attackType === "heavy" || attacker.attackType === "royal";
  let options: readonly DefenseReaction[];
  if (defender.piece === "r") options = magical ? ["shield", "brace"] : ["brace", "shield"];
  else if (defender.piece === "k") options = magical ? ["shield", "barrier"] : heavy ? ["brace", "shield"] : ["parry", "shield"];
  else if (defender.piece === "b" || defender.piece === "q") options = magical ? ["barrier"] : heavy ? ["barrier", "dodge"] : ["barrier", "parry"];
  else if (defender.piece === "n") options = heavy ? ["dodge", "brace"] : magical ? ["dodge", "barrier"] : ["parry", "dodge"];
  else options = magical ? ["shield", "dodge"] : heavy ? ["brace", "dodge"] : ["parry", "shield"];

  // A phase skin can retreat through a rift; frost makes a crystalline guard;
  // royal armour resists heavy blows. Broad rook silhouettes retain their guard.
  if (defender.skin === "astral" && defender.piece !== "r") options = [...options, "dodge", "dodge"];
  if (defender.skin === "frost") options = [...options, magical ? "barrier" : "shield"];
  if (defender.skin === "royal" && heavy) options = [...options, "brace"];
  if (defender.skin === "ember" && defender.piece !== "r" && !magical && !heavy) options = [...options, "parry"];
  return options[seedIndex(seed, `${attacker.id}>${defender.id}`, options.length)];
}
