import {boardTexture,SkillCosmetic} from './cosmetic-effects';
import {boardThemes,skillThemes} from '../shared/presentation.js';
import {CombatDimension,dimensionWindow,dimensionTransition} from './combat-dimension';
import {shopCatalog} from '../shared/economy.js';
import * as THREE from "three";
import { BattleOverlay, cinematicFrame } from "./cinematic";
import { useDramaticCamera, type CinematicScope } from "./gameplay";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { Chess, type Square, type PieceSymbol, type Move } from "chess.js";
import { kingSquare, type MoveEvent } from "../shared/events.js";
import { skins, type SkinId } from "./profile";
import { combatStyles, moveFrame, captureFrame, CAPTURE_DURATION, CAPTURE_CONTACT, CAPTURE_CLASH, CAPTURE_DEATH, captureCuePoints, clampCaptureDuration, resumeAnimationStart, type CombatCue } from "./combat";
import { combatProfile, resolveDefense, type CombatProfile, type DefenseReaction } from "./combat-profiles";
import { createAvatar, animateAvatar, animateDefender, createAvatarAura, animateAvatarAura } from "./avatar";
import { ArenaEnvironment } from "./arena";
import { arenas, type ArenaId } from "./arenas";
import { frameCombat } from "./framing";
import { ExecutionVFX } from "./execution-vfx";
import { executionFrame } from "./skin-execution";
import { DuelChoreography, type DuelFrame } from "./duel-choreography";
import { CombatVFX } from "./vfx";
import { previewMove, type MovePreview } from "./tactics";
import { SpecialChess, ultimates, type UltimateMove } from "./special";
import { VariantChess, controlSquares } from "./variants";
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
  // Energy and labels never cast solid shadows over fighters.
  o.castShadow = !(m instanceof THREE.MeshBasicMaterial || m instanceof THREE.ShaderMaterial);
  o.receiveShadow = m instanceof THREE.MeshStandardMaterial;
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
    if (skin === "storm") {
      for (const sign of [-1, 1]) { const fin = mesh(new THREE.BoxGeometry(.035,.4,.06),accent,group,sign*.24,height+.08); fin.rotation.z=sign*.4; }
    } else if (skin === "void") {
      for (let i=0;i<2;i++) mesh(new THREE.TorusGeometry(.26+i*.07,.018,4,24),accent,group,0,height+.1).rotation.x=i*.65;
    } else if (skin === "prism") {
      for (let i=0;i<3;i++) { mesh(new THREE.OctahedronGeometry(.08),accent,group,(i-1)*.17,height+.16); mesh(new THREE.TorusGeometry(.23+i*.045,.014,4,6),accent,group,0,height+.2+i*.06); }
    } else if (skin === "ember") {
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
  profile: CombatProfile;
  defenderProfile?: CombatProfile;
  reaction?: DefenseReaction;
  sequence: number;
  cueIndex: number;
  stop: THREE.Vector3;
  avatar?: THREE.Group;
  avatarAura?: THREE.Group;
  defenderAvatar?: THREE.Group;
  defenderAura?: THREE.Group;
  guard?: THREE.Mesh;
  victimOrigin?: THREE.Vector3;
  victimRotation?: THREE.Euler;
  execution?:ExecutionVFX;
  duel?: DuelChoreography;
  duelFrame?: DuelFrame;
  duelDirection?: THREE.Vector3;
  duelSide?: THREE.Vector3;
  duelCentre?: THREE.Vector3;
  quieted?:boolean;
  vfx?: CombatVFX;
  skillFx?:SkillCosmetic;
  dramatic: boolean;
  launched: boolean;
  lock?: THREE.Group;
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
  readonly aim = new THREE.Group();
  readonly fx = new THREE.Group();
  readonly board = new THREE.Group();
  readonly groundAuras = new THREE.Group();
  readonly groundScars = new THREE.Group();
  readonly environment = new ArenaEnvironment();
  readonly combatDimension=new CombatDimension();
  onDimension=(_active:boolean)=>{};
  private presentation:Partial<Record<'dimension'|'finisher'|'frame'|'board'|'skill',string>>={};
  private dimensionSaved?:{visibility:[THREE.Object3D,boolean][];background:THREE.Scene['background'];fog:THREE.Scene['fog']};
  private dimensionCurtain?:HTMLElement;
  private dimensionLabel?:HTMLElement;
  private duelHUD?: HTMLElement;
  private duelPhase?: HTMLElement;
  private duelProgress?: HTMLElement;
  private duelSkill?: HTMLElement;
  private customBoardTexture?:THREE.Texture;
  private customBoardId?:string;
  setPresentation(equipped:Partial<Record<'dimension'|'finisher'|'frame'|'board'|'skill',string>>){this.presentation={...equipped};this.applyBoardCosmetic();}
  private applyBoardCosmetic(){
    const id=this.presentation.board,theme=boardThemes.find(v=>`board-${v.id}`===id);
    if(id!==this.customBoardId){this.customBoardTexture?.dispose();this.customBoardTexture=theme?boardTexture(theme):undefined;this.customBoardId=id;}
    for(const tile of this.board.children)if(tile instanceof THREE.InstancedMesh){
      const mat=tile.material as THREE.MeshStandardMaterial;
      const map=this.customBoardTexture||tile.userData.baseMap;
      if(mat.map!==map){mat.map=map;mat.needsUpdate=true;}
      mat.color.setHex(tile.userData.parity?arenas[this.environment.id].dark:arenas[this.environment.id].light);
      if(theme&&!tile.userData.parity)mat.color.lerp(new THREE.Color(theme.color),.22);
    }
    this.boardRail?.material.color.set(theme?.color||arenas[this.environment.id].glow);
    if(theme)this.stage.dataset.boardCosmetic=theme.id;else delete this.stage.dataset.boardCosmetic;
    this.dirty=true;
  }
  private leaveDimension(){
    if(this.dimensionSaved){for(const [object,visible] of this.dimensionSaved.visibility)object.visible=visible;
      this.scene.background=this.dimensionSaved.background;this.scene.fog=this.dimensionSaved.fog;this.dimensionSaved=undefined;
      if(this.scene.fog instanceof THREE.Fog){const distance=this.camera.position.distanceTo(this.controls.target);this.scene.fog.near=distance+6;this.scene.fog.far=distance+24;}
      this.onDimension(false);}
    this.combatDimension.root.visible=false;delete this.stage.dataset.combatDimension;
    if(this.showcaseHost)delete this.showcaseHost.dataset.combatDimension;
    delete this.stage.dataset.duelExchange;
    if(this.duelHUD)this.duelHUD.hidden=true;
    if(this.duelSkill){this.duelSkill.hidden=true;delete this.duelSkill.dataset.active;}
    if(this.dimensionCurtain)this.dimensionCurtain.style.opacity='0';
  }
  private updateDimension(a:Animation,t:number){
    const active=!!a.move.captured&&a.dramatic&&dimensionWindow(t,this.reduced);
    if(active&&!this.dimensionSaved){
      const objects=[this.board,this.pieces,this.markers,this.aim,this.groundAuras,this.groundScars,this.environment.root];
      this.dimensionSaved={visibility:objects.map(object=>[object,object.visible]),background:this.scene.background,fog:this.scene.fog};
      objects.forEach(object=>object.visible=false);this.onDimension(true);this.scene.background=new THREE.Color('#02040b');this.scene.fog=null;
    } else if(!active&&this.dimensionSaved)this.leaveDimension();
    if(a.move.captured&&a.dramatic&&!this.reduced){
      this.dimensionCurtain!.style.opacity=String(dimensionTransition(t));
      if(active){
        const equipped=shopCatalog.find(item=>item.id===this.presentation.dimension),finish=shopCatalog.find(item=>item.id===this.presentation.finisher);
        const theme=equipped?.cosmetic||({nova:'solar',phantom:'veil',dragon:'wyrm',frost:'glacier',storm:'machine',royal:'sanctum',void:'abyss'} as Record<string,string>)[a.skin]||'nebula';
        this.stage.dataset.combatDimension=theme;this.dimensionLabel!.textContent=equipped?.label||'BATTLE DOMAIN / IAHCARUS';
        if(this.showcaseHost)this.showcaseHost.dataset.combatDimension=theme;
        this.combatDimension.root.visible=true;this.combatDimension.update(t,a.duelCentre!,theme,finish?.cosmetic);
        const frame=captureFrame(t);
        this.stage.dataset.duelExchange=frame.exchange;
        this.duelHUD!.hidden=false;
        const labels:Record<string,string>={faceoff:'ตั้งท่า',opening:'เปิดฉาก',guard:'ปัด · รับท่า',counter:'สวนกลับ','counter-clash':'รับแรงสวน',combo:'คอมโบต่อเนื่อง','combo-clash':'ปะทะ','finisher-charge':'ชาร์จท่าปิดฉาก',finisher:'ท่าปิดฉาก',impact:'ปะทะตัดสิน',defeat:'ยุติการต่อสู้',return:'คืนกระดาน'};
        this.duelPhase!.textContent=labels[frame.exchange]||'ประลอง';
        this.duelProgress!.style.transform=`scaleX(${1-t})`;
        this.duelSkill!.hidden=frame.exchange!=='finisher'&&frame.exchange!=='finisher-charge';
        this.duelSkill!.dataset.active=String(frame.exchange==='finisher'||frame.exchange==='finisher-charge');
      }
    }
  }
  private arenaSun?: THREE.DirectionalLight;
  private arenaSky?: THREE.HemisphereLight;
  private arenaRim?: THREE.PointLight;
  private arenaFloor?: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  private boardRail?: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  private selectionGame: Chess | null = null;
  private selectionSquare: Square | null = null;
  private hoveredSquare: Square | null = null;
  private hoverInput: Square | null = null;
  private pointerHeld = false;
  private pointerPosition?: { x: number; y: number };
  private hoverFrame = 0;
  animation: Animation | null = null;
  reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  cinematic = true;
  cinematicScope: CinematicScope = "key";
  private captureDurationMs = CAPTURE_DURATION;
  get captureDuration() { return this.captureDurationMs; }
  set captureDuration(ms: number) { this.captureDurationMs = clampCaptureDuration(ms); }
  private sequence = 0;
  private cameraReturn?: { position: THREE.Vector3; focus: THREE.Vector3; camera: THREE.Vector3; target: THREE.Vector3; start: number };
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
  private forcePaused = false;
  private pausedAt?: number;
  private get presentationPaused() { return this.forcePaused || this.paused && !this.showcaseHost; }
  private refreshPause(wasPaused: boolean) {
    const paused = this.presentationPaused;
    if (paused !== wasPaused) {
      if (paused) this.pausedAt = performance.now();
      else if (this.pausedAt !== undefined) {
        const now = performance.now();
        if (this.animation) this.animation.start = resumeAnimationStart(this.animation.start, this.pausedAt, now);
        if (this.celebration) this.celebration.start = resumeAnimationStart(this.celebration.start, this.pausedAt, now);
        if (this.cameraReturn) this.cameraReturn.start = resumeAnimationStart(this.cameraReturn.start, this.pausedAt, now);
        this.pausedAt = undefined;
      }
    }
    this.controls.enabled = !paused && !this.animation && !this.cameraReturn;
    this.dirty = true;
  }
  setPaused(paused: boolean, force = false) {
    const wasPaused = this.presentationPaused;
    this.paused = paused;
    // Menus keep their ordinary avatar preview live; hidden tabs freeze it too.
    this.forcePaused = paused && force;
    this.refreshPause(wasPaused);
    if (paused) this.previewTarget(null);
  }
  setSkin(skin: SkinId) {
    this.skin = skin;
    this.stage.dataset.skin = skin;
  }
  setArena(id: ArenaId) {
    if (this.environment.id !== id) this.environment.setArena(id);
    const theme = arenas[id];
    this.stage.dataset.arena = id;
    if(this.dimensionSaved){
      this.dimensionSaved.background=new THREE.Color(theme.background);
      if(this.dimensionSaved.fog instanceof THREE.Fog)this.dimensionSaved.fog.color.setHex(theme.background);
    }else{
      this.scene.background = new THREE.Color(theme.background);
      if (this.scene.fog instanceof THREE.Fog) this.scene.fog.color.setHex(theme.background);
    }
    for (const tile of this.board.children) {
      if (tile instanceof THREE.InstancedMesh) (tile.material as THREE.MeshStandardMaterial).color.setHex(tile.userData.parity ? theme.dark : theme.light);
    }
    this.arenaFloor?.material.color.setHex(theme.floor);
    this.arenaSky?.color.setHex(theme.sky);
    this.arenaRim?.color.setHex(theme.glow);
    this.arenaSun?.color.setHex(theme.sky);
    this.boardRail?.material.color.setHex(theme.glow);
    this.applyBoardCosmetic();
    this.environment.setMotion(this.quality === "low", this.reduced);
    this.renderer.shadowMap.needsUpdate = true; this.dirty = true;
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
  onPreview: (preview: MovePreview | null) => void = () => {};
  onFinish: () => void = () => {};
  onImpact: (move: Move, event: MoveEvent) => void = () => {};
  onDash: (move: Move, event: MoveEvent) => void = () => {};
  onDeath: (move: Move, event: MoveEvent) => void = () => {};
  onCancel: () => void = () => {};
  onAnticipation:()=>void=()=>{};
  onCombatCue: (move: Move, event: MoveEvent, cue: CombatCue, actor: "attacker" | "defender", skin: SkinId) => void = () => {};
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
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
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
    this.arenaSky = new THREE.HemisphereLight(0xc8e8ff, 0x162034, 2);
    this.scene.add(this.arenaSky);
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
    this.arenaSun = sun;
    const rim = new THREE.PointLight(0x6b65ff, 18, 15);
    rim.position.set(-5, 3, -4);
    this.scene.add(rim);
    this.arenaRim = rim;
    this.scene.add(this.combatDimension.root);
    this.dimensionCurtain=document.createElement('div');this.dimensionCurtain.className='dimension-transition';this.dimensionCurtain.setAttribute('aria-hidden','true');this.stage.append(this.dimensionCurtain);
    this.dimensionLabel=document.createElement('div');this.dimensionLabel.className='dimension-label';this.dimensionLabel.setAttribute('aria-hidden','true');this.stage.append(this.dimensionLabel);
    this.duelHUD=document.createElement('div');this.duelHUD.className='dimension-duel';this.duelHUD.hidden=true;this.duelHUD.setAttribute('aria-hidden','true');
    this.duelHUD.innerHTML='<div class="duel-fighter" data-side="attacker"><small>ATTACKER</small><strong></strong><span></span></div><div class="duel-versus">VS</div><div class="duel-fighter" data-side="defender"><small>DEFENDER</small><strong></strong><span></span></div><div class="duel-phase"></div><div class="duel-progress"><i></i></div>';
    this.duelPhase=this.duelHUD.querySelector('.duel-phase')!;this.duelProgress=this.duelHUD.querySelector('.duel-progress i')!;
    this.duelSkill=document.createElement('div');this.duelSkill.className='duel-skill';this.duelSkill.setAttribute('aria-hidden','true');this.duelSkill.hidden=true;
    this.stage.append(this.duelHUD,this.duelSkill);
    this.scene.add(this.board, this.pieces, this.markers, this.aim, this.fx, this.groundAuras, this.groundScars, this.environment.root);
    const tileGeometry = new THREE.BoxGeometry(0.98, 0.16, 0.98);
    const plate = document.createElement("canvas"); plate.width = plate.height = 256;
    const ink = plate.getContext("2d")!;
    const sheen = ink.createLinearGradient(0, 0, 256, 256);
    sheen.addColorStop(0, "#ffffff"); sheen.addColorStop(1, "#cbd2dc");
    ink.fillStyle = sheen; ink.fillRect(0, 0, 256, 256);
    ink.strokeStyle = "#7c8a9c"; ink.lineWidth = 2; ink.strokeRect(6, 6, 244, 244);
    ink.strokeStyle = "#f4f8ff"; ink.lineWidth = 3;
    for (const [x, y, dx, dy] of [[17, 17, 1, 1], [239, 17, -1, 1], [17, 239, 1, -1], [239, 239, -1, -1]]) {
      ink.beginPath(); ink.moveTo(x + dx * 24, y); ink.lineTo(x, y); ink.lineTo(x, y + dy * 24); ink.stroke();
    }
    ink.fillStyle = "#afbbc9";
    for (let y = 28; y < 235; y += 24) for (let x = 28; x < 235; x += 24) ink.fillRect(x, y, 1, 1);
    const plateTexture = new THREE.CanvasTexture(plate); plateTexture.colorSpace = THREE.SRGBColorSpace;
    for (const parity of [0, 1]) {
      const surface = material(parity ? 0x1a2b40 : 0x58738b, 0.55);
      surface.map = plateTexture; surface.roughness = 0.38;
      const tiles = new THREE.InstancedMesh(tileGeometry, surface, 32);
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
      tiles.userData.parity = parity;tiles.userData.baseMap=plateTexture;
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
    const rails: THREE.BufferGeometry[] = [];
    for (const edge of [-4.04, 4.04]) {
      rails.push(new THREE.BoxGeometry(8.18, 0.024, 0.025).translate(0, 0.006, edge));
      rails.push(new THREE.BoxGeometry(0.025, 0.024, 8.18).translate(edge, 0.006, 0));
    }
    this.boardRail = mesh(mergeGeometries(rails)!, new THREE.MeshBasicMaterial({ color: 0x70ddff, transparent: true, opacity: 0.7 }), this.board) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
    this.boardRail.userData.role = "board-rail";
    rails.forEach(g => g.dispose());
    const floor = mesh(
      new THREE.PlaneGeometry(100, 100),
      material(0x0a121f, 0.05),
      this.board,
      0,
      -0.43,
    );
    floor.rotation.x = -Math.PI / 2;
    this.arenaFloor = floor as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    this.setArena("citadel");
    this.labels();
    let down = { x: 0, y: 0 };
    this.renderer.domElement.addEventListener("pointerdown", (e) => {
      down = { x: e.clientX, y: e.clientY };
      this.pointerHeld = true; this.previewTarget(null);
    });
    this.renderer.domElement.addEventListener("pointerup", (e) => {
      this.pointerHeld = false;
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
    this.renderer.domElement.addEventListener("pointermove", e => {
      if (e.pointerType === "touch" || this.pointerHeld || !this.selectionSquare || this.animation || this.paused || this.showcaseHost) return;
      this.pointerPosition = { x: e.clientX, y: e.clientY };
      if (this.hoverFrame) return;
      this.hoverFrame = requestAnimationFrame(() => {
        this.hoverFrame = 0;
        if (!this.pointerPosition || this.pointerHeld || this.animation || this.paused || this.showcaseHost || !this.selectionSquare) return;
        const rect = this.renderer.domElement.getBoundingClientRect();
        const ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2((this.pointerPosition.x - rect.left) / rect.width * 2 - 1, -(this.pointerPosition.y - rect.top) / rect.height * 2 + 1), this.camera);
        let square: Square | null = null;
        for (const hit of ray.intersectObjects([...this.pieces.children, ...this.board.children], true)) {
          if (hit.object instanceof THREE.InstancedMesh && hit.object.userData.squares && hit.instanceId !== undefined) { square = hit.object.userData.squares[hit.instanceId]; break; }
          let object: THREE.Object3D | null = hit.object;
          while (object && !object.userData.square) object = object.parent;
          if (object?.userData.square) { square = object.userData.square; break; }
        }
        this.previewTarget(square);
      });
    });
    for (const event of ["pointerleave", "pointercancel", "lostpointercapture"]) this.renderer.domElement.addEventListener(event, () => {
      this.pointerHeld = false; this.pointerPosition = undefined; this.previewTarget(null);
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
    const wasPaused = this.presentationPaused;
    this.finish();
    if (this.showcaseHost) this.resizeObserver.unobserve(this.showcaseHost);
    this.showcaseHost = host;
    this.showcaseFocus = null;
    this.controls.minDistance = host ? 3 : 7;
    (host || this.stage).prepend(this.renderer.domElement);
    const surface=host||this.stage;
    for(const element of [this.dimensionCurtain,this.dimensionLabel,this.duelHUD,this.duelSkill,this.overlay.canvas])if(element)surface.append(element);
    this.overlay.setSurface(surface);
    if (host) this.resizeObserver.observe(host);
    this.refreshPause(wasPaused);
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
    this.environment.setMotion(quality === "low", this.reduced);
  }
  private labels() {
    const c = document.createElement("canvas");
    c.width = 1024; c.height = 64;
    const ctx = c.getContext("2d")!;
    ctx.font = "32px monospace";
    ctx.fillStyle = "#bdd9e9";
    ctx.textAlign = "center";
    const planes: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 16; i++) {
      const index = i % 8;
      ctx.fillText(i < 8 ? String.fromCharCode(97 + index) : String(index + 1), i * 64 + 32, 43);
      const plane = new THREE.PlaneGeometry(0.32, 0.32);
      const uv = plane.getAttribute("uv");
      for (let v = 0; v < uv.count; v++) uv.setX(v, (uv.getX(v) + i) / 16);
      plane.rotateX(-Math.PI / 2).translate(i < 8 ? index - 3.5 : -4.1, -0.1, i < 8 ? 4.12 : 3.5 - index);
      planes.push(plane);
    }
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    const o = mesh(
      mergeGeometries(planes)!,
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
      }),
      this.board,
    );
    o.userData.role = "coordinates";
    planes.forEach(g => g.dispose());
  }
  renderBoard(game: Chess, preserveField = false) {
    this.dirty = true;
    this.renderer.shadowMap.needsUpdate = true;
    this.cancel(preserveField);
    clear(this.pieces);
    clear(this.markers);
    this.selectionGame = null; this.selectionSquare = null; this.previewTarget(null);
    clear(this.aim);
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
    if (game instanceof VariantChess && game.id === "control") {
      const geometry = new THREE.RingGeometry(0.32, 0.43, 4); geometry.rotateX(-Math.PI / 2); geometry.rotateY(Math.PI / 4);
      const zones = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial({ color: 0x77ebff, transparent: true, opacity: 0.8, side: THREE.DoubleSide }), controlSquares.length);
      controlSquares.forEach((square, index) => {
        const point = coords(square); zones.setMatrixAt(index, new THREE.Matrix4().makeTranslation(point.x, 0.042, point.z));
        const owner = game.get(square)?.color;
        zones.setColorAt(index, new THREE.Color(owner === "w" ? 0x77ebff : owner === "b" ? 0xb899ff : 0xebcf88));
      });
      zones.userData.role = "control-zones"; this.groundAuras.add(zones);
    }
    if (game instanceof SpecialChess && game.field) {
      const field=game.field,event=field.active||field.forecast;
      const geometry=new THREE.RingGeometry(.32,.44,event.kind==='portal'?32:6);geometry.rotateX(-Math.PI/2);
      const zones=new THREE.InstancedMesh(geometry,new THREE.MeshBasicMaterial({color:event.kind==='portal'?0xc89aff:0x70f3d8,transparent:true,opacity:field.active?.85:.35,side:THREE.DoubleSide,depthWrite:false}),2);
      event.squares.forEach((square,i)=>{const at=coords(square);zones.setMatrixAt(i,new THREE.Matrix4().makeTranslation(at.x,.05,at.z));});
      zones.userData.role='field-zones';this.groundAuras.add(zones);
      this.stage.dataset.fieldState=field.active?'active':'warning';this.stage.dataset.fieldKind=event.kind;
    } else {delete this.stage.dataset.fieldState;delete this.stage.dataset.fieldKind;}
    if (game instanceof SpecialChess) {
      const ready = game.board().flat().filter(p => p && game.choice(p.type,p.color)!=="off" && game.remaining[p.color] > 0 && !game.spent(p.square));
      if (ready.length) {
        const badges = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.055), new THREE.MeshBasicMaterial({ color: 0xd7b5ff }), ready.length);
        ready.forEach((p, i) => { const at = coords(p!.square); badges.setMatrixAt(i, new THREE.Matrix4().makeTranslation(at.x + 0.34, 0.1, at.z + 0.34)); });
        badges.userData.role = "ultimate-ready"; this.groundAuras.add(badges);
      }
    }
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
        const rings = [[0.39, skin === "prism" || skin === "frost" ? 6 : skin === "storm" ? 12 : sides, 0, 0.018], [0.31, 24, 0, 0.022],
          [0.46, 24, 1, 0.018], [0.34, sides * 2, 0, 0.072], [0.37, sides * 2, 2, 0.23]];
        if (tier >= 3) rings.push([0.44, skin === "royal" ? 8 : 32, 0, 0.045]);
        if (tier >= 4) rings.push([0.41, skin === "void" ? 32 : 6, 0, 0.1]);
        if (tier >= 5) rings.push([0.43, 6, 0, 0.16]);
        const auraColor = new THREE.Color(battleColor(piece.color, undefined, skin));
        for (const [radius, segments, glow, height] of rings) {
          const geometry = glow === 2 ? new THREE.CylinderGeometry(radius * 0.85, radius, 0.42, segments, 1, true)
            : new THREE.RingGeometry(glow ? 0 : radius - 0.014, radius, segments, glow ? 4 : 1);
          if (glow !== 2) geometry.rotateX(-Math.PI / 2);
          geometry.translate(p.x, height, p.z);
          const count = geometry.getAttribute("position").count;
          const centers = new Float32Array(count * 3), flags = new Float32Array(count), colors = new Float32Array(count * 3), tiers = new Float32Array(count), schools = new Float32Array(count), families = new Float32Array(count);
          for (let i = 0; i < count; i++) {
            centers.set([p.x, sides + p.z * 2, p.z], i * 3); flags[i] = glow;
            colors.set([auraColor.r, auraColor.g, auraColor.b], i * 3); tiers[i] = tier;
            families[i] = Object.keys(skins).indexOf(skin);
            schools[i] = ["p", "n", "b", "r", "q", "k"].indexOf(piece.type);
          }
          geometry.setAttribute("aCenter", new THREE.BufferAttribute(centers, 3));
          geometry.setAttribute("aGlow", new THREE.BufferAttribute(flags, 1));
          geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
          geometry.setAttribute("aTier", new THREE.BufferAttribute(tiers, 1));
          geometry.setAttribute("aFamily", new THREE.BufferAttribute(families, 1));
          geometry.setAttribute("aSchool", new THREE.BufferAttribute(schools, 1));
          geometries.push(geometry);
        }
      }
      if (!geometries.length) continue;
      const merged = mergeGeometries(geometries)!;
      geometries.forEach((g) => g.dispose());
      const material = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: performance.now() / 1000 }, uColor: { value: new THREE.Color(0xffffff) } },
        vertexShader: `attribute vec3 aCenter; attribute float aGlow; attribute vec3 aColor; attribute float aTier; attribute float aSchool; attribute float aFamily; uniform float uTime;
          varying vec2 vLocal; varying float vPhase; varying float vGlow; varying vec3 vColor; varying float vTier; varying float vHeight; varying float vSchool; varying float vFamily;
          void main() { vec3 p = position; vec2 local = p.xz - aCenter.xz;
            float angle = uTime * (aTier > 2.5 ? -0.17 : 0.13) + aCenter.y * 0.2;
            float c = cos(angle), s = sin(angle);
            p.xz = aCenter.xz + mat2(c,-s,s,c) * local;
            vLocal = local; vPhase = aCenter.y; vGlow = aGlow; vColor = aColor; vTier = aTier; vHeight = p.y; vSchool = aSchool; vFamily = aFamily;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0); }`,
        fragmentShader: `uniform vec3 uColor; uniform float uTime;
          varying vec2 vLocal; varying float vPhase; varying float vGlow; varying vec3 vColor; varying float vTier; varying float vHeight; varying float vSchool; varying float vFamily;
          void main() {
            float radius=length(vLocal)/0.46, angle=atan(vLocal.y,vLocal.x);
            float pulse=0.72+0.13*sin(uTime*1.5+vPhase);
            float petals=3.0+vSchool;
            float flow=pow(0.5+0.5*cos(angle*petals-radius*11.0+uTime*(vSchool==3.0?0.6:1.1)),5.0);
            float sweep=pow(0.5+0.5*cos(angle-uTime*0.75-vPhase),12.0);
            float alpha;
            if(vGlow>1.5){
              float height=clamp(vHeight/0.45,0.0,1.0);
              float filaments=pow(0.5+0.5*sin(angle*petals-height*9.0+uTime*2.0),9.0);
              alpha=(1.0-height)*(0.025+filaments*0.085);
            } else if(vGlow>0.5) {
              float halo=pow(max(0.0,1.0-radius),2.0);
              float petalsGlow=flow*smoothstep(0.12,0.28,radius)*(1.0-smoothstep(0.7,1.0,radius));
              alpha=halo*0.32+petalsGlow*0.08;
            } else alpha=0.30+flow*0.17+sweep*0.2;
            if(vFamily>6.5){flow=pow(abs(cos(angle*6.0-radius*9.0+uTime)),8.0);alpha*=0.7+flow*0.5;}
            else if(vFamily>5.5){alpha*=0.4+0.6*pow(abs(sin(radius*12.0+uTime*1.2)),3.0);}
            else if(vFamily>4.5){alpha*=0.4+0.6*step(0.4,sin(angle*12.0+radius*9.0-uTime*5.0));}
            else if(vFamily>3.5){alpha*=0.8+0.2*cos(angle*8.0-uTime*0.7);}
            else if(vFamily>2.5){alpha*=0.5+0.5*pow(abs(sin(angle*3.0-radius*8.0+uTime)),2.0);}
            else if(vFamily>1.5){alpha*=0.65+0.35*step(0.2,cos(angle*6.0+radius*10.0));}
            else if(vFamily>0.5){alpha*=0.7+0.3*sin(angle*5.0-radius*9.0-uTime*3.0);}
            vec3 tint=mix(vColor,vec3(0.88,0.97,1.0),sweep*0.24);
            if(vFamily>6.5)tint=mix(tint,vec3(0.65)+0.35*cos(vec3(0.0,2.1,4.2)+angle*2.0+uTime),0.45);
            gl_FragColor=vec4(uColor*tint*(0.85+sweep*0.4),alpha*pulse*(0.85+vTier*0.05));
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
  private brackets(squares: Square[], color: number, parent = this.markers) {
    const vertices: number[] = [];
    for (const square of squares) {
      const p = coords(square);
      for (const x of [-1, 1]) for (const z of [-1, 1]) {
        const a = p.x + x * 0.43, b = p.z + z * 0.43;
        vertices.push(a - x * 0.15, 0.026, b, a, 0.026, b, a, 0.026, b, a, 0.026, b - z * 0.15);
      }
    }
    if (!vertices.length) return;
    const lines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3)),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }));
    lines.userData.role = "target-brackets"; parent.add(lines);
  }
  previewTarget(square: Square | null) {
    if (square === this.hoverInput) return;
    this.hoverInput = square;
    const target = this.selectionGame && this.selectionSquare && square && !this.animation && !this.paused && !this.showcaseHost
      ? previewMove(this.selectionGame, this.selectionSquare, square) : null;
    const next = target?.to || null;
    if (next === this.hoveredSquare) return;
    this.hoveredSquare = next;
    clear(this.aim); delete this.stage.dataset.previewTarget;
    this.onPreview(target); this.dirty = true;
    if (!target) return;
    this.stage.dataset.previewTarget = target.to;
    const color = target.ultimate ? ultimates[target.piece].color : target.captured ? 0xff8097 : target.controlled ? 0xffc16f : 0x6beafa;
    const from = coords(target.from).setY(0.04), to = coords(target.to).setY(0.04);
    const points = target.piece === "n" && !target.ultimate
      ? [from, new THREE.Vector3(from.x, 0.04, to.z), to]
      : [from, to];
    const route = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineDashedMaterial({ color, dashSize: 0.12, gapSize: 0.07, transparent: true, opacity: 0.85 }));
    route.computeLineDistances(); route.userData.role = "move-preview"; this.aim.add(route);
    const direction = to.clone().sub(points.at(-2)!).normalize();
    const head = mesh(new THREE.ConeGeometry(0.09, 0.24, 3), new THREE.MeshBasicMaterial({ color }), this.aim);
    head.position.copy(to).addScaledVector(direction, -0.15).setY(0.07);
    head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    this.brackets([target.to], color, this.aim);
    if (target.capturedSquare && target.capturedSquare !== target.to) this.brackets([target.capturedSquare], 0xff8097, this.aim);
  }
  showUltimateThreats(squares: Square[]) {
    clear(this.aim); this.dirty = true;
    if (!squares.length) return;
    const geometry = new THREE.RingGeometry(0.31, 0.36, 6); geometry.rotateX(-Math.PI / 2);
    const marks = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial({ color: 0xffae73, transparent: true, opacity: 0.9, side: THREE.DoubleSide }), squares.length);
    squares.forEach((square, i) => { const p = coords(square); marks.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, 0.035, p.z)); });
    marks.userData.role = "ultimate-threats"; this.aim.add(marks);
  }
  select(game: Chess, s: Square | null, last?: { from: Square; to: Square }) {
    this.dirty = true;
    this.selectionGame = null; this.selectionSquare = null; this.previewTarget(null);
    clear(this.aim);
    clear(this.markers);
    if (last) {
      this.ring(last.from, 0xd1a35b, 0.4);
      this.ring(last.to, 0xd1a35b, 0.4);
    }
    const k = kingSquare(game, game.turn());
    if (k && game.isCheck()) { this.ring(k, 0xff557a, 0.38); this.brackets([k], 0xff557a); }
    if (!s) return;
    this.selectionGame = game; this.selectionSquare = s;
    this.ring(s, 0xffffff, 0.44);
    const ultimate = game instanceof SpecialChess && game.armed === s;
    const selectionColor = ultimate ? ultimates[game.get(s)!.type].color : 0x8af2ff;
    this.brackets([s], selectionColor);
    if (ultimate) {
      this.ring(s, selectionColor, 0.58);
      this.ring(s, selectionColor, 0.66);
    }
    if (!this.reduced) {
      const piece = game.get(s)!;
      const halo = mesh(new THREE.RingGeometry(0.46, 0.49, combatStyles[piece.type].sides),
        this.glow(battleColor(piece.color, undefined, this.appearances[s] || this.skin), 0.7), this.markers);
      halo.position.copy(coords(s)); halo.position.y = 0.022;
      halo.rotation.x = -Math.PI / 2;
    }
    const moves = game.moves({ square: s, verbose: true });
    for (const capture of [false, true]) {
      const destinations = [...new Set(moves.filter(m => !!m.captured === capture).map(m => m.to))];
      if (!destinations.length) continue;
      const geometry = capture || ultimate ? new THREE.RingGeometry(capture ? 0.35 : 0.15, capture ? 0.39 : 0.19, 6) : new THREE.CircleGeometry(0.065, 12);
      geometry.rotateX(-Math.PI / 2);
      const targets = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial({ color: ultimate ? selectionColor : capture ? 0xff8097 : 0x70efdc, transparent: true, opacity: 0.9, side: THREE.DoubleSide }), destinations.length);
      destinations.forEach((square, index) => { const p = coords(square); targets.setMatrixAt(index, new THREE.Matrix4().makeTranslation(p.x, 0.025, p.z)); });
      targets.userData.role = capture ? "capture-targets" : "move-targets";
      targets.userData.squares = destinations; this.markers.add(targets);
      if (capture) this.brackets(destinations, 0xff8097);
    }
  }
  resetView(flip = this.flipped) {
    if (this.cameraReturn) { this.cameraReturn = undefined; this.controls.enabled = !this.presentationPaused && !this.animation; }
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
  cancel(preserveField = false) {
    this.clearCelebration();
    this.dirty = true;
    if (this.cameraReturn) {
      this.camera.position.copy(this.cameraReturn.camera);
      this.controls.target.copy(this.cameraReturn.target);
      this.cameraReturn = undefined;
    }
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
    if (this.scene.fog instanceof THREE.Fog) {
      const distance = this.camera.position.distanceTo(this.controls.target);
      this.scene.fog.near = distance + 6; this.scene.fog.far = distance + 18;
    }
    this.leaveDimension();
    this.animation?.duel?.dispose();
    this.animation = null;
    if (!preserveField) this.environment.resetReaction();
    this.overlay.clear();
    delete this.stage.dataset.skillCosmetic;
    delete this.stage.dataset.movePhase;
    delete this.stage.dataset.attackStyle;
    delete this.stage.dataset.executionPhase;
    delete this.stage.dataset.skinExecution;
    delete this.stage.dataset.defenderStatus;
    delete this.stage.dataset.combatPhase;
    delete this.stage.dataset.defenseReaction;
    delete this.stage.dataset.cinematicDuration;
    delete this.stage.dataset.combatCue;
    delete this.stage.dataset.cameraShot;
    delete this.stage.dataset.ultimate;
    this.renderer.toneMappingExposure = 1;
    this.onCancel();
    this.controls.enabled = !this.presentationPaused;
    clear(this.fx);
    this.sparks = [];
    this.particleMesh = undefined;
  }
  finish() {
    if (!this.animation) return;
    const game = this.animation.after;
    if (this.afterAppearances) { this.appearances = this.afterAppearances; this.afterAppearances = undefined; }
    this.renderBoard(game, true);
    this.onFinish();
  }
  /** Settle the board immediately; only the camera's short return remains visual. */
  skip() {
    const a = this.animation;
    if (!a) return;
    const returning = a.dramatic && !this.reduced ? {
      position: this.camera.position.clone(), focus: this.controls.target.clone(),
      camera: a.camera.clone(), target: a.target.clone(), start: performance.now(),
    } : undefined;
    this.finish();
    // onFinish may synchronously start a new sequence; never restore its camera.
    if (!returning || this.animation || this.sequence !== a.sequence ||
      !this.camera.position.equals(returning.camera) || !this.controls.target.equals(returning.target)) return;
    this.cameraReturn = returning;
    this.camera.position.copy(returning.position); this.controls.target.copy(returning.focus);
    this.camera.lookAt(returning.focus); this.controls.enabled = false; this.dirty = true;
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
    if (!object) { this.renderBoard(after, true); this.onFinish(); return; }
    const skin = object.userData.skin as SkinId || this.skin;
    const profile = combatProfile(move.piece, skin);
    const defenderProfile = victim ? combatProfile(victim.userData.piece as PieceSymbol, victim.userData.skin as SkinId || this.skin) : undefined;
    const from = coords(move.from), to = coords(move.to);
    const direction = to.clone().sub(from).normalize();
    const stopDistance = Math.min(from.distanceTo(to) * 0.68, move.piece === "r" || move.piece === "b" ? 1.05 : 0.77);
    const stop = to.clone().addScaledVector(direction, -stopDistance);
    const ultimate = !!(move as UltimateMove).ultimate;
    if (ultimate) this.stage.dataset.ultimate = move.piece;
    const urgent = ultimate || ["mate", "promotion", "rescue"].includes(event.kind) ||
      ["queen-fallen", "comeback"].includes(event.story || "");
    const dramatic =
      this.cinematic && !this.reduced &&
      (!!move.captured || ultimate || useDramaticCamera(move, event, this.cinematicScope)) &&
      (!!move.captured || this.cinematicScope === "all" || urgent || ply - this.lastDramaticPly >= 4);
    if (dramatic) this.lastDramaticPly = ply;
    this.animation = {
      object,
      victim,
      from, to, stop, skin, profile, defenderProfile,
      reaction: defenderProfile ? resolveDefense(profile, defenderProfile, ply * 131 + move.from.charCodeAt(0) * 17 + move.to.charCodeAt(0) + Number(move.to[1])) : undefined,
      sequence: ++this.sequence, cueIndex: 0,
      start: performance.now(),
      duration: this.reduced
        ? 180
        : move.captured ? this.captureDuration
        : event.kind === "mate"
          ? dramatic
            ? 3800
            : 1000
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
      launched: false,
      rotation: object.rotation.y,
      camera: this.camera.position.clone(),
      target: this.controls.target.clone(),
      rook,
      victimOrigin: victim?.position.clone(),
      victimRotation: victim?.rotation.clone(),
    };
    if(victim&&defenderProfile&&!this.reduced){
      this.animation.duel=new DuelChoreography(profile,defenderProfile);
      const incoming=(this.animation.victimOrigin||to).clone().sub(stop);incoming.y=0;
      if(incoming.lengthSq()<.0001)incoming.copy(direction);
      this.animation.duelDirection=incoming.normalize();
      this.animation.duelSide=new THREE.Vector3(-incoming.z,0,incoming.x);
      this.animation.duelCentre=dramatic?new THREE.Vector3():stop.clone().lerp(this.animation.victimOrigin||to,.5);
      const names:Record<PieceSymbol,string>={p:'เบี้ย',n:'ม้า',b:'บิชอป',r:'เรือ',q:'ควีน',k:'คิง'};
      const attacker=this.duelHUD!.querySelector('[data-side="attacker"]')!;
      const defender=this.duelHUD!.querySelector('[data-side="defender"]')!;
      attacker.querySelector('small')!.textContent=move.color==='w'?'WHITE / ATTACKER':'BLACK / ATTACKER';
      defender.querySelector('small')!.textContent=move.color==='w'?'BLACK / DEFENDER':'WHITE / DEFENDER';
      attacker.querySelector('strong')!.textContent=names[move.piece];
      attacker.querySelector('span')!.textContent=skins[skin].name;
      defender.querySelector('strong')!.textContent=names[defenderProfile.piece];
      defender.querySelector('span')!.textContent=skins[defenderProfile.skin].name;
      this.duelSkill!.textContent=event.title;
    }
    this.controls.enabled = false;
    if (move.captured) this.stage.dataset.cinematicDuration = String(this.animation.duration);
    if (this.animation.reaction) this.stage.dataset.defenseReaction = this.animation.reaction;
    if (!this.reduced) {
      this.stage.dataset.attackStyle = move.piece;
      const visual = new CombatVFX({ piece: move.piece, color: ultimate ? ultimates[move.piece].color : battleColor(move.color, event.story, skin),
        skin, quality: this.compactEffects() ? "low" : this.quality, captured: !!victim,
        defenderPiece: defenderProfile?.piece, defenderSkin: defenderProfile?.skin,
        defenderColor: victim ? battleColor(victim.userData.color, undefined, victim.userData.skin || this.skin) : undefined, reaction: this.animation.reaction });
      this.animation.vfx = visual;
      const skill=skillThemes.find(v=>`skill-${v.id}`===this.presentation.skill);
      if(skill){this.animation.skillFx=new SkillCosmetic(skill);this.fx.add(this.animation.skillFx.mesh);this.stage.dataset.skillCosmetic=skill.id;}
      this.animation.aura = visual.chargeGroup;
      this.animation.lock = visual.lockGroup;
      if (ultimate) {
        const seal = mesh(new THREE.RingGeometry(0.62, 0.7, combatStyles[move.piece].sides), this.glow(ultimates[move.piece].color, 0.85), visual.chargeGroup);
        seal.rotation.x = -Math.PI / 2; seal.position.y = 0.025;
        const crown = mesh(new THREE.TorusGeometry(0.48, 0.025, 4, 24), this.glow(ultimates[move.piece].color, 0.7), visual.chargeGroup);
        crown.rotation.x = Math.PI / 2; crown.position.y = 1.4;
      }
      this.fx.add(visual.group);
      if(victim&&["storm","void","prism","nova","phantom","dragon"].includes(skin)){this.animation.execution=new ExecutionVFX(skin);this.fx.add(this.animation.execution.group);}
      this.animation.cracks = this.groundCracks(this.animation);
      this.animation.avatar = createAvatar(move.piece, move.color, skin);
      this.animation.avatarAura = createAvatarAura(move.piece, move.color, skin);
      this.fx.add(this.animation.avatar, this.animation.avatarAura);
      if (victim) {
        const defenderType = victim.userData.piece as PieceSymbol;
        const defenderColor = victim.userData.color as "w" | "b";
        const defenderSkin = victim.userData.skin as SkinId;
        this.animation.defenderAvatar = createAvatar(defenderType, defenderColor, defenderSkin);
        this.animation.defenderAvatar.name = `defender-${defenderType}-${defenderSkin}`;
        this.animation.defenderAura = createAvatarAura(defenderType, defenderColor, defenderSkin);
        this.fx.add(this.animation.defenderAvatar, this.animation.defenderAura);
        const guard = mesh(new THREE.SphereGeometry(0.85, 24, 16), this.barrier(battleColor(move.color === "w" ? "b" : "w", undefined, victim.userData.skin || this.skin)), this.fx);
        guard.name = "defender-guard"; guard.position.copy(victim.position); guard.position.y = 1.15;
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
    const dark = mesh(darkGeometry, new THREE.MeshBasicMaterial({ color: 0x020711, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true }), group);
    dark.castShadow = dark.receiveShadow = false;
    const core = new THREE.LineSegments(lineGeometry, new THREE.LineBasicMaterial({ color: battleColor(a.move.color, undefined, a.skin), transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false }));
    group.add(core); this.groundScars.add(group);
    return { dark, core, stops };
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
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(color) } },
        vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform vec3 uColor; varying vec2 vUv;
          void main() {
            float core = pow(abs(cos(vUv.x * 6.28318)), 8.0);
            float taper = smoothstep(0.0, .12, vUv.y) * (1.0 - smoothstep(.88, 1.0, vUv.y));
            gl_FragColor = vec4(mix(uColor * .7, vec3(.9, .96, 1.0), core * .45), (.16 + core * .42) * taper);
            #include <colorspace_fragment>
          }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      }),
      this.fx,
    );
    o.position.copy(from).add(to).multiplyScalar(0.5);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    return o;
  }
  private animateExecution(a: Animation, t: number) {
    const frame = captureFrame(t);
    const execution=executionFrame(a.skin,t);
    this.stage.dataset.skinExecution=`${a.skin}:${execution.phase}`;
    if(execution.quiet&&!a.quieted){a.quieted=true;this.onAnticipation();}
    const direction = a.duelDirection||a.to.clone().sub(a.from).normalize();
    const side = a.duelSide||new THREE.Vector3(-direction.z, 0, direction.x);
    const duel=a.duel?.sample(t);
    a.duelFrame=duel;
    const defenderPosition=duel?a.duelCentre!.clone().addScaledVector(direction,duel.defender.x).addScaledVector(side,duel.defender.z):a.victimOrigin?.clone();
    if(defenderPosition&&duel)defenderPosition.y=duel.defender.lift;
    const reaction=duel?.defender.guard||0;
    const facing = direction.clone();
    const seconds = t * a.duration / 1000;
    const context = { combat: true, progress: t, approach: frame.approach, opening: frame.opening,
      counter: frame.counter, clash: frame.clash, finisher: frame.finisher, recovery: frame.recovery,
      seconds:frame.seconds,exchange:frame.exchange };
    if (a.avatar) {
      if(duel){a.avatar.position.copy(a.duelCentre!).addScaledVector(direction,duel.attacker.x).addScaledVector(side,duel.attacker.z);a.avatar.position.y=duel.attacker.lift;}
      else a.avatar.position.lerpVectors(a.from,a.stop,frame.approach);
      if (defenderPosition) { facing.copy(defenderPosition).sub(a.avatar.position); facing.y = 0; facing.normalize(); }
      a.avatar.rotation.y = Math.atan2(-facing.x, -facing.z);
      const fade = a.dramatic?(this.dimensionSaved?Math.min(1,Math.max(0,(t-.07)/.025))*(1-frame.recovery):0):Math.min(1,t/.08)*(1-frame.recovery);
      a.avatar.scale.setScalar(1.12 + skins[a.skin].tier * 0.045);
      animateAvatar(a.avatar, a.move.piece,duel?.attacker.charge??frame.charge,duel?.attacker.strike??frame.strike,fade,seconds,
        { ...context,profile:a.profile,skin:a.skin,actionCharge:duel?.attacker.charge,actionProgress:duel?.attacker.strike,guard:duel?.attacker.guard,recoil:duel?.attacker.recoil,aimWeight:duel?.attacker.aimWeight,contactTarget: defenderPosition
          ? [defenderPosition.x, defenderPosition.y + 1.38, defenderPosition.z] : undefined });
      if (a.avatarAura) animateAvatarAura(a.avatarAura,a.avatar,duel?.attacker.charge??frame.charge,fade,seconds);
    }
    if (a.defenderAvatar && defenderPosition) {
      const defender = a.defenderAvatar;
      const fade = a.dramatic?(this.dimensionSaved?Math.min(1,Math.max(0,(t-.07)/.025))*(1-frame.defeat):0):Math.min(1,t/.08)*(1-frame.defeat);
      defender.position.copy(defenderPosition);
      // Face the opponent's current location throughout lateral dodges/counters.
      const incoming = (a.avatar?.position || a.stop).clone().sub(defender.position); incoming.y = 0;
      defender.rotation.y = Math.atan2(-incoming.x, -incoming.z);
      defender.scale.setScalar((1.06 - frame.defeat * 0.25)*(1-execution.collapse*.85));
      if(a.skin==="void")defender.position.y-=execution.collapse*.5;
      const hit = a.impacted ? Math.min(1, Math.max(0, (t - CAPTURE_CONTACT) / 0.09)) : 0;
      const defenderContext={...context,profile:a.defenderProfile,skin:a.defenderProfile?.skin,reaction:a.reaction,
        actionCharge:duel?.defender.charge,actionProgress:duel?.defender.strike,guard:duel?.defender.guard,recoil:duel?.defender.recoil,aimWeight:duel?.defender.aimWeight,
        contactTarget:a.avatar?[a.avatar.position.x,a.avatar.position.y+1.4,a.avatar.position.z] as [number,number,number]:undefined};
      if(t<CAPTURE_CONTACT)animateAvatar(defender,defender.userData.piece,duel?.defender.charge||.2,duel?.defender.strike||0,fade,seconds,defenderContext);
      else animateDefender(defender,defender.userData.piece,hit,fade,seconds,defenderContext);
      if (a.defenderAura) animateAvatarAura(a.defenderAura, defender, 0.25 + reaction * 0.6, fade, seconds);
    }
    if(a.execution)a.execution.update(t,a.avatar?.position||a.from,a.defenderAvatar?.position||a.to);
    if (a.guard) {
      if (a.defenderAvatar) a.guard.position.copy(a.defenderAvatar.position).add(new THREE.Vector3(0, 1.15, 0));
      a.guard.rotation.y = Math.atan2(facing.x, facing.z);
      a.guard.visible = (a.reaction === "barrier" || a.reaction === "shield" || a.reaction === "brace") && reaction>.08 && t<CAPTURE_CONTACT+.03 && (!a.dramatic||!!this.dimensionSaved);
      const scale = 0.86 + reaction * 0.18;
      const depth = a.reaction === "barrier" ? 0.7 : a.reaction === "brace" ? 0.38 : 0.25;
      a.guard.scale.set(scale, scale, scale * depth);
      const uniforms = (a.guard.material as THREE.ShaderMaterial).uniforms;
      uniforms.uTime.value = seconds;
      uniforms.uHit.value = Math.min(1, frame.clash + (a.impacted ? 1 : 0));
      uniforms.uFade.value = Math.min(1, reaction * 2 + (a.impacted ? Math.max(0, 1 - (t - CAPTURE_CONTACT) / 0.05) : 0));
    }
    if (a.victim && a.victimOrigin && a.victimRotation) {
      const recoil = a.impacted ? Math.min(0.22, a.defenderProfile?.motion.recoil || 0.16) : frame.clash * 0.035;
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
  }
  private animateMoveAvatar(a: Animation, t: number, travel: number, charge: number) {
    if (!a.avatar) return;
    const direction = a.to.clone().sub(a.from).normalize();
    const fade = Math.min(1, t / 0.12) * Math.max(0, 1 - (t - 0.68) / 0.2);
    a.avatar.position.copy(a.object.position).addScaledVector(direction, -0.35);
    a.avatar.rotation.y = Math.atan2(-direction.x, -direction.z);
    a.avatar.scale.setScalar(a.dramatic ? 1.16 : 1.0);
    animateAvatar(a.avatar, a.move.piece, charge, travel, fade, t * a.duration / 1000,
      { approach: travel, recovery: Math.max(0, (t - 0.68) / 0.2), profile: a.profile, skin: a.skin });
    if (a.avatarAura) animateAvatarAura(a.avatarAura, a.avatar, charge, fade, t * a.duration / 1000);
  }
  private compactEffects() {
    return this.quality === "low" || (this.quality === "auto" && (this.showcaseHost || this.stage).clientWidth < 700);
  }
  private death(a: Animation) {
    this.onDeath(a.move, a.event);
    if (this.animation !== a) return;
    if (this.reduced) { if (a.victim) a.victim.visible = false; return; }
    const color = battleColor(a.move.color, a.event.story, a.skin);
    const origin = a.defenderAvatar?.position || a.victimOrigin || a.to;
    const tier = skins[a.skin].tier;
    const count = Math.min(this.compactEffects() ? 24 : this.quality === "high" ? 64 : 44, (a.dramatic ? 32 : 22) + tier * 4);
    this.particleMesh = new THREE.InstancedMesh(
      a.skin === "frost" ? new THREE.OctahedronGeometry(1) : a.move.piece === "r" ? new THREE.BoxGeometry(1, 1, 1) : new THREE.IcosahedronGeometry(1),
      new THREE.MeshBasicMaterial({ color }), count,
    );
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleMesh.frustumCulled = false;
    this.fx.add(this.particleMesh);
    const direction = a.to.clone().sub(a.from).normalize();
    const random = (i: number, channel: number) => { const x = Math.sin((a.sequence + 1) * 12.9898 + i * 78.233 + channel * 39.425) * 43758.5453; return x - Math.floor(x); };
    for (let i = 0; i < count; i++) {
      const angle = i * Math.PI * 2 / count;
      const sideways = a.move.piece === "q" ? 0.6 : a.move.piece === "r" ? 3.8 : a.dramatic ? 4 : 2;
      const upward = a.move.piece === "b" ? 4.5 : a.move.piece === "r" ? 0.5 : 1.7;
      const velocity = new THREE.Vector3(Math.cos(angle) * sideways, upward + random(i, 0) * 1.5, Math.sin(angle) * sideways);
      if (a.move.piece === "n" || a.move.piece === "p") velocity.addScaledVector(direction, a.move.piece === "n" ? 3.5 : 2);
      if (a.skin === "ember") velocity.y += 1.5;
      if (a.skin === "astral") { velocity.x *= 0.45; velocity.z *= 0.45; velocity.y += 2; }
      if (a.skin === "royal") velocity.y = i % 2 ? 3 : 0.5;
      this.sparks.push({ position: origin.clone().add(new THREE.Vector3(Math.cos(angle) * 0.18, 0.15 + random(i, 1) * 0.75, Math.sin(angle) * 0.18)),
        velocity, life: 1, size: (a.move.piece === "r" ? 0.07 : 0.03) + random(i, 2) * 0.045 });
    }
  }
  private impact(a: Animation) {
    const color = battleColor(a.move.color, a.event.story, a.skin);
    this.onImpact(a.move, a.event);
    if (this.animation !== a) return;
    if (this.reduced) {
      if (a.victim) { a.died = true; this.death(a); }
      return;
    }
    this.environment.react(a.victimOrigin || a.to);
    if(a.duel&&a.dramatic)return;
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
          this.barrier(color),
          this.fx,
          pos.x,
          0.55,
          pos.z,
        );
        shield.scale.y = 1.3;
      }
    }
  }
  private barrier(color: number) {
    return new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uHit: { value: 0 }, uFade: { value: 1 } },
      vertexShader: `varying vec3 vNormal, vView; varying vec2 vUv;
        void main() { vec4 p = modelViewMatrix * vec4(position, 1.0); vView = -p.xyz; vNormal = normalize(normalMatrix * normal); vUv = uv;
          gl_Position = projectionMatrix * p; }`,
      fragmentShader: `uniform vec3 uColor; uniform float uTime, uHit, uFade;
        varying vec3 vNormal, vView; varying vec2 vUv;
        void main() {
          float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 3.5);
          float grid = pow(abs(sin(vUv.x * 75.398 + sin(vUv.y * 25.133) * .5)), 24.0) * pow(abs(sin(vUv.y * 37.699)), 8.0);
          float scan = pow(max(0.0, sin(vUv.y * 18.85 - uTime * 2.0)), 14.0);
          float alpha = (rim * (.3 + uHit * .25) + grid * .07 + scan * .04) * uFade;
          if (alpha < .003) discard;
          gl_FragColor = vec4(mix(uColor * .65, vec3(.87, .95, 1.0), rim * .45), alpha);
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      side: THREE.DoubleSide, forceSinglePass: true,
    });
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
  private directCamera(a: Animation, t: number) {
    const smooth = (value: number) => { const x = Math.max(0, Math.min(1, value)); return x * x * (3 - 2 * x); };
    const attack = a.duelDirection?.clone()||a.to.clone().sub(a.from).normalize();
    const side = new THREE.Vector3(-attack.z, 0, attack.x).multiplyScalar(this.flipped ? -1 : 1);
    const capture = a.move.captured ? captureFrame(t) : null;
    const sweep = Math.sin(Math.min(1, t / (capture ? CAPTURE_CONTACT : 0.52)) * Math.PI) * (a.move.piece === "n" ? 0.17 : 0.09);
    const counterArc = capture ? Math.sin(capture.counter * Math.PI) : 0;
    const angle = 0.22 + sweep + (capture ? capture.opening * 0.11 - counterArc * 0.17 : 0);
    const view = side.multiplyScalar(a.profile.camera.side).addScaledVector(attack, angle)
      .add(new THREE.Vector3(0, 0.54 + sweep * 0.3 - (capture?.finisher || 0) * 0.05, 0));
    this.stage.dataset.cameraShot = capture ? t>=.94 ? "return"
      : capture.combatPhase === "finisher" ? "closeup" : capture.combatPhase === "defense" ? "counter"
        : capture.combatPhase === "opening" ? "tracking" : "faceoff" : "tracking";
    const actors = [a.avatar, a.defenderAvatar].filter((actor): actor is THREE.Group => !!actor);
    const bounds = actors.map((actor) => {
      const height = actor === a.avatar && a.move.piece === "k" ? 3.9 : 3.5;
      // Stable envelopes avoid zoom jitter as articulated limbs swing.
      const box = new THREE.Box3().setFromCenterAndSize(actor.position.clone().add(new THREE.Vector3(0, height / 2, 0)), new THREE.Vector3(2.4, height, 2.4));
      box.union(new THREE.Box3().setFromObject(actor));
      const aura = actor === a.avatar ? a.avatarAura : a.defenderAura;
      if (aura) box.union(new THREE.Box3().setFromObject(aura));
      return box.expandByScalar(0.05);
    });
    if(a.execution?.skin==="prism"&&a.avatar)bounds.push(new THREE.Box3().setFromCenterAndSize(a.avatar.position.clone().add(new THREE.Vector3(0,1.5,0)),new THREE.Vector3(3.8,3.1,3.8)));
    if (!a.move.captured) bounds.push(new THREE.Box3().setFromCenterAndSize(a.to.clone().add(new THREE.Vector3(0, 0.6, 0)), new THREE.Vector3(1.2, 1.2, 1.2)));
    if (!a.move.captured && ["check", "mate", "double-check", "discovered-check"].includes(a.event.kind)) {
      const king = kingSquare(a.after, a.after.turn());
      if (king) bounds.push(new THREE.Box3().setFromCenterAndSize(coords(king).add(new THREE.Vector3(0, 0.7, 0)), new THREE.Vector3(1.3, 1.4, 1.3)));
    }
    const shot = frameCombat(bounds, view, this.camera.fov, this.camera.aspect);
    // Dolly within the safe fit envelope: close-ups retain both fighters and
    // their weapons, even when the phone's portrait viewport narrows the frame.
    const dolly = capture ? 1 + 0.045 * Math.sin(capture.opening * Math.PI) + 0.025 * counterArc : 1;
    shot.position.sub(shot.focus).multiplyScalar(dolly).add(shot.focus);
    const entering = this.dimensionSaved?1:smooth(t / (capture ? .07 : 0.1));
    const returnAt = capture ? CAPTURE_DEATH : 0.82;
    const returning = this.dimensionSaved?0:smooth((t - returnAt) / (1 - returnAt));
    const position = capture&&t>=.94?a.camera.clone():a.camera.clone().lerp(shot.position, entering).lerp(a.camera, returning);
    const focus = capture&&t>=.94?a.target.clone():a.target.clone().lerp(shot.focus, entering).lerp(a.target, returning);
    const contact = a.move.captured ? CAPTURE_CONTACT : 0.52;
    const clashShake = capture && capture.contactPulse>.4 && t<CAPTURE_CONTACT;
    if ((t >= contact && t < contact + 0.05) || clashShake) {
      const shake = (clashShake?capture!.contactPulse:1-(t-contact)/.05)*a.profile.camera.shake*(clashShake?.25:.65);
      position.x += Math.sin(t * 200) * shake;
      position.y += Math.cos(t * 150) * shake * 0.5;
    }
    this.camera.position.copy(position);
    this.controls.target.copy(focus);
    this.camera.lookAt(focus);
    if (this.scene.fog instanceof THREE.Fog) {
      const distance = position.distanceTo(focus);
      this.scene.fog.near = distance + 6; this.scene.fog.far = distance + 18;
      }
  }
  private frame(now: number) {
    if (this.presentationPaused) { this.previous = now; return; }
    const elapsed = now - this.previous;
    const dt = Math.max(0, Math.min(elapsed / 1000, 0.05));
    this.previous = now;
    this.environment.update(now / 1000, this.quality === "low", this.reduced);
    this.animateCelebration(now);
    if (this.cameraReturn) {
      const returning = this.cameraReturn, p = Math.max(0, Math.min(1, (now - returning.start) / 150));
      const ease = p * p * (3 - 2 * p);
      this.camera.position.lerpVectors(returning.position, returning.camera, ease);
      this.controls.target.lerpVectors(returning.focus, returning.target, ease);
      this.camera.lookAt(this.controls.target); this.dirty = true;
      if (this.scene.fog instanceof THREE.Fog) {
        const distance = this.camera.position.distanceTo(this.controls.target);
        this.scene.fog.near = distance + 6; this.scene.fog.far = distance + 18;
      }
      if (p === 1) { this.cameraReturn = undefined; this.controls.enabled = !this.presentationPaused; }
    }
    if (this.controls.enabled) this.controls.update();
    const a = this.animation;
    if (a) {
      const t = Math.max(0, Math.min((now - a.start) / a.duration, 1));
      this.updateDimension(a,t);
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
          this.stage.dataset.combatPhase = capture.combatPhase;
          this.stage.dataset.defenderStatus = capture.death ? "defeated" : capture.impact ? "hit"
            : capture.combatPhase === "defense" ? "counter" : "guard";
        }

      }
      if (!a.launched && t >= (this.reduced ? 0 : capture ? .45/5 : a.dramatic ? 0.3 : 0.22)) {
        a.launched = true; this.onDash(a.move, a.event);
        if (this.animation !== a) return;
      }
      if (a.dramatic) {
        if (capture) this.overlay.drawCapture(t, a.move.piece, a.move.color, a.event.title);
        else this.overlay.draw(t, a.move.piece, a.move.color, a.event.title);
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
      const contact = this.reduced ? 0.58 : capture ? CAPTURE_CONTACT : a.dramatic ? 0.52 : 0.62;
      if (!a.impacted && t >= contact) {
        a.impacted = true;
        this.impact(a);
        if (this.animation !== a) return;
      }
      if (capture) {
        this.animateExecution(a, t);
        if (!a.died && capture.death) { a.died = true; this.death(a); if (this.animation !== a) return; }
      } else if (!this.reduced) this.animateMoveAvatar(a, t, travel, a.dramatic ? choreography.charge : short.charge);
      a.skillFx?.update(t,a.avatar?.position||a.object.position,a.defenderAvatar?.position||a.victimOrigin||a.to,contact);
      if (a.vfx) {
        a.vfx.update({ time: t * a.duration / 1000, progress: t,
          phase: capture?.phase || (a.dramatic ? choreography.phase : short.phase),
          charge: capture?.charge ?? (a.dramatic ? choreography.charge : short.charge),
          travel,strike:a.duelFrame?.attacker.strike??capture?.strike??travel,defeat: capture?.defeat ?? 0,
          from: this.dimensionSaved&&a.avatar?a.avatar.position:a.from,to:this.dimensionSaved&&a.defenderAvatar?a.defenderAvatar.position:a.to,actor: a.avatar?.position || a.object.position,
          target: a.defenderAvatar?.position || a.victimOrigin || a.to,
          contact: a.impacted, dead: a.died, contactAt: contact,
          opening: capture?.opening, counter: capture?.counter, clash: capture?.clash,
          finisher: capture?.finisher, recovery: capture?.recovery,
          attackerCharge:a.duelFrame?.attacker.charge,attackerStrike:a.duelFrame?.attacker.strike,attackerGuard:a.duelFrame?.attacker.guard,
          defenderCharge:a.duelFrame?.defender.charge,defenderStrike:a.duelFrame?.defender.strike,defenderGuard:a.duelFrame?.defender.guard,contactPulse:capture?.contactPulse });
      }
      if (a.dramatic) {
        this.directCamera(a, t);
      }
      if (capture) {
        while (a.cueIndex < captureCuePoints.length && t >= captureCuePoints[a.cueIndex].at) {
          const point = captureCuePoints[a.cueIndex++];
          this.stage.dataset.combatCue = point.cue;
          this.onCombatCue(a.move, a.event, point.cue, point.actor,
            point.actor === "defender" ? a.defenderProfile?.skin || a.skin : a.skin);
          // A skip/reset issued by a cue listener invalidates the whole frame.
          if (this.animation !== a) return;
        }
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
      const material = (rune as THREE.Mesh).material;
      if (material instanceof THREE.ShaderMaterial) material.uniforms.uTime.value = now / 1000;
    }
    for (const scar of [...this.groundScars.children]) {
      if (scar.userData.active) continue;
      const fade = Math.max(0, 1 - (now - scar.userData.born) / 7000);
      if (!fade) { disposeObject(scar); this.dirty = true; continue; }
      for (const child of scar.children) (child as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material.opacity = fade * (child instanceof THREE.Line ? 0.65 : 0.5);
    }
    // A low-rate idle pulse shares the same two aura batches. Orbit still follows display frames.
    if (((!this.reduced && this.environment.root.children.length) || this.groundAuras.children.length || this.groundScars.children.length) && now - this.lastAuraDraw >= (this.quality === "low" ? 125 : 50)) this.dirty = true;
    // Narrow screens reduce VFX batches before motion. Rendering still follows
    // display frames; a second FPS gate makes orbit and contact poses judder.
    if (this.dirty) {
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
