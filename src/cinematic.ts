import { CAPTURE_CONTACT, CAPTURE_DEATH } from "./combat.ts";
/** Choreography is visual only; authoritative chess state is already committed. */
export function cinematicFrame(progress: number) {
  const t = Math.max(0, Math.min(1, progress));
  const smooth = (x: number) => {
    x = Math.max(0, Math.min(1, x));
    return x * x * (3 - 2 * x);
  };
  const phase =
    t < 0.3
      ? "charge"
      : t < 0.52
        ? "dash"
        : t < 0.6
          ? "impact"
          : t < 0.84
            ? "aftermath"
            : "return";
  // Hold both attacker and camera at impact, then ease back to the board.
  const travel = t < 0.3 ? 0 : t < 0.44 ? smooth((t - 0.3) / 0.14) * 0.88
    : t < 0.52 ? 0.88 + smooth((t - 0.44) / 0.08) * 0.12 : 1;
  return {
    phase,
    travel,
    charge: smooth(t / 0.3),
    impact: t >= 0.52,
    release: smooth((t - 0.6) / 0.24),
    returning: smooth((t - 0.84) / 0.16),
    flash: t >= 0.52 && t < 0.57 ? Math.sin(((t - 0.52) / 0.05) * Math.PI) : 0,
  };
}
export class BattleOverlay {
  readonly canvas = document.createElement("canvas");
  private ctx: CanvasRenderingContext2D;
  private stage: HTMLElement;
  private surface: HTMLElement;
  constructor(stage: HTMLElement) {
    this.stage = stage;
    this.surface = stage;
    this.canvas.className = "battle-overlay";
    this.canvas.setAttribute("aria-hidden", "true");
    this.ctx = this.canvas.getContext("2d")!;
    stage.append(this.canvas);
  }
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    delete this.stage.dataset.battlePhase;
  }
  setSurface(surface: HTMLElement) { this.surface=surface; }
  /** Reuse the same overlay; its soft contact flash follows the final strike. */
  drawCapture(t: number, type: string, color: "w" | "b", title: string) {
    const opening = .45 / 5, contactEnd = CAPTURE_CONTACT + .025;
    const progress = t < opening ? t / opening * 0.3
      : t < CAPTURE_CONTACT ? 0.3 + (t - opening) / (CAPTURE_CONTACT - opening) * 0.22
      : t < contactEnd ? 0.52 + (t - CAPTURE_CONTACT) / (contactEnd - CAPTURE_CONTACT) * 0.08
      : t < CAPTURE_DEATH ? 0.6 + (t - contactEnd) / (CAPTURE_DEATH - contactEnd) * 0.24
      : 0.84 + (t - CAPTURE_DEATH) / (1 - CAPTURE_DEATH) * 0.16;
    this.draw(progress, type, color, title);
  }
  draw(t: number, type: string, color: "w" | "b", _title: string) {
    const w = this.surface.clientWidth,
      h = this.surface.clientHeight;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    const c = this.ctx;
    c.clearRect(0, 0, w, h);
    const f = cinematicFrame(t);
    this.stage.dataset.battlePhase = f.phase;
    const accent = color === "w" ? "#8dfff0" : "#c3a1ff";
    const fade = 1 - f.returning;
    c.save();
    c.globalAlpha = fade;
    if (t >= 0.3 && t < 0.84) {
      const cx = w * 0.5,
        cy = h * 0.49;
      const strength = f.phase === "impact" ? 1 : 0.55;
      const style = Math.max(0, ["p", "n", "b", "r", "q", "k"].indexOf(type));
      // Thin class-specific streaks stay around the frame; the combat pair stays clear.
      const vignette = c.createRadialGradient(cx, cy, Math.min(w, h) * .4, cx, cy, Math.max(w, h) * .72);
      vignette.addColorStop(0, "transparent"); vignette.addColorStop(1, "rgba(3,7,20,.38)");
      c.fillStyle = vignette; c.fillRect(0, 0, w, h);
      c.lineCap = "round";
      for (let i = 0; i < 24 + style * 2; i++) {
        const a = (i * Math.PI * 2) / (24 + style * 2) + Math.sin(i * 7) * 0.02 + (style === 1 ? .15 : 0);
        const near = Math.min(w, h) * (0.48 + (i % 5) * 0.025),
          far = Math.max(w, h) * 1.2;
        const sx = cx + Math.cos(a) * near, sy = cy + Math.sin(a) * near;
        const ex = cx + Math.cos(a) * far, ey = cy + Math.sin(a) * far;
        const gradient = c.createLinearGradient(sx, sy, ex, ey);
        gradient.addColorStop(0, "transparent"); gradient.addColorStop(.5, i % 3 === 0 ? accent : "#e7f1ff");
        gradient.addColorStop(1, "transparent"); c.strokeStyle = gradient;
        c.globalAlpha = fade * strength * (0.06 + (i % 4) * 0.03);
        c.lineWidth = i % 6 === 0 ? 3 : 1;
        c.beginPath();
        c.moveTo(sx, sy);
        if (style === 1 || style === 4) c.quadraticCurveTo(cx + Math.cos(a + .08) * far * .65, cy + Math.sin(a + .08) * far * .65, ex, ey);
        else c.lineTo(ex, ey);
        c.stroke();
      }
      c.globalAlpha = fade;
    }
    // A single soft impact pulse; no repeating fullscreen flashes.
    if (f.flash > 0) {
      c.globalAlpha = f.flash * 0.06;
      c.fillStyle = accent;
      c.fillRect(0, 0, w, h);
    }
    c.restore();
  }
}
