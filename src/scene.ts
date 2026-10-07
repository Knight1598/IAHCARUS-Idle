import * as THREE from "three";
import { BattleOverlay, cinematicFrame } from "./cinematic";
import { useDramaticCamera, type CinematicScope } from "./gameplay";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { Chess, type Square, type PieceSymbol, type Move } from "chess.js";
import { kingSquare, type MoveEvent } from "../shared/events.js";
import { skins, type SkinId } from "./profile";
import { combatStyles, moveFrame, captureFrame } from "./combat";
import { createAvatar, animateAvatar } from "./avatar";
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
      if (child instanceof THREE.InstancedMesh) child.dispose();
      if (!child.userData.sharedGeometry) geometries.add(child.geometry);
      for (const m of Array.isArray(child.material)
        ? child.material
        : [child.material])
        if (!child.userData.sharedMaterial) materials.add(m);
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
function buildPiece(type: PieceSymbol, color: "w" | "b", skin: SkinId) {
  const group = new THREE.Group();
  const palette = color === "w" ? skins[skin].white : skins[skin].black;
  const body = material(palette[0], 0.55);
  const accent = material(palette[1], 0.6);
  mesh(new THREE.CylinderGeometry(0.27, 0.33, 0.13, 24), body, group, 0, 0.1);
  mesh(new THREE.CylinderGeometry(0.12, 0.23, 0.38, 24), body, group, 0, 0.34);
  mesh(
    new THREE.TorusGeometry(0.2, 0.035, 8, 24),
    accent,
    group,
    0,
    0.17,
  ).rotation.x = Math.PI / 2;
  if (type === "p") {
    if (skin === "ember") mesh(new THREE.OctahedronGeometry(0.22), accent, group, 0, 0.68);
    else if (skin === "frost") mesh(new THREE.ConeGeometry(0.19, 0.36, 6), accent, group, 0, 0.69);
    else {
      mesh(new THREE.SphereGeometry(0.18, 20, 12), body, group, 0, 0.65);
      if (skin === "astral") mesh(new THREE.TorusGeometry(0.23, 0.025, 6, 16), accent, group, 0, 0.73).rotation.x = Math.PI / 2.5;
      if (skin === "royal") for (let i = 0; i < 5; i++) {
        const angle = i * Math.PI * 2 / 5;
        mesh(new THREE.ConeGeometry(0.045, 0.14, 4), accent, group, Math.cos(angle) * 0.13, 0.85, Math.sin(angle) * 0.13);
      }
    }
  }
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
    const silhouette = new THREE.Shape();
    silhouette.moveTo(-0.16, 0.47); silhouette.lineTo(0.18, 0.47);
    silhouette.quadraticCurveTo(0.08, 0.65, 0.13, 0.78);
    silhouette.lineTo(0.3, 0.8); silhouette.lineTo(0.32, 0.94);
    silhouette.lineTo(0.17, 1.04); silhouette.lineTo(0.09, 1.13);
    silhouette.lineTo(0.025, 1.04);
    silhouette.quadraticCurveTo(-0.2, 0.94, -0.16, 0.47);
    const horse = new THREE.ExtrudeGeometry(silhouette, { depth: 0.2, bevelEnabled: true,
      bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 2, steps: 1, curveSegments: 5 });
    horse.translate(0, 0, -0.1); horse.rotateY(Math.PI / 2);
    mesh(horse, body, group);
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
  // Each family changes every class's silhouette. All parts still merge into
  // the same body/accent batches below, including mixed armies.
  if (skin !== "classic") {
    const height = type === "p" ? 0.48 : type === "r" ? 0.6 : 0.7;
    if (skin === "ember") {
      for (const direction of [-1, 1]) {
        const fin = mesh(new THREE.ConeGeometry(0.1, type === "r" ? 0.34 : 0.25, 3), accent, group, direction * 0.24, height + 0.13, 0);
        fin.rotation.z = direction * -0.45;
      }
      mesh(new THREE.OctahedronGeometry(0.075), accent, group, 0, height, -0.19);
    } else if (skin === "frost") {
      for (const direction of [-1, 1]) mesh(new THREE.OctahedronGeometry(0.1), accent, group, direction * 0.22, height, 0);
      const plate = mesh(new THREE.BoxGeometry(0.21, 0.14, 0.06), accent, group, 0, height + 0.09, -0.17);
      plate.rotation.z = Math.PI / 4;
    } else if (skin === "astral") {
      const orbit = mesh(new THREE.TorusGeometry(type === "p" ? 0.26 : 0.33, 0.017, 4, 24), accent, group, 0, height + 0.2);
      orbit.rotation.x = 0.5;
      for (const direction of [-1, 1]) mesh(new THREE.OctahedronGeometry(0.055), accent, group, direction * 0.27, height + 0.3, 0);
    } else if (skin === "royal") {
      for (const direction of [-1, 1]) {
        const wing = mesh(new THREE.BoxGeometry(0.06, 0.28, 0.09), accent, group, direction * 0.25, height + 0.1, 0.1);
        wing.rotation.z = direction * -0.6;
      }
      const seal = mesh(new THREE.TorusGeometry(0.25, 0.025, 4, 20), accent, group, 0, 0.29);
      seal.rotation.x = Math.PI / 2;
    }
  }
  return group;
}
const pieceAssets = new Map<string, { geometry: THREE.BufferGeometry; material: THREE.Material }[]>();
function makePiece(type: PieceSymbol, color: "w" | "b", skin: SkinId = "classic") {
  const key = type + color + skin;
  let assets = pieceAssets.get(key);
  if (!assets) {
    const source = buildPiece(type, color, skin);
    source.rotation.y = 0;
    source.updateMatrixWorld(true);
    const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
    source.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const mat = child.material as THREE.Material;
      const geometries = batches.get(mat) || [];
      geometries.push(child.geometry.clone().applyMatrix4(child.matrixWorld));
      batches.set(mat, geometries);
    });
    assets = [...batches].map(([mat, geometries]) => {
      // Crystal polyhedra have unindexed vertices; cylinders/torus meshes use indices.
      const mixedIndices = geometries.some((g) => !!g.index !== !!geometries[0].index);
      const prepared = mixedIndices ? geometries.map((g) => g.index ? g.toNonIndexed() : g) : geometries;
      const geometry = mergeGeometries(prepared);
      if (!geometry) throw Error("Cannot merge procedural piece geometry");
      new Set([...geometries, ...prepared]).forEach((g) => g.dispose());
      return { geometry, material: mat.clone() };
    });
    disposeObject(source);
    pieceAssets.set(key, assets);
  }
  const group = new THREE.Group();
  for (const asset of assets) {
    const part = mesh(asset.geometry, asset.material, group);
    part.userData.sharedGeometry = true;
    part.userData.sharedMaterial = true;
  }
  if (type === "n" && color === "b") group.rotation.y = Math.PI;
  return group;
}
export type GraphicsQuality = "auto" | "low" | "high";
function battleColor(color: "w" | "b", story?: string, skin: SkinId = "classic") {
  return story === "comeback" ? 0xffc06b : story === "queen-fallen" ? 0xbb8dff : (color === "w" ? skins[skin].white : skins[skin].black)[1];
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
  died: boolean;
  skin: SkinId;
  stop: THREE.Vector3;
  avatar?: THREE.Group;
  guard?: THREE.Mesh;
  victimOrigin?: THREE.Vector3;
  victimRotation?: THREE.Euler;
  weaponsGroup?: THREE.Group;
  dramatic: boolean;
  weapons: boolean;
  launched: boolean;
  lock?: THREE.Group;
  trail?: THREE.LineSegments;
  cracks?: { dark: THREE.Mesh; core: THREE.LineSegments; stops: number[] };
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
  readonly groundAuras = new THREE.Group();
  readonly groundScars = new THREE.Group();
  animation: Animation | null = null;
  reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  cinematic = true;
  cinematicScope: CinematicScope = "key";
  flipped = false;
  skin: SkinId = "classic";
  private appearances: Record<string, SkinId> = {};
  private afterAppearances?: Record<string, SkinId>;
  private showcaseHost: HTMLElement | null = null;
  private showcaseFocus: Square | null = null;
  private resizeObserver: ResizeObserver;
  private celebration?: {
    key: string; start: number; group: THREE.Group; crown?: THREE.Mesh;
    actors: { object: THREE.Object3D; position: THREE.Vector3; rotation: THREE.Euler; scale: THREE.Vector3; lift: number }[];
  };
  setAppearances(appearances: Record<string, SkinId>, afterAppearances?: Record<string, SkinId>) {
    this.appearances = { ...appearances };
    this.afterAppearances = afterAppearances ? { ...afterAppearances } : undefined;
  }
  private paused = false;
  setPaused(paused: boolean) {
    this.paused = paused;
    this.controls.enabled = (!paused || !!this.showcaseHost) && !this.animation;
    this.dirty = true;
  }
  setSkin(skin: SkinId) {
    this.skin = skin;
    this.stage.dataset.skin = skin;
  }
  celebrate(winner: "w" | "b" | null, mvpSquare?: Square) {
    if (this.animation) return;
    const key = `${winner || "draw"}:${mvpSquare || ""}`;
    if (this.celebration?.key === key) return;
    this.clearCelebration();
    if (!winner) return;
    const king = this.pieces.children.find((piece) => piece.userData.piece === "k" && piece.userData.color === winner);
    const mvp = mvpSquare ? this.pieces.children.find((piece) => piece.userData.square === mvpSquare && piece.userData.color === winner) : undefined;
    const star = mvp || king;
    if (!star) return;
    const group = new THREE.Group(); group.name = "victory-pose";
    group.position.copy(star.position);
    this.scene.add(group);
    const color = battleColor(winner, undefined, star.userData.skin || this.skin);
    const halo = mesh(new THREE.RingGeometry(0.44, 0.47, combatStyles[star.userData.piece as PieceSymbol].sides), this.glow(color, 0.42), group, 0, 0.025);
    halo.rotation.x = -Math.PI / 2;
    halo.castShadow = halo.receiveShadow = false;
    let crown: THREE.Mesh | undefined;
    if (!this.reduced) {
      const geometry: THREE.BufferGeometry[] = [];
      for (let i = 0; i < 5; i++) {
        const angle = i * Math.PI * 2 / 5;
        const point = new THREE.ConeGeometry(0.035, i % 2 ? 0.12 : 0.17, 4);
        point.translate(Math.cos(angle) * 0.2, 0.08, Math.sin(angle) * 0.2);
        geometry.push(point);
      }
      const ring = new THREE.TorusGeometry(0.23, 0.014, 4, 20); ring.rotateX(Math.PI / 2);
      geometry.push(ring);
      const merged = mergeGeometries(geometry)!;
      geometry.forEach((part) => part.dispose());
      crown = mesh(merged, this.glow(color, 0.5), group, 0, star.userData.piece === "p" ? 1.05 : 1.4);
      crown.castShadow = crown.receiveShadow = false;
    }
    const actors = [...new Set([king, mvp].filter((actor): actor is THREE.Object3D => !!actor))].map((object) => ({
      object, position: object.position.clone(), rotation: object.rotation.clone(), scale: object.scale.clone(),
      lift: this.reduced ? 0 : object === star ? 0.085 : 0.035,
    }));
    this.celebration = { key, start: performance.now(), group, crown, actors };
    this.stage.dataset.victoryPose = winner;
    this.dirty = true;
  }
  clearCelebration() {
    if (!this.celebration) return;
    for (const actor of this.celebration.actors) {
      actor.object.position.copy(actor.position);
      actor.object.rotation.copy(actor.rotation);
      actor.object.scale.copy(actor.scale);
    }
    disposeObject(this.celebration.group);
    this.celebration = undefined;
    delete this.stage.dataset.victoryPose;
    this.renderer.shadowMap.needsUpdate = true;
    this.dirty = true;
  }
  private animateCelebration(now: number) {
    const celebration = this.celebration;
    if (!celebration) return;
    const progress = this.reduced ? 1 : Math.max(0, Math.min(1, (now - celebration.start) / 1200));
    const ease = progress * progress * (3 - 2 * progress);
    for (const actor of celebration.actors) {
      actor.object.position.copy(actor.position); actor.object.position.y += actor.lift * ease;
      actor.object.scale.copy(actor.scale).multiplyScalar(this.reduced ? 1 : 1 + ease * 0.035);
      actor.object.rotation.copy(actor.rotation);
      if (!this.reduced) actor.object.rotation.y += Math.sin(progress * Math.PI) * 0.1;
    }
    if (celebration.crown) {
      celebration.crown.rotation.y = ease * 0.6;
      (celebration.crown.material as THREE.MeshBasicMaterial).opacity = ease * 0.5;
    }
    if (progress < 1) {
      this.dirty = true;
      this.renderer.shadowMap.needsUpdate = true;
    }
  }
  onPick: (s: Square) => void = () => {};
  onFinish: () => void = () => {};
  onImpact: (move: Move, event: MoveEvent) => void = () => {};
  onDash: (move: Move, event: MoveEvent) => void = () => {};
  onDeath: (move: Move, event: MoveEvent) => void = () => {};
  onCancel: () => void = () => {};
  private overlay: BattleOverlay;
  private sparks: {
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    life: number;
    size: number;
  }[] = [];
  private particleMesh: THREE.InstancedMesh | undefined;
  private particleMatrix = new THREE.Matrix4();
  private previous = performance.now();
  private dirty = true;
  private lastRender = 0;
  private lastAuraDraw = 0;
  private quality: GraphicsQuality = "auto";
  private resolution = 1;
  private slowFrames = 0;
  private lastDramaticPly = -100;
  resetPacing() { this.lastDramaticPly = -100; clear(this.groundScars); }
  constructor(private stage: HTMLElement) {
    this.scene.background = new THREE.Color("#080d16");
    this.scene.fog = new THREE.Fog("#080d16", 19, 35);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.setQuality("auto");
    this.stage.prepend(this.renderer.domElement);
    this.overlay = new BattleOverlay(stage);
    this.camera.position.set(0, 10, 10);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
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
    this.scene.add(this.board, this.pieces, this.markers, this.fx, this.groundAuras, this.groundScars);
    const tileGeometry = new THREE.BoxGeometry(0.98, 0.16, 0.98);
    for (const parity of [0, 1]) {
      const tiles = new THREE.InstancedMesh(tileGeometry, material(parity ? 0x1a2b40 : 0x58738b), 32);
      const squares: Square[] = [];
      for (let rank = 1; rank <= 8; rank++)
        for (let file = 0; file < 8; file++) {
          if ((rank + file) % 2 !== parity) continue;
          const square = `${String.fromCharCode(97 + file)}${rank}` as Square;
          const p = coords(square);
          tiles.setMatrixAt(squares.length, new THREE.Matrix4().makeTranslation(p.x, -0.08, p.z));
          squares.push(square);
        }
      tiles.userData.squares = squares;
      tiles.receiveShadow = true;
      this.board.add(tiles);
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
        this.showcaseHost || this.paused ||
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
        if (hit.object instanceof THREE.InstancedMesh && hit.instanceId !== undefined) {
          this.onPick(hit.object.userData.squares[hit.instanceId]);
          return;
        }
        let o: THREE.Object3D | null = hit.object;
        while (o && !o.userData.square) o = o.parent;
        if (o?.userData.square) {
          this.onPick(o.userData.square);
          return;
        }
      }
    });
    this.resizeObserver = new ResizeObserver(() => {
      const surface = this.showcaseHost || this.stage;
      const w = surface.clientWidth,
        h = surface.clientHeight;
      if (!w || !h) return;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      this.finish();
      this.resetView();
      this.dirty = true;
    });
    this.resizeObserver.observe(this.stage);
    this.renderer.setAnimationLoop((time) => this.frame(time));
  }
  setShowcase(host: HTMLElement | null) {
    if (host === this.showcaseHost) { this.resizeSurface(); return; }
    this.finish();
    if (this.showcaseHost) this.resizeObserver.unobserve(this.showcaseHost);
    this.showcaseHost = host;
    this.showcaseFocus = null;
    this.controls.minDistance = host ? 3 : 7;
    (host || this.stage).prepend(this.renderer.domElement);
    if (host) this.resizeObserver.observe(host);
    this.controls.enabled = (!!host || !this.paused) && !this.animation;
    this.markers.visible = !host;
    this.resizeSurface();
  }
  showcasePiece(square: Square | null) {
    this.showcaseFocus = square;
    this.resetView();
    this.dirty = true;
  }
  private resizeSurface() {
    const surface = this.showcaseHost || this.stage;
    const w = surface.clientWidth, h = surface.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.resetView();
    this.dirty = true;
  }
  setQuality(quality: GraphicsQuality) {
    this.quality = quality;
    this.resolution = Math.min(devicePixelRatio, quality === "high" ? 1.7 : quality === "low" ? 1 : 1.25);
    this.renderer.setPixelRatio(this.resolution);
    this.renderer.shadowMap.enabled = quality !== "low";
    this.renderer.shadowMap.needsUpdate = true;
    this.slowFrames = 0;
    this.dirty = true;
    this.stage.dataset.graphics = quality;
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
    this.renderer.shadowMap.needsUpdate = true;
    this.cancel();
    clear(this.pieces);
    clear(this.markers);
    clear(this.groundAuras);
    if (game.fen() === new Chess().fen() || this.reduced) clear(this.groundScars);
    for (const row of game.board())
      for (const p of row)
        if (p) {
          const skin = this.appearances[p.square] || this.skin;
          const o = makePiece(p.type, p.color, skin);
          o.position.copy(coords(p.square));
          o.userData.square = p.square;
          o.userData.skin = skin;
          o.userData.piece = p.type;
          o.userData.color = p.color;
          if (p.type === "k" && p.color === game.turn() && game.isCheckmate()) {
            o.rotation.z = -Math.PI / 3;
            o.position.y = 0.05;
          }
          this.pieces.add(o);
        }
    if (!this.reduced) this.buildGroundAuras(game);
    if (game.isCheck()) {
      const k = kingSquare(game, game.turn());
      if (k) this.ring(k, 0xff557a, 0.38);
    }
  }
  private buildGroundAuras(game: Chess) {
    // All 32 breathing runes share one shader clock and two color batches.
    for (const color of ["w", "b"] as const) {
      const geometries: THREE.BufferGeometry[] = [];
      for (const piece of game.board().flat()) {
        if (!piece || piece.color !== color) continue;
        const p = coords(piece.square);
        const skin = this.appearances[piece.square] || this.skin;
        const tier = skins[skin].tier;
        const sides = combatStyles[piece.type].sides;
        const rings = [[0.39, skin === "frost" ? 6 : sides, 0], [0.31, 24, 0], [0.46, 24, 1]];
        if (tier >= 3) rings.push([0.44, skin === "royal" ? 8 : 32, 0]);
        const auraColor = new THREE.Color(battleColor(piece.color, undefined, skin));
        for (const [radius, segments, glow] of rings) {
          const geometry = new THREE.RingGeometry(glow ? 0 : radius - 0.014, radius, segments, glow ? 4 : 1);
          geometry.rotateX(-Math.PI / 2);
          geometry.translate(p.x, 0.018, p.z);
          const count = geometry.getAttribute("position").count;
          const centers = new Float32Array(count * 3), flags = new Float32Array(count), colors = new Float32Array(count * 3), tiers = new Float32Array(count);
          for (let i = 0; i < count; i++) {
            centers.set([p.x, sides + p.z * 2, p.z], i * 3); flags[i] = glow;
            colors.set([auraColor.r, auraColor.g, auraColor.b], i * 3); tiers[i] = tier;
          }
          geometry.setAttribute("aCenter", new THREE.BufferAttribute(centers, 3));
          geometry.setAttribute("aGlow", new THREE.BufferAttribute(flags, 1));
          geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
          geometry.setAttribute("aTier", new THREE.BufferAttribute(tiers, 1));
          geometries.push(geometry);
        }
      }
      if (!geometries.length) continue;
      const merged = mergeGeometries(geometries)!;
      geometries.forEach((g) => g.dispose());
      const material = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: performance.now() / 1000 }, uColor: { value: new THREE.Color(0xffffff) } },
        vertexShader: `attribute vec3 aCenter; attribute float aGlow; attribute vec3 aColor; attribute float aTier; uniform float uTime;
          varying vec2 vLocal; varying float vPhase; varying float vGlow; varying vec3 vColor; varying float vTier;
          void main() { vec3 p = position; vec2 local = p.xz - aCenter.xz;
            float angle = uTime * (aTier > 2.5 ? -0.17 : 0.13) + aCenter.y * 0.2;
            float c = cos(angle), s = sin(angle);
            p.xz = aCenter.xz + mat2(c,-s,s,c) * local;
            vLocal = local; vPhase = aCenter.y; vGlow = aGlow; vColor = aColor; vTier = aTier;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0); }`,
        fragmentShader: `uniform vec3 uColor; uniform float uTime;
          varying vec2 vLocal; varying float vPhase; varying float vGlow; varying vec3 vColor; varying float vTier;
          void main() { float pulse = 0.65 + 0.2 * sin(uTime * 1.7 + vPhase);
            float alpha = vGlow > 0.5 ? pow(max(0.0,1.0-length(vLocal)/0.46),2.0) * 0.65 : 0.5;
            gl_FragColor = vec4(uColor * vColor, alpha * pulse * (0.85 + vTier * 0.05));
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, forceSinglePass: true,
      });
      const rune = mesh(merged, material, this.groundAuras);
      rune.castShadow = rune.receiveShadow = false;
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
    if (!this.reduced) {
      const piece = game.get(s)!;
      const halo = mesh(new THREE.RingGeometry(0.46, 0.49, combatStyles[piece.type].sides),
        this.glow(battleColor(piece.color, undefined, this.appearances[s] || this.skin), 0.7), this.markers);
      halo.position.copy(coords(s)); halo.position.y = 0.022;
      halo.rotation.x = -Math.PI / 2;
    }
    for (const m of game.moves({ square: s, verbose: true }))
      this.ring(m.to, m.captured ? 0xff657c : 0x58e5d1);
  }
  resetView(flip = this.flipped) {
    this.flipped = flip;
    if (this.showcaseHost && this.showcaseFocus) {
      const focus = coords(this.showcaseFocus);
      this.camera.position.copy(focus).add(new THREE.Vector3(1.9, 2.5, 3.1));
      this.controls.target.copy(focus).add(new THREE.Vector3(0, 0.55, 0));
      this.controls.update();
      return;
    }
    if (this.camera.aspect < 0.8) {
      const radius = Math.max(12, 4.6 / (Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.aspect));
      this.camera.position.set(0, radius * 0.96, radius * (flip ? -0.28 : 0.28));
    } else {
      const distance = Math.max(10, (10 * 1.05) / this.camera.aspect);
      this.camera.position.set(0, distance, flip ? -distance : distance);
    }
    // Portrait framing needs distance to fit width; fog must not darken the far army.
    const fog = this.scene.fog as THREE.Fog;
    fog.near = this.camera.position.length() + 6; fog.far = fog.near + 18;
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }
  cancel() {
    this.clearCelebration();
    this.dirty = true;
    if (this.animation) {
      this.camera.position.copy(this.animation.camera);
      this.controls.target.copy(this.animation.target);
      const cracks = this.animation.cracks;
      if (cracks?.core.parent) {
        if (!cracks.core.geometry.drawRange.count) disposeObject(cracks.core.parent);
        else { cracks.core.parent.userData.active = false; cracks.core.parent.userData.born = performance.now(); }
      }
    }
    this.camera.lookAt(this.controls.target);
    this.animation = null;
    this.overlay.clear();
    delete this.stage.dataset.movePhase;
    delete this.stage.dataset.attackStyle;
    delete this.stage.dataset.executionPhase;
    delete this.stage.dataset.defenderStatus;
    this.renderer.toneMappingExposure = 1;
    this.onCancel();
    this.controls.enabled = !this.paused || !!this.showcaseHost;
    clear(this.fx);
    this.sparks = [];
    this.particleMesh = undefined;
  }
  finish() {
    if (!this.animation) return;
    const game = this.animation.after;
    if (this.afterAppearances) { this.appearances = this.afterAppearances; this.afterAppearances = undefined; }
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
    const ply = after.history().length;
    const skin = object.userData.skin as SkinId || this.skin;
    const from = coords(move.from), to = coords(move.to);
    const direction = to.clone().sub(from).normalize();
    const stopDistance = Math.min(from.distanceTo(to) * 0.68, move.piece === "r" || move.piece === "b" ? 1.05 : 0.77);
    const stop = to.clone().addScaledVector(direction, -stopDistance);
    const urgent = ["mate", "promotion", "rescue"].includes(event.kind) ||
      ["queen-fallen", "comeback"].includes(event.story || "");
    const dramatic =
      this.cinematic && !this.reduced &&
      useDramaticCamera(move, event, this.cinematicScope) &&
      (this.cinematicScope === "all" || urgent || ply - this.lastDramaticPly >= 4);
    if (dramatic) this.lastDramaticPly = ply;
    this.animation = {
      object,
      victim,
      from, to, stop, skin,
      start: performance.now(),
      duration: this.reduced
        ? 180
        : event.kind === "mate"
          ? dramatic
            ? 3800
            : 1000
          : move.captured ? dramatic ? 2800 : 1400
          : event.kind !== "move"
            ? dramatic
              ? 2800
              : 1150
            : 780,
      move,
      event,
      after,
      impacted: false,
      died: false,
      dramatic,
      weapons: false,
      launched: false,
      rotation: object.rotation.y,
      camera: this.camera.position.clone(),
      target: this.controls.target.clone(),
      rook,
      victimOrigin: victim?.position.clone(),
      victimRotation: victim?.rotation.clone(),
    };
    this.controls.enabled = false;
    if (!this.reduced) {
      this.stage.dataset.attackStyle = move.piece;
      this.animation.aura = this.chargeAura(this.animation);
      this.animation.lock = this.targetLock(this.animation);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(24 * 6), 3).setUsage(THREE.DynamicDrawUsage));
      const trail = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
        color: battleColor(move.color, event.story, skin), transparent: true,
        opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      trail.frustumCulled = false;
      this.fx.add(trail); this.animation.trail = trail;
      this.animation.cracks = this.groundCracks(this.animation);
      if (victim) {
        this.animation.avatar = createAvatar(move.piece, move.color, skin);
        this.fx.add(this.animation.avatar);
        const guard = mesh(new THREE.SphereGeometry(0.48, 12, 8), this.glow(battleColor(move.color === "w" ? "b" : "w", undefined, victim.userData.skin || this.skin), 0.18), this.fx);
        guard.name = "defender-guard"; guard.position.copy(victim.position); guard.position.y = 0.48;
        guard.scale.z = 0.55;
        this.animation.guard = guard;
        // The attacker/cached board meshes retain shared materials; only the
        // animated defender needs independent opacity for the defeat sequence.
        victim.traverse((part) => {
          if (!(part instanceof THREE.Mesh)) return;
          part.material = (part.material as THREE.Material).clone();
          part.userData.sharedMaterial = false;
          part.material.transparent = true;
        });
      }
    }
  }
  private groundCracks(a: Animation) {
    while (this.groundScars.children.length >= 4) disposeObject(this.groundScars.children[0]);
    const group = new THREE.Group(); group.name = "energy-fracture";
    group.userData.born = performance.now(); group.userData.active = true;
    const lines: number[] = [], ribbons: number[] = [], stops: number[] = [];
    const distance = a.from.distanceTo(a.to), steps = Math.min(7, Math.max(2, Math.ceil(distance)));
    const sides = combatStyles[a.move.piece].sides;
    const segment = (p: THREE.Vector3, q: THREE.Vector3) => {
      p.x = Math.max(-3.98, Math.min(3.98, p.x)); p.z = Math.max(-3.98, Math.min(3.98, p.z));
      q.x = Math.max(-3.98, Math.min(3.98, q.x)); q.z = Math.max(-3.98, Math.min(3.98, q.z));
      lines.push(p.x, 0.03, p.z, q.x, 0.03, q.z);
      const side = new THREE.Vector3(-(q.z - p.z), 0, q.x - p.x).normalize().multiplyScalar(0.018);
      for (const vertex of [p.clone().add(side), p.clone().sub(side), q.clone().add(side),
        q.clone().add(side), p.clone().sub(side), q.clone().sub(side)]) ribbons.push(vertex.x, 0.024, vertex.z);
    };
    for (let step = 0; step <= steps; step++) {
      const root = a.from.clone().lerp(a.to, step / steps);
      const radius = step === steps ? a.victim ? 0.5 : 0.32 : 0.22;
      for (let i = 0; i < sides; i++) {
        const angle = i * Math.PI * 2 / sides + step * 0.7;
        const elbow = root.clone().add(new THREE.Vector3(Math.cos(angle) * radius * 0.5, 0, Math.sin(angle) * radius * 0.5));
        const tip = root.clone().add(new THREE.Vector3(Math.cos(angle + 0.3) * radius, 0, Math.sin(angle + 0.3) * radius));
        segment(root.clone(), elbow); segment(elbow.clone(), tip);
        if (i % 2 === 0) segment(elbow.clone(), elbow.clone().add(new THREE.Vector3(Math.cos(angle - 0.7) * radius * 0.35, 0, Math.sin(angle - 0.7) * radius * 0.35)));
      }
      stops.push(lines.length / 3);
    }
    const lineGeometry = new THREE.BufferGeometry(); lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(lines, 3));
    const darkGeometry = new THREE.BufferGeometry(); darkGeometry.setAttribute("position", new THREE.Float32BufferAttribute(ribbons, 3));
    lineGeometry.setDrawRange(0, 0); darkGeometry.setDrawRange(0, 0);
    const dark = mesh(darkGeometry, new THREE.MeshBasicMaterial({ color: 0x020711, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true }), group);
    dark.castShadow = dark.receiveShadow = false;
    const core = new THREE.LineSegments(lineGeometry, new THREE.LineBasicMaterial({ color: battleColor(a.move.color, undefined, a.skin), transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false }));
    group.add(core); this.groundScars.add(group);
    return { dark, core, stops };
  }
  private targetLock(a: Animation) {
    const group = new THREE.Group();
    group.name = a.victim ? "enemy-lock" : "destination-lock";
    group.position.copy(a.to); group.position.y = 0.04;
    const color = a.victim ? 0xff657c : battleColor(a.move.color, undefined, a.skin);
    const ring = mesh(new THREE.RingGeometry(0.42, 0.45, combatStyles[a.move.piece].sides), this.glow(color, 0.8), group);
    ring.rotation.x = -Math.PI / 2;
    const vertices: number[] = [];
    for (const x of [-1, 1]) for (const z of [-1, 1]) {
      vertices.push(x * 0.55, 0, z * 0.32, x * 0.55, 0, z * 0.55,
        x * 0.55, 0, z * 0.55, x * 0.32, 0, z * 0.55);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    group.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 })));
    this.fx.add(group);
    return group;
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
  private weapon(a: Animation) {
    const color = battleColor(a.move.color, undefined, a.skin);
    const p = a.to;
    const group = new THREE.Group(); group.name = `execution-${a.move.piece}-${a.skin}`;
    group.position.copy(p); this.fx.add(group);
    const add = (geometry: THREE.BufferGeometry, x = 0, y = 0, z = 0) => mesh(geometry, this.glow(color, 0.85), group, x, y, z);
    const direction = a.to.clone().sub(a.stop).normalize();
    if (a.move.piece === "p") {
      const spear = add(new THREE.CylinderGeometry(0.045, 0.065, 1.65, 6), 0, 0.58);
      spear.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
      const point = add(new THREE.ConeGeometry(0.13, 0.4, 4), direction.x * 0.66, 0.58, direction.z * 0.66);
      point.quaternion.copy(spear.quaternion);
    }
    if (a.move.piece === "n") {
      for (let i = 0; i < (skins[a.skin].tier >= 3 ? 3 : 2); i++) {
        const slash = add(new THREE.TorusGeometry(0.75 + i * 0.09, 0.025, 4, 24, Math.PI * 1.25), 0, 0.52 + i * 0.08);
        slash.rotation.set(0.4, i * 0.6, -0.8 + i * 1.4);
      }
    }
    if (a.move.piece === "b" || a.move.piece === "r") {
      const origin = a.stop.clone().sub(p).add(new THREE.Vector3(0, a.move.piece === "b" ? 1.6 : 0.72, 0));
      const destination = new THREE.Vector3(0, 0.5, 0);
      const d = destination.clone().sub(origin);
      const beam = add(new THREE.CylinderGeometry(a.move.piece === "b" ? 0.12 : 0.2, 0.06, d.length(), 8));
      beam.position.copy(origin).add(destination).multiplyScalar(0.5);
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      for (let i = 0; i < (a.move.piece === "b" ? 3 : 2); i++) {
        const circle = add(new THREE.TorusGeometry(0.38 + i * 0.13, 0.025, 4, 24), 0, 0.13 + i * 0.06);
        circle.rotation.x = Math.PI / 2;
      }
    }
    if (a.move.piece === "q") {
      for (let i = 0; i < 6; i++) {
        const angle = i * Math.PI / 3;
        const blade = add(new THREE.ConeGeometry(0.08, 0.9, 4), Math.cos(angle) * 0.8, 1.4, Math.sin(angle) * 0.8);
        blade.rotation.z = Math.PI; blade.userData.cageBlade = angle;
      }
    }
    if (a.move.piece === "k") {
      const sword = add(new THREE.BoxGeometry(0.17, 1.9, 0.07), 0, 1.4);
      sword.rotation.z = -0.6; sword.userData.regalBlade = true;
      add(new THREE.BoxGeometry(0.62, 0.08, 0.1), 0.23, 1.8);
    }
    if (a.skin === "ember") {
      for (let i = 0; i < 3; i++) {
        const flame = add(new THREE.ConeGeometry(0.09, 0.7, 3), Math.cos(i * 2.1) * 0.45, 0.6, Math.sin(i * 2.1) * 0.45);
        flame.rotation.z = 0.2; flame.userData.family = "ember";
      }
    } else if (a.skin === "frost") {
      for (let i = 0; i < 3; i++) {
        const crystal = add(new THREE.OctahedronGeometry(0.17), Math.cos(i * 2.1) * 0.55, 0.25, Math.sin(i * 2.1) * 0.55);
        crystal.userData.family = "frost";
      }
    } else if (a.skin === "astral" || a.skin === "royal") {
      const seal = add(new THREE.TorusGeometry(a.skin === "royal" ? 0.85 : 0.65, 0.025, 4, a.skin === "royal" ? 8 : 32), 0, 0.05);
      seal.rotation.x = Math.PI / 2; seal.userData.family = a.skin;
      if (a.skin === "royal") for (const side of [-1, 1]) {
        const wing = add(new THREE.ConeGeometry(0.17, 0.85, 3), side * 0.85, 0.65);
        wing.rotation.z = side * -0.65; wing.userData.family = "royal";
      }
    }
    return group;
  }
  private animateExecution(a: Animation, t: number) {
    const frame = captureFrame(t);
    const direction = a.to.clone().sub(a.from).normalize();
    const skinTier = skins[a.skin].tier;
    if (a.avatar) {
      a.avatar.position.lerpVectors(a.from, a.stop, frame.approach);
      a.avatar.position.addScaledVector(direction, frame.strike * 0.15);
      a.avatar.position.y = a.move.piece === "n" ? Math.sin(frame.approach * Math.PI) * 1.2
        : a.move.piece === "q" || a.move.piece === "b" ? 0.15 : 0;
      a.avatar.rotation.y = Math.atan2(-direction.x, -direction.z);
      const fade = Math.min(1, t / 0.12) * Math.max(0, 1 - (t - 0.7) / 0.18);
      const scale = 0.75 + skinTier * 0.075;
      a.avatar.scale.setScalar(scale);
      animateAvatar(a.avatar, a.move.piece, frame.charge, frame.strike, fade, t * a.duration / 1000);
    }
    if (a.guard) {
      a.guard.visible = t >= 0.2 && t < 0.66;
      a.guard.scale.setScalar(0.8 + frame.strike * 0.28);
      (a.guard.material as THREE.MeshBasicMaterial).opacity = t < 0.56 ? 0.16 + Math.sin(t * 35) * 0.05 : Math.max(0, (0.66 - t) * 2.5);
    }
    if (a.victim && a.victimOrigin && a.victimRotation) {
      const heavy = a.victim.userData.piece === "r" || a.victim.userData.piece === "k";
      const recoil = a.impacted ? (heavy ? 0.12 : 0.22) : -Math.sin(Math.max(0, t - 0.3) * 15) * 0.025;
      a.victim.position.copy(a.victimOrigin).addScaledVector(direction, recoil);
      a.victim.rotation.copy(a.victimRotation);
      if (a.impacted) {
        const defeat = frame.defeat;
        if (a.move.piece === "p") { a.victim.rotation.z = defeat * 0.85; a.victim.position.addScaledVector(direction, defeat * 0.18); }
        if (a.move.piece === "n") { a.victim.rotation.x = defeat * -0.9; a.victim.position.addScaledVector(direction, defeat * 0.3); }
        if (a.move.piece === "b") { a.victim.position.y = defeat * 0.85; a.victim.rotation.y += defeat * 1.5; }
        if (a.move.piece === "r") { a.victim.position.addScaledVector(direction, defeat * 0.45); a.victim.rotation.z = defeat * 1.3; }
        if (a.move.piece === "q") { a.victim.scale.setScalar(1 - defeat * 0.5); a.victim.position.y = defeat * 0.22; }
        if (a.move.piece === "k") { a.victim.rotation.z = defeat * -1.2; a.victim.position.y = -defeat * 0.15; }
        a.victim.traverse((part) => {
          if (part instanceof THREE.Mesh) {
            const mat = part.material as THREE.MeshStandardMaterial;
            mat.opacity = Math.max(0, 1 - defeat);
            mat.emissive.setHex(battleColor(a.move.color, undefined, a.skin));
            mat.emissiveIntensity = 0.3 + defeat * 2;
          }
        });
      }
    }
    if (a.weaponsGroup) {
      const fade = t < 0.64 ? Math.min(1, frame.strike * 2) : Math.max(0, 1 - (t - 0.64) / 0.2);
      a.weaponsGroup.traverse((part) => {
        if (part instanceof THREE.Mesh) (part.material as THREE.MeshBasicMaterial).opacity = fade * 0.85;
        if (part.userData.cageBlade !== undefined) {
          const angle = part.userData.cageBlade;
          const radius = 0.8 - frame.strike * 0.55;
          part.position.set(Math.cos(angle) * radius, 1.4 - frame.strike * 0.8, Math.sin(angle) * radius);
          part.rotation.z = Math.PI + frame.strike * 0.35;
        }
        if (part.userData.regalBlade) part.rotation.z = -0.6 - frame.strike * 1.4;
        if (part.userData.family === "astral") part.rotation.z = t * 5;
        if (part.userData.family === "frost") part.scale.y = 0.4 + frame.strike * 1.8;
        if (part.userData.family === "ember") part.scale.y = 0.8 + Math.sin(t * 70) * 0.3;
      });
    }
  }
  private death(a: Animation) {
    this.onDeath(a.move, a.event);
    if (this.reduced) { if (a.victim) a.victim.visible = false; return; }
    const color = battleColor(a.move.color, a.event.story, a.skin);
    const tier = skins[a.skin].tier;
    const count = Math.min(72, (a.dramatic ? 42 : 26) + tier * 5);
    this.particleMesh = new THREE.InstancedMesh(
      a.skin === "frost" ? new THREE.OctahedronGeometry(1) : a.move.piece === "r" ? new THREE.BoxGeometry(1, 1, 1) : new THREE.IcosahedronGeometry(1),
      new THREE.MeshBasicMaterial({ color }), count,
    );
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleMesh.frustumCulled = false;
    this.fx.add(this.particleMesh);
    const direction = a.to.clone().sub(a.from).normalize();
    for (let i = 0; i < count; i++) {
      const angle = i * Math.PI * 2 / count;
      const sideways = a.move.piece === "q" ? 0.6 : a.move.piece === "r" ? 3.8 : a.dramatic ? 4 : 2;
      const upward = a.move.piece === "b" ? 4.5 : a.move.piece === "r" ? 0.5 : 1.7;
      const velocity = new THREE.Vector3(Math.cos(angle) * sideways, upward + Math.random() * 1.5, Math.sin(angle) * sideways);
      if (a.move.piece === "n" || a.move.piece === "p") velocity.addScaledVector(direction, a.move.piece === "n" ? 3.5 : 2);
      if (a.skin === "ember") velocity.y += 1.5;
      if (a.skin === "astral") { velocity.x *= 0.45; velocity.z *= 0.45; velocity.y += 2; }
      if (a.skin === "royal") velocity.y = i % 2 ? 3 : 0.5;
      this.sparks.push({ position: a.to.clone().add(new THREE.Vector3(Math.cos(angle) * 0.18, 0.15 + Math.random() * 0.75, Math.sin(angle) * 0.18)),
        velocity, life: 1, size: (a.move.piece === "r" ? 0.07 : 0.03) + Math.random() * 0.045 });
    }
  }
  private impact(a: Animation) {
    const color = battleColor(a.move.color, a.event.story, a.skin);
    this.onImpact(a.move, a.event);
    if (this.reduced) {
      if (a.victim) { a.died = true; this.death(a); }
      return;
    }
    if (a.event.story === "recapture") {
      for (const angle of [-0.65, 0.65]) {
        const slash = mesh(new THREE.TorusGeometry(0.7, 0.035, 4, 24, Math.PI),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 }),
          this.fx, a.to.x, 0.6, a.to.z);
        slash.rotation.z = angle;
        slash.userData.shock = true;
      }
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
      forceSinglePass: true,
    });
  }
  private chargeAura(a: Animation) {
    const color = battleColor(a.move.color, a.event.story, a.skin);
    const style = combatStyles[a.move.piece];
    const group = new THREE.Group();
    this.fx.add(group);
    group.position.copy(a.from);
    group.name = `charge-${a.move.piece}`;
    for (let i = 0; i < (a.dramatic ? 3 : 2); i++) {
      const ring = mesh(
        new THREE.TorusGeometry(0.44 + i * 0.16, 0.014, 4, i === 0 ? style.sides : 32),
        this.glow(color, 0.7 - i * 0.12),
        group,
        0,
        0.08 + i * 0.12,
      );
      ring.rotation.x = Math.PI / 2;
      ring.userData.auraRing = i;
    }
    const shellGeometry = a.move.piece === "k" ? new THREE.SphereGeometry(0.65, 12, 8)
      : a.move.piece === "q" ? new THREE.TorusGeometry(0.65, 0.035, 4, 32)
      : a.move.piece === "r" ? new THREE.CylinderGeometry(0.5, 0.5, 0.7, 4, 1, true)
      : new THREE.ConeGeometry(0.45, a.move.piece === "b" ? 2.3 : 1.3, style.sides, 1, true);
    const shell = mesh(
      shellGeometry,
      this.glow(color, 0.13),
      group,
      0,
      a.move.piece === "r" ? 0.4 : 0.8,
    );
    shell.userData.auraShell = true;
    const lightning: number[] = [];
    for (let i = 0; i < style.sides; i++) {
      const angle = (i * Math.PI * 2) / style.sides;
      for (let j = 0; j < 3; j++) {
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
    for (let i = 0; i < (a.dramatic ? style.sides : 3); i++) {
      const angle = (i * Math.PI * 2) / style.sides;
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
  private animateAura(a: Animation, t: number, charge: number, travel: number) {
    if (!a.aura) return;
    a.aura.position.lerpVectors(a.from, a.to, travel);
    a.aura.rotation.y = t * (a.move.piece === "q" ? 10 : a.move.piece === "r" ? 0 : 4);
    a.aura.scale.setScalar(0.3 + charge * (a.dramatic ? 0.9 : 0.55));
    a.aura.visible = t < (a.dramatic ? 0.6 : 0.72);
    for (const o of a.aura.children) {
      if (o.userData.auraShard !== undefined)
        o.position.y = 0.2 + ((t * 5 + o.userData.auraShard * 0.22) % 1) * 2;
    }
    if (travel === 0) a.object.scale.setScalar(1 + charge * 0.08);
    else a.object.scale.setScalar(1 + (1 - travel) * 0.08);
  }
  private animateTrail(a: Animation, travel: number) {
    if (!a.trail) return;
    a.trail.visible = travel > 0 && !a.impacted;
    const position = a.trail.geometry.getAttribute("position") as THREE.BufferAttribute;
    const direction = a.to.clone().sub(a.from).normalize();
    const side = new THREE.Vector3(-direction.z, 0, direction.x);
    const point = (progress: number, lane: number) => {
      const p = a.from.clone().lerp(a.to, progress);
      p.y = 0.12 + Math.sin(progress * Math.PI) * combatStyles[a.move.piece].lift;
      if (a.move.piece === "q") p.addScaledVector(side, Math.sin(progress * Math.PI * 3 + lane) * 0.2);
      else p.addScaledVector(side, lane * (a.move.piece === "r" ? 0.15 : 0.045));
      return p;
    };
    for (let i = 0; i < 24; i++) {
      const lane = Math.floor(i / 8) - 1, segment = i % 8;
      const start = Math.max(0, travel - 0.5);
      const p = point(start + (travel - start) * segment / 8, lane);
      const q = point(start + (travel - start) * (segment + 1) / 8, lane);
      position.setXYZ(i * 2, p.x, p.y, p.z); position.setXYZ(i * 2 + 1, q.x, q.y, q.z);
    }
    position.needsUpdate = true;
  }
  private finalStrike(a: Animation) {
    const color = battleColor(a.move.color, a.event.story, a.skin);
    const type = a.move.piece;
    const tier = skins[a.skin].tier;
    const wave = mesh(new THREE.TorusGeometry(0.36, type === "r" ? 0.055 : 0.022, 4,
      a.skin === "frost" ? 6 : type === "q" ? 6 : 32), this.glow(color, 0.45),
      this.fx, a.to.x, 0.055, a.to.z);
    wave.rotation.x = Math.PI / 2; wave.userData.blast = true; wave.userData.layer = type === "r" ? 2 : 0;
    if (type === "p") {
      const direction = a.to.clone().sub(a.stop).normalize();
      const thrust = this.beam(a.stop.clone().add(new THREE.Vector3(0, 0.5, 0)), a.to.clone().addScaledVector(direction, 0.45).add(new THREE.Vector3(0, 0.5, 0)), color, 0.035);
      thrust.userData.pierce = true;
    } else if (type === "n" || type === "k") {
      for (let i = 0; i < (type === "n" ? 2 : 1); i++) {
        const slash = mesh(new THREE.TorusGeometry(type === "n" ? 0.75 : 1.05,
          type === "n" ? 0.032 : 0.065, 4, 32, Math.PI * 1.25), this.glow(color, 0.7),
          this.fx, a.to.x, type === "n" ? 0.55 : 0.85, a.to.z);
        slash.rotation.set(type === "n" ? 0.3 : 0.15, i * 0.5, type === "n" ? -0.8 + i * 1.6 : -0.7);
        slash.userData.slash = true;
      }
    } else if (type === "b") {
      const pillar = mesh(new THREE.CylinderGeometry(0.08, 0.2, 2.6, 12, 1, true),
        this.glow(color, 0.25), this.fx, a.to.x, 1.3, a.to.z);
      pillar.userData.pillar = true;
      for (let i = 0; i < 2; i++) {
        const halo = mesh(new THREE.TorusGeometry(0.36 + i * 0.16, 0.018, 4, 24),
          this.glow(color, 0.4), this.fx, a.to.x, 0.5 + i * 0.45, a.to.z);
        halo.rotation.x = Math.PI / 2; halo.userData.shock = true;
      }
    } else if (type === "r") {
      const shock = mesh(new THREE.ConeGeometry(0.6, 0.7, 8, 1, true), this.glow(color, 0.18),
        this.fx, a.to.x, 0.35, a.to.z);
      shock.userData.shock = true;
    } else if (type === "q") {
      for (let i = 0; i < 6; i++) {
        const angle = i * Math.PI / 3;
        this.beam(a.to.clone().add(new THREE.Vector3(Math.cos(angle) * 0.75, 0.85, Math.sin(angle) * 0.75)),
          a.to.clone().add(new THREE.Vector3(0, 0.4, 0)), color, 0.018);
      }
    }
    const spokes: number[] = [];
    const rayCount = tier >= 3 ? 12 : 6;
    for (let i = 0; i < rayCount; i++) {
      const angle = i * Math.PI * 2 / rayCount;
      const radius = type === "r" ? 1.25 : 0.75 + (i % 3) * 0.15;
      spokes.push(a.to.x + Math.cos(angle) * 0.2, 0.12, a.to.z + Math.sin(angle) * 0.2,
        a.to.x + Math.cos(angle) * radius, 0.12, a.to.z + Math.sin(angle) * radius);
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(spokes, 3));
    this.fx.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color, transparent: true,
      opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending })));
  }
  private directCamera(a: Animation, t: number) {
    const f = cinematicFrame(t);
    const direction = this.flipped ? -1 : 1;
    const actor = a.from.clone().add(new THREE.Vector3(0, a.move.captured ? 1.15 : 0.65, 0));
    const target = a.to.clone().add(new THREE.Vector3(0, a.move.captured ? 0.95 : 0.55, 0));
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
  private frame(now: number) {
    if (this.paused && !this.showcaseHost) { this.previous = now; return; }
    const elapsed = now - this.previous;
    const dt = Math.max(0, Math.min(elapsed / 1000, 0.05));
    this.previous = now;
    this.animateCelebration(now);
    if (this.controls.enabled) this.controls.update();
    const a = this.animation;
    if (a) {
      const t = Math.min((now - a.start) / a.duration, 1);
      const choreography = cinematicFrame(t);
      const short = moveFrame(t);
      const capture = a.move.captured && !this.reduced ? captureFrame(t) : null;
      const stopRatio = a.from.distanceTo(a.stop) / a.from.distanceTo(a.to);
      const travel = this.reduced ? Math.min(t / 0.58, 1) : capture
        ? capture.approach * stopRatio + capture.occupy * (1 - stopRatio)
        : a.dramatic ? choreography.travel : short.travel;
      const e = travel;
      if (a.cracks) {
        const count = travel === 0 ? 0 : a.cracks.stops[Math.min(a.cracks.stops.length - 1, Math.floor(travel * (a.cracks.stops.length - 1)))];
        a.cracks.core.geometry.setDrawRange(0, count);
        a.cracks.dark.geometry.setDrawRange(0, count * 3);
      }
      if (!this.reduced) {
        this.stage.dataset.movePhase = capture ? capture.phase : a.dramatic ? t >= 0.44 && t < 0.52 ? "slowmo" : choreography.phase : short.phase;
        if (capture) {
          this.stage.dataset.executionPhase = capture.phase;
          this.stage.dataset.defenderStatus = capture.death ? "defeated" : capture.impact ? "hit" : "guard";
        }
        this.animateAura(a, t, capture ? capture.charge : a.dramatic ? choreography.charge : short.charge, travel);
        this.animateTrail(a, travel);
        if (a.lock) {
          a.lock.visible = !a.impacted;
          a.lock.scale.setScalar(1.4 - Math.min(1, (a.dramatic ? choreography.charge : short.charge)) * 0.4);
          a.lock.rotation.y = a.move.piece === "r" ? 0 : (1 - Math.min(1, t * 4)) * 0.6;
        }
      }
      if (!a.launched && t >= (this.reduced ? 0 : capture ? 0.18 : a.dramatic ? 0.3 : 0.22)) {
        a.launched = true; this.onDash(a.move, a.event);
      }
      if (a.dramatic) {
        this.overlay.draw(t, a.move.piece, a.move.color, a.event.title);
      }
      if (
        !a.weapons &&
        !this.reduced &&
        a.move.captured &&
        t >= (capture ? 0.48 : a.dramatic ? 0.3 : 0.22)
      ) {
        a.weapons = true;
        a.weaponsGroup = this.weapon(a);
      }
      a.object.position.lerpVectors(a.from, a.to, e);
      a.object.position.y =
        Math.sin((capture ? capture.approach : travel) * Math.PI) *
        combatStyles[a.move.piece].lift;
      if (capture && capture.occupy > 0) a.object.position.y = Math.sin(capture.occupy * Math.PI) * 0.06;
      if (a.move.piece === "b")
        a.object.rotation.y =
          a.rotation + Math.sin(travel * Math.PI) * Math.PI * 2;
      if (a.move.piece === "r")
        a.object.rotation.z = Math.sin(travel * Math.PI * 2) * 0.08;
      if (a.move.piece === "k")
        a.object.scale.setScalar(1 + Math.sin(travel * Math.PI) * 0.08);
      if (a.rook) a.rook.object.position.lerpVectors(a.rook.from, a.rook.to, e);
      const contact = this.reduced ? 0.58 : capture ? 0.56 : a.dramatic ? 0.52 : 0.62;
      if (!a.impacted && t >= contact) {
        a.impacted = true;
        this.impact(a);
      }
      if (capture) {
        this.animateExecution(a, t);
        if (!a.died && capture.death) { a.died = true; this.death(a); }
      }
      for (const o of this.fx.children)
        if (o.userData.shock) {
          o.scale.setScalar(1 + Math.max(0, t - contact) * 7);
          (
            o as THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>
          ).material.opacity = Math.max(0, 1 - (t - contact) * 2);
        } else if (o.userData.hitEcho) {
          const release = Math.max(0, (t - contact) / (1 - contact));
          o.scale.setScalar(1 + release * 0.35);
          o.position.y = release * 0.5;
          o.rotation.z = release * 0.5;
          o.traverse((child) => {
            if (child instanceof THREE.Mesh) (child.material as THREE.MeshBasicMaterial).opacity = (1 - release) * 0.65;
          });
        }
      if (a.dramatic) {
        this.directCamera(a, t);
      }
      if (t === 1) this.finish();
    }
    const progress = this.animation ? (now - this.animation.start) / this.animation.duration : 1;
    const particleSpeed = !this.animation || this.reduced ? 1 : this.animation.move.captured ? captureFrame(progress).particleSpeed : this.animation.dramatic
      ? progress >= 0.52 && progress < 0.6 ? 0 : progress < 0.76 ? 0.22 : 1
      : moveFrame(progress).particleSpeed;
    const particleDt = dt * particleSpeed;
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life -= particleDt;
      s.velocity.y -= particleDt * 3;
      s.position.addScaledVector(s.velocity, particleDt);
      if (s.life <= 0) {
        this.sparks.splice(i, 1);
      }
    }
    if (this.particleMesh) {
      this.particleMesh.count = this.sparks.length;
      for (let i = 0; i < this.sparks.length; i++) {
        const spark = this.sparks[i];
        this.particleMatrix.makeScale(spark.size * spark.life, spark.size * spark.life, spark.size * spark.life);
        this.particleMatrix.setPosition(spark.position);
        this.particleMesh.setMatrixAt(i, this.particleMatrix);
      }
      this.particleMesh.instanceMatrix.needsUpdate = true;
      if (!this.sparks.length) {
        disposeObject(this.particleMesh);
        this.particleMesh = undefined;
      }
    }
    if (this.animation || this.sparks.length) this.dirty = true;
    for (const rune of this.groundAuras.children) {
      (rune as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>).material.uniforms.uTime.value = now / 1000;
    }
    for (const scar of [...this.groundScars.children]) {
      if (scar.userData.active) continue;
      const fade = Math.max(0, 1 - (now - scar.userData.born) / 7000);
      if (!fade) { disposeObject(scar); this.dirty = true; continue; }
      for (const child of scar.children) (child as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material.opacity = fade * (child instanceof THREE.Line ? 0.65 : 0.9);
    }
    // A low-rate idle pulse shares the same two aura batches. Orbit still follows display frames.
    if ((this.groundAuras.children.length || this.groundScars.children.length) && now - this.lastAuraDraw >= (this.quality === "low" ? 125 : 50)) this.dirty = true;
    // Keep camera interaction and short moves responsive; bound heavy mobile cuts.
    const targetFps = this.animation?.dramatic && (this.showcaseHost || this.stage).clientWidth < 700 ? 30 : 60;
    // Orbit/short moves follow every display frame; a second 60 Hz gate causes skips.
    if (this.dirty && (targetFps === 60 || now - this.lastRender >= 1000 / targetFps - 1)) {
      // Camera movement can reuse the board's shadow map; moving pieces cannot.
      if (this.animation) this.renderer.shadowMap.needsUpdate = true;
      this.renderer.render(this.scene, this.camera);
      this.lastRender = now;
      this.lastAuraDraw = now;
      this.dirty = false;
      if (this.quality === "auto" && elapsed > 25 && elapsed < 200) this.slowFrames++;
      else this.slowFrames = Math.max(0, this.slowFrames - 1);
      if (this.quality === "auto" && this.slowFrames >= 12 && this.resolution > 0.8) {
        this.resolution = Math.max(0.8, this.resolution - 0.15);
        this.renderer.setPixelRatio(this.resolution);
        this.slowFrames = 0;
        this.dirty = true;
      }
    }
  }
}
