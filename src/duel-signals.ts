export const signalLabels:Record<string,string>={wellPlayed:'เล่นได้ยอดเยี่ยม',niceMove:'เดินสวย',thinking:'กำลังคิด',rematch:'ขอแก้มือ',goodLuck:'ขอให้เป็นศึกที่ดี'};
export class DuelSignals {
  private root:HTMLElement;
  private toast:HTMLElement;
  private last='';
  private until=0;
  constructor(stage:HTMLElement,send:(m:object)=>boolean,private sound:()=>void){
    this.root=document.createElement('nav');this.root.id='duel-signals';this.root.hidden=true;this.root.setAttribute('aria-label','สัญญาณระหว่างดวล');
    this.root.innerHTML=Object.entries(signalLabels).map(([id,label],i)=>`<button data-signal="${id}" title="${label}" aria-label="${label}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 L22 8 L22 16 L12 22 L2 16 L2 8 Z M${6+i} 12 L12 ${5+i} L${18-i} 12 L12 ${19-i} Z" fill="none" stroke="currentColor" stroke-width="1.4"/></svg><span>${label}</span></button>`).join('');
    this.root.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.onclick=()=>{if(Date.now()<this.until)return;if(send({type:'signal',signal:b.dataset.signal})){this.until=Date.now()+5000;this.refresh();setTimeout(()=>this.refresh(),5000);}});
    this.toast=document.createElement('aside');this.toast.id='duel-signal-toast';this.toast.hidden=true;this.toast.setAttribute('role','status');stage.append(this.root,this.toast);
  }
  private refresh(){this.root.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.disabled=Date.now()<this.until);}
  update(active:boolean,packet?:{id:string;color:'w'|'b';signal:string}){
    this.root.hidden=!active;if(!active){this.toast.hidden=true;return;}
    if(packet&&packet.id!==this.last&&Object.hasOwn(signalLabels,packet.signal)){
      this.last=packet.id;this.toast.textContent=`ฝ่าย${packet.color==='w'?'ขาว':'ดำ'} · ${signalLabels[packet.signal]}`;this.toast.hidden=false;this.sound();const id=packet.id;setTimeout(()=>{if(this.last===id)this.toast.hidden=true;},3200);
    }
  }
}
