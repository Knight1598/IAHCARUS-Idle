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
  constructor(stage: HTMLElement) {
    this.stage = stage;
    this.canvas.className = "battle-overlay";
    this.canvas.setAttribute("aria-hidden", "true");
    this.ctx = this.canvas.getContext("2d")!;
    stage.append(this.canvas);
  }
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    delete this.stage.dataset.battlePhase;
  }
  draw(t: number, type: string, color: "w" | "b", title: string) {
    const w = this.stage.clientWidth,
      h = this.stage.clientHeight;
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
      c.lineCap = "round";
      for (let i = 0; i < 24; i++) {
        const a = (i * Math.PI * 2) / 24 + Math.sin(i * 7) * 0.02;
        const near = Math.min(w, h) * (0.45 + (i % 5) * 0.025),
          far = Math.max(w, h) * 1.2;
        c.strokeStyle = i % 3 === 0 ? accent : "#e7f1ff";
        c.globalAlpha = fade * strength * (0.06 + (i % 4) * 0.03);
        c.lineWidth = i % 6 === 0 ? 3 : 1;
        c.beginPath();
        c.moveTo(cx + Math.cos(a) * near, cy + Math.sin(a) * near);
        c.lineTo(cx + Math.cos(a) * far, cy + Math.sin(a) * far);
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
