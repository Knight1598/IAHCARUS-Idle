import type { Color, Square } from 'chess.js';
import { duelRules, duelMinutes, duelIncrements, roomSettings, type RoomSettings } from '../shared/duel-room.js';
import type { ArmyCosmetics } from '../shared/cosmetics.js';
import { arenas } from './arenas';
import { skins, isSkinUnlocked, type Profile, type SkinId } from './profile';
import { initialArmySlots } from './cosmetics';
import { geometricPiece } from './design';

interface LobbyState {
  protocol?:number;settings?:RoomSettings;settingsRevision?:number;host?:Color|null;
  started:boolean;result:{winner:Color|null;reason:string}|null;checks?:Record<Color,number>;
  drawOffer?:Color|null;rematch?:Record<Color,boolean>;cosmetics?:Record<Color,ArmyCosmetics>;
}
export class DuelLobby {
  private state:LobbyState|null=null;
  private color:Color|null=null;
  private slot:Square='a1';
  private lastSettings='';
  private connected=false;
  constructor(private panel:HTMLElement, private send:(m:object)=>boolean, private profile:()=>Profile, private save:(color:Color,army:ArmyCosmetics)=>void) {
    const options=Object.entries(duelRules).map(([id,r])=>`<option value="${id}">${r.name}</option>`).join('');
    panel.querySelector('#duel-seats')!.insertAdjacentHTML('beforebegin',`<section class="duel-settings" id="duel-settings"><div class="duel-section-heading"><small>ROOM RULES</small><h3>ตั้งค่าการประลอง</h3><span id="duel-host-note">เจ้าของห้องเลือกกติกาก่อนสร้างได้</span></div><div class="duel-options"><label>โหมด<select id="duel-rule">${options}</select></label><label>เวลาแต่ละฝ่าย<select id="duel-time">${duelMinutes.map(m=>`<option value="${m*60000}" ${m===5?'selected':''}>${m} นาที</option>`).join('')}</select></label><label>เพิ่มเวลาทุกครั้งที่เดิน<select id="duel-increment">${duelIncrements.map(s=>`<option value="${s}">+${s} วินาที</option>`).join('')}</select></label><label>สนาม<select id="duel-arena">${Object.entries(arenas).map(([id,a])=>`<option value="${id}">${a.name}</option>`).join('')}</select></label><label id="duel-side-label">ฝ่ายของเจ้าของห้อง<select id="duel-side"><option value="w">ขาว · เดินก่อน</option><option value="b">ดำ · เดินทีหลัง</option><option value="random">สุ่มฝ่าย</option></select></label><label class="duel-toggle"><input id="duel-allow-draw" type="checkbox" checked> อนุญาตเสนอเสมอ</label></div><p id="duel-rule-description"></p><button id="duel-apply" hidden>บันทึกกติกาห้อง</button><p class="duel-note">เปลี่ยนกติกาหรือสกินแล้วทั้งสองคนต้องกดพร้อมใหม่ · สกินไม่มีผลต่อความสามารถ</p><p id="duel-objective" role="status"></p></section>`);
    panel.querySelector('#duel-ready')!.insertAdjacentHTML('beforebegin',`<section id="duel-armory" hidden><div class="duel-section-heading"><small>YOUR ARMY</small><h3>แต่งหมากก่อนประลอง</h3><span id="duel-army-side"></span></div><label>ชุดทั้งกองทัพ<select id="duel-army-skin"></select></label><button id="duel-equip-army">สวมทั้งกองทัพ</button><div id="duel-piece-slots" class="duel-piece-slots"></div><label><span id="duel-piece-label">สกินหมากที่เลือก</span><select id="duel-piece-skin"></select></label><button id="duel-equip-piece">สวมให้หมากตัวนี้</button></section>`);
    panel.insertAdjacentHTML('beforeend',`<section id="duel-match-actions" hidden><p id="duel-action-status" role="status"></p><div class="duel-action-row"><button id="duel-draw-offer">เสนอเสมอ</button><button id="duel-draw-accept" hidden>ยอมรับเสมอ</button><button id="duel-draw-decline" hidden>ปฏิเสธ</button><button id="duel-draw-cancel" hidden>ยกเลิกข้อเสนอ</button><button id="duel-rematch" hidden>ขอเล่นใหม่ในห้องเดิม</button></div></section>`);
    this.select('#duel-arena').value=profile().arena;
    this.el('#duel-rule-description').textContent=duelRules.standard.description;
    this.select('#duel-rule').onchange=()=>{this.el('#duel-rule-description').textContent=duelRules[this.settings().rule].description;};
    this.button('#duel-apply').onclick=()=>this.send({type:'configure',settings:this.settings(),settingsRevision:this.state?.settingsRevision});
    this.button('#duel-equip-army').onclick=()=>this.equip(true);
    this.button('#duel-equip-piece').onclick=()=>this.equip(false);
    for(const [id,action] of [['offer','offer'],['accept','accept'],['decline','decline'],['cancel','cancel']])this.button('#duel-draw-'+id).onclick=()=>this.send({type:'draw',action});
    this.button('#duel-rematch').onclick=()=>this.send({type:'rematch',ready:!this.state?.rematch?.[this.color||'w']});
    this.el('#duel-settings').addEventListener('change',()=>{
      this.button('#duel-ready').disabled=!this.connected||this.pendingSettings();
      if(this.color&&this.state?.host===this.color)this.el('#duel-host-note').textContent=this.pendingSettings()?'มีการแก้ไขกติกา · กดบันทึกก่อนยืนยันพร้อม':'คุณเป็นเจ้าของห้อง';
    });
  }
  private el(s:string){return this.panel.querySelector<HTMLElement>(s)!;}
  private select(s:string){return this.el(s) as HTMLSelectElement;}
  private button(s:string){return this.el(s) as HTMLButtonElement;}
  settings():RoomSettings {return roomSettings({rule:this.select('#duel-rule').value,baseMs:Number(this.select('#duel-time').value),increment:Number(this.select('#duel-increment').value),arena:this.select('#duel-arena').value,allowDraw:(this.el('#duel-allow-draw') as HTMLInputElement).checked});}
  side(){return this.select('#duel-side').value;}
  pendingSettings() {
    if(!this.state?.settings||this.state.started||this.state.host!==this.color)return false;
    const current=this.state.settings,next=this.settings();
    return current.rule!==next.rule||current.baseMs!==next.baseMs||current.increment!==next.increment||current.arena!==next.arena||current.allowDraw!==next.allowDraw;
  }
  private equip(all:boolean) {
    if(!this.color||!this.state||this.state.started)return;
    const skin=this.select(all?'#duel-army-skin':'#duel-piece-skin').value as SkinId;
    if(!isSkinUnlocked(this.profile(),skin))return;
    const previous=this.state.cosmetics?.[this.color]||{skin:this.profile().skin,loadout:this.profile().loadouts[this.color]};
    const army:ArmyCosmetics=all?{skin,loadout:{}}:{skin:previous.skin,loadout:{...previous.loadout,[this.slot]:skin}};
    if(this.send({type:'equip',cosmetics:army,settingsRevision:this.state.settingsRevision}))this.save(this.color,army);
  }
  update(state:LobbyState|null,color:Color|null,connected:boolean) {
    this.state=state;this.color=color;this.connected=connected;
    const supported=!state||state.protocol===2;
    const editable=!state?.started&&(!color||state?.host===color)&&supported;
    const signature=JSON.stringify(state?.settings);
    if(state?.settings&&signature!==this.lastSettings) {
      const r=state.settings;
      this.select('#duel-rule').value=r.rule;this.select('#duel-time').value=String(r.baseMs);this.select('#duel-increment').value=String(r.increment);this.select('#duel-arena').value=r.arena;
      (this.el('#duel-allow-draw') as HTMLInputElement).checked=r.allowDraw;
      this.lastSettings=signature;
    }
    if(!state)this.lastSettings='';
    this.el('#duel-settings').querySelectorAll<HTMLInputElement|HTMLSelectElement>('input,select').forEach(input=>input.disabled=!editable);
    this.el('#duel-side-label').hidden=!!color;
    this.el('#duel-host-note').textContent=!supported?'เซิร์ฟเวอร์ยังเป็นเวอร์ชันเดิม · รอ Render Deploy ล่าสุด':!color?'เลือกกติกาก่อนสร้างห้อง · ผู้จอยใช้กติกาของเจ้าของห้อง':state?.host===color?'คุณเป็นเจ้าของห้อง':`เจ้าของห้อง: ฝ่าย${state?.host==='w'?'ขาว':'ดำ'} · กติกาซิงก์อัตโนมัติ`;
    this.button('#duel-apply').hidden=!color||!editable;this.button('#duel-apply').disabled=!connected;
    const rule=state?.settings?.rule||this.settings().rule;
    this.el('#duel-rule-description').textContent=duelRules[rule].description;
    this.el('#duel-objective').textContent=rule==='threeCheck'&&state?.checks?`รุกสำเร็จ · ขาว ${state.checks.w}/3 · ดำ ${state.checks.b}/3`:'';
    this.el('#duel-armory').hidden=!color||!!state?.started||!supported;
    if(color&&state&&!state.started&&supported) {
      this.el('#duel-army-side').textContent=`กองทัพ${color==='w'?'ขาว':'ดำ'}ของคุณ · อีกฝ่ายเห็นชุดที่บันทึกแล้ว`;
      const army=state.cosmetics?.[color]||{skin:this.profile().skin,loadout:{}};
      const slots=initialArmySlots(color);if(!slots.some(s=>s.origin===this.slot))this.slot=slots[0].origin;
      const options=Object.entries(skins).filter(([id])=>isSkinUnlocked(this.profile(),id as SkinId)).map(([id,s])=>`<option value="${id}">${s.label} · ${s.rarity}</option>`).join('');
      for(const selector of ['#duel-army-skin','#duel-piece-skin'])if(this.select(selector).innerHTML!==options)this.select(selector).innerHTML=options;
      this.select('#duel-army-skin').value=army.skin;
      const updatePiece=()=>{this.el('#duel-piece-label').textContent=`สกินหมาก ${this.slot}`;this.select('#duel-piece-skin').value=army.loadout[this.slot]||army.skin;this.el('#duel-piece-slots').querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.slot===this.slot)));};
      this.el('#duel-piece-slots').innerHTML=slots.map(s=>`<button data-slot="${s.origin}" title="${s.origin} · ${skins[army.loadout[s.origin]||army.skin].label}" style="--slot-glow:${skins[army.loadout[s.origin]||army.skin].glow}">${geometricPiece(s.type,color)}<small>${s.origin}</small></button>`).join('');
      this.el('#duel-piece-slots').querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.onclick=()=>{this.slot=b.dataset.slot as Square;updatePiece();});updatePiece();
      this.button('#duel-equip-army').disabled=!connected;this.button('#duel-equip-piece').disabled=!connected;
    }
    this.el('#duel-match-actions').hidden=!color||!state?.started||!supported;
    const ended=!!state?.result,offer=state?.drawOffer,ownOffer=offer===color;
    this.button('#duel-draw-offer').hidden=ended||!!offer||!state?.settings?.allowDraw;
    this.button('#duel-draw-accept').hidden=ended||!offer||ownOffer;
    this.button('#duel-draw-decline').hidden=ended||!offer||ownOffer;
    this.button('#duel-draw-cancel').hidden=ended||!ownOffer;
    this.button('#duel-rematch').hidden=!ended;
    this.button('#duel-rematch').textContent=state?.rematch?.[color||'w']?'ยกเลิกคำขอเล่นใหม่':'ขอเล่นใหม่ในห้องเดิม';
    this.el('#duel-match-actions').querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.disabled=!connected);
    this.el('#duel-action-status').textContent=ended?'ทั้งคู่ยืนยันเล่นใหม่ แล้วกลับมาแต่งหมากและกดพร้อมได้อีกครั้ง':offer?ownOffer?'ส่งคำขอเสมอแล้ว · รอคู่แข่งตอบ':'คู่แข่งเสนอเสมอ · เลือกยอมรับหรือปฏิเสธ':'ระหว่างคัตซีนและเปิดเมนู เวลายังเดินต่อ';
    if(ended&&state?.rematch?.[color==='w'?'b':'w'])this.el('#duel-action-status').textContent='คู่แข่งขอเล่นใหม่ · กดยืนยันเพื่อกลับล็อบบี้';
  }
}
