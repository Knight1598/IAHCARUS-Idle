import type { AudioBus } from "./sound";

export const mixDefaults: Record<AudioBus, number> = { master: .35, music: .38, ambience: .28, sfx: .82, cinematic: .9 };
export interface AudioPreferences { levels: Record<AudioBus, number>; muted: boolean }
export function readAudioPreferences(raw: string | null): AudioPreferences {
  const levels = { ...mixDefaults }; let muted = false;
  try {
    const parsed = JSON.parse(raw || "null");
    for (const bus of Object.keys(levels) as AudioBus[]) {
      const value = parsed?.levels?.[bus];
      if (typeof value === "number" && Number.isFinite(value)) levels[bus] = Math.max(0, Math.min(1, value));
    }
    muted = parsed?.muted === true;
  } catch { /* Invalid saved preferences use the balanced mix. */ }
  return { levels, muted };
}

export function installAudioControls(host: HTMLElement, preferences: AudioPreferences,
  change: (bus: AudioBus | "mute", value: number | boolean) => void) {
  const labels = { music: "ดนตรี", ambience: "บรรยากาศสนาม", sfx: "เสียงการเดินและเหตุการณ์", cinematic: "เสียงคัตซีน" };
  const group = document.createElement("fieldset"); group.className = "audio-mix";
  group.innerHTML = `<legend>มิกซ์เสียงจักรวาล</legend><p>เปิดเสียงด้วยปุ่มเสียงก่อนฟัง · ปรับแต่ละส่วนได้</p>${Object.entries(labels).map(([bus, label]) =>
    `<label class="setting-select" for="audio-${bus}">${label}<span><input id="audio-${bus}" data-audio-bus="${bus}" type="range" min="0" max="100" value="${Math.round(preferences.levels[bus as AudioBus] * 100)}" aria-label="${label}"><output>${Math.round(preferences.levels[bus as AudioBus] * 100)}%</output></span></label>`).join("")}
    <label><input id="audio-mute" type="checkbox" ${preferences.muted ? "checked" : ""}> ปิดเสียงทุกส่วน</label>`;
  host.append(group);
  group.querySelectorAll<HTMLInputElement>("[data-audio-bus]").forEach(input => {
    input.oninput = () => {
      input.nextElementSibling!.textContent = `${input.value}%`;
      change(input.dataset.audioBus as AudioBus, Number(input.value) / 100);
    };
  });
  group.querySelector<HTMLInputElement>("#audio-mute")!.onchange = e => change("mute", (e.target as HTMLInputElement).checked);
}
