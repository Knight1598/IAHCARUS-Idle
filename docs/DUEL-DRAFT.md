# Duel Draft and Living Field

Start → Special Duel → setup. Choose **Duel Draft** for side-specific loadouts and/or **สนามมีชีวิต** for field events. Both are optional; old saves retain shared freestyle skills and quiet fields. Online rooms keep standard chess.

## Draft flow

1. Ban one opponent skill (class + signature/alternate). With a bot, its ban and build are seeded; with local two-player play, both sides select their bans.
2. Build each editable side within **12 points**. Each class takes signature, alternate, or off. Pawns cost 1/2, knights 3/2, bishops 2/3, rooks 2/3, queens 2/3, kings 2/2; off is free. A banned choice cannot be equipped. Overspending is blocked.
3. Reveal both builds before continuing to skins and arena. You can return to edit. Builds are public, including the bot's. Off removes ultimates for that class, keeping its normal movement. Cosmetics never change the budget.

## Field rules

One round means one white and one black turn. Events are based on completed moves, not wall time. At rounds 1–2, show the exact energy squares and a 2/1-round countdown. The event lasts rounds 3–4; rounds 5–6 warn of portals, active in rounds 7–8. This repeats with seeded square pairs. Active fields also show the next forecast inside the compact rules disclosure.

- **Energy Nexus:** at the end of an active round, each side occupying at least one energy square gains one charge, capped at the starting charge count. Two pieces never grant two charges. One-use restrictions still apply; select reusable pieces in setup if desired.
- **Dimension Gate:** a non-king on one endpoint can move or capture on the other endpoint as one turn, spending no charge. Own-king safety is mandatory; friendly pieces and kings cannot be captured. Select the piece, then the highlighted destination. This is `P:` notation; ultimates remain `U:`. Neither permanently changes attacks.

Undo, reload and the bot worker retain event progress, reserves, piece identities and loadouts. Repetition distinguishes event phases and square cycles. These PGNs carry custom notation and are not standard chess imports.

## Executions

Storm creates a lightning binding and branching discharge. Void creates an eclipse with spiralling energy, drawing the defeated avatar into collapse. Prism splits into two procedural fighter silhouettes that converge at the final strike. Existing class-specific poses, defense reactions, framing and distinct sound recipes still apply. Premium effects add at most three small draw batches; reduced effects omit them. Capture duration remains 2–3 seconds, with impact at the existing timeline position. Anticipation cuts effect tails and ducks music briefly; skip/pause cancels the duck and pending effects.

## Verification

`npm test` covers budget normalization, opposing bans, field timing, resource cap/undo, portal legality/replay, execution clock and all three bot levels. After `npm run build:pages`, `npm run test:duel-draft` exercises draft/reveal, mobile layouts, field HUD and portal save replay in the embedded offline build. `test:freestyle`, `test:special`, `test:title` and `test:pages` check existing flows.
