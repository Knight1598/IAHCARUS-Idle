import { waapi, type WAAPIAnimation } from "animejs/waapi";

/** Short, compositor-only transitions. No animation loop runs during a match. */
export class GameMotion {
  private readonly groups = new Map<HTMLElement, Set<WAAPIAnimation>>();
  private readonly preference: MediaQueryList;

  constructor(private readonly host: HTMLElement) {
    this.preference = host.ownerDocument.defaultView!.matchMedia("(prefers-reduced-motion: reduce)");
    host.dataset.motionEngine = "animejs";
    this.syncPreference();
    this.preference.addEventListener("change", this.syncPreference);
    host.ownerDocument.addEventListener("visibilitychange", this.onVisibilityChange);
    host.ownerDocument.addEventListener("change", this.onGamePreference);
  }

  private get reduced() {
    return this.preference.matches || !!this.host.ownerDocument.querySelector<HTMLInputElement>('#reduced')?.checked;
  }

  private onGamePreference = (event: Event) => {
    if (event.target instanceof HTMLElement && event.target.id === 'reduced') this.syncPreference();
  };

  private syncPreference = () => {
    this.host.dataset.motionMode = this.reduced ? "reduced" : "full";
    if (this.reduced) this.cancelAll();
  };

  private onVisibilityChange = () => {
    if (this.host.ownerDocument.hidden) this.cancelAll();
  };

  /** The result is already actionable; motion never delays a button or a reward. */
  enter(scope: HTMLElement, cards: HTMLElement[] = [], reveal = false) {
    this.cancel(scope);
    scope.dataset.motionState = "idle";
    if (this.reduced || this.host.hidden || !scope.isConnected ||
        typeof scope.animate !== "function") return;

    // Animate only a small, visible set. Large shops keep the rest of their cards static.
    const visible = cards.filter(card => !card.closest("[hidden]")).slice(0, reveal ? 10 : 12);
    const group = new Set<WAAPIAnimation>();
    this.groups.set(scope, group);
    scope.dataset.motionState = "entering";
    const finish = (animation: WAAPIAnimation) => {
      // Restore the original styles, including theme hover transforms.
      animation.revert();
      group.delete(animation);
      if (this.groups.get(scope) === group && !group.size) {
        this.groups.delete(scope);
        scope.dataset.motionState = "idle";
      }
      this.updateActive();
    };
    group.add(waapi.animate(scope, {
      opacity: [0, 1],
      duration: reveal ? 160 : 200,
      ease: "outCubic",
      onComplete: finish,
    }));
    if (visible.length) group.add(waapi.animate(visible, {
      opacity: [0, 1],
      transform: reveal
        ? ["translateY(12px) scale(.97)", "translateY(0px) scale(1)"]
        : ["translateY(9px)", "translateY(0px)"],
      duration: reveal ? 260 : 210,
      delay: (_target, index) => Math.min(index, reveal ? 9 : 6) * (reveal ? 35 : 24),
      ease: "outCubic",
      onComplete: finish,
    }));
    this.updateActive();
  }

  cancel(scope: HTMLElement) {
    const group = this.groups.get(scope);
    if (!group) return;
    this.groups.delete(scope);
    for (const animation of group) animation.revert();
    group.clear();
    scope.dataset.motionState = "idle";
    this.updateActive();
  }

  cancelAll() {
    for (const scope of this.groups.keys()) this.cancel(scope);
    this.updateActive();
  }

  private updateActive() {
    this.host.dataset.motionActive = String(this.groups.size);
  }

  dispose() {
    this.cancelAll();
    this.preference.removeEventListener("change", this.syncPreference);
    this.host.ownerDocument.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.host.ownerDocument.removeEventListener("change", this.onGamePreference);
  }
}
