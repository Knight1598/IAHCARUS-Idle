import { decodeReplay,encodeReplay,replayGame,replayLink,type MatchReplay } from './match-replay';
export class ReplayStudio {
  readonly root:HTMLElement;
  private record:MatchReplay|null=null;
  private ply=0;
  private timer:ReturnType<typeof setTimeout>|undefined;
  constructor(host:HTMLElement,private show:(record:MatchReplay,ply:number,animate:boolean)=>void,private close:()=>void,flip:()=>void){
    this.root=document.createElement('section');this.root.id='replay-studio';this.root.hidden=true;this.root.setAttribute('aria-label','รีเพลย์การแข่งขัน');
    this.root.innerHTML='<small>MATCH THEATER</small><strong id="replay-position"></strong><div class="replay-controls"><button id="replay-prev">ตาก่อน</button><button id="replay-next">ตาถัดไป</button><button id="replay-play">เล่นอัตโนมัติ</button><button id="replay-next-capture">ฉากกินถัดไป</button><button id="replay-camera">สลับมุมกล้อง</button><button id="replay-share">คัดลอกลิงก์รีเพลย์</button><button id="replay-code">คัดลอกรหัส</button><button id="replay-close">ปิดรีเพลย์</button></div><input id="replay-scrub" aria-label="เลือกตาในรีเพลย์" type="range" min="0" value="0"><p id="replay-message" role="status"></p>';
    host.append(this.root);
    this.button('prev').onclick=()=>{this.stop();this.seek(this.ply-1);};this.button('next').onclick=()=>{this.stop();this.seek(this.ply+1,true);};
    this.button('play').onclick=()=>{if(this.timer){this.stop();return;}if(this.ply===this.record?.moves.length)this.seek(0);this.auto();};
    this.button('next-capture').onclick=()=>{this.stop();if(!this.record)return;const moves=replayGame(this.record).history({verbose:true});const i=moves.findIndex((m,index)=>index>=this.ply&&!!m.captured);if(i>=0)this.seek(i+1,true);else this.message('ไม่มีฉากกินถัดไป');};
    this.button('camera').onclick=flip;this.button('close').onclick=()=>{this.stop();this.root.hidden=true;this.close();};
    this.button('share').onclick=()=>this.copy(false);this.button('code').onclick=()=>this.copy(true);
    this.input().oninput=()=>{this.stop();this.seek(Number(this.input().value));};
  }
  private button(id:string){return this.root.querySelector<HTMLButtonElement>('#replay-'+id)!;}
  private input(){return this.root.querySelector<HTMLInputElement>('#replay-scrub')!;}
  private message(text:string){this.root.querySelector('#replay-message')!.textContent=text;}
  open(record:MatchReplay){this.stop();this.record=record;this.root.hidden=false;this.input().max=String(record.moves.length);this.message('ลากเพื่อหมุนฉาก · เลื่อนเพื่อซูม · ใช้ปุ่มดูฉากกินย้อนหลัง');this.seek(0);}
  dismiss(){this.stop();this.root.hidden=true;}
  private seek(ply:number,animate=false){if(!this.record)return;this.ply=Math.max(0,Math.min(this.record.moves.length,ply));this.show(this.record,this.ply,animate);this.input().value=String(this.ply);this.root.querySelector('#replay-position')!.textContent=`ตา ${this.ply}/${this.record.moves.length} · ${this.record.moves[this.ply-1]||'เริ่มการแข่งขัน'}`;this.button('prev').disabled=this.ply===0;this.button('next').disabled=this.ply===this.record.moves.length;}
  private auto(){if(!this.record||this.ply===this.record.moves.length){this.stop();return;}this.seek(this.ply+1,true);this.button('play').textContent='หยุดอัตโนมัติ';this.timer=setTimeout(()=>this.auto(),3200);}
  private stop(){clearTimeout(this.timer);this.timer=undefined;this.button('play').textContent='เล่นอัตโนมัติ';}
  private async copy(code:boolean){if(!this.record)return;try{await navigator.clipboard.writeText(code?encodeReplay(this.record):replayLink(location.href,this.record));this.message(code?'คัดลอกรหัสรีเพลย์แล้ว':'คัดลอกลิงก์แล้ว · เพื่อนเปิดดูได้โดยไม่ต้องเชื่อมเซิร์ฟเวอร์');}catch{this.message('คัดลอกไม่ได้ · ลองใช้เบราว์เซอร์ที่อนุญาตคลิปบอร์ด');}}
}
