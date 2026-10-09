import type {PieceSymbol} from 'chess.js';
export interface Deployment {type:PieceSymbol;cell:number;}
export interface BGUnit extends Deployment {id:string;seat:number;}
export interface BGPlayer {seat:number;hand:PieceSymbol[];alive:boolean;captured:number;missed:number;}
export interface BGEvent {kind:'timeout'|'deploy'|'capture'|'clash'|'eliminated';seat:number;victim?:number;type?:PieceSymbol;attackerType?:PieceSymbol;from?:number;cell?:number;}
export interface BGGame {id:string;round:number;revision:number;board:BGUnit[];players:BGPlayer[];orders:Record<number,Deployment>;events:BGEvent[];result:{winners:number[];reason:string}|null;}
export const bgTypes:PieceSymbol[];
export const bgValues:Record<PieceSymbol,number>;
export const bgSize:number;
export const bgColors:string[];
export function newBattleground(id?:string):BGGame;
export function submitDeployment(game:BGGame,seat:number,order:Deployment):void;
export function deploymentTargets(game:BGGame,seat:number,order:Deployment):number[];
export function resolveDeployments(game:BGGame):BGGame;
export function botDeployment(game:BGGame,seat:number,random?:()=>number):Deployment|null;
