import type { PieceSymbol } from "chess.js";
import { combatProfile, type CombatProfile, type DefenseReaction } from "./combat-profiles.ts";
import type { SkinId } from "./profile";

export type MotionVector = [number, number, number];
export interface MotionContext {
  progress?: number; approach?: number; recovery?: number;
  /** Capture-only choreography shares the same authoritative timeline as sound and VFX. */
  combat?: boolean; profile?: CombatProfile; skin?: SkinId; reaction?: DefenseReaction;
  opening?: number; counter?: number; clash?: number; finisher?: number;
  /** World-space opponent chest point, used only by the visual hand/weapon aiming rig. */
  contactTarget?: MotionVector;
}
export interface FighterPose {
  body: MotionVector; offset: MotionVector; hips: MotionVector; torso: MotionVector; head: MotionVector;
  leftArm: MotionVector; rightArm: MotionVector; leftElbow: MotionVector; rightElbow: MotionVector;
  leftLeg: MotionVector; rightLeg: MotionVector; leftKnee: MotionVector; rightKnee: MotionVector;
  weapon: MotionVector; weaponOffset: MotionVector; mantle: MotionVector;
}
const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const ease = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };

function neutral(): FighterPose {
  return { body: [0, 0, 0], offset: [0, 0, 0], hips: [0, 0, 0], torso: [0, 0, 0], head: [0, 0, 0],
    leftArm: [-0.15, 0, -0.18], rightArm: [-0.15, 0, 0.18], leftElbow: [-0.28, 0, 0], rightElbow: [-0.28, 0, 0],
    leftLeg: [0, 0, -0.05], rightLeg: [0, 0, 0.05], leftKnee: [0, 0, 0], rightKnee: [0, 0, 0],
    weapon: [0, 0, 0], weaponOffset: [0, 0, 0], mantle: [0, 0, 0] };
}

/** One deterministic pose for a timeline sample; no integrated velocities or random jitter. */
function quietFighterPose(type: PieceSymbol, charge: number, strike: number, time: number, context: MotionContext = {}): FighterPose {
  const pose = neutral();
  const progress = context.progress;
  const recovery = ease(context.recovery ?? (progress === undefined ? 0 : (progress - 0.64) / 0.2));
  const active = 1 - recovery;
  const c = clamp(charge) * active, s = ease(strike) * active;
  const windup = progress === undefined ? c : ease((progress - 0.36) / 0.12) * active;
  const contactKick = progress === undefined ? 0 : ease((progress - 0.56) / 0.016) * (1 - ease((progress - 0.576) / 0.1));
  const hit = Math.min(1, Math.sin(clamp(strike) * Math.PI) + contactKick) * active;
  const approach = clamp(context.approach ?? (progress === undefined ? 0 : (progress - 0.18) / 0.18));
  const step = Math.sin(approach * Math.PI * (type === "n" ? 3 : 2)) * Math.sin(approach * Math.PI) * active;
  const breath = Math.sin(time * 3.5) * 0.025;
  pose.torso[0] = breath; pose.head[0] = -breath * 0.5;
  pose.leftLeg[0] = step * 0.65; pose.rightLeg[0] = -step * 0.65;
  pose.leftKnee[0] = Math.max(0, -step) * 0.75; pose.rightKnee[0] = Math.max(0, step) * 0.75;
  pose.mantle[0] = -0.12 - Math.abs(step) * 0.35 - hit * 0.2;
  if (type === "p") {
    // Spear fighter: heel planted, spear drawn to hip, then a full-body thrust.
    pose.offset = [0, -c * 0.08, c * 0.08 - s * 0.12];
    pose.hips = [c * 0.1, -windup * 0.42 + s * 0.62, -c * 0.08];
    pose.torso = [-c * 0.12 + s * 0.26, -windup * 0.32 + s * 0.4, -hit * 0.06];
    pose.head = [-s * 0.12, windup * 0.25 - s * 0.35, 0];
    pose.leftArm = [-0.9 - s * 0.38, c * 0.2, -0.3]; pose.rightArm = [-0.4 - s * 1.08, -windup * 0.25, 0.24];
    pose.leftElbow = [-0.5 + s * 0.35, 0, 0]; pose.rightElbow = [-1.15 * c + s * 1.0, 0, 0];
    pose.leftLeg = [-c * 0.22 + step * 0.6, 0, -0.12]; pose.rightLeg = [c * 0.18 - step * 0.6, 0, 0.12];
    pose.leftKnee[0] += c * 0.24; pose.rightKnee[0] += c * 0.18;
    pose.weapon = [-0.48 - s * 1.08, -windup * 0.1, 0.1]; pose.weaponOffset = [-c * 0.05, -c * 0.06, c * 0.35 - s * 0.96];
    pose.body[0] = hit * 0.12;
  } else if (type === "n") {
    // Cavalry duellist: low stalk, airborne corkscrew and a diagonal finishing slash.
    pose.offset = [hit * 0.1, -c * 0.1 + hit * 0.12, -s * 0.12];
    pose.hips = [c * 0.12, -windup * 0.65 + s * 1.3, -windup * 0.14 + s * 0.18];
    pose.torso = [-c * 0.23 + s * 0.17, -windup * 0.65 + s * 1.35, windup * 0.13 - s * 0.2];
    pose.head = [c * 0.09, windup * 0.65 - s * 0.5, -hit * 0.15];
    pose.leftArm = [-0.8 + s * 0.38, windup * 0.6, -0.75 - s * 0.4];
    pose.rightArm = [-1.05 - windup * 0.6 + s * 0.55, -windup * 0.3, 0.8 * windup - s * 1.4];
    pose.leftElbow = [-0.85 + s * 0.5, 0, 0]; pose.rightElbow = [-0.45 - windup * 0.7 + s * 0.7, 0, 0];
    pose.leftLeg = [-c * 0.42 + step * 0.65, c * 0.2, -0.22]; pose.rightLeg = [c * 0.3 - step * 0.65, -c * 0.1, 0.18];
    pose.leftKnee[0] += c * 0.45; pose.rightKnee[0] += c * 0.3;
    pose.weapon = [-0.6 - windup * 0.42, s * 0.45, 1.5 * windup - s * 2.6];
    pose.weaponOffset = [-s * 0.25, windup * 0.32 - s * 0.2, -s * 0.5];
    pose.body = [-c * 0.16 + hit * 0.18, 0, -hit * 0.15];
  } else if (type === "b") {
    // Ritualist: levitation, inward gathering gesture and a two-handed spell release.
    pose.offset = [0, c * 0.12 + Math.sin(time * 4) * 0.035, 0];
    pose.hips = [0, Math.sin(time * 2) * c * 0.1, 0];
    pose.torso = [-windup * 0.12 + s * 0.18, -windup * 0.15, 0]; pose.head = [-c * 0.12, windup * 0.15, 0];
    pose.leftArm = [-windup * 0.4 - s * 1.35, -windup * 0.3, -0.65 - c * 0.55 + s * 0.65];
    pose.rightArm = [-windup * 0.65 - s * 1.2, windup * 0.2, 0.65 + c * 0.55 - s * 0.65];
    pose.leftElbow = [-0.75 * windup + s * 0.5, 0, -windup * 0.2]; pose.rightElbow = [-windup + s * 0.7, 0, windup * 0.1];
    pose.leftLeg = [-c * 0.14, 0, -0.08]; pose.rightLeg = [c * 0.08, 0, 0.08];
    pose.weapon = [-s * 0.75, 0, -0.25 - windup * 0.5 + s * 0.4]; pose.weaponOffset = [-windup * 0.2, c * 0.25, -s * 0.4];
    pose.mantle = [-0.1 - c * 0.25, Math.sin(time * 2) * 0.08, Math.sin(time * 3) * 0.06];
  } else if (type === "r") {
    // Artillery titan: spread feet, brace both arms and absorb the cannon recoil.
    pose.offset = [0, -c * 0.12, hit * 0.18]; pose.hips = [c * 0.1, 0, 0];
    pose.torso = [-c * 0.12 - hit * 0.15, windup * 0.06, 0]; pose.head = [c * 0.1 + hit * 0.12, 0, 0];
    pose.leftArm = [-1.34 - c * 0.12 + hit * 0.16, -c * 0.14, -0.26]; pose.rightArm = [-1.4 - c * 0.12 + hit * 0.16, c * 0.14, 0.26];
    pose.leftElbow = [-0.28 - c * 0.2 - hit * 0.3, 0, 0]; pose.rightElbow = [-0.28 - c * 0.2 - hit * 0.3, 0, 0];
    pose.leftLeg = [-c * 0.15, -c * 0.15, -0.18 - c * 0.08]; pose.rightLeg = [c * 0.15, c * 0.15, 0.18 + c * 0.08];
    pose.leftKnee[0] = c * 0.38; pose.rightKnee[0] = c * 0.38;
    pose.weapon = [-Math.PI / 2, 0, 0]; pose.weaponOffset = [0, -c * 0.06, -0.3 + hit * 0.26];
    pose.body[0] = -hit * 0.08;
  } else if (type === "q") {
    // Blade sovereign: a poised turn gathers her orbiting blades, then a sweeping command.
    pose.offset = [Math.sin(time * 2) * 0.025, c * 0.16, 0];
    pose.hips = [0, -windup * 0.5 + s * 0.8, -c * 0.07]; pose.torso = [-windup * 0.06, -windup * 0.55 + s * 0.95, -s * 0.08];
    pose.head = [-c * 0.08, windup * 0.55 - s * 0.65, c * 0.09];
    pose.leftArm = [-0.25 - windup * 0.2, -windup * 0.6, -1.08 - windup * 0.18 + s * 0.2];
    pose.rightArm = [-0.3 - s * 1.2, windup * 0.3, 1.1 + windup * 0.4 - s * 1.4];
    pose.leftElbow = [-c * 0.25, 0, -0.2]; pose.rightElbow = [-windup * 0.75 + s * 0.45, 0, 0.2];
    pose.leftLeg = [-c * 0.1, -c * 0.16, -0.08]; pose.rightLeg = [c * 0.16, c * 0.15, 0.08];
    pose.weapon = [-s * 0.9, -windup * 0.5, windup * 1.65 - s * 2.4]; pose.weaponOffset = [-s * 0.15, windup * 0.3, -s * 0.45];
    pose.mantle = [-0.18 - windup * 0.16, -windup * 0.3 + s * 0.55, Math.sin(time * 3) * 0.04];
  } else {
    // Execution king: a heavy two-handed overhead windup and a committed downward cleave.
    pose.offset = [0, -c * 0.08 - s * 0.08, -s * 0.1]; pose.hips = [-windup * 0.1 + s * 0.2, -windup * 0.14 + s * 0.12, 0];
    pose.torso = [-windup * 0.24 + s * 0.38, -windup * 0.2 + s * 0.3, 0]; pose.head = [windup * 0.14 - s * 0.18, 0, 0];
    pose.leftArm = [-c * 0.7 - windup * 1.4 + s * 1.05, -0.08, -0.16];
    pose.rightArm = [-c * 0.65 - windup * 1.55 + s * 1.05, 0.08, 0.18];
    pose.leftElbow = [-c * 0.4 - windup * 0.85 + s * 1.0, 0, 0]; pose.rightElbow = [-c * 0.4 - windup * 0.85 + s * 1.0, 0, 0];
    pose.leftLeg = [-c * 0.14, 0, -0.15]; pose.rightLeg = [c * 0.18, 0, 0.15]; pose.leftKnee[0] = c * 0.25 + s * 0.18; pose.rightKnee[0] = c * 0.3;
    pose.weapon = [-windup * 1.2 + s * 1.55, 0, -0.8 - windup * 0.55 + s * 1.45];
    pose.weaponOffset = [-c * 0.24, c * 0.15 + windup * 0.7 - s * 0.55, windup * 0.18 - s * 0.65];
    pose.body[0] = hit * 0.14; pose.mantle[0] = -0.15 - hit * 0.35;
  }
  return pose;
}

/** Guard, stagger and loss of balance depend on the defender's class and weight. */
function quietDefenderPose(type: PieceSymbol, hit: number, time: number): FighterPose {
  const pose = neutral(); const h = ease(hit), recoil = Math.sin(h * Math.PI);
  const weight = type === "r" ? 0.45 : type === "k" ? 0.7 : 1;
  pose.offset = [h * (type === "n" ? -0.08 : 0.04), -h * 0.15 * weight, h * 0.12 * weight];
  pose.hips = [-h * 0.15, h * 0.16 * weight, h * 0.12 * weight];
  pose.torso = [-h * 0.35 * weight, h * (type === "q" ? -0.5 : 0.24), h * 0.32 * weight];
  pose.head = [h * 0.22, -h * 0.18, h * 0.13];
  pose.leftArm = [-1.12 + h * 0.3, -0.1, -0.18 - h * 0.48]; pose.rightArm = [-1.3 + h * 0.48, 0.1, 0.24 + h * 0.45];
  pose.leftElbow = [-0.65 + h * 0.3, 0, 0]; pose.rightElbow = [-0.85 + h * 0.35, 0, 0];
  pose.leftLeg = [-0.1 - recoil * 0.25, 0, -0.12]; pose.rightLeg = [0.2 + h * 0.3, 0, 0.12];
  pose.leftKnee = [0.18 + h * 0.4 * weight, 0, 0]; pose.rightKnee = [0.2 + h * 0.28, 0, 0];
  pose.weapon = [-0.5 - h * 0.3, h * 0.2, -0.9 + h * 0.5]; pose.weaponOffset = [-0.1, 0.2 - h * 0.2, -0.28 + h * 0.15];
  pose.body = [-h * 0.2 * weight, 0, h * 0.24 * weight]; pose.mantle = [-0.12 - recoil * 0.3, h * 0.25, 0];
  if (type === "p") { pose.leftArm[0] = -1.4 + h * 0.4; pose.weapon[2] = 0.25 + h * 0.8; }
  if (type === "n") { pose.torso[1] = -0.2 - h * 0.7; pose.rightArm[2] = 0.7 + h * 0.55; pose.weapon[2] = 0.7 + h * 0.65; }
  if (type === "b") { pose.leftArm[2] = -0.75 - h * 0.35; pose.rightArm[2] = 0.75 + h * 0.35; pose.offset[1] += Math.sin(time * 3) * 0.025; }
  if (type === "r") { pose.leftArm[0] = -1.45 + h * 0.15; pose.rightArm[0] = -1.45 + h * 0.15; pose.weapon = [-Math.PI / 2, 0, 0]; }
  if (type === "q") { pose.leftArm[2] = -1.0 - h * 0.35; pose.rightArm[0] = -0.8 + h * 0.4; pose.weapon[2] = -0.3 + h * 0.8; }
  if (type === "k") { pose.leftArm[0] = -1.45 + h * 0.22; pose.rightArm[0] = -1.5 + h * 0.3; pose.weapon[2] = -0.25 + h * 0.3; }
  return pose;
}

const pulse = (value: number) => Math.sin(clamp(value) * Math.PI);
const mixVector = (a: MotionVector, b: MotionVector, amount: number): MotionVector =>
  a.map((value, index) => value + (b[index] - value) * amount) as MotionVector;

function sampleCombat(context: MotionContext, time: number) {
  // Pose time remains normalized to the 2.6 s score when the player changes sequence length.
  // It never integrates previous frames, so pause, seek and slow devices cannot cause drift.
  const seconds = context.progress === undefined ? Math.max(0, time) : clamp(context.progress) * 2.6;
  return {
    seconds,
    opening: clamp(context.opening ?? ease((seconds - 0.4) / 0.6)),
    counter: clamp(context.counter ?? ease((seconds - 1) / 0.5)),
    finisher: clamp(context.finisher ?? ease((seconds - 1.5) / 0.35)),
    recovery: ease(context.recovery ?? (seconds - 2.1) / 0.5),
    guard: ease((seconds - 0.72) / 0.26) * (1 - ease((seconds - 1.47) / 0.32)),
    finalKick: pulse((seconds - 1.85) / 0.25),
  };
}

/** Modular skin gestures alter stance, travel and follow-through, never contact or game timing. */
function skinAttack(pose: FighterPose, type: PieceSymbol, profile: CombatProfile,
  draw: number, opening: number, finish: number, counter: number, recovery: number) {
  const motion = profile.motion;
  const active = 1 - recovery;
  const stroke = Math.max(opening * 0.7, finish) * active;
  for (const name of ["hips", "torso", "weapon", "mantle"] as const) {
    pose[name][1] *= motion.twist; pose[name][2] *= motion.twist;
  }
  pose.offset[1] += draw * motion.lift * 0.14;
  pose.weaponOffset[2] *= motion.reach;
  pose.body[0] *= motion.recoil;
  const finesse = type === "p" ? 0.8 : type === "n" ? 1.2 : type === "r" ? 0.55 : 1;
  switch (motion.skinStyle) {
    case "disciplined":
      pose.torso[1] += -draw * 0.1 + stroke * 0.12;
      pose.leftArm[2] += draw * 0.12;
      pose.weapon[1] += stroke * 0.1 * finesse;
      break;
    case "explosive":
      pose.offset[1] -= draw * 0.12 * motion.weight;
      pose.torso[0] += stroke * 0.13;
      pose.leftLeg[0] -= draw * 0.16;
      pose.rightKnee[0] += draw * 0.16;
      pose.weapon[2] -= stroke * 0.27 * finesse;
      pose.mantle[0] -= stroke * 0.23;
      break;
    case "precise":
      pose.offset[0] -= draw * 0.055;
      pose.torso[1] -= draw * 0.18 * finesse;
      pose.leftArm[2] += draw * 0.18;
      pose.rightElbow[0] -= draw * 0.17;
      pose.weapon[1] -= stroke * 0.19;
      pose.leftKnee[0] += stroke * 0.1;
      break;
    case "phase":
      pose.offset[0] += opening * 0.2 * finesse * active;
      pose.offset[1] += draw * 0.1;
      pose.hips[1] += opening * 0.38 * finesse * active;
      pose.torso[1] -= opening * 0.27 * active;
      pose.weapon[2] += stroke * 0.24 * finesse;
      pose.mantle[1] -= stroke * 0.35;
      break;
    case "ceremonial":
      pose.offset[1] += draw * 0.045;
      pose.leftArm[2] -= draw * 0.2;
      pose.rightArm[0] -= draw * 0.16;
      pose.head[0] -= draw * 0.06;
      pose.weapon[0] -= draw * 0.2 * finesse;
      pose.torso[0] += stroke * 0.11;
      pose.mantle[0] -= stroke * 0.15;
      break;
  }
  // The defender's counter visibly interrupts the first attack before the finishing windup.
  pose.torso[0] -= counter * 0.17 / motion.weight;
  pose.offset[2] += counter * 0.075;
  pose.rightElbow[0] -= counter * 0.2;
}

/** Shared class building blocks produce a first strike, a parried recoil and a decisive finish. */
export function fighterPose(type: PieceSymbol, charge: number, strike: number, time: number, context: MotionContext = {}): FighterPose {
  if (!context.combat) return quietFighterPose(type, charge, strike, time, context);
  const profile = context.profile ?? combatProfile(type, context.skin ?? "classic");
  const motion = profile.motion;
  const frame = sampleCombat(context, time);
  const { seconds, finisher } = frame;
  const recovery = Math.pow(frame.recovery, Math.max(0.7, Math.min(1.5, motion.followThrough)));
  const active = 1 - recovery;
  const draw = Math.max(ease((seconds - 0.16) / 0.36) * (1 - ease((seconds - 0.58) / 0.22)),
    ease((seconds - 1.2) / 0.3) * (1 - ease((seconds - 1.61) / 0.24)));
  const opening = ease((seconds - 0.53) / 0.21) * (1 - ease((seconds - 1.02) / 0.2));
  const counter = pulse((seconds - 1.02) / 0.46);
  const attack = Math.max(opening * 0.72, finisher);
  const pose = quietFighterPose(type, clamp(draw * (0.65 + motion.anticipation * 0.65)), attack, time,
    { approach: context.approach, recovery });
  // The first attack is a class-specific gesture; every final stroke reaches the shared hit time.
  if (type === "p") {
    const jab = Math.sin(frame.opening * Math.PI * (3 + motion.tempo)) * opening * 0.12 * active;
    pose.rightArm[0] -= jab; pose.rightElbow[0] += jab;
    pose.weaponOffset[2] -= jab * 0.7;
    pose.leftLeg[0] -= finisher * 0.12 * active;
    pose.body[0] += frame.finalKick * 0.06;
  } else if (type === "n") {
    const flank = pulse(frame.opening) * active;
    pose.offset[0] += flank * 0.17;
    pose.hips[1] += flank * 0.6;
    pose.torso[1] -= flank * 0.35;
    pose.rightArm[2] -= finisher * 0.3 * active;
    pose.mantle[1] += flank * 0.5;
  } else if (type === "b") {
    const seal = pulse(frame.opening) * active;
    pose.leftArm[2] -= seal * 0.38;
    pose.rightElbow[0] -= seal * 0.35;
    pose.weapon[1] += seal * 0.4;
    pose.offset[1] += seal * 0.08;
    pose.leftArm[0] -= finisher * 0.18 * active;
  } else if (type === "r") {
    pose.leftArm[0] -= draw * 0.12;
    pose.leftArm[2] -= opening * 0.2 * active;
    pose.offset[2] += frame.finalKick * 0.08 * motion.recoil;
    pose.torso[0] -= frame.finalKick * 0.1;
    pose.leftKnee[0] += finisher * 0.1 * active;
  } else if (type === "q") {
    const orbit = pulse(frame.opening) * active;
    pose.leftArm[2] -= orbit * 0.3;
    pose.rightArm[2] += orbit * 0.3;
    pose.hips[1] += orbit * 0.3;
    pose.weapon[1] -= orbit * 0.5;
    pose.offset[1] += orbit * 0.06;
  } else {
    pose.leftArm[0] -= draw * 0.18;
    pose.weapon[2] += opening * 0.22 * active;
    pose.torso[0] += finisher * 0.1 * active;
    pose.rightKnee[0] += finisher * 0.12 * active;
    pose.body[0] += frame.finalKick * 0.06;
  }
  skinAttack(pose, type, profile, draw * active, opening, finisher, counter * active, recovery);
  // Hand attachment supplies most of the reach. Small local adjustments keep the weapon graspable.
  pose.weaponOffset = pose.weaponOffset.map((value) => Math.max(-0.22, Math.min(0.22, value * 0.25))) as MotionVector;
  return pose;
}

/** Reactive defences share the attack's exact clock; counters are visual and have no board effects. */
export function defenderPose(type: PieceSymbol, hit: number, time: number, context: MotionContext = {}): FighterPose {
  if (!context.combat) return quietDefenderPose(type, hit, time);
  const profile = context.profile ?? combatProfile(type, context.skin ?? "classic");
  const motion = profile.motion;
  const frame = sampleCombat(context, time);
  const reaction = context.reaction ?? (type === "b" || type === "q" ? "barrier" : type === "r" ? "brace" : "parry");
  const guard = frame.guard;
  const counter = pulse(frame.counter) * (1 - frame.recovery);
  const pose = neutral();
  const guardPose = quietDefenderPose(type, 0, time);
  for (const name of Object.keys(pose) as (keyof FighterPose)[]) pose[name] = mixVector(pose[name], guardPose[name], guard);
  pose.torso[0] += Math.sin(time * 3) * 0.018;
  if (reaction === "parry") {
    pose.rightArm[0] -= guard * 0.18;
    pose.rightArm[2] -= guard * 0.65;
    pose.rightElbow[0] -= guard * 0.3;
    pose.weapon[2] -= guard * 0.55;
    pose.torso[1] -= guard * 0.3;
    pose.hips[1] += counter * 0.3 * motion.twist;
    pose.rightArm[0] -= counter * 0.28;
    pose.weapon[2] += counter * 0.5;
  } else if (reaction === "shield") {
    pose.leftArm[0] -= guard * 0.25;
    pose.leftArm[2] += guard * 0.16;
    pose.leftElbow[0] -= guard * 0.12;
    pose.torso[0] += guard * 0.12;
    pose.rightArm[0] -= counter * 0.45;
    pose.weapon[0] -= counter * 0.25;
    pose.offset[2] -= counter * 0.05;
  } else if (reaction === "barrier") {
    pose.leftArm[0] -= guard * 0.18;
    pose.rightArm[0] -= guard * 0.2;
    pose.leftArm[2] -= guard * 0.35;
    pose.rightArm[2] += guard * 0.35;
    pose.leftElbow[0] += guard * 0.15;
    pose.rightElbow[0] += guard * 0.15;
    pose.offset[1] += guard * 0.075 * motion.lift;
    pose.leftArm[0] -= counter * 0.22;
    pose.rightArm[0] -= counter * 0.3;
    pose.weapon[1] += counter * 0.3;
  } else if (reaction === "dodge") {
    const dodge = pulse((frame.seconds - 0.86) / 0.6);
    pose.offset[0] += dodge * 0.24 * motion.counterReach;
    pose.offset[2] += dodge * 0.12;
    pose.hips[1] -= dodge * 0.35;
    pose.leftLeg[2] -= dodge * 0.18;
    pose.rightLeg[0] += dodge * 0.25;
    pose.rightKnee[0] += dodge * 0.2;
    pose.rightArm[0] -= counter * 0.36;
    pose.weapon[2] += counter * 0.28;
  } else {
    pose.offset[1] -= guard * 0.1 * motion.weight;
    pose.torso[0] += guard * 0.1;
    pose.leftArm[0] -= guard * 0.22;
    pose.rightArm[0] -= guard * 0.17;
    pose.leftLeg[2] -= guard * 0.12;
    pose.rightLeg[2] += guard * 0.12;
    pose.leftKnee[0] += guard * 0.25;
    pose.rightKnee[0] += guard * 0.25;
    pose.weapon[0] -= counter * 0.12;
    pose.offset[2] -= counter * 0.04;
  }
  // Skin stance remains identifiable even when the selected reaction is shared by another skin.
  switch (motion.skinStyle) {
    case "disciplined": pose.head[1] -= guard * 0.08; pose.weapon[1] += counter * 0.1; break;
    case "explosive": pose.offset[1] -= guard * 0.05; pose.mantle[0] -= counter * 0.3; pose.torso[1] += counter * 0.2; break;
    case "precise": pose.leftArm[2] += guard * 0.12; pose.rightElbow[0] -= guard * 0.18; pose.weapon[1] -= counter * 0.2; break;
    case "phase": pose.offset[0] -= counter * 0.12; pose.hips[1] += counter * 0.35; pose.mantle[1] -= guard * 0.2; break;
    case "ceremonial": pose.offset[1] += guard * 0.035; pose.leftArm[2] -= guard * 0.2; pose.head[0] -= guard * 0.08; break;
  }
  const defeated = quietDefenderPose(type, hit, time);
  const loseBalance = ease((frame.seconds - 1.83) / 0.28);
  for (const name of Object.keys(pose) as (keyof FighterPose)[]) pose[name] = mixVector(pose[name], defeated[name], loseBalance);
  pose.body[0] -= frame.finalKick * 0.12 / motion.weight;
  pose.torso[0] -= frame.finalKick * 0.16 / motion.weight;
  pose.offset[2] += frame.finalKick * 0.07 * motion.recoil;
  pose.weaponOffset = pose.weaponOffset.map((value) => value * 0.35) as MotionVector;
  return pose;
}
