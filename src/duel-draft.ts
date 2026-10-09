import type { Color, PieceSymbol } from 'chess.js';
export type SkillChoice = 'signature' | 'alternate' | 'off';
export type SkillTeam = Record<PieceSymbol, SkillChoice>;
export type SkillBan = `${PieceSymbol}:${Exclude<SkillChoice,'off'>}`;
export const skillPieces: PieceSymbol[] = ['p','n','b','r','q','k'];
export const skillBudget = 12;
export const skillCosts: Record<PieceSymbol, Record<SkillChoice,number>> = {
  p:{signature:1,alternate:2,off:0}, n:{signature:3,alternate:2,off:0}, b:{signature:2,alternate:3,off:0},
  r:{signature:2,alternate:3,off:0}, q:{signature:2,alternate:3,off:0}, k:{signature:2,alternate:2,off:0},
};
export const defaultSkillTeam = (): SkillTeam => Object.fromEntries(skillPieces.map(p=>[p,'signature'])) as SkillTeam;
export function skillSpend(team: Partial<SkillTeam>) { return skillPieces.reduce((sum,p)=>sum+skillCosts[p][team[p] || 'signature'],0); }
export function validBan(raw: unknown): raw is SkillBan { return typeof raw === 'string' && /^[pnbrqk]:(signature|alternate)$/.test(raw); }
/** A side's ban restricts its opponent, never its own pieces. Invalid saves fail closed. */
export function normalizeTeam(raw: unknown, enemyBan?: SkillBan): SkillTeam {
  const value = raw && typeof raw === 'object' ? raw as Partial<SkillTeam> : {};
  const team = Object.fromEntries(skillPieces.map(p=>[p,['signature','alternate','off'].includes(value[p]!) ? value[p] : 'signature'])) as SkillTeam;
  for(const p of skillPieces)if(enemyBan===`${p}:${team[p]}`)team[p]='off';
  if(skillSpend(team)>skillBudget)for(const p of [...skillPieces].reverse()) {team[p]='off';if(skillSpend(team)<=skillBudget)break;}
  return team;
}
export function botDraft(seed:number, enemyBan?:SkillBan):SkillTeam {
  const team=normalizeTeam(undefined,enemyBan);
  for(let i=0;i<skillPieces.length;i++) {
    const p=skillPieces[(i+(seed>>>0)%6)%6];
    const choice:SkillChoice=((seed>>>i)&1)?'alternate':'signature';
    const candidate={...team,[p]:choice};
    if(enemyBan!==`${p}:${choice}`&&skillSpend(candidate)<=skillBudget)team[p]=choice;
  }
  return team;
}
export function botBan(seed:number): SkillBan { return `${skillPieces[(seed>>>0)%6]}:${seed&1?'alternate':'signature'}`; }
export function enemyOf(side:Color):Color{return side==='w'?'b':'w';}
