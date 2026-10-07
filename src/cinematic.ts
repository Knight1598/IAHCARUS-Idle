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
    // The diagonally clipped cut-in is a manga panel, drawn entirely in code.
    if (t < 0.3) {
      const appear = Math.min(1, t / 0.045);
      const band = h * 0.21;
      const y = h * 0.54;
      c.save();
      c.globalAlpha = appear;
      c.beginPath();
      c.moveTo(0, y + band * 0.25);
      c.lineTo(w, y - band * 0.6);
      c.lineTo(w, y + band * 0.4);
      c.lineTo(0, y + band * 1.25);
      c.closePath();
      c.clip();
      c.fillStyle = "#050912ed";
      c.fillRect(0, y - band, w, band * 3);
      c.strokeStyle = accent;
      c.lineWidth = 2;
      for (let i = 0; i < 12; i++) {
        const x = ((i / 12) * w + t * w * 2) % w;
        c.beginPath();
        c.moveTo(x, y - band);
        c.lineTo(x - w * 0.24, y + band * 2);
        c.stroke();
      }
      c.font = `900 italic ${Math.min(65, w * 0.09)}px system-ui`;
      c.fillStyle = accent;
      c.shadowColor = accent;
      c.shadowBlur = 12;
      c.textAlign = "center";
      c.fillText(title || "ROYAL POWER", w * 0.5, y + band * 0.5);
      c.restore();
    }
    if (t >= 0.3 && t < 0.84) {
      const cx = w * 0.5,
        cy = h * 0.49;
      const strength = f.phase === "impact" ? 1 : 0.55;
      c.lineCap = "round";
      for (let i = 0; i < 48; i++) {
        const a = (i * Math.PI * 2) / 48 + Math.sin(i * 7) * 0.02;
        const near = Math.min(w, h) * (0.25 + (i % 5) * 0.025),
          far = Math.max(w, h) * 1.2;
        c.strokeStyle = i % 3 === 0 ? accent : "#e7f1ff";
        c.globalAlpha = fade * strength * (0.16 + (i % 4) * 0.1);
        c.lineWidth = i % 6 === 0 ? 3 : 1;
        c.beginPath();
        c.moveTo(cx + Math.cos(a) * near, cy + Math.sin(a) * near);
        c.lineTo(cx + Math.cos(a) * far, cy + Math.sin(a) * far);
        c.stroke();
      }
      c.globalAlpha = fade;
    }
    if (f.phase === "impact") {
      c.save();
      c.translate(w * 0.5, h * 0.53);
      c.rotate(-0.12);
      c.fillStyle = "#040713";
      c.globalAlpha = 0.8;
      c.beginPath();
      for (let i = 0; i < 24; i++) {
        const a = (i * Math.PI) / 12;
        const r = (i % 2 ? 1 : 0.5) * Math.min(w, h) * 0.29;
        c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      c.closePath();
      c.fill();
      c.globalAlpha = 1;
      c.font = `900 italic ${Math.min(78, w * 0.13)}px system-ui`;
      c.textAlign = "center";
      c.lineWidth = 6;
      c.strokeStyle = "#07111f";
      c.strokeText(
        type === "n" ? "BREAK!" : type === "q" ? "ECLIPSE!" : "IMPACT!",
        0,
        12,
      );
      c.fillStyle = accent;
      c.fillText(
        type === "n" ? "BREAK!" : type === "q" ? "ECLIPSE!" : "IMPACT!",
        0,
        12,
      );
      c.restore();
    }
    // A single soft impact pulse; no repeating fullscreen flashes.
    if (f.flash > 0) {
      c.globalAlpha = f.flash * 0.2;
      c.fillStyle = accent;
      c.fillRect(0, 0, w, h);
    }
    c.restore();
  }
}
