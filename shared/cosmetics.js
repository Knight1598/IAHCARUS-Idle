// Cosmetics describe presentation only. Unlocks currently live in the browser
// profile, so this validation does not establish ownership of paid items.
export const cosmeticSkins = Object.freeze([
  "classic", "ember", "frost", "astral", "royal",
]);

const isRecord = (value) => value !== null && typeof value === "object" &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const ownValue = (value, key) => {
  if (!isRecord(value)) return undefined;
  // JSON has no accessors, but do not invoke them if a caller passes an object.
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
};
const validSkin = (value) => typeof value === "string" && cosmeticSkins.includes(value);

/** Sanitize an army setup using its owner's original sixteen board squares. */
export function normalizeCosmetics(value, color) {
  const selected = ownValue(value, "skin");
  const skin = validSkin(selected) ? selected : "classic";
  const loadout = {};
  const rawLoadout = ownValue(value, "loadout");
  if (isRecord(rawLoadout) && (color === "w" || color === "b")) {
    // Only sixteen known keys are ever inspected; inherited keys, enemy
    // squares, prototype names and arbitrary metadata cannot enter a snapshot.
    const ranks = color === "w" ? ["1", "2"] : ["7", "8"];
    for (const rank of ranks) {
      for (const file of "abcdefgh") {
        const square = file + rank;
        const override = ownValue(rawLoadout, square);
        if (validSkin(override)) loadout[square] = override;
      }
    }
  }
  return { skin, loadout };
}
