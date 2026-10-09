import type { Square } from 'chess.js';
export type FieldEventKind = 'charge' | 'portal';
export interface FieldEvent { kind:FieldEventKind; squares:Square[]; label:string; description:string }
export interface FieldState { round:number; active:FieldEvent|null; forecast:FieldEvent; startsIn:number; endsIn:number }
/** Two rounds of public warning, then two active rounds; no wall-clock randomness. */
export function fieldState(plies:number,seed:number):FieldState {
  const round=Math.floor(Math.max(0,plies)/2), block=Math.floor(round/4), phase=round%4;
  const event=(index:number):FieldEvent=>{
    const kind:FieldEventKind=index%2===0?'charge':'portal';
    const pick=((seed>>>0)+index)%3;
    return kind==='charge'?{kind,squares:([['d4','e5'],['e4','d5'],['c4','f5']] as Square[][])[pick],label:'ENERGY NEXUS',description:'จบรอบครบสองฝ่าย: มีหมากบนจุดพลังงาน รับ +1 ชาร์จต่อฝ่าย ไม่เกินเพดานเริ่มต้น'}
      :{kind,squares:([['b3','g6'],['c3','f6'],['c4','f5']] as Square[][])[pick],label:'DIMENSION GATE',description:'หมากที่ยืนบนประตูเดิน/กินไปอีกประตูได้ในหนึ่งตา โดยไม่ใช้ชาร์จ · คิงผ่านไม่ได้ · ห้ามเปิดคิง'};
  };
  return {round,active:phase>=2?event(block):null,forecast:phase>=2?event(block+1):event(block),startsIn:phase>=2?6-phase:2-phase,endsIn:phase>=2?4-phase:0};
}
