# Resume development

The checkout is an existing isolated workspace; do not create another worktree unless requested.

Entry point: `src/main.ts`; layout: `src/style.css`.

`game` is the authoritative local Chess instance. `rebuild()` reconstructs rendered pieces from its board. `move()` validates and commits a move, then animates the old rendered piece to its destination. Finishing or skipping an animation rebuilds the scene, which also resolves castling and promotion visuals. Keep chess state independent from visual animation.

Start with the README commands. Preserve legal move behavior when adding animations. Build a reusable event analyzer and animation timeline before adding pair-specific cinematics. Royal rescue detection is currently approximate (capture while previously in check); refine it using the previous attacker set. Current castling and promotion resolve visually at animation completion, and need dedicated choreography.

For PvP, validate moves and clocks on the server. Clients should render only confirmed events. Do not depend on animation completion for network turn timing.
