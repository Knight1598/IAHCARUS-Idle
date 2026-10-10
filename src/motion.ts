import type { PieceSymbol } from "chess.js";
import { combatProfile, type CombatProfile, type DefenseReaction } from "./combat-profiles.ts";
import type { SkinId } from "./profile";
import { CAPTURE_DURATION, CAPTURE_CONTACT, CAPTURE_DEATH, captureFrame } from "./combat.ts";

export type MotionVector = [number, number, number];
export interface MotionContext {
  progress?: number; approach?: number; recovery?: number;
  /** Capture-only choreography shares the same authoritative timeline as sound and VFX. */
  combat?: boolean; profile?: CombatProfile; skin?: SkinId; reaction?: DefenseReaction;
  opening?: number; counter?: number; clash?: number; finisher?: number;
  /** Local swing progress resets for every exchange; scene-owned choreography supplies it. */
  actionProgress?: number; actionCharge?: number; guard?: number; recoil?: number; aimWeight?: number;
  seconds?: number; exchange?: string;
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
  // Every exchange reads one absolute score. Seeking and paused tabs cannot integrate drift.
  const duration = CAPTURE_DURATION / 1000;
  const seconds = context.seconds ?? (context.progress === undefined ? Math.max(0, time) : clamp(context.progress) * duration);
  const score = captureFrame(seconds / duration);
  return {
    seconds,
    opening: clamp(context.opening ?? score.opening),
    counter: clamp(context.counter ?? score.counter),
    finisher: clamp(context.finisher ?? score.finisher),
    recovery: ease(context.recovery ?? score.recovery),
    guard: clamp(context.guard ?? score.defenderGuard),
    finalKick: pulse((seconds - CAPTURE_CONTACT * duration) / .3),
    score,
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

/** Skin choreography replaces the gesture, while class weapons and the contact rig remain intact. */
function signatureGesture(pose: FighterPose, type: PieceSymbol, skin: SkinId, draw: number, stroke: number, recovery: number) {
  const active = 1 - recovery, c = draw * active, s = stroke * active;
  switch (skin) {
    case "ember":
      pose.leftArm = [-.3 - c*.5, 0, -.5 - s*.55];
      pose.rightArm = [-.2 - c*.5 - s*1.8, 0, .3 + c*.8 - s*.65];
      pose.torso = [-c*.3 + s*.22, -c*.5 + s*.7, 0];
      pose.offset[1] = -c*.18 + s*.12;
      break;
    case "frost":
      pose.leftArm = [-.4 - c*1.0, 0, -.25 + c*.35];
      pose.rightArm = [-.2 - c*.6 - s*1.2, 0, .2];
      pose.torso = [0, -c*.35 + s*.25, 0];
      pose.offset[0] = -c*.16; pose.offset[1] = -c*.04;
      break;
    case "astral":
      pose.leftArm = [-.2 - c*.7, c*.45, -.3 - c*.9];
      pose.rightArm = [-.2 - c*.8 - s*.9, -c*.45, .3 + c*.9 - s*1.1];
      pose.torso = [0, -c*.6 + s*.8, 0];
      pose.offset[1] = c*.27;
      break;
    case "royal":
      pose.leftArm = [-.15 - c*2.0 - s*.7, 0, -.2];
      pose.rightArm = [-.15 - c*2.1 - s*.6, 0, .2];
      pose.torso = [-c*.12 + s*.35, 0, 0];
      pose.leftKnee[0] += c*.35; pose.offset[1] = -c*.12;
      break;
    case "storm":
      pose.leftArm = [-.2 - c*.9 - s*.55, 0, -.2 - s*.8];
      pose.rightArm = [-.2 - c*.35 - s*1.3, 0, .2 + c*.6];
      pose.torso = [c*.1 + s*.18, c*.55 - s*.75, -s*.12];
      pose.offset[0] = c*.12 - s*.15;
      break;
    case "void":
      pose.leftArm = [-.15 - c*1.15 - s*.65, 0, -.2 - c*.65 + s*.5];
      pose.rightArm = [-.15 - c*1.15 - s*.65, 0, .2 + c*.65 - s*.5];
      pose.torso = [-c*.16 + s*.12, 0, 0];
      pose.offset[1] = c*.16; pose.offset[2] = c*.12;
      break;
    case "prism":
      pose.leftArm = [-.2 - c*.95 - s*.8, c*.25, -.2 + c*.9 - s*.9];
      pose.rightArm = [-.2 - c*.95 - s*1.0, -c*.25, .2 - c*.9 + s*.7];
      pose.torso = [0, -c*.25 + s*.45, -s*.08];
      pose.offset[0] = c*.09; pose.offset[1] = c*.1;
      break;
    case "nova":
      // Raise a miniature sun overhead, brace, then drive both palms forward.
      pose.leftArm = [-.15 - c * 2.45 - s * 1.25, 0, -.18 - c * .3];
      pose.rightArm = [-.15 - c * 2.45 - s * 1.25, 0, .18 + c * .3];
      pose.leftElbow = [-.28 - c * .55 + s * .2, 0, 0];
      pose.rightElbow = [-.28 - c * .55 + s * .2, 0, 0];
      pose.torso = [-c * .22 + s * .28, 0, 0];
      pose.offset = [0, c * .2 - s * .1, s * .12];
      pose.weapon = [-c * .3 - s * 1.4, 0, 0];
      break;
    case "phantom":
      // Sideways veil step: crossed guard unfolds into a low, horizontal draw cut.
      pose.leftArm = [-.3 - c * .85, c * .5, -.2 + c * .75 - s * .9];
      pose.rightArm = [-.3 - c * .95 - s * .9, -c * .6, .2 - c * .9 + s * 1.25];
      pose.rightElbow = [-.28 - c * .95 + s * .6, 0, 0];
      pose.offset = [-c * .34 + s * .16, -c * .16, 0];
      pose.hips[1] = -c * .8 + s * .45;
      pose.torso = [c * .12, c * .55 - s * .6, c * .14];
      pose.weapon = [-s * 1.1, c * .8, -c * 1.2 + s * 1.4];
      pose.mantle[1] = -c * .8 + s * .9;
      break;
    case "dragon":
      // Open wing stance, crouch and spring into an asymmetric claw slam.
      pose.leftArm = [-.15 - c * .45 - s * 1.7, 0, -.18 - c * 1.15 + s * .45];
      pose.rightArm = [-.15 - c * .8 - s * 1.1, 0, .18 + c * 1.25 - s * .7];
      pose.leftElbow = [-.28 - c * .8 + s * .25, 0, 0];
      pose.rightElbow = [-.28 - c * .9 + s * .3, 0, 0];
      pose.offset = [0, -c * .25 + Math.sin(stroke * Math.PI) * active * .3, -s * .12];
      pose.torso = [-c * .3 + s * .5, -c * .35 + s * .65, -s * .15];
      pose.leftKnee[0] += c * .4; pose.rightKnee[0] += c * .45;
      pose.weapon = [-c * .55 + s * .8, 0, c * .9 - s * 1.5];
      pose.mantle[0] = -c * .7 - s * .4;
      break;
  }
  if(skin !== "classic") {
    // Weapon discipline stays visible inside each skin's stance.
    if(type === "p") {
      pose.rightArm[0] -= c*.18+s*.22; pose.rightArm[1] -= c*.12;
      pose.leftArm[2] += c*.14+s*.2;
    } else if(type === "n") {
      pose.hips[1] += s*.45; pose.leftArm[2] -= c*.3+s*.3;
      pose.rightArm[1] += c*.25; pose.rightArm[2] += c*.18;
      pose.offset[1] += Math.sin(stroke*Math.PI)*active*.12;
    } else if(type === "b") {
      pose.leftArm[0] -= c*.12+s*.2; pose.rightArm[0] -= c*.12;
      pose.leftArm[2] -= c*.24; pose.rightArm[2] += c*.24;
      pose.leftElbow[0] += s*.25; pose.offset[1] += c*.08;
    } else if(type === "r") {
      pose.offset[1] -= c*.12; pose.leftKnee[0] += c*.2;
      pose.leftArm[0] -= c*.35; pose.rightArm[0] -= c*.35;
      pose.leftArm[1] -= c*.1; pose.rightArm[1] += c*.1;
      pose.leftArm[2] *= .65; pose.rightArm[2] *= .65;
    } else if(type === "q") {
      pose.leftArm[2] -= c*.35+s*.2; pose.rightArm[1] -= c*.22;
      pose.hips[1] += s*.3;
    } else {
      pose.leftArm[0] -= c*.32; pose.rightArm[0] -= c*.32;
      pose.leftArm[2] += c*.08; pose.rightArm[2] -= c*.08;
      pose.leftElbow[0] -= c*.25; pose.leftKnee[0] += s*.2; pose.torso[0] += s*.12;
    }
  }
}

/** Every local swing has a fresh class-specific windup, contact and follow-through. */
export function fighterPose(type: PieceSymbol, charge: number, strike: number, time: number, context: MotionContext = {}): FighterPose {
  if (!context.combat) {
    const pose = quietFighterPose(type, charge, strike, time, context);
    const recovery = ease(context.recovery ?? (context.progress === undefined ? 0 : (context.progress - .64) / .2));
    signatureGesture(pose, type, context.skin ?? context.profile?.skin ?? "classic", clamp(charge), ease(strike), recovery);
    return pose;
  }
  const profile = context.profile ?? combatProfile(type, context.skin ?? "classic");
  const motion = profile.motion, frame = sampleCombat(context, time);
  const recovery = Math.pow(frame.recovery, Math.max(.7, Math.min(1.5, motion.followThrough)));
  const active = 1 - recovery;
  const explicitAction = context.actionProgress !== undefined;
  const attack = clamp(context.actionProgress ?? frame.score.attackerStrike);
  const draw = clamp(explicitAction ? charge : frame.score.attackerCharge);
  const guard = clamp(context.guard ?? (.28 + frame.score.defenderStrike * .57)) * active;
  const recoil = clamp(context.recoil ?? frame.score.attackerRecoil) * active;
  const pose = quietFighterPose(type, draw * (.65 + motion.anticipation * .65), attack, time,
    { approach: context.approach, recovery });
  const guardPose = quietDefenderPose(type, 0, time);
  const guarding = guard * (1 - attack) * .72;
  for (const name of ["leftArm", "rightArm", "leftElbow", "rightElbow", "weapon", "weaponOffset"] as const)
    pose[name] = mixVector(pose[name], guardPose[name], guarding);
  const reverse = 1 - 2 * ease((frame.seconds - 2.61) / .1) * (1 - ease((frame.seconds - 3.01) / .11));
  const stroke = ease(attack) * active;
  const arc = pulse(attack) * active;
  // Each second exchange changes the weapon path rather than repeating the first shot.
  if (type === "p") {
    pose.rightArm[0] -= stroke * .18;
    pose.rightElbow[0] += stroke * .14;
    pose.hips[1] += reverse * arc * .2;
    pose.leftLeg[0] -= stroke * .14;
    pose.weaponOffset[2] -= stroke * .14;
  } else if (type === "n") {
    pose.offset[0] += reverse * arc * .18;
    pose.offset[1] += arc * .18;
    pose.hips[1] += reverse * stroke * .65;
    pose.torso[1] -= reverse * arc * .3;
    pose.rightArm[2] -= reverse * stroke * .35;
    pose.mantle[1] += reverse * arc * .45;
  } else if (type === "b") {
    pose.leftArm[2] -= arc * .38;
    pose.rightElbow[0] -= draw * .3;
    pose.weapon[1] += reverse * arc * .45;
    pose.offset[1] += draw * .09 + arc * .08;
    pose.leftArm[0] -= stroke * .24;
  } else if (type === "r") {
    pose.leftArm[0] -= draw * .16;
    pose.offset[1] -= draw * .08;
    pose.offset[2] += arc * .11 * motion.recoil;
    pose.torso[0] -= arc * .12;
    pose.leftKnee[0] += stroke * .15;
  } else if (type === "q") {
    pose.leftArm[2] -= reverse * arc * .38;
    pose.rightArm[2] += reverse * arc * .35;
    pose.hips[1] += reverse * stroke * .4;
    pose.weapon[1] -= reverse * arc * .55;
    pose.offset[1] += arc * .08;
  } else {
    pose.leftArm[0] -= draw * .22;
    pose.weapon[2] += reverse * arc * .3;
    pose.torso[0] += stroke * .14;
    pose.rightKnee[0] += stroke * .18;
    pose.body[0] += arc * .08;
  }
  const stance = Math.max(draw, guard * .42);
  skinAttack(pose, type, profile, stance * active, arc, stroke, recoil, recovery);
  signatureGesture(pose, type, profile.skin, stance, attack, recovery);
  // A blocked counter visibly rocks the attacker; both actors retain their footing until defeat.
  pose.torso[0] -= recoil * .22 / motion.weight;
  pose.head[0] += recoil * .15;
  pose.offset[2] += recoil * .12 * motion.recoil;
  pose.leftKnee[0] += guard * .12;
  pose.rightKnee[0] += guard * .1;
  pose.mantle[0] -= recoil * .2;
  if (context.reaction === "dodge") { pose.hips[1] += guard * .28; pose.offset[0] -= guard * .12; }
  if (context.reaction === "barrier") { pose.leftArm[2] -= guard * .25; pose.rightArm[2] += guard * .25; }
  if (context.reaction === "brace") { pose.offset[1] -= guard * .07; pose.leftLeg[2] -= guard * .09; }
  // The scene owns root travel. The hand joint supplies reach while keeping the grip attached.
  pose.weaponOffset = pose.weaponOffset.map((value) => Math.max(-.22, Math.min(.22, value * .25))) as MotionVector;
  return pose;
}

/** Reactive defences share the attack's exact clock; counters are visual and have no board effects. */
export function defenderPose(type: PieceSymbol, hit: number, time: number, context: MotionContext = {}): FighterPose {
  if (!context.combat) return quietDefenderPose(type, hit, time);
  const profile = context.profile ?? combatProfile(type, context.skin ?? "classic");
  const motion = profile.motion;
  const frame = sampleCombat(context, time);
  if (context.actionProgress !== undefined) {
    // Continue the very same stance at the fatal contact, then surrender balance smoothly.
    const pose = fighterPose(type, context.actionCharge ?? 0, context.actionProgress, time, context);
    const defeated = quietDefenderPose(type, hit, time);
    const loseBalance = ease((frame.seconds - CAPTURE_CONTACT * (CAPTURE_DURATION / 1000)) /
      ((CAPTURE_DEATH - CAPTURE_CONTACT) * (CAPTURE_DURATION / 1000)));
    for (const name of Object.keys(pose) as (keyof FighterPose)[])
      pose[name] = mixVector(pose[name], defeated[name], loseBalance);
    pose.body[0] -= frame.finalKick * .12 / motion.weight;
    pose.offset[2] += frame.finalKick * .07 * motion.recoil;
    return pose;
  }
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
    const dodge = Math.max(pulse((frame.seconds - .9) / .4), pulse((frame.seconds - 2.3) / .65));
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
  if(profile.skin === "nova") {
    pose.leftArm[0] -= guard*.5; pose.leftArm[2] -= guard*.45;
    pose.rightArm[2] += guard*.45; pose.offset[1] += guard*.08;
  } else if(profile.skin === "phantom") {
    pose.offset[0] -= guard*.2; pose.torso[1] += guard*.55;
    pose.leftArm[2] += guard*.4; pose.mantle[1] -= counter*.5;
  } else if(profile.skin === "dragon") {
    pose.leftArm[2] -= guard*.65; pose.rightArm[2] += guard*.55;
    pose.offset[1] -= guard*.12; pose.torso[0] += counter*.25;
  }
  const defeated = quietDefenderPose(type, hit, time);
  const loseBalance = ease((frame.seconds - CAPTURE_CONTACT * (CAPTURE_DURATION / 1000)) /
    ((CAPTURE_DEATH - CAPTURE_CONTACT) * (CAPTURE_DURATION / 1000)));
  for (const name of Object.keys(pose) as (keyof FighterPose)[]) pose[name] = mixVector(pose[name], defeated[name], loseBalance);
  pose.body[0] -= frame.finalKick * 0.12 / motion.weight;
  pose.torso[0] -= frame.finalKick * 0.16 / motion.weight;
  pose.offset[2] += frame.finalKick * 0.07 * motion.recoil;
  pose.weaponOffset = pose.weaponOffset.map((value) => value * 0.35) as MotionVector;
  return pose;
}
