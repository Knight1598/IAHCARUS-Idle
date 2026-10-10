import type { SkinId } from "../src/profile.ts";
export type EconomicMode = "open" | "bounty" | "vault" | "broker" | "stakes" | "payday";
export interface Economy { version: 2; inventory:string[]; equipped:Partial<Record<'dimension'|'finisher'|'frame'|'board'|'skill',string>>; bannerPity:Record<string,{legend:number;rare:number}>; lootHistory:LootReward[]; premium: number; credits: number; shards: number; pulls: number; pity: number; owned: SkinId[]; claimed: string[]; log: { id: string; label: string; delta: number; currency?: "premium" }[] }
export interface Contract { id: string; mode: EconomicMode }
export interface ContractResult { won: boolean; draw: boolean; plies?: number; solved?: number; capturedValue?: number; controlScore?: number; unusedBudget?: number }
export const economicModes: { id: EconomicMode; name: string; label: string; base: "bot" | "score" | "control" | "draft" | "rush"; entry: number; prize: number; description: string; rules: string }[];
export const skinPool: { skin: SkinId; chance: number; shards: number }[];
export const pullCost: number;
export const pityLimit: number;
export const forgeCosts: Partial<Record<SkinId, number>>;
export function isEconomicMode(id: unknown): id is EconomicMode;
export function economicDefinition(id: unknown): typeof economicModes[number] | undefined;
export function readEconomy(raw?: unknown): Economy;
export function claimCredits(wallet: Economy, id: string, amount: number, label: string): { wallet: Economy; added: boolean; amount: number };
export function dailyCredits(wallet: Economy, day: string): ReturnType<typeof claimCredits>;
export function enterContract(wallet: Economy, id: string, mode: EconomicMode): ReturnType<typeof claimCredits>;
export function settleContract(wallet: Economy, id: string, mode: EconomicMode, result: ContractResult): ReturnType<typeof claimCredits>;
export function contractAmount(mode: EconomicMode, result: ContractResult): number;
export function rollSkin(wallet: Economy, unlocked?: SkinId[], random?: () => number): { wallet: Economy; skin: SkinId; duplicate: boolean; shards: number; guaranteed: boolean };
export function forgeSkin(wallet: Economy, skin: SkinId, unlocked?: SkinId[]): Economy;

export interface ShopItem {id:string;kind:"skin"|"bundle"|"supplies"|"dimension"|"finisher"|"frame"|"board"|"skill";rarity?:LootRarity;cosmetic?:string;color?:string;pattern?:number;description?:string;skin?:SkinId;label?:string;price:number;currency:"credits"|"premium";shards:number;credits:number;}
export const shopCatalog: ShopItem[];
export function trialPremium(wallet:Economy):ReturnType<typeof claimCredits>;
export function buyShopItem(wallet:Economy,id:string,unlocked?:SkinId[]):Economy;

export function equipShopItem(wallet:Economy,id:string):Economy;

export type LootRarity='common'|'rare'|'epic'|'legendary';
export interface LootReward {id:string;banner:string;product:string;rarity:LootRarity;duplicate:boolean;shards:number;guaranteed:boolean}
export const gachaBanners:{id:string;label:string;description:string;kinds:string[]}[];
export const capsuleCost:number;
export const rarityRates:Record<LootRarity,number>;
export const duplicateShards:Record<LootRarity,number>;
export const cosmeticForgeCosts:Record<LootRarity,number>;
export function lootRarity(item:ShopItem):LootRarity;
export function bannerPool(id:string):ShopItem[];
export function bannerOdds(id:string,wallet?:Economy):{product:string;rarity:LootRarity;chance:number}[];
export function rollCapsules(wallet:Economy,banner:string,count?:number,unlocked?:SkinId[],random?:()=>number):{wallet:Economy;rewards:LootReward[]};
export function forgeCosmetic(wallet:Economy,id:string):Economy;
