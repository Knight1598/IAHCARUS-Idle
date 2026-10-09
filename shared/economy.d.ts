import type { SkinId } from "../src/profile.ts";
export type EconomicMode = "bounty" | "vault" | "broker" | "stakes" | "payday";
export interface Economy { version: 1; credits: number; shards: number; pulls: number; pity: number; owned: SkinId[]; claimed: string[]; log: { id: string; label: string; delta: number }[] }
export interface Contract { id: string; mode: EconomicMode }
export interface ContractResult { won: boolean; draw: boolean; solved?: number; capturedValue?: number; controlScore?: number; unusedBudget?: number }
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
