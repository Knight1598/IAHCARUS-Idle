import type { AudioBus } from "./sound";
import type { AudioProcessingMode } from "./audio-processing";

export const mixDefaults: Record<AudioBus, number> = { master: .35, music: .38, ambience: .28, sfx: .82, cinematic: .9 };
export interface AudioPreferences { levels: Record<AudioBus, number>; muted: boolean; processing: AudioProcessingMode }
const processingLabels: Record<AudioProcessingMode, string> = {
  cinematic: "เสียงภาพยนตร์", focused: "เสียงคมชัด", dry: "เสียงต้นฉบับ",
};
const processingDescriptions: Record<AudioProcessingMode, string> = {
  cinematic: "เสียงต่อสู้มีน้ำหนักและมิติ เหมาะกับการชมคัตซีน",
  focused: "ลดหางเสียงให้กระชับ ฟังจังหวะเดินและอ่านเกมกระดานได้ง่ายขึ้น",
  dry: "ฟังเสียงต้นฉบับก่อนปรุงแต่ง เพื่อเปรียบเทียบรูปแบบเสียง",
};
function readProcessingMode(value: unknown): AudioProcessingMode {
  return value === "focused" || value === "dry" ? value : "cinematic";
}
export function readAudioPreferences(raw: string | null): AudioPreferences {
  const levels = { ...mixDefaults }; let muted = false, processing: AudioProcessingMode = "cinematic";
  try {
    const parsed = JSON.parse(raw || "null");
    for (const bus of Object.keys(levels) as AudioBus[]) {
      const value = parsed?.levels?.[bus];
      if (typeof value === "number" && Number.isFinite(value)) levels[bus] = Math.max(0, Math.min(1, value));
    }
    muted = parsed?.muted === true;
    processing = readProcessingMode(parsed?.processing);
  } catch { /* Invalid saved preferences use the balanced mix. */ }
  return { levels, muted, processing };
}

export function installAudioControls(host: HTMLElement, preferences: AudioPreferences,
  change: (bus: AudioBus | "mute" | "processing", value: number | boolean | AudioProcessingMode) => void) {
  const labels = { music: "ดนตรี", ambience: "บรรยากาศสนาม", sfx: "เสียงการเดินและเหตุการณ์", cinematic: "เสียงคัตซีน" };
  const group = document.createElement("fieldset"); group.className = "audio-mix";
  const processing = readProcessingMode(preferences.processing);
  group.innerHTML = `<legend>มิกซ์เสียงจักรวาล</legend><p>เปิดเสียงด้วยปุ่มเสียงก่อนฟัง · ปรับแต่ละส่วนได้</p>
    <label class="setting-select audio-processing-control" for="audio-processing">รูปแบบเสียง<select id="audio-processing" aria-describedby="audio-processing-help">${Object.entries(processingLabels).map(([mode, label]) => `<option value="${mode}" ${mode === processing ? "selected" : ""}>${label}</option>`).join("")}</select></label>
    <p id="audio-processing-help" class="audio-processing-help">${processingDescriptions[processing]}</p>${Object.entries(labels).map(([bus, label]) =>
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
  group.querySelector<HTMLSelectElement>("#audio-processing")!.onchange = e => {
    const mode = readProcessingMode((e.target as HTMLSelectElement).value);
    group.querySelector<HTMLElement>("#audio-processing-help")!.textContent = processingDescriptions[mode];
    change("processing", mode);
  };
}
