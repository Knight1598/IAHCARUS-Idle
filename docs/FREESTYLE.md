# Freestyle duels and skin identities

Special Duel preparation is a separate sequence: **mode → rules → skill loadout → cosmetic army → arena**. Standard matches skip skill selection and retain normal chess. Economic contracts retain their published fees and objectives.

Rules offer three starting formations: the normal army, seeded symmetric skirmish armies, and the existing balanced default draft. Select 0/1/3/5/9 charges per side, with one use per physical piece or repeated use until the team reserve runs out. Both sides have identical skill choices; bots receive the same configuration.

Each class chooses its original signature ultimate or an alternative:

| Class | Alternative |
| --- | --- |
| Knight | Jump two squares diagonally, over intervening pieces |
| Bishop | Knight jump |
| Rook | Knight jump |
| Queen | Jump two squares horizontally or vertically |
| Pawn | Move or capture one square sideways |
| King | Move two squares diagonally; both transit squares must be empty and safe |

Every skill consumes one move and one charge. Ordinary attack patterns still determine check. Legal ultimate escapes count when deciding mate or stalemate. Castling rights, promotions, captures, ownership, replay, undo and bot snapshots remain authoritative in `SpecialChess`. `specialConfig` saves the initial rules alongside history, so reload/replay does not silently switch to default rules. Older saves default to the original three-charge duel.

Eight skin sets contain 48 class/skin combat identities. Storm Circuit adds conductive fins, zigzag lightning, pulsed floor runes and short plasma accents. Void Reaper adds eclipse rings, inward trails, contracting aura bands and lowered choir tones. Prism Ascendant adds three crystal crowns, faceted trails, layered hexagonal auras and staggered metallic accents. Each class keeps its weapon silhouette. Rarity tiers 1–5 add ornament/rune layers and bounded impact detail, while choreography and sound remain specific to each skin. Skins never grant skill access or stronger rules.

The new sets are available through XP, capsules or chosen forging; the treasury displays actual next-pull odds and duplicate rewards. Existing skin IDs, equips, balances and pity counters remain valid. The eighth capsule still guarantees Golden Sovereign after seven results below legendary rarity; a legendary/mythic result resets the counter.

GPU batches remain 4/5 per combat effect according to quality. Ground runes still merge into two color batches and avatar auras into three batches. CPU avatar templates are bounded by 48 profiles. Low quality and reduced effects remain available.

Verification: `npm test`, `npm run build`, `npm run build:pages`, `npm run test:freestyle`, `npm run test:title`, `npm run test:special`, `npm run test:economy`. Freestyle browser coverage uses the built offline artifact at an intercepted HTTP origin with network disabled, including 320px portrait and short landscape. It verifies all new previews compile their shaders, independent skills, real alternate capture, saved resume and undo. This is Chromium/SwiftShader coverage; it does not assert physical-device performance.
