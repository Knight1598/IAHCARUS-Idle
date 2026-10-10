import { createTimeline, type Timeline } from "animejs/timeline";
import type { CombatProfile } from "./combat-profiles.ts";
import { CAPTURE_DURATION } from "./combat.ts";

/** Canonical stage coordinates. The scene maps X towards the opponent, Z sideways. */
export interface DuelActorFrame {
  x: number; z: number; lift: number;
  charge: number; strike: number; guard: number; recoil: number; aimWeight: number;
}
export interface DuelFrame {
  readonly attacker: Readonly<DuelActorFrame>;
  readonly defender: Readonly<DuelActorFrame>;
}
type Point = readonly [milliseconds: number, value: number];
type Track = readonly Point[];
const contacts = [1.08, 1.86, 2.48, 2.83, 3.85] as const;
const point = (seconds: number, value: number): Point => [seconds * 1000, value];
const idle = (): DuelActorFrame => ({ x: 0, z: 0, lift: 0, charge: 0, strike: 0, guard: 0, recoil: 0, aimWeight: 0 });

/** Explicit from/to values make forward, backward and repeated seeking agree. */
function keyframes(points: Track) {
  return points.slice(1).map(([time, value], index) => ({
    to: [points[index][1], value], duration: time - points[index][0], ease: "inOutQuad",
  }));
}

/** A strike reaches its opponent, holds contact for 80 ms, then returns to guard. */
function attacks(contacts: readonly number[], windup: number, recovery: number): Track {
  const points: Point[] = [point(0, 0)];
  // Close combo beats shorten their next windup, preserving time for the preceding
  // weapon to recover. Compressing recovery would create an unreadable pose snap.
  const windups = contacts.map((contact, index) => index === 0 ? windup :
    Math.min(windup, contact - contacts[index - 1] - .08 - recovery - .015));
  for (let index = 0; index < contacts.length; index++) {
    const contact = contacts[index];
    const hold = contact === 3.85 ? .12 : .08;
    const recoverAt = Math.min(contact + hold + recovery,
      (contacts[index + 1] ?? 5.5) - (windups[index + 1] ?? windup) - .015);
    points.push(point(contact - windups[index], 0), point(contact, 1), point(contact + hold, 1), point(recoverAt, 0));
  }
  points.push(point(5, 0));
  return points;
}

/** Body placement uses the active striker's reach, including mixed melee/ranged pairs. */
function pairPositions(attacker: CombatProfile, defender: CombatProfile): readonly [Track, Track] {
  const reach = (profile: CombatProfile) => ["b", "r", "q"].includes(profile.piece) ? 1.6 : .67;
  const a = reach(attacker), d = reach(defender);
  const attackerX: Track = [point(0, -2.1), point(.45, -2.1), point(1.08, -a), point(1.16, -a),
    point(1.4, -a - .3), point(1.86, -d), point(1.94, -d), point(2.16, -a - .35),
    point(2.48, -a), point(2.56, -a), point(2.65, -a - .23), point(2.83, -a), point(2.91, -a),
    point(3.12, -a - .62), point(3.48, -a - .62), point(3.85, -a), point(3.97, -a),
    point(4.25, -a - .08), point(4.65, -a - .28), point(5, -a - .28)];
  const defenderX: Track = [point(0, 2.1), point(.45, 2.1), point(1.08, a), point(1.16, a),
    point(1.4, a + .12), point(1.86, d), point(1.94, d), point(2.16, a + .16),
    point(2.48, a), point(2.56, a), point(2.65, a + .18), point(2.83, a), point(2.91, a),
    point(3.12, a + .14), point(3.48, a + .14), point(3.85, a), point(3.97, a),
    point(4.25, a + .68), point(4.65, a + 1), point(5, a + 1)];
  return [attackerX, defenderX];
}

/** Freeze all spatial channels at contact, rather than just the weapon swing. */
function holdPositions(track: Track): Track {
  const valueAt = (time: number) => {
    for (let i = 1; i < track.length; i++) if (time <= track[i][0]) {
      const [start, from] = track[i - 1], [end, to] = track[i];
      const t = Math.max(0, Math.min(1, (time - start) / (end - start)));
      const ease = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      return from + (to - from) * ease;
    }
    return track[track.length - 1][1];
  };
  let held = [...track];
  for (const contact of contacts) {
    const time = contact * 1000, end = time + (contact === 3.85 ? 120 : 80), value = valueAt(time);
    held = held.filter(([at]) => at < time || at > end);
    held.push([time, value], [end, value]);
  }
  return held.sort(([a], [b]) => a - b);
}

function actorTracks(profile: CombatProfile, defender: boolean): Record<keyof DuelActorFrame, Track> {
  const piece = profile.piece, motion = profile.motion;
  const flank = (piece === "n" ? .46 : piece === "q" ? .28 : piece === "b" ? .17 : piece === "k" ? .1 : .05)
    * (motion.skinStyle === "phase" ? 1.25 : motion.skinStyle === "precise" ? .82 : 1)
    * Math.max(.75, Math.min(1.3, motion.twist));
  const jump = piece === "n" ? .65 : piece === "b" ? .24 : piece === "q" ? .32 : piece === "k" ? .06 : 0;
  const lift = Math.min(.85, jump * (1 + motion.lift * .25));
  const recoil = Math.min(.95, (.32 + motion.recoil * .45) / Math.max(.6, motion.weight));
  const contacts = defender ? [1.86] : [1.08, 2.48, 2.83, 3.85];
  const z: Track = defender ? [point(0, 0), point(.75, 0), point(1.08, flank * .6), point(1.32, flank * .6),
    point(1.86, -flank * .8), point(2.12, 0), point(2.48, flank * .45), point(2.63, 0),
    point(2.83, -flank * .5), point(3.13, 0), point(3.85, 0), point(4.25, flank * .2), point(5, flank * .2)]
    : [point(0, 0), point(.45, 0), point(.85, -flank), point(1.08, -flank * .35), point(1.4, 0),
      point(1.86, flank * .4), point(2.12, flank), point(2.48, flank * .2), point(2.63, -flank),
      point(2.83, -flank * .2), point(3.12, 0), point(3.45, flank * .2), point(3.85, 0), point(5, 0)];
  const airborne: Track = defender ? [point(0, 0), point(1.48, 0), point(1.72, lift * .72),
    point(1.86, lift * .3), point(2.07, 0), point(3.96, 0), point(4.25, .17 * recoil), point(4.63, 0), point(5, 0)]
    : [point(0, 0), point(.65, 0), point(.91, lift), point(1.08, lift * .2), point(1.3, 0),
      point(2.24, 0), point(2.42, lift * .72), point(2.58, 0), point(2.72, lift * .6), point(3.02, 0),
      point(3.4, 0), point(3.67, lift * 1.08), point(3.85, lift * .18), point(4.15, 0), point(5, 0)];
  const charge: Track = defender ? [point(0, .12), point(1.2, .12), point(1.48, .9), point(1.67, .95),
    point(1.86, 0), point(2.2, .12), point(3.5, .12), point(3.85, .6), point(4.25, 0), point(5, 0)]
    : [point(0, .15), point(.45, .45), point(.78, .95), point(1.08, 0), point(1.4, .12),
      point(1.9, .16), point(2.22, .8), point(2.48, 0), point(2.63, .78), point(2.83, 0),
      point(3.12, .45), point(3.5, 1), point(3.72, 1), point(3.85, 0), point(4.25, .08), point(5, 0)];
  const guard: Track = defender ? [point(0, .3), point(.78, .3), point(1, 1), point(1.16, 1),
    point(1.45, .1), point(1.95, .1), point(2.34, .95), point(2.57, .95), point(2.7, .5),
    point(2.83, 1), point(2.96, 1), point(3.25, .25), point(3.72, .9), point(3.93, .9), point(4.25, 0), point(5, 0)]
    : [point(0, .15), point(1.25, .15), point(1.66, 1), point(1.96, 1), point(2.12, .1), point(3.15, .1), point(4.25, .15), point(5, 0)];
  const recoilTrack: Track = defender ? [point(0, 0), point(.99, 0), point(1.08, recoil), point(1.17, recoil), point(1.42, 0),
    point(2.39, 0), point(2.48, recoil * .8), point(2.57, recoil * .8), point(2.69, 0),
    point(2.74, 0), point(2.83, recoil), point(2.92, recoil), point(3.12, 0), point(3.85, 0), point(4.12, 1), point(4.65, 0), point(5, 0)]
    : [point(0, 0), point(1.76, 0), point(1.86, recoil), point(1.96, recoil), point(2.17, 0), point(5, 0)];
  return { x: [point(0, 0), point(5, 0)], z: holdPositions(z), lift: holdPositions(airborne), charge, strike: attacks(contacts, defender ? .34 : .2, defender ? .21 : .14),
    guard, recoil: recoilTrack, aimWeight: attacks(contacts, .11, .13) };
}

/**
 * Anime.js owns interpolation, while the existing scene owns time. No autoplay,
 * timer callbacks or extra requestAnimationFrame loop can advance a paused duel.
 * The returned actor objects are reused; callers should read them without mutation.
 */
export class DuelChoreography {
  private readonly attacker = idle();
  private readonly defender = idle();
  private readonly frame: DuelFrame = { attacker: this.attacker, defender: this.defender };
  private readonly timeline: Timeline;
  private disposed = false;

  constructor(attacker: CombatProfile, defender: CombatProfile) {
    this.timeline = createTimeline({ autoplay: false });
    const positions = pairPositions(attacker, defender);
    for (const [actor, profile, defending, x] of [[this.attacker, attacker, false, positions[0]], [this.defender, defender, true, positions[1]]] as const) {
      const tracks = actorTracks(profile, defending);
      tracks.x = x;
      const params = Object.fromEntries(Object.entries(tracks).map(([name, points]) => [name, keyframes(points)]));
      this.timeline.add(actor, params, 0);
    }
    this.timeline.seek(0, true);
  }

  get duration() { return this.timeline.duration; }
  get paused() { return this.timeline.paused; }

  sample(progress: number): DuelFrame {
    if (this.disposed) throw new Error("Cannot sample a disposed duel");
    const t = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
    this.timeline.seek(t * CAPTURE_DURATION, true);
    return this.frame;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.timeline.cancel();
  }
}
