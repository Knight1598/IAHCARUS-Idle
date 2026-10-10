import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom';
import { icon } from './design';
import './game-help.css';

type Help = { title: string; body: string };
const chapters: Record<string, Help> = {
  mode: { title: 'เลือกประสบการณ์ของคุณ', body: 'ดวลหมาก: แข่งกับบอตหรือเพื่อน · อารีนา: ดัดแปลงกระดานและทีม · ท้าฝีมือ: โจทย์และศึกประจำวัน · เศรษฐกิจ: เล่นเพื่อสะสมเงินธรรมดา เมื่อเลือกแล้วจะตั้งกติกา จัดกองทัพ และเลือกสนามตามลำดับ' },
  setup: { title: 'ตั้งกติกาก่อนเริ่ม', body: 'ตัวเลือกที่เห็นเป็นกติกาของโหมดนี้ ใน Special Duel คุณเลือกกระดาน จำนวนชาร์จ และการใช้ซ้ำก่อนจัดสกิล ส่วน Duel Draft ให้ทั้งสองฝ่ายเลือกและแบนชุดสกิลก่อนเปิดเผยทีม' },
  skills: { title: 'สกิลเป็นสิทธิ์เดินพิเศษ', body: 'เลือกชุดสกิลให้หมากทั้ง 6 ชนิด ทุกอัลติใช้แทนการเดินหนึ่งตาและต้องรักษาคิงให้ปลอดภัย กติกา Freestyle ใช้ชุดร่วมกัน ส่วน Duel Draft เลือกแยกฝ่ายภายใต้งบแต้ม สกินเปลี่ยนภาพและเสียงโดยไม่เพิ่มสิทธิ์เดิน' },
  army: { title: 'กองทัพที่เป็นของคุณ', body: 'เลือกสกินทั้งกองทัพได้ที่นี่ หรือเปิด “แต่งหมากรายตัว” เพื่อแต่งแต่ละตำแหน่งแยกกัน สี อวตาร และเอฟเฟคขึ้นกับสกิน กติกาการเดินขึ้นกับโหมดและชุดสกิลที่คุณเลือก' },
  arena: { title: 'เช็กแผนก่อนเข้าสนาม', body: 'เลือกสนามและอ่านสรุปกติกาด้านล่างก่อนเริ่ม รูปลักษณ์สนามเป็นคนละส่วนกับอีเวนท์สนามที่ตั้งไว้ใน Special Duel เมื่อพร้อม กดเข้าสู่สนาม' },
  armory: { title: 'แต่งหมากแยกทีละตัว', body: 'เลือกฝ่าย เลือกตำแหน่ง แล้วเลือกสกินให้หมากตัวนั้น พรีวิวแสดงอวตารและท่าของหมากที่เลือก ใช้ห้องทดลองการต่อสู้เพื่อดูสกินและเอฟเฟคก่อนลงเล่น' },
  treasury: { title: 'ร้านค้าทดลอง', body: 'เงินธรรมดาหาจากการเล่น ส่วนสกุลพรีเมียมเป็นระบบทดลอง ดูประเภทของ ช่องสวมใส่ โอกาสสุ่ม และการันตีของแต่ละตู้ก่อนเลือก รางวัลซ้ำเปลี่ยนเป็นชิ้นส่วนสำหรับสร้างของในคลัง' },
};

/** One shared, click-operated panel. No listeners run for positioning while closed. */
export function installGameHelp(root: ParentNode = document) {
  const panel = document.createElement('section');
  panel.id = 'game-context-help'; panel.hidden = true;
  panel.className = 'game-context-help';
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'false');
  panel.setAttribute('aria-labelledby', 'game-help-title');
  panel.innerHTML = `<header><small>TACTICAL FIELD GUIDE</small><button type="button" aria-label="ปิดคำอธิบาย">${icon('close')}</button></header><h2 id="game-help-title"></h2><p></p><div class="help-rule" aria-hidden="true"></div>`;
  document.body.append(panel);
  let reference: HTMLElement | null = null;
  let cleanup: (() => void) | undefined;
  let revision = 0;
  let focusWhenPositioned = false;

  const close = (restoreFocus = false) => {
    const previous = reference;
    revision++; focusWhenPositioned = false; cleanup?.(); cleanup = undefined;
    panel.hidden = true; panel.style.visibility = '';
    reference?.setAttribute('aria-expanded', 'false'); reference = null;
    if (restoreFocus && previous?.isConnected && previous.getClientRects().length) previous.focus({ preventScroll: true });
  };
  const register = (button: HTMLElement, help: Help) => {
    button.dataset.gameHelp = 'true';
    button.dataset.helpTitle = help.title; button.dataset.helpBody = help.body;
    button.setAttribute('aria-controls', panel.id); button.setAttribute('aria-expanded', 'false');
  };
  const helpButton = (help: Help) => {
    const button = document.createElement('button'); button.type = 'button';
    button.className = 'game-help-trigger'; button.innerHTML = icon('help');
    button.setAttribute('aria-label', `คำอธิบาย: ${help.title}`); register(button, help);
    return button;
  };
  for (const [chapter, help] of Object.entries(chapters)) {
    root.querySelector(`[data-menu-view="${chapter}"] > h1`)?.append(helpButton(help));
  }
  for (const card of root.querySelectorAll<HTMLElement>('.skill-loadout-card')) {
    const header = card.querySelector('header');
    if (!header) continue;
    const descriptions = [...card.querySelectorAll('[data-rule-skill]')].map(button =>
      `${button.querySelector('strong')?.textContent || ''}: ${button.querySelector('span')?.textContent || ''}`);
    header.append(helpButton({ title: `เปรียบเทียบสกิล${header.querySelector('strong')?.textContent || ''}`, body: descriptions.join('\n\n') }));
  }
  for (const button of root.querySelectorAll<HTMLElement>('[data-help-title][data-help-body]')) {
    register(button, { title: button.dataset.helpTitle!, body: button.dataset.helpBody! });
  }
  const position = async () => {
    const anchor = reference, current = revision;
    if (!anchor || panel.hidden) return;
    const result = await computePosition(anchor, panel, {
      strategy: 'fixed', placement: 'bottom-end',
      middleware: [offset(10), flip({ padding: 12 }), shift({ padding: 12, crossAxis: true })],
    });
    if (current !== revision || reference !== anchor || panel.hidden) return;
    panel.style.left = `${result.x}px`; panel.style.top = `${result.y}px`;
    panel.style.visibility = 'visible'; panel.dataset.placement = result.placement;
    if (focusWhenPositioned) {
      focusWhenPositioned = false;
      panel.querySelector<HTMLButtonElement>('button')!.focus({ preventScroll: true });
    }
  };
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-game-help]') : null;
    if (!target) return;
    if (reference === target) { close(); return; }
    close(); reference = target; revision++;
    panel.querySelector('h2')!.textContent = target.dataset.helpTitle || '';
    panel.querySelector('p')!.textContent = target.dataset.helpBody || '';
    panel.hidden = false; panel.style.visibility = 'hidden';
    target.setAttribute('aria-expanded', 'true');
    panel.dataset.positionEngine = 'floating-ui';
    focusWhenPositioned = event.detail === 0;
    cleanup = autoUpdate(target, panel, () => { void position(); });
  });
  panel.querySelector('button')!.addEventListener('click', () => close(true));
  document.addEventListener('pointerdown', event => {
    if (reference && event.target instanceof Node && !panel.contains(event.target) && !reference.contains(event.target)) close();
  }, { passive: true });
  // Capture Escape so the underlying title/drawer does not navigate at the same time.
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !reference) return;
    event.preventDefault(); event.stopImmediatePropagation(); close(true);
  }, true);
  document.addEventListener('focusin', event => {
    if (reference && event.target instanceof Node && !panel.contains(event.target) && !reference.contains(event.target)) close();
  });
  const title = root.querySelector('#title-screen');
  if (title) new MutationObserver(() => close()).observe(title, { attributes: true, attributeFilter: ['hidden', 'data-menu-view'] });
  const shell = root.querySelector('#game-shell');
  if (shell) new MutationObserver(() => close()).observe(shell, { attributes: true, attributeFilter: ['hidden'] });
  document.addEventListener('visibilitychange', () => { if (document.hidden) close(); });
  return { close };
}
