import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { captureFrame, CAPTURE_DURATION, CAPTURE_CONTACT, CAPTURE_DEATH } from "../src/combat.ts";
import { combatProfile } from "../src/combat-profiles.ts";
import { DuelChoreography } from "../src/duel-choreography.ts";
import { fighterPose, defenderPose } from "../src/motion.ts";
import { createAvatar, animateAvatar, animateDefender, avatarResourceStats } from "../src/avatar.ts";

const classes = ["p", "n", "b", "r", "q", "k"];
const skins = ["classic", "ember", "frost", "astral", "royal", "storm", "void", "prism", "nova", "phantom", "dragon"];
const sample = (type, progress, skin = "classic") => {
  const frame = captureFrame(progress);
  return fighterPose(type, frame.charge, frame.strike, progress * CAPTURE_DURATION / 1000,
    { ...frame, combat: true, progress, profile: combatProfile(type, skin) });
};
const values = (pose) => Object.values(pose).flat();

test("all six fighters have distinct windups, finishing gestures and guards", () => {
  for (const progress of [0.3, 0.5, CAPTURE_CONTACT]) {
    const signatures = classes.map((type) => {
      const pose = sample(type, progress);
      return JSON.stringify([pose.torso, pose.leftArm, pose.rightArm, pose.weapon]);
    });
    assert.equal(new Set(signatures).size, 6);
  }
  assert.equal(new Set(classes.map((type) => JSON.stringify(defenderPose(type, 0.75, 1.2)))).size, 6);
});

test("every skin retains six different actual arm windups while the local strike is zero", () => {
  for (const skin of skins) {
    const signatures = classes.map((type) => {
      const avatar = createAvatar(type, "w", skin), profile = combatProfile(type, skin);
      animateAvatar(avatar, type, 1, 0, 1, 3.45, {
        combat: true, progress: 3.45 / 5, profile, actionProgress: 0,
        actionCharge: 1, guard: 0, recoil: 0, aimWeight: 0,
      });
      const signature = JSON.stringify(avatar.userData.arms.map((arm) => arm.rotation.toArray().slice(0, 3)));
      releaseAvatar(avatar);
      return signature;
    });
    assert.equal(new Set(signatures).size, 6, `${skin} replaces class-specific charged arm stances`);
  }
});

test("capture choreography is bounded and continuous through phase boundaries", () => {
  for (const type of classes) for (const skin of skins) {
    let previous = values(sample(type, 0, skin));
    for (let i = 1; i <= 4000; i++) {
      const current = values(sample(type, i / 4000, skin));
      for (let j = 0; j < current.length; j++) {
        assert.ok(Number.isFinite(current[j]) && Math.abs(current[j]) < 4, `${type}:${skin} pose out of bounds at ${i}`);
        assert.ok(Math.abs(current[j] - previous[j]) < 0.15, `${type}:${skin} snapped at ${i}`);
      }
      previous = current;
    }
  }
});

test("attacks shift weight and recover rather than holding their strike forever", () => {
  for (const type of classes) {
    const charged = sample(type, 3.5 / 5), strike = sample(type, CAPTURE_CONTACT), recovery = sample(type, 0.97);
    assert.notDeepEqual(charged.torso, strike.torso);
    assert.notDeepEqual(charged.leftLeg, recovery.leftLeg);
    assert.notDeepEqual([strike.weapon, strike.weaponOffset], [recovery.weapon, recovery.weaponOffset]);
    assert.ok(Math.abs(recovery.torso[1]) < Math.abs(charged.torso[1]) + 0.001);
    assert.deepEqual(sample(type, CAPTURE_CONTACT), strike, "sampling a frame must be deterministic");
  }
});

test("all sixty-six class/skin combinations change actual kinematics, including defenses", () => {
  for (const type of classes) {
    const attacks = skins.map((skin) => JSON.stringify([sample(type, 0.28, skin), sample(type, 0.65, skin)]));
    assert.equal(new Set(attacks).size, 11, `${type} skin attack kinematics repeat`);
    const defenses = skins.map((skin) => JSON.stringify(defenderPose(type, 0, 1.25,
      { combat: true, progress: 1.25 / 5, profile: combatProfile(type, skin), reaction: "parry" })));
    assert.equal(new Set(defenses).size, 11, `${type} skin defense kinematics repeat`);
  }
});

test("reactive defense produces a visible counter and recovers continuously into defeat", () => {
  for (const type of classes) for (const reaction of ["parry", "shield", "barrier", "dodge", "brace"]) {
    const poseAt = (seconds) => defenderPose(type, Math.max(0, Math.min(1, (seconds - CAPTURE_CONTACT * 5) / .4)), seconds,
      { ...captureFrame(seconds / 5), progress: seconds / 5, combat: true, reaction, profile: combatProfile(type, "astral") });
    assert.notDeepEqual(poseAt(0.4), poseAt(1.25), `${type} ${reaction} must visibly respond`);
    let previous = values(poseAt(0));
    for (let i = 1; i <= 1000; i++) {
      const current = values(poseAt(i * 5 / 1000));
      current.forEach((value, index) => {
        assert.ok(Number.isFinite(value) && Math.abs(value) < 4);
        assert.ok(Math.abs(value - previous[index]) < 0.08, `${type} ${reaction} jumped at ${i}`);
      });
      previous = current;
    }
  }
});

function releaseAvatar(group) {
  const geometries = new Set(), materials = new Set();
  group.traverse((object) => {
    if (!object.isMesh) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
  });
  geometries.forEach((geometry) => geometry.dispose()); materials.forEach((material) => material.dispose());
}

test("hand-directed melee weapons reach the actual chest point for every skin at the final contact", () => {
  // A 1.25-unit faceoff matches the scene's stop offset, outside the defender silhouette.
  const target = new THREE.Vector3(0, 1.38, -1.25);
  const chest = new THREE.Box3(new THREE.Vector3(-0.31, 0.9, -1.55), new THREE.Vector3(0.31, 1.75, -0.95));
  const frame = captureFrame(CAPTURE_CONTACT);
  for (const type of ["p", "n", "k"]) for (const skin of skins) {
    const avatar = createAvatar(type, "w", skin); avatar.scale.setScalar(1.165);
    const context = { ...frame, progress: CAPTURE_CONTACT, combat: true, contactTarget: target.toArray(), profile: combatProfile(type, skin) };
    animateAvatar(avatar, type, frame.charge, frame.strike, 1, 3.85, context); avatar.updateMatrixWorld(true);
    const weapon = avatar.userData.weapon;
    assert.equal(weapon.parent, avatar.userData.bones.rightElbow, "weapon must have a real hand pivot");
    const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(weapon.getWorldQuaternion(new THREE.Quaternion()));
    const direction = target.clone().sub(weapon.getWorldPosition(new THREE.Vector3())).normalize();
    assert.ok(axis.dot(direction) > 0.999, `${type}:${skin} weapon points away from the defender`);
    assert.ok(new THREE.Box3().setFromObject(weapon, true).intersectsBox(chest), `${type}:${skin} blade misses the visible torso`);
    // Re-sampling a frame cannot integrate aim transforms or change the legal actor's root.
    const quaternion = weapon.quaternion.toArray(), position = avatar.position.toArray();
    animateAvatar(avatar, type, frame.charge, frame.strike, 1, 3.85, context);
    assert.deepEqual(weapon.quaternion.toArray(), quaternion); assert.deepEqual(avatar.position.toArray(), position);
    releaseAvatar(avatar);
  }
});

test("both fighters reuse their class rig for every exchange and retain the guard at fatal contact", () => {
  for (const type of classes) for (const skin of skins) {
    const profile = combatProfile(type, skin), enemy = combatProfile(classes[(classes.indexOf(type) + 1) % classes.length], skin);
    const duel = new DuelChoreography(profile, enemy);
    const previous = new Map();
    for (let step = 0; step <= 4000; step++) {
      const progress = step / 4000, score = captureFrame(progress), actors = duel.sample(progress);
      for (const [role, rig] of [["attacker", profile], ["defender", enemy]]) {
        const actor = actors[role];
        const context = { ...score, combat: true, progress, profile: rig, skin,
          actionProgress: actor.strike, actionCharge: actor.charge, guard: actor.guard, recoil: actor.recoil, aimWeight: actor.aimWeight };
        const pose = role === "defender" && progress >= CAPTURE_CONTACT ?
          defenderPose(rig.piece, Math.min(1, (score.seconds - CAPTURE_CONTACT * 5) / .4), score.seconds, context) :
          fighterPose(rig.piece, actor.charge, actor.strike, score.seconds, context);
        const current = values(pose), prior = previous.get(role);
        current.forEach((value, index) => {
          assert.ok(Number.isFinite(value) && Math.abs(value) < 4, `${rig.id} ${role} explicit exchange exceeds its rig`);
          if (prior) assert.ok(Math.abs(value - prior[index]) < .15, `${rig.id} ${role} explicit exchange snapped at ${score.seconds}`);
        });
        previous.set(role, current);
      }
    }
    const progress = CAPTURE_CONTACT, score = captureFrame(progress), actor = duel.sample(progress).defender;
    const context = { ...score, combat: true, progress, profile: enemy, skin,
      actionProgress: actor.strike, actionCharge: actor.charge, guard: actor.guard, recoil: actor.recoil, aimWeight: actor.aimWeight };
    const fatalGuard = values(defenderPose(enemy.piece, 0, score.seconds, context));
    const fightingGuard = values(fighterPose(enemy.piece, actor.charge, actor.strike, score.seconds, context));
    assert.ok(fatalGuard.every((value, index) => Math.abs(value - fightingGuard[index]) < 1e-10),
      "fatal hit must continue the counter fighter's current guard rather than teleport to a different rig pose");
    duel.dispose();
  }
});

test("each of the five contacts aims a hand-held weapon at the visible opposing chest", () => {
  const target = new THREE.Vector3(0, 1.38, -1.34);
  const chest = new THREE.Box3(new THREE.Vector3(-.31, .9, -1.64), new THREE.Vector3(.31, 1.75, -1.04));
  for (const type of ["p", "n", "k"]) for (const skin of skins) {
    const profile = combatProfile(type, skin), avatar = createAvatar(type, "w", skin);
    avatar.scale.setScalar(1.165);
    for (const seconds of [1.08, 1.86, 2.48, 2.83, 3.85]) {
      const progress = seconds / 5, score = captureFrame(progress);
      const context = { ...score, progress, combat: true, profile, actionProgress: 1,
        actionCharge: 0, guard: 0, recoil: 0, aimWeight: 1, contactTarget: target.toArray() };
      animateAvatar(avatar, type, 0, 1, 1, seconds, context); avatar.updateMatrixWorld(true);
      const weapon = avatar.userData.weapon;
      const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(weapon.getWorldQuaternion(new THREE.Quaternion()));
      assert.ok(axis.dot(target.clone().sub(weapon.getWorldPosition(new THREE.Vector3())).normalize()) > .999,
        `${type}:${skin} points away during the exchange at ${seconds}s`);
      assert.ok(new THREE.Box3().setFromObject(weapon, true).intersectsBox(chest),
        `${type}:${skin} weapon does not touch the chest at ${seconds}s`);
    }
    releaseAvatar(avatar);
  }
});

test("procedural geometry is cached on CPU with independent GPU wrappers and fade materials", () => {
  for (const type of classes) for (const skin of skins) {
    const a = createAvatar(type, "w", skin), b = createAvatar(type, "b", skin);
    const meshes = (group) => { const result = []; group.traverse((object) => { if (object.isMesh) result.push(object); }); return result; };
    const first = meshes(a), second = meshes(b);
    assert.ok(first.length <= 20, `${type}:${skin} avatar exceeds its draw budget`);
    assert.equal(first.length, second.length);
    for (let i = 0; i < first.length; i++) {
      assert.notEqual(first[i].geometry, second[i].geometry, "disposal wrappers must be independent");
      assert.equal(first[i].geometry.attributes.position.array, second[i].geometry.attributes.position.array, "reuse immutable generated vertex arrays");
      assert.notEqual(first[i].material, second[i].material, "one defender fading must not fade its opponent");
    }
    animateDefender(b, type, 0, 0.25, 1.25, { combat: true, progress: 1.25 / 5, reaction: "shield" });
    assert.equal(a.userData.materials[0].opacity, 0.96);
    releaseAvatar(a); releaseAvatar(b);
  }
  const before = avatarResourceStats();
  for (let i = 0; i < 100; i++) releaseAvatar(createAvatar("n", "w", "astral"));
  assert.deepEqual(avatarResourceStats(), before, "repeat captures must not grow template memory");
  assert.equal(before.profiles, classes.length * skins.length);
  assert.ok(before.bytes < 5_000_000, `procedural avatar cache unexpectedly large: ${before.bytes}`);
});

test("heavy defenders keep their footing longer and guard transitions remain smooth", () => {
  assert.ok(Math.abs(defenderPose("r", 1, 0).body[2]) < Math.abs(defenderPose("p", 1, 0).body[2]));
  for (const type of classes) {
    let previous = values(defenderPose(type, 0, 0));
    for (let i = 1; i <= 200; i++) {
      const current = values(defenderPose(type, i / 200, i / 200));
      current.forEach((value, j) => assert.ok(Number.isFinite(value) && Math.abs(value - previous[j]) < 0.04));
      previous = current;
    }
  }
});

 test("new skin silhouettes differ from their former inherited styles in movement and capture", () => {
  for (const [skin, former] of [["nova","storm"],["phantom","void"],["dragon","ember"]]) {
    for (const type of classes) {
      for (const combat of [true,false]) {
        const a=fighterPose(type,.8,.15,.7,{combat,skin,progress:combat ? .69 : .28});
        const b=fighterPose(type,.8,.15,.7,{combat,skin:former,progress:combat ? .69 : .28});
        const distance=Math.hypot(...a.leftArm.map((v,i)=>v-b.leftArm[i]),...a.rightArm.map((v,i)=>v-b.rightArm[i]));
        assert.ok(distance>.4, `${skin}:${type} retains a recoloured ${former} stance`);
      }
    }
  }
});
