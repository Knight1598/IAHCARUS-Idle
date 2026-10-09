import type { Color, Square } from "chess.js";

export type CosmeticSkinId = "classic" | "ember" | "frost" | "astral" | "royal" | "storm" | "void" | "prism";
export interface ArmyCosmetics {
  skin: CosmeticSkinId;
  /** Overrides keyed by each piece's starting square, retained after it moves. */
  loadout: Partial<Record<Square, CosmeticSkinId>>;
}
export const cosmeticSkins: readonly CosmeticSkinId[];
export function normalizeCosmetics(value: unknown, color: Color): ArmyCosmetics;
