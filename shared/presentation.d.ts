export type LootRarity='common'|'rare'|'epic'|'legendary';
export type CosmeticKind = 'dimension'|'finisher'|'frame'|'board'|'skill';
export interface CosmeticTheme {id:string;name:string;label:string;color:string;pattern:number;description:string}
export const dimensionThemes:CosmeticTheme[];
export const finisherThemes:CosmeticTheme[];
export const profileFrames:CosmeticTheme[];
export const cosmeticGroups:Record<CosmeticKind,CosmeticTheme[]>;
export const presentationCatalog: {id:string;kind:CosmeticKind;cosmetic:string;label:string;name:string;color:string;pattern:number;description:string;rarity:LootRarity;price:number;currency:'credits';shards:number;credits:number}[];

export const boardThemes:CosmeticTheme[];
export const skillThemes:CosmeticTheme[];
export function rarityForPattern(pattern:number):'common'|'rare'|'epic'|'legendary';
