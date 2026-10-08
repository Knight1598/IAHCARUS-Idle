import { icon } from "./design";
import "./player.css";

export interface PlayerCharacter {
  name: string;
  silhouette: "sentinel" | "striker" | "oracle";
  crest: "crown" | "wing" | "blade" | "prism";
  accent: "cyan" | "violet" | "amber" | "rose";
}
interface AccountUser { id: string; username: string; character: PlayerCharacter; progression?: unknown }
interface AccountResponse { available?: boolean; user?: AccountUser | null; error?: string; message?: string }
interface PlayerOptions {
  offline: boolean;
  onIdentity?: (character: PlayerCharacter, username?: string) => void;
  getProgression?: () => unknown;
  applyProgression?: (data: unknown) => void;
}
const playerKey = "special-chess-player-v1";
const silhouettes = { sentinel: "ผู้พิทักษ์", striker: "ผู้จู่โจม", oracle: "นักวางแผน" } as const;
const crests = { crown: "มงกุฎ", wing: "ปีก", blade: "คมดาบ", prism: "ผลึก" } as const;
const accents = { cyan: { name: "ฟ้าอาร์ก", color: "#82f0ff" }, violet: { name: "ม่วงนีออน", color: "#ae92ff" }, amber: { name: "ทองอำพัน", color: "#ffc17a" }, rose: { name: "กุหลาบพลังงาน", color: "#ff7caa" } } as const;
const fallback: PlayerCharacter = { name: "ผู้เล่น", silhouette: "sentinel", crest: "crown", accent: "cyan" };
function escape(value: string) { return value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)); }
function normalize(raw: unknown): PlayerCharacter {
  const value = raw && typeof raw === "object" ? raw as Partial<PlayerCharacter> : {};
  const name = typeof value.name === "string" ? value.name.trim().normalize("NFC") : fallback.name;
  return {
    name: [...name].length >= 2 && [...name].length <= 24 ? name : fallback.name,
    silhouette: value.silhouette && Object.hasOwn(silhouettes, value.silhouette) ? value.silhouette : "sentinel",
    crest: value.crest && Object.hasOwn(crests, value.crest) ? value.crest : "crown",
    accent: value.accent && Object.hasOwn(accents, value.accent) ? value.accent : "cyan",
  };
}
function crestPaths(crest: PlayerCharacter["crest"]) {
  return ({
    crown: '<path d="m61 34 8 14 11-21 11 21 8-14-4 26H65Z"/><path d="M66 66h28" fill="none" stroke="currentColor" stroke-width="3"/>',
    wing: '<path d="m79 34-26 8 8 8-14 8 26 7 6-15Zm2 0 26 8-8 8 14 8-26 7-6-15Z"/>',
    blade: '<path d="m80 29 8 13-5 18 12 5-3 5-10-4-2 10-2-10-10 4-3-5 12-5-5-18Z"/>',
    prism: '<path d="m80 28 20 20-20 24-20-24Zm0 8-12 12 12 16 12-16Z" fill-rule="evenodd"/>',
  } as const)[crest];
}

/** A portrait built from our own polygons: no images, fonts or external assets. */
export function playerPortrait(character: PlayerCharacter, className = ""): string {
  const value = normalize(character), color = accents[value.accent].color;
  const body = value.silhouette === "sentinel"
    ? '<path d="m27 156 12-36 28-15h26l28 15 12 36-21 19H48Z" fill="#172b44"/><path d="m39 120 25 9-14 35-20-12Zm82 0-25 9 14 35 20-12Z" fill="currentColor" opacity=".35"/><path d="m64 111 16 10 16-10-4 55H68Z" fill="#29415c"/><path d="m48 142 18 7m46-7-18 7" stroke="currentColor" stroke-width="3"/>'
    : value.silhouette === "striker"
      ? '<path d="m39 153 20-38 18-9h13l22 20 14 35-28 15H57Z" fill="#172b44"/><path d="m39 153 19-34 14 10-11 38Zm50-44 18 15 11 26-17-5Z" fill="currentColor" opacity=".4"/><path d="m121 90 7 5-48 82-9-3Z" fill="#48627e"/><path d="m113 115 15 10m-18-17 6-10" stroke="currentColor" stroke-width="4"/><path d="m68 127 25 9-7 35H65Z" fill="#29415c"/>'
      : '<path d="m47 164 12-42 12-13h18l12 13 12 42-33 14Z" fill="#172b44"/><path d="m59 122 21 14 21-14-6 47-15 9-15-9Z" fill="#29415c"/><path d="m80 135-6 30 6 7 6-7Z" fill="currentColor" opacity=".7"/><path d="M122 91v74m-8-68 8-12 8 12-8 12Z" fill="none" stroke="currentColor" stroke-width="3"/><path d="m46 132 8 10-8 10-8-10Z" fill="currentColor" opacity=".6"/>';
  const helmet = value.silhouette === "oracle"
    ? '<path d="m80 72 20 17-4 22-16 13-16-13-4-22Z" fill="#35516c"/><path d="m80 79 13 12-13 5-13-5Z" fill="currentColor" opacity=".85"/><path d="m69 100 11 16 11-16Z" fill="#0a1220"/>'
    : value.silhouette === "striker"
      ? '<path d="m67 78 24 4 9 14-7 17-16 8-16-18Z" fill="#35516c"/><path d="m63 94 33 3-8 5-24-3Z" fill="currentColor"/><path d="m74 105 3 16 16-8-2-7Z" fill="#182a41"/>'
      : '<path d="m80 74 19 13-2 22-17 14-17-14-2-22Z" fill="#35516c"/><path d="m64 92 16 4 16-4-3 7-13 3-13-3Z" fill="currentColor"/><path d="m80 101 8 8-8 14-8-14Z" fill="#182a41"/>';
  return `<svg class="player-portrait ${className}" viewBox="0 0 160 200" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="color:${color}"><path d="M80 6 148 45v110l-68 39-68-39V45Z" fill="#080f1e" stroke="currentColor" stroke-opacity=".45"/><path d="m80 17 57 33v99l-57 33-57-33V50Z" fill="#101a30"/><path d="m80 26 48 28v90l-48 28-48-28V54Z" stroke="currentColor" stroke-opacity=".18"/><path d="M18 71h19m86 0h19M18 128h19m86 0h19M80 9v14m0 153v15" stroke="currentColor" stroke-opacity=".4" stroke-width="2"/><path d="m42 99 38-22 38 22-38 64Z" fill="currentColor" opacity=".07"/><g fill="currentColor">${crestPaths(value.crest)}</g>${body}${helmet}<path d="m80 144 8 9-8 12-8-12Z" fill="currentColor"/><path d="M53 182h54" stroke="currentColor" stroke-width="2" opacity=".7"/></svg>`;
}

export function installPlayer(options: PlayerOptions) {
  let stored: unknown = null;
  try { stored = JSON.parse(localStorage.getItem(playerKey) || "null"); } catch {}
  let guest = normalize(stored), created = !!stored;
  let user: AccountUser | null = null, available = false, busy = false;
  let draft = { ...guest }, tab: "character" | "account" | "profile" = "character";
  const dialog = document.createElement("dialog");
  dialog.id = "player-dialog";
  dialog.setAttribute("aria-labelledby", "player-heading");
  dialog.innerHTML = `<div class="player-window">
    <header class="player-header"><div>${icon("profile")}<span>PLAYER IDENTITY<small>ตัวตนของคุณบนกระดาน</small></span></div><button id="player-close" aria-label="ปิดหน้าผู้เล่น">${icon("close")}</button></header>
    <nav class="player-tabs" aria-label="หน้าผู้เล่น"><button data-player-tab="character" class="active" aria-pressed="true">สร้างตัวละคร</button><button data-player-tab="account" aria-pressed="false" hidden>บัญชีผู้เล่น</button><button data-player-tab="profile" aria-pressed="false">โปรไฟล์</button></nav>
    <div class="player-body"><aside class="player-stage"><small>YOUR SIGNATURE</small><div id="player-portrait"></div><strong id="player-preview-name"></strong><span id="player-preview-style"></span><div class="player-origin-label">${icon("shield")}<span>แต่งตัวตน · ทุกคนใช้กติกาเดียวกัน</span></div></aside>
    <section class="player-controls"><h2 id="player-heading">สร้างเอกลักษณ์ของคุณ</h2><p id="player-subtitle">ภาพลักษณ์ ตราประจำตัว และสีพลังงาน ใช้ปรากฏบนโปรไฟล์ของคุณ</p>
      <form id="player-character-form" data-player-page="character">
        <label class="player-field">ชื่อที่แสดง<input id="player-name" name="name" autocomplete="nickname" maxlength="48" placeholder="ตั้งชื่อผู้เล่นของคุณ" required aria-describedby="player-name-note"></label><small id="player-name-note">2–24 ตัวอักษร · เปลี่ยนได้ภายหลัง</small>
        <fieldset><legend>รูปลักษณ์</legend><div class="player-silhouettes">${Object.entries(silhouettes).map(([key, name]) => `<button type="button" data-player-silhouette="${key}" aria-pressed="false">${playerPortrait({ ...fallback, silhouette: key as PlayerCharacter["silhouette"] })}<span>${name}</span></button>`).join("")}</div></fieldset>
        <fieldset><legend>ตราประจำตัว</legend><div class="player-crests">${Object.entries(crests).map(([key, name]) => `<button type="button" data-player-crest="${key}" aria-pressed="false"><svg viewBox="40 22 80 62" aria-hidden="true" fill="currentColor">${crestPaths(key as PlayerCharacter["crest"])}</svg><span>${name}</span></button>`).join("")}</div></fieldset>
        <fieldset><legend>สีพลังงาน</legend><div class="player-accents">${Object.entries(accents).map(([key, value]) => `<button type="button" data-player-accent="${key}" style="--player-swatch:${value.color}" aria-label="${value.name}" aria-pressed="false"><i></i><span>${value.name}</span></button>`).join("")}</div></fieldset>
        <button id="player-save" class="primary" type="submit">${icon("check")}<span>สร้างผู้เล่นในเครื่องนี้</span></button>
      </form>
      <section data-player-page="account" hidden><div class="player-auth-switch"><button type="button" data-player-auth="register" class="active" aria-pressed="true">สมัครบัญชี</button><button type="button" data-player-auth="login" aria-pressed="false">เข้าสู่ระบบ</button></div>
        <form id="player-auth-form"><label class="player-field">ชื่อบัญชี<input id="player-username" name="username" autocomplete="username" inputmode="text" autocapitalize="none" spellcheck="false" minlength="3" maxlength="24" pattern="[a-zA-Z0-9_]{3,24}" required></label><small>อักษรอังกฤษ ตัวเลข หรือ _ จำนวน 3–24 ตัว</small><label class="player-field">รหัสผ่าน<input id="player-password" name="password" type="password" autocomplete="new-password" maxlength="256" required aria-describedby="player-password-note"></label><small id="player-password-note">10–128 ตัวอักษร · ไม่บันทึกรหัสผ่านในเครื่อง</small><label id="player-copy-local" class="player-check"><input type="checkbox" checked><span>นำสกินและสถิติในเครื่องนี้ไปไว้ในบัญชีใหม่</span></label><p class="player-auth-note" id="player-register-note">บัญชีใหม่ใช้ตัวละครจากหน้าสร้างตัวละคร และเก็บไว้บนเซิร์ฟเวอร์ที่คุณกำลังเล่น</p><button id="player-auth-submit" class="primary" type="submit">${icon("lock")}<span>สมัครบัญชี</span></button></form>
      </section>
      <section data-player-page="profile" hidden><div id="player-profile-card"></div><div class="player-cloud-actions" hidden><button id="player-cloud-save">${icon("online")}<span>บันทึกสกินและสถิติขึ้นบัญชี</span></button><button id="player-cloud-load">${icon("copy")}<span>นำสกินและสถิติจากบัญชีมาใช้</span></button><p>กดนำมาใช้เพื่อแทนที่สกินและสถิติในเครื่องนี้ เกมที่กำลังเล่นจะยังอยู่</p><button id="player-logout" class="text-button">ออกจากระบบ</button></div><button id="player-edit">${icon("edit")}<span>แต่งตัวละคร</span></button></section>
      <p id="player-status" role="status" aria-live="polite"></p><p id="player-storage-note" class="player-storage-note"></p>
    </section></div>
  </div>`;
  document.body.append(dialog);
  const get = <T extends HTMLElement = HTMLElement>(selector: string) => dialog.querySelector<T>(selector)!;
  const entry = document.createElement("button"); entry.id = "player-entry";
  entry.setAttribute("aria-label", "เปิดโปรไฟล์ผู้เล่น");
  document.querySelector(".menu-commander")?.append(entry);
  const createTitle = document.createElement("button"); createTitle.id = "player-create-title";
  document.querySelector("#title-enter")?.insertAdjacentElement("afterend", createTitle);
  document.querySelector("#title-screen")?.classList.add("has-player-identity");
  const identity = () => user?.character ?? guest;
  const setStatus = (message: string, error = false) => { const node = get("#player-status"); node.textContent = message; node.classList.toggle("error", error); };
  function notify() { options.onIdentity?.(identity(), user?.username); }
  function preview() {
    get("#player-portrait").innerHTML = playerPortrait(draft);
    get("#player-preview-name").textContent = draft.name || "ตั้งชื่อผู้เล่น";
    get("#player-preview-style").textContent = `${silhouettes[draft.silhouette]} / ${crests[draft.crest]}`;
    dialog.style.setProperty("--player-accent", accents[draft.accent].color);
    for (const key of ["silhouette", "crest", "accent"] as const) dialog.querySelectorAll<HTMLButtonElement>(`[data-player-${key}]`).forEach(button => button.setAttribute("aria-pressed", String(button.dataset[`player${key[0].toUpperCase()}${key.slice(1)}`] === draft[key])));
  }
  function profile() {
    const progress = options.getProgression?.() as { matches?: number; wins?: number; xp?: number } | undefined;
    get("#player-profile-card").innerHTML = `<div class="player-profile-id"><small>${user ? "บัญชีผู้เล่น" : "โปรไฟล์ในเครื่อง"}</small><strong>${escape(identity().name)}</strong><span>${user ? `@${escape(user.username)}` : "LOCAL PLAYER"}</span></div><div class="player-stat-grid"><div><small>ประลอง</small><strong>${Number.isFinite(progress?.matches) ? Math.max(0, Math.floor(progress!.matches!)) : 0}</strong></div><div><small>ชนะ</small><strong>${Number.isFinite(progress?.wins) ? Math.max(0, Math.floor(progress!.wins!)) : 0}</strong></div><div><small>แต้มสกิน</small><strong>${Number.isFinite(progress?.xp) ? Math.max(0, Math.floor(progress!.xp!)) : 0}</strong></div></div>`;
    get(".player-cloud-actions").hidden = !user;
    get<HTMLButtonElement>("#player-cloud-save").hidden = !options.getProgression;
    get<HTMLButtonElement>("#player-cloud-load").hidden = !options.applyProgression;
    get<HTMLButtonElement>("#player-cloud-load").disabled = busy || !user?.progression;
  }
  function render() {
    const character = identity();
    entry.innerHTML = `${playerPortrait(character, "player-mini")}<span><small>${user ? "PLAYER ACCOUNT" : created ? "LOCAL PLAYER" : "CREATE YOUR PLAYER"}</small><strong>${escape(created || user ? character.name : "สร้างผู้เล่น")}</strong></span>${icon("arrow-right")}`;
    createTitle.innerHTML = `${icon(created || user ? "profile" : "edit")}<span>${created || user ? "ตัวละครและโปรไฟล์" : "สร้างตัวละครของคุณ"}</span>`;
    get<HTMLButtonElement>('[data-player-tab="account"]').hidden = !available || !!user;
    get("#player-save span").textContent = user ? "บันทึกตัวละครลงบัญชี" : created ? "บันทึกตัวละครในเครื่อง" : "สร้างผู้เล่นในเครื่องนี้";
    get("#player-storage-note").textContent = user ? `ลงชื่อเข้าใช้ @${user.username} · ตัวละครเก็บในบัญชี สกินและสถิติซิงก์เมื่อกดบันทึก` : available ? "เล่นแบบโปรไฟล์ในเครื่องได้ทันที หรือสมัครบัญชีเพื่อเก็บตัวละครบนเซิร์ฟเวอร์" : "โปรไฟล์เก็บในเบราว์เซอร์นี้ · GitHub Pages และไฟล์ออฟไลน์ไม่มีเซิร์ฟเวอร์บัญชี";
    profile(); preview();
  }
  function showTab(next: typeof tab) {
    if (next === "account" && (!available || user)) next = "profile";
    tab = next;
    dialog.querySelectorAll<HTMLButtonElement>("[data-player-tab]").forEach(button => { const active = button.dataset.playerTab === next; button.classList.toggle("active", active); button.setAttribute("aria-pressed", String(active)); });
    dialog.querySelectorAll<HTMLElement>("[data-player-page]").forEach(page => page.hidden = page.dataset.playerPage !== next);
    get("#player-heading").textContent = next === "character" ? "สร้างเอกลักษณ์ของคุณ" : next === "account" ? "เชื่อมตัวตนกับบัญชี" : "พร้อมสำหรับตาถัดไป";
    get("#player-subtitle").textContent = next === "character" ? "เลือกภาพลักษณ์ ตราประจำตัว และสีพลังงาน ทุกตัวเลือกเป็นของตกแต่ง" : next === "account" ? "ใช้บัญชีจริงบนเซิร์ฟเวอร์เกมนี้ โปรไฟล์ในเครื่องยังเล่นต่อได้เสมอ" : "ตัวตน สถิติ และชุดหมากที่คุณเลือก";
    setStatus(""); profile();
  }
  function open() {
    if (dialog.open) return;
    draft = { ...identity(), name: created || user ? identity().name : "" }; get<HTMLInputElement>("#player-name").value = draft.name;
    showTab(created || user ? "profile" : "character"); render(); dialog.showModal();
    get(created || user ? "#player-edit" : "#player-name").focus();
  }
  function setBusy(value: boolean) {
    busy = value; dialog.setAttribute("aria-busy", String(value));
    dialog.querySelectorAll<HTMLButtonElement>("button").forEach(button => { if (button.id !== "player-close") button.disabled = value; });
    if (!value) get<HTMLButtonElement>("#player-cloud-load").disabled = !user?.progression;
  }
  async function request(path: string, method = "GET", payload?: unknown): Promise<AccountResponse> {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const response = await fetch(`/api/account/${path}`, { method, credentials: "same-origin", cache: "no-store", signal: controller.signal, ...(payload === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }) });
      const data = await response.json() as AccountResponse;
      if (!response.ok) throw Error(data.message || data.error || "ไม่สามารถดำเนินการได้ กรุณาลองอีกครั้ง");
      return data;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw Error("เซิร์ฟเวอร์ไม่ตอบสนอง กรุณาลองอีกครั้ง");
      throw error;
    } finally { clearTimeout(timeout); }
  }
  function accept(data: AccountResponse) {
    user = data.user ? { ...data.user, character: normalize(data.user.character) } : null;
    draft = { ...identity() }; render(); notify();
  }
  entry.onclick = open; createTitle.onclick = open;
  get("#player-close").onclick = () => dialog.close();
  dialog.addEventListener("close", () => { get<HTMLInputElement>("#player-password").value = ""; });
  dialog.querySelectorAll<HTMLButtonElement>("[data-player-tab]").forEach(button => button.onclick = () => { if (!busy) showTab(button.dataset.playerTab as typeof tab); });
  get<HTMLInputElement>("#player-name").addEventListener("input", event => { draft.name = (event.target as HTMLInputElement).value.trim().normalize("NFC"); preview(); });
  for (const key of ["silhouette", "crest", "accent"] as const) dialog.querySelectorAll<HTMLButtonElement>(`[data-player-${key}]`).forEach(button => button.onclick = () => {
    if (busy) return;
    const value = button.getAttribute(`data-player-${key}`)!;
    draft = { ...draft, [key]: value }; preview();
  });
  get<HTMLFormElement>("#player-character-form").onsubmit = async event => {
    event.preventDefault(); if (busy) return;
    const name = get<HTMLInputElement>("#player-name").value.trim().normalize("NFC");
    if ([...name].length < 2 || [...name].length > 24 || /[\p{Cc}\p{Cf}]/u.test(name)) { setStatus("ตั้งชื่อ 2–24 ตัวอักษร โดยไม่ใช้ตัวอักษรควบคุม", true); get("#player-name").focus(); return; }
    draft.name = name;
    if (user) {
      setBusy(true);
      try { accept(await request("profile", "PUT", { character: draft })); showTab("profile"); setStatus("บันทึกตัวละครลงบัญชีแล้ว"); }
      catch (error) { setStatus(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ", true); }
      finally { setBusy(false); }
    } else {
      const next = { ...draft };
      try { localStorage.setItem(playerKey, JSON.stringify(next)); }
      catch { setStatus("เบราว์เซอร์ไม่อนุญาตให้บันทึกโปรไฟล์ กรุณาเปิดพื้นที่จัดเก็บแล้วลองอีกครั้ง", true); return; }
      guest = next; created = true; render(); notify(); showTab("profile"); setStatus("สร้างผู้เล่นแล้ว พร้อมลงสนามประลอง");
    }
  };
  let authMode: "register" | "login" = "register";
  dialog.querySelectorAll<HTMLButtonElement>("[data-player-auth]").forEach(button => button.onclick = () => {
    if (busy) return;
    authMode = button.dataset.playerAuth as typeof authMode;
    dialog.querySelectorAll<HTMLButtonElement>("[data-player-auth]").forEach(node => { const active = node === button; node.classList.toggle("active", active); node.setAttribute("aria-pressed", String(active)); });
    get<HTMLInputElement>("#player-password").autocomplete = authMode === "register" ? "new-password" : "current-password";
    get("#player-auth-submit span").textContent = authMode === "register" ? "สมัครบัญชี" : "เข้าสู่ระบบ";
    get("#player-copy-local").hidden = authMode === "login"; get("#player-register-note").hidden = authMode === "login"; setStatus("");
  });
  get<HTMLFormElement>("#player-auth-form").onsubmit = async event => {
    event.preventDefault(); if (busy || !available) return;
    const username = get<HTMLInputElement>("#player-username").value.trim(), password = get<HTMLInputElement>("#player-password").value;
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) { setStatus("ชื่อบัญชีต้องมีอักษรอังกฤษ ตัวเลข หรือ _ จำนวน 3–24 ตัว", true); return; }
    if ([...password].length < 10 || [...password].length > 128 || new TextEncoder().encode(password).length > 512) { setStatus("รหัสผ่านต้องมี 10–128 ตัวอักษร", true); return; }
    if (authMode === "register" && ([...draft.name].length < 2 || [...draft.name].length > 24)) { setStatus("ตั้งชื่อตัวละครในหน้าสร้างตัวละครก่อนสมัครบัญชี", true); return; }
    setBusy(true); setStatus(authMode === "register" ? "กำลังสร้างบัญชี…" : "กำลังเข้าสู่ระบบ…");
    try {
      const payload = authMode === "register" ? { username, password, character: draft, ...(get<HTMLInputElement>("#player-copy-local input").checked && options.getProgression ? { progression: options.getProgression() } : {}) } : { username, password };
      accept(await request(authMode, "POST", payload)); get<HTMLInputElement>("#player-password").value = "";
      get<HTMLInputElement>("#player-name").value = draft.name; showTab("profile"); setStatus(authMode === "register" ? "สร้างบัญชีและเข้าสู่ระบบแล้ว" : "เข้าสู่ระบบแล้ว สกินและสถิติในเครื่องยังอยู่ เลือกนำข้อมูลบัญชีมาใช้ได้ด้านบน");
    } catch (error) { setStatus(error instanceof Error ? error.message : "ไม่สามารถเข้าสู่ระบบได้", true); }
    finally { setBusy(false); }
  };
  get("#player-edit").onclick = () => { draft = { ...identity() }; get<HTMLInputElement>("#player-name").value = draft.name; preview(); showTab("character"); get("#player-name").focus(); };
  get("#player-cloud-save").onclick = async () => {
    if (busy || !user || !options.getProgression) return;
    setBusy(true); setStatus("กำลังบันทึกสกินและสถิติ…");
    try { accept(await request("profile", "PUT", { progression: options.getProgression() })); setStatus("บันทึกสกินและสถิติลงบัญชีแล้ว"); }
    catch (error) { setStatus(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ", true); }
    finally { setBusy(false); }
  };
  get("#player-cloud-load").onclick = () => {
    if (busy || !user?.progression || !options.applyProgression) return;
    try { options.applyProgression(user.progression); profile(); setStatus("นำสกินและสถิติจากบัญชีมาใช้ในเครื่องนี้แล้ว"); }
    catch { setStatus("นำข้อมูลมาใช้ไม่สำเร็จ", true); }
  };
  get("#player-logout").onclick = async () => {
    if (busy || !user) return; setBusy(true);
    try { accept(await request("logout", "POST", {})); get<HTMLInputElement>("#player-name").value = created ? guest.name : ""; showTab("profile"); setStatus("ออกจากระบบแล้ว กลับมาใช้โปรไฟล์ในเครื่อง"); }
    catch (error) { setStatus(error instanceof Error ? error.message : "ออกจากระบบไม่สำเร็จ", true); }
    finally { setBusy(false); }
  };
  render(); notify();
  const ready = options.offline ? Promise.resolve() : request("me").then(data => {
    available = data.available === true;
    if (data.user) accept(data);
    else render();
  }).catch(() => { available = false; render(); });
  return {
    get character() { return { ...identity() }; },
    get displayName() { return identity().name; },
    get hasIdentity() { return created || !!user; },
    get username() { return user?.username ?? null; },
    get accountAvailable() { return available; },
    ready, open,
    sync() { render(); },
  };
}

export type PlayerManager = ReturnType<typeof installPlayer>;
