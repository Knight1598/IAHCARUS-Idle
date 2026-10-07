import * as THREE from "three";
import { BattleOverlay, cinematicFrame } from "./cinematic";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Chess, type Square, type PieceSymbol, type Move } from "chess.js";
import { kingSquare, type MoveEvent } from "../shared/events.js";
const material = (color: number, metalness = 0.3) =>
  new THREE.MeshStandardMaterial({ color, metalness, roughness: 0.3 });
const mesh = (
  g: THREE.BufferGeometry,
  m: THREE.Material,
  parent: THREE.Group,
  x = 0,
  y = 0,
  z = 0,
) => {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  parent.add(o);
  return o;
};
export const coords = (s: Square) =>
  new THREE.Vector3(s.charCodeAt(0) - 97 - 3.5, 0, 3.5 - (Number(s[1]) - 1));
function disposeObject(o: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  o.traverse((child) => {
    if (
      child instanceof THREE.Mesh ||
      child instanceof THREE.Line ||
      child instanceof THREE.Points
    ) {
      geometries.add(child.geometry);
      for (const m of Array.isArray(child.material)
        ? child.material
        : [child.material])
        materials.add(m);
    }
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => {
    if (m instanceof THREE.MeshBasicMaterial) m.map?.dispose();
    m.dispose();
  });
  o.removeFromParent();
}
function clear(group: THREE.Group) {
  for (const child of [...group.children]) disposeObject(child);
}
function makePiece(type: PieceSymbol, color: "w" | "b") {
  const group = new THREE.Group();
  const body = material(color === "w" ? 0xe4edf4 : 0x222937, 0.55);
  const accent = material(color === "w" ? 0x39d9e8 : 0xae70ff, 0.6);
  mesh(new THREE.CylinderGeometry(0.27, 0.33, 0.13, 24), body, group, 0, 0.1);
  mesh(new THREE.CylinderGeometry(0.12, 0.23, 0.38, 24), body, group, 0, 0.34);
  mesh(
    new THREE.TorusGeometry(0.2, 0.035, 8, 24),
    accent,
    group,
    0,
    0.17,
  ).rotation.x = Math.PI / 2;
  if (type === "p")
    mesh(new THREE.SphereGeometry(0.18, 20, 12), body, group, 0, 0.65);
  if (type === "r") {
    mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.25, 16), body, group, 0, 0.66);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      mesh(
        new THREE.BoxGeometry(0.13, 0.16, 0.13),
        accent,
        group,
        Math.cos(a) * 0.2,
        0.85,
        Math.sin(a) * 0.2,
      );
    }
  }
  if (type === "b") {
    mesh(new THREE.ConeGeometry(0.21, 0.46, 16), body, group, 0, 0.74);
    mesh(new THREE.SphereGeometry(0.07, 12, 8), accent, group, 0, 1);
  }
  if (type === "n") {
    const neck = mesh(
      new THREE.BoxGeometry(0.23, 0.42, 0.22),
      body,
      group,
      0,
      0.67,
    );
    neck.rotation.x = -0.25;
    mesh(new THREE.BoxGeometry(0.23, 0.2, 0.4), body, group, 0, 0.86, -0.09);
    for (const x of [-0.065, 0.065])
      mesh(new THREE.ConeGeometry(0.055, 0.15, 4), accent, group, x, 1, -0.01);
    for (const x of [-0.12, 0.12])
      mesh(new THREE.SphereGeometry(0.035, 8, 8), accent, group, x, 0.9, -0.2);
    group.rotation.y = color === "w" ? 0 : Math.PI;
  }
  if (type === "q" || type === "k") {
    mesh(
      new THREE.CylinderGeometry(0.16, 0.12, 0.23, 16),
      body,
      group,
      0,
      0.65,
    );
    mesh(
      new THREE.CylinderGeometry(0.23, 0.15, 0.16, 16),
      accent,
      group,
      0,
      0.85,
    );
    if (type === "q") {
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        mesh(
          new THREE.ConeGeometry(0.06, 0.2, 8),
          body,
          group,
          Math.cos(a) * 0.17,
          1,
          Math.sin(a) * 0.17,
        );
      }
    } else {
      mesh(new THREE.BoxGeometry(0.08, 0.3, 0.08), accent, group, 0, 1.06);
      mesh(new THREE.BoxGeometry(0.24, 0.08, 0.08), accent, group, 0, 1.1);
    }
  }
  return group;
}
interface Animation {
  object: THREE.Group;
  victim?: THREE.Object3D;
  from: THREE.Vector3;
  to: THREE.Vector3;
  start: number;
  duration: number;
  move: Move;
  event: MoveEvent;
  after: Chess;
  impacted: boolean;
  dramatic: boolean;
  weapons: boolean;
  aura?: THREE.Group;
  rotation: number;
  camera: THREE.Vector3;
  target: THREE.Vector3;
  rook?: { object: THREE.Object3D; from: THREE.Vector3; to: THREE.Vector3 };
}
export class ChessScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: OrbitControls;
  readonly pieces = new THREE.Group();
  readonly markers = new THREE.Group();
  readonly fx = new THREE.Group();
  readonly board = new THREE.Group();
  animation: Animation | null = null;
  reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  cinematic = true;
  flipped = false;
  onPick: (s: Square) => void = () => {};
  onFinish: () => void = () => {};
  onImpact: (move: Move, event: MoveEvent) => void = () => {};
  onCancel: () => void = () => {};
  private overlay: BattleOverlay;
  private sparks: {
    object: THREE.Mesh;
    velocity: THREE.Vector3;
    life: number;
  }[] = [];
  private previous = performance.now();
  private dirty = true;
  private lastRender = 0;
  constructor(private stage: HTMLElement) {
    this.scene.background = new THREE.Color("#080d16");
    this.scene.fog = new THREE.Fog("#080d16", 19, 35);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.stage.prepend(this.renderer.domElement);
    this.overlay = new BattleOverlay(stage);
    this.camera.position.set(0, 10, 10);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.minDistance = 7;
    this.controls.maxDistance = 32;
    this.controls.maxPolarAngle = Math.PI / 2.25;
    this.controls.enablePan = false;
    this.controls.addEventListener("change", () => {
      this.dirty = true;
    });
    this.scene.add(new THREE.HemisphereLight(0xc8e8ff, 0x162034, 2));
    const sun = new THREE.DirectionalLight(0xfff2de, 3.4);
    sun.position.set(3, 9, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.bias = -0.001;
    Object.assign(sun.shadow.camera, {
      left: -6,
      right: 6,
      top: 6,
      bottom: -6,
    });
    this.scene.add(sun);
    const rim = new THREE.PointLight(0x6b65ff, 18, 15);
    rim.position.set(-5, 3, -4);
    this.scene.add(rim);
    this.scene.add(this.board, this.pieces, this.markers, this.fx);
    for (let rank = 1; rank <= 8; rank++)
      for (let file = 0; file < 8; file++) {
        const s = `${String.fromCharCode(97 + file)}${rank}` as Square;
        const p = coords(s);
        const tile = mesh(
          new THREE.BoxGeometry(0.98, 0.16, 0.98),
          material((rank + file) % 2 ? 0x253d51 : 0x9ab5bf),
          this.board,
          p.x,
          -0.08,
          p.z,
        );
        tile.userData.square = s;
      }
    mesh(
      new THREE.BoxGeometry(8.45, 0.28, 8.45),
      material(0x172333, 0.7),
      this.board,
      0,
      -0.27,
    );
    const floor = mesh(
      new THREE.PlaneGeometry(100, 100),
      material(0x0a121f, 0.05),
      this.board,
      0,
      -0.43,
    );
    floor.rotation.x = -Math.PI / 2;
    for (let i = 0; i < 8; i++) {
      this.label(String.fromCharCode(97 + i), i - 3.5, 4.08);
      this.label(String(i + 1), -4.1, 3.5 - i);
    }
    let down = { x: 0, y: 0 };
    this.renderer.domElement.addEventListener("pointerdown", (e) => {
      down = { x: e.clientX, y: e.clientY };
    });
    this.renderer.domElement.addEventListener("pointerup", (e) => {
      if (
        this.animation ||
        Math.hypot(e.clientX - down.x, e.clientY - down.y) > 7
      )
        return;
      const rect = this.renderer.domElement.getBoundingClientRect();
      const ray = new THREE.Raycaster();
      ray.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          (-(e.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        this.camera,
      );
      for (const hit of ray.intersectObjects(
        [...this.pieces.children, ...this.board.children],
        true,
      )) {
        let o: THREE.Object3D | null = hit.object;
        while (o && !o.userData.square) o = o.parent;
        if (o?.userData.square) {
          this.onPick(o.userData.square);
          return;
        }
      }
    });
    new ResizeObserver(() => {
      const w = this.stage.clientWidth,
        h = this.stage.clientHeight;
      if (!w || !h) return;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      this.finish();
      this.resetView();
      this.dirty = true;
    }).observe(this.stage);
    this.renderer.setAnimationLoop(() => this.frame());
  }
  private label(text: string, x: number, z: number) {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d")!;
    ctx.font = "32px monospace";
    ctx.fillStyle = "#91a8b9";
    ctx.textAlign = "center";
    ctx.fillText(text, 32, 43);
    const texture = new THREE.CanvasTexture(c);
    const o = mesh(
      new THREE.PlaneGeometry(0.3, 0.3),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
      }),
      this.board,
      x,
      -0.115,
      z,
    );
    o.rotation.x = -Math.PI / 2;
  }
  renderBoard(game: Chess) {
    this.dirty = true;
    this.cancel();
    clear(this.pieces);
    clear(this.markers);
    for (const row of game.board())
      for (const p of row)
        if (p) {
          const o = makePiece(p.type, p.color);
          o.position.copy(coords(p.square));
          o.userData.square = p.square;
          if (p.type === "k" && p.color === game.turn() && game.isCheckmate()) {
            o.rotation.z = -Math.PI / 3;
            o.position.y = 0.05;
          }
          this.pieces.add(o);
        }
    if (game.isCheck()) {
      const k = kingSquare(game, game.turn());
      if (k) this.ring(k, 0xff557a, 0.38);
    }
  }
  private ring(s: Square, color: number, radius = 0.27) {
    const p = coords(s);
    const o = mesh(
      new THREE.RingGeometry(radius - 0.04, radius, 32),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
      }),
      this.markers,
      p.x,
      0.015,
      p.z,
    );
    o.rotation.x = -Math.PI / 2;
  }
  select(game: Chess, s: Square | null, last?: { from: Square; to: Square }) {
    this.dirty = true;
    clear(this.markers);
    if (last) {
      this.ring(last.from, 0xd1a35b, 0.4);
      this.ring(last.to, 0xd1a35b, 0.4);
    }
    const k = kingSquare(game, game.turn());
    if (k && game.isCheck()) this.ring(k, 0xff557a, 0.38);
    if (!s) return;
    this.ring(s, 0xffffff, 0.44);
    for (const m of game.moves({ square: s, verbose: true }))
      this.ring(m.to, m.captured ? 0xff657c : 0x58e5d1);
  }
  resetView(flip = this.flipped) {
    this.flipped = flip;
    const distance = Math.max(10, (10 * 1.05) / this.camera.aspect);
    this.camera.position.set(0, distance, flip ? -distance : distance);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }
  cancel() {
    this.dirty = true;
    if (this.animation) {
      this.camera.position.copy(this.animation.camera);
      this.controls.target.copy(this.animation.target);
    }
    this.camera.lookAt(this.controls.target);
    this.animation = null;
    this.overlay.clear();
    this.renderer.toneMappingExposure = 1;
    this.onCancel();
    this.controls.enabled = true;
    clear(this.fx);
    this.sparks = [];
  }
  finish() {
    if (!this.animation) return;
    const game = this.animation.after;
    this.renderBoard(game);
    this.onFinish();
  }
  play(before: Chess, after: Chess, move: Move, event: MoveEvent) {
    this.renderBoard(before);
    const object = this.pieces.children.find(
      (o) => o.userData.square === move.from,
    ) as THREE.Group;
    const victim = move.captured
      ? this.pieces.children.find(
          (o) => o.userData.square === event.capturedSquare,
        )
      : undefined;
    let rook: Animation["rook"];
    if (move.flags.includes("k") || move.flags.includes("q")) {
      const rank = move.from[1];
      const from = ((move.flags.includes("k") ? "h" : "a") + rank) as Square;
      const to = ((move.flags.includes("k") ? "f" : "d") + rank) as Square;
      const o = this.pieces.children.find((o) => o.userData.square === from);
      if (o) rook = { object: o, from: coords(from), to: coords(to) };
    }
    const dramatic = this.cinematic && !this.reduced && event.kind !== "move";
    this.animation = {
      object,
      victim,
      from: coords(move.from),
      to: coords(move.to),
      start: performance.now(),
      duration: this.reduced
        ? 180
        : event.kind === "mate"
          ? dramatic
            ? 3800
            : 1000
          : event.kind !== "move"
            ? dramatic
              ? 2800
              : 850
            : 420,
      move,
      event,
      after,
      impacted: false,
      dramatic,
      weapons: false,
      rotation: object.rotation.y,
      camera: this.camera.position.clone(),
      target: this.controls.target.clone(),
      rook,
    };
    this.controls.enabled = false;
    if (dramatic) this.animation.aura = this.chargeAura(this.animation);
  }
  private beam(
    from: THREE.Vector3,
    to: THREE.Vector3,
    color: number,
    radius = 0.035,
  ) {
    const d = to.clone().sub(from);
    const o = mesh(
      new THREE.CylinderGeometry(radius, radius, d.length(), 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 }),
      this.fx,
    );
    o.position.copy(from).add(to).multiplyScalar(0.5);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    return o;
  }
  private weapon(move: Move, p: THREE.Vector3) {
    const color = move.color === "w" ? 0x68f9e0 : 0xb787ff;
    if (move.piece === "p") {
      this.beam(
        p.clone().add(new THREE.Vector3(0, 2, -0.6)),
        p.clone().add(new THREE.Vector3(0, 0.2, 0)),
        color,
        0.06,
      );
      mesh(
        new THREE.ConeGeometry(0.13, 0.4, 6),
        new THREE.MeshBasicMaterial({ color }),
        this.fx,
        p.x,
        0.45,
        p.z,
      ).rotation.z = Math.PI;
    }
    if (move.piece === "n") {
      const ghost = makePiece("n", move.color);
      ghost.position.copy(p).add(new THREE.Vector3(0, 1.7, 0));
      ghost.scale.setScalar(1.5);
      ghost.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          (o.material as THREE.MeshStandardMaterial).transparent = true;
          (o.material as THREE.MeshStandardMaterial).opacity = 0.3;
        }
      });
      this.fx.add(ghost);
    }
    if (move.piece === "b") {
      this.beam(
        p.clone().add(new THREE.Vector3(-1, 3, -1)),
        p.clone().add(new THREE.Vector3(0, 0.15, 0)),
        color,
        0.14,
      );
      for (let i = 0; i < 3; i++) {
        const ring = mesh(
          new THREE.TorusGeometry(0.4 + i * 0.17, 0.02, 6, 40),
          new THREE.MeshBasicMaterial({ color }),
          this.fx,
          p.x,
          0.1 + i * 0.05,
          p.z,
        );
        ring.rotation.x = Math.PI / 2;
      }
    }
    if (move.piece === "r") {
      this.beam(
        coords(move.from).add(new THREE.Vector3(0, 0.75, 0)),
        p.clone().add(new THREE.Vector3(0, 0.6, 0)),
        color,
        0.12,
      );
    }
    if (move.piece === "q") {
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        const blade = mesh(
          new THREE.ConeGeometry(0.09, 0.95, 4),
          new THREE.MeshBasicMaterial({ color }),
          this.fx,
          p.x + Math.cos(a) * 0.65,
          1.2,
          p.z + Math.sin(a) * 0.65,
        );
        blade.rotation.z = Math.PI;
      }
    }
    if (move.piece === "k") {
      const sword = mesh(
        new THREE.BoxGeometry(0.12, 1.8, 0.06),
        new THREE.MeshBasicMaterial({ color }),
        this.fx,
        p.x,
        1.5,
        p.z,
      );
      sword.rotation.z = -0.6;
      mesh(
        new THREE.BoxGeometry(0.6, 0.08, 0.09),
        new THREE.MeshBasicMaterial({ color }),
        this.fx,
        p.x + 0.35,
        2,
        p.z,
      );
    }
  }
  private impact(a: Animation) {
    const color = a.move.color === "w" ? 0x68f9e0 : 0xb787ff;
    if (a.victim) disposeObject(a.victim);
    this.onImpact(a.move, a.event);
    if (this.reduced) return;
    const count = a.move.captured ? (a.dramatic ? 52 : 32) : 12;
    for (let i = 0; i < count; i++) {
      const o = mesh(
        new THREE.IcosahedronGeometry(0.035 + Math.random() * 0.045),
        new THREE.MeshBasicMaterial({ color }),
        this.fx,
      );
      o.position.copy(a.to).add(new THREE.Vector3(0, 0.4, 0));
      this.sparks.push({
        object: o,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * (a.dramatic ? 6 : 3),
          1 + Math.random() * (a.dramatic ? 4 : 2),
          (Math.random() - 0.5) * (a.dramatic ? 6 : 3),
        ),
        life: 1,
      });
    }
    const ring = mesh(
      new THREE.TorusGeometry(0.3, 0.025, 6, 48),
      new THREE.MeshBasicMaterial({ color, transparent: true }),
      this.fx,
      a.to.x,
      0.03,
      a.to.z,
    );
    ring.rotation.x = Math.PI / 2;
    ring.userData.shock = true;
    if (a.dramatic) this.finalStrike(a);
    for (const target of a.event.targets) {
      this.beam(
        a.to.clone().add(new THREE.Vector3(0, 0.5, 0)),
        coords(target).add(new THREE.Vector3(0, 0.6, 0)),
        color,
        0.018,
      );
    }
    if (["rescue", "block", "castle"].includes(a.event.kind)) {
      const k = kingSquare(a.after, a.move.color);
      if (k) {
        const pos = coords(k);
        const shield = mesh(
          new THREE.SphereGeometry(0.8, 24, 12),
          new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.18,
            wireframe: true,
          }),
          this.fx,
          pos.x,
          0.55,
          pos.z,
        );
        shield.scale.y = 1.3;
      }
    }
  }
  private glow(color: number, opacity = 0.65) {
    return new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }
  private chargeAura(a: Animation) {
    const color = a.move.color === "w" ? 0x6bffe4 : 0xb47aff;
    const group = new THREE.Group();
    this.fx.add(group);
    group.position.copy(a.from);
    for (let i = 0; i < 3; i++) {
      const ring = mesh(
        new THREE.TorusGeometry(0.6 + i * 0.22, 0.018, 6, 56),
        this.glow(color, 0.7 - i * 0.12),
        group,
        0,
        0.08 + i * 0.12,
      );
      ring.rotation.x = Math.PI / 2;
      ring.userData.auraRing = i;
    }
    const shell = mesh(
      new THREE.ConeGeometry(0.58, 2.2, 8, 1, true),
      this.glow(color, 0.13),
      group,
      0,
      1,
    );
    shell.userData.auraShell = true;
    const lightning: number[] = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      for (let j = 0; j < 5; j++) {
        const y = j * 0.45;
        const r = 0.35 + Math.sin(i * 17 + j * 13) * 0.18;
        const next = 0.35 + Math.sin(i * 17 + (j + 1) * 13) * 0.18;
        lightning.push(
          Math.cos(angle) * r,
          y,
          Math.sin(angle) * r,
          Math.cos(angle + 0.1) * next,
          y + 0.45,
          Math.sin(angle + 0.1) * next,
        );
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(lightning, 3),
    );
    const bolts = new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    group.add(bolts);
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      const shard = mesh(
        new THREE.OctahedronGeometry(0.065),
        this.glow(color),
        group,
        Math.cos(angle) * 0.7,
        0.2,
        Math.sin(angle) * 0.7,
      );
      shard.userData.auraShard = i;
    }
    return group;
  }
  private animateAura(a: Animation, t: number, charge: number) {
    if (!a.aura) return;
    const f = cinematicFrame(t);
    a.aura.position.lerpVectors(a.from, a.to, f.travel);
    a.aura.rotation.y = t * 8;
    a.aura.scale.setScalar(0.3 + charge * 0.9);
    a.aura.visible = t < 0.6;
    for (const o of a.aura.children) {
      if (o.userData.auraShard !== undefined)
        o.position.y = 0.2 + ((t * 5 + o.userData.auraShard * 0.22) % 1) * 2;
    }
    if (t < 0.3) a.object.scale.setScalar(1 + charge * 0.12);
    else a.object.scale.setScalar(1 + (1 - f.travel) * 0.12);
  }
  private finalStrike(a: Animation) {
    const color = a.move.color === "w" ? 0x86fff0 : 0xc59bff;
    for (let i = 0; i < 3; i++) {
      const wave = mesh(
        new THREE.TorusGeometry(0.36 + i * 0.12, 0.04, 6, 64),
        this.glow(color, 0.7),
        this.fx,
        a.to.x,
        0.06 + i * 0.06,
        a.to.z,
      );
      wave.rotation.x = Math.PI / 2;
      wave.userData.blast = true;
      wave.userData.layer = i;
    }
    if (a.move.piece === "b" || a.move.piece === "r") {
      const pillar = mesh(
        new THREE.CylinderGeometry(0.1, 0.7, 5, 12, 1, true),
        this.glow(color, 0.35),
        this.fx,
        a.to.x,
        2.5,
        a.to.z,
      );
      pillar.userData.pillar = true;
    } else {
      const slash = mesh(
        new THREE.TorusGeometry(1.3, 0.1, 6, 56, Math.PI * 1.35),
        this.glow(color, 0.95),
        this.fx,
        a.to.x,
        0.8,
        a.to.z,
      );
      slash.rotation.set(0.9, 0.4, -0.8);
      slash.userData.slash = true;
    }
    const spokes: number[] = [];
    for (let i = 0; i < 20; i++) {
      const angle = (i * Math.PI) / 10;
      const r = 1.1 + (i % 3) * 0.35;
      spokes.push(
        a.to.x + Math.cos(angle) * 0.2,
        0.12,
        a.to.z + Math.sin(angle) * 0.2,
        a.to.x + Math.cos(angle) * r,
        0.12,
        a.to.z + Math.sin(angle) * r,
      );
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(spokes, 3));
    this.fx.add(
      new THREE.LineSegments(
        g,
        new THREE.LineBasicMaterial({
          color,
          transparent: true,
          opacity: 0.6,
          blending: THREE.AdditiveBlending,
        }),
      ),
    );
  }
  private directCamera(a: Animation, t: number) {
    const f = cinematicFrame(t);
    const direction = this.flipped ? -1 : 1;
    const actor = a.from.clone().add(new THREE.Vector3(0, 0.65, 0));
    const target = a.to.clone().add(new THREE.Vector3(0, 0.55, 0));
    const attackDirection = a.to.clone().sub(a.from).normalize();
    const side = new THREE.Vector3(-attackDirection.z, 0, attackDirection.x);
    const portrait = actor
      .clone()
      .add(side.clone().multiplyScalar(2.3))
      .add(new THREE.Vector3(0, 1.35, direction * 2.6));
    const clash = target
      .clone()
      .add(side.clone().multiplyScalar(3))
      .add(new THREE.Vector3(0, 2, direction * 2.8));
    let position: THREE.Vector3, focus: THREE.Vector3;
    if (t < 0.3) {
      const ease = Math.min(1, t / 0.08);
      position = a.camera.clone().lerp(portrait, ease);
      focus = a.target.clone().lerp(actor, ease);
    } else if (t < 0.52) {
      position = portrait.clone().lerp(clash, f.travel);
      focus = actor.clone().lerp(target, f.travel);
    } else if (t < 0.6) {
      position = clash;
      focus = target;
    } else {
      focus = target.clone();
      if (
        [
          "check",
          "mate",
          "double-check",
          "discovered-check",
          "rescue",
          "block",
        ].includes(a.event.kind)
      ) {
        const king = kingSquare(
          a.after,
          ["rescue", "block"].includes(a.event.kind)
            ? a.move.color
            : a.after.turn(),
        );
        if (king)
          focus.lerp(
            coords(king).add(new THREE.Vector3(0, 0.65, 0)),
            f.release * 0.7,
          );
      }
      const wide = focus
        .clone()
        .add(new THREE.Vector3(side.x * 3.6, 3.5, direction * 5));
      position = clash.clone().lerp(wide, f.release);
      position.lerp(a.camera, f.returning);
      focus.lerp(a.target, f.returning);
    }
    if (t >= 0.6 && t < 0.72) {
      const shake = (1 - (t - 0.6) / 0.12) * 0.11;
      position.x += Math.sin(t * 200) * shake;
      position.y += Math.cos(t * 150) * shake * 0.55;
    }
    this.camera.position.copy(position);
    this.controls.target.copy(focus);
    this.camera.lookAt(focus);
    for (const o of this.fx.children) {
      if (o.userData.blast) {
        const p = Math.max(0, (t - 0.52) / 0.48);
        o.scale.setScalar(1 + p * (5 + o.userData.layer));
        (
          o as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>
        ).material.opacity = (1 - p) * 0.6;
      }
      if (o.userData.slash) {
        o.rotation.z += 0.045;
        (
          o as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>
        ).material.opacity = Math.max(0, 1 - (t - 0.52) * 2);
      }
    }
  }
  private frame() {
    const now = performance.now(),
      dt = Math.min((now - this.previous) / 1000, 0.05);
    this.previous = now;
    if (this.controls.enabled) this.controls.update();
    const a = this.animation;
    if (a) {
      const t = Math.min((now - a.start) / a.duration, 1);
      const choreography = cinematicFrame(t);
      const travel = a.dramatic ? choreography.travel : Math.min(t / 0.58, 1);
      const e = travel * travel * (3 - 2 * travel);
      if (a.dramatic) {
        this.overlay.draw(t, a.move.piece, a.move.color, a.event.title);
        this.animateAura(a, t, choreography.charge);
      }
      if (
        !a.weapons &&
        !this.reduced &&
        a.move.captured &&
        (!a.dramatic || t >= 0.3)
      ) {
        a.weapons = true;
        this.weapon(a.move, a.to);
      }
      a.object.position.lerpVectors(a.from, a.to, e);
      a.object.position.y =
        Math.sin(travel * Math.PI) *
        (a.move.piece === "n"
          ? 1.5
          : a.move.piece === "b"
            ? 0.6
            : a.move.piece === "q"
              ? 0.8
              : 0.2);
      if (a.move.piece === "b")
        a.object.rotation.y =
          a.rotation + Math.sin(travel * Math.PI) * Math.PI * 2;
      if (a.move.piece === "r")
        a.object.rotation.z = Math.sin(travel * Math.PI * 2) * 0.08;
      if (a.move.piece === "k")
        a.object.scale.setScalar(1 + Math.sin(travel * Math.PI) * 0.08);
      if (a.rook) a.rook.object.position.lerpVectors(a.rook.from, a.rook.to, e);
      if (!a.impacted && t >= (a.dramatic ? 0.52 : 0.58)) {
        a.impacted = true;
        this.impact(a);
      }
      for (const o of this.fx.children)
        if (o.userData.shock) {
          o.scale.setScalar(1 + Math.max(0, t - 0.58) * 7);
          (
            o as THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>
          ).material.opacity = Math.max(0, 1 - (t - 0.58) * 2);
        }
      if (a.dramatic) {
        this.directCamera(a, t);
      }
      if (t === 1) this.finish();
    }
    const particleDt =
      this.animation?.dramatic &&
      cinematicFrame((now - this.animation.start) / this.animation.duration)
        .phase === "impact"
        ? 0
        : dt;
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life -= particleDt;
      s.velocity.y -= particleDt * 3;
      s.object.position.addScaledVector(s.velocity, particleDt);
      s.object.scale.setScalar(Math.max(0, s.life));
      if (s.life <= 0) {
        disposeObject(s.object);
        this.sparks.splice(i, 1);
      }
    }
    if (this.animation || this.sparks.length) this.dirty = true;
    if (this.dirty && now - this.lastRender > 1000 / 30) {
      this.renderer.render(this.scene, this.camera);
      this.lastRender = now;
      this.dirty = false;
    }
  }
}
