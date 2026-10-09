import type { Chess, Move, Color } from 'chess.js';
export type DuelRule = 'special' | 'standard' | 'threeCheck' | 'kingHill' | 'firstCapture';
export interface RoomSettings {rule:DuelRule;baseMs:number;increment:number;arena:'citadel'|'ember'|'frost'|'astral'|'storm'|'grove'|'reactor'|'eclipse';allowDraw:boolean;charges:number;reusable:boolean;bestOf:number;swapSides:boolean;}
export const duelRules: Record<DuelRule,{name:string;description:string}>;
export const duelMinutes: number[];
export const duelIncrements: number[];
export const duelArenas: RoomSettings['arena'][];
export function roomSettings(raw?:unknown,current?:RoomSettings):RoomSettings;
export function duelOutcome(game:Chess,rule:DuelRule,move:Move,checks:Record<Color,number>):{winner:Color|null;reason:string}|null;
