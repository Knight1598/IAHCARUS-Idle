export type CosmeticKind = 'dimension'|'finisher'|'frame';
export interface CosmeticTheme {id:string;name:string;label:string;color:string;pattern:number;description:string}
export const dimensionThemes:CosmeticTheme[];
export const finisherThemes:CosmeticTheme[];
export const profileFrames:CosmeticTheme[];
export const cosmeticGroups:Record<CosmeticKind,CosmeticTheme[]>;
export const presentationCatalog: {id:string;kind:CosmeticKind;cosmetic:string;label:string;name:string;color:string;pattern:number;description:string;price:number;currency:'credits';shards:number;credits:number}[];
