import { Chess, type Color } from 'chess.js';
import { SpecialChess } from './special.ts';
import { roomSettings,type RoomSettings } from '../shared/duel-room.js';
import { normalizeCosmetics,type ArmyCosmetics } from '../shared/cosmetics.js';
import { normalizeTeam,type SkillTeam } from './duel-draft.ts';
export interface MatchReplay {version:1;settings:RoomSettings;teams:Record<Color,SkillTeam>;cosmetics:Record<Color,ArmyCosmetics>;moves:string[];}
export function replayGame(record:MatchReplay,ply=record.moves.length){
  const game=record.settings.rule==='special'?new SpecialChess(undefined,undefined,{charges:record.settings.charges,reusable:record.settings.reusable,drafted:true,teams:record.teams,formation:'standard',seed:1,skills:{}}):new Chess();
  for(const san of record.moves.slice(0,ply))game.move(san);return game;
}
/** Reconstruct legal history. Imported records contain no accounts, room tokens or arbitrary FEN. */
export function readReplay(raw:unknown):MatchReplay|null {
  try {
    const value=raw as MatchReplay;if(!value||value.version!==1||!Array.isArray(value.moves)||value.moves.length>512||value.moves.some(m=>typeof m!=='string'||m.length>48))return null;
    const record:MatchReplay={version:1,settings:roomSettings(value.settings),teams:{w:normalizeTeam(value.teams?.w),b:normalizeTeam(value.teams?.b)},cosmetics:{w:normalizeCosmetics(value.cosmetics?.w,'w'),b:normalizeCosmetics(value.cosmetics?.b,'b')},moves:[...value.moves]};
    replayGame(record);return record;
  }catch{return null;}
}
export function encodeReplay(record:MatchReplay){const safe=readReplay(record);if(!safe)throw Error('บันทึกแมตช์ไม่ถูกต้อง');return btoa(JSON.stringify(safe)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');}
export function decodeReplay(code:string){try{if(code.length>32768||!/^[A-Za-z0-9_-]+$/.test(code))return null;return readReplay(JSON.parse(atob(code.replaceAll('-','+').replaceAll('_','/'))));}catch{return null;}}
export function replayLink(page:string,record:MatchReplay){const url=new URL(page);url.search='';url.hash='replay='+encodeReplay(record);return url.href;}
