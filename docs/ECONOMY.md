# Play-credit economy

Credits are free, browser-owned game currency, stored with the existing profile.
They have no cash purchase, withdrawal, transfer or competitive-server authority.
The account endpoint can back up this cosmetic save when a backend is configured;
GitHub Pages continues to work entirely offline. Loading a backup replaces the
local profile, including its wallet. It is not a server-verified economy.

Legacy profiles keep all XP unlocks and individual piece assignments. A profile
without a wallet receives 750 credits once; loading a saved zero balance never
refills it. The main menu shows the balance; **คลังสมบัติและสุ่มสกิน** contains
the capsule, forge, daily provisions and the latest forty transactions.

## Earning and spending

Existing first-clear, match and daily XP rewards also give the same number of
credits, capped at 250 per reward. The original first-clear/match IDs prevent
repeat rewards. Economic contracts give XP normally but use their published
contract payout instead of this extra credit reward.

Daily provisions give 100 credits once per UTC day (reset 07:00 in Thailand).
Puzzle Payday is free, allowing a player with zero credits to earn again.

| Contract | Board rules | Entry | Gross payout |
| --- | --- | ---: | --- |
| Bounty Hunt | Score Clash, twelve turns each | 40 | Win: 160 + captured value × 6, capped at 360 |
| Vault Control | Control Arena, five control points | 60 | Win: 200 + control score × 20, capped at 300 |
| Broker Draft | Draft Arena, equal team budgets | 80 | Win: 260 + unused budget × 10, bonus capped at 120 |
| Royal Stakes | Full classic chess against a bot | 150 | Win: 450 |
| Puzzle Payday | Three-minute mate-in-one Rush, three failures | 0 | Run ends: 25 per solved puzzle, capped at 500 |

Paid contracts refund entry on a draw and pay zero on a loss. Switching to
another game or restarting forfeits the old entry; restarting charges a new
entry. Continuing a saved game never charges again. All board contracts play
against the existing three bot levels; Payday is solo. The regular local/PvP
modes remain available alongside them.

Live contract HUD shows capture bounty, control points, draft savings or solved
puzzles and the projected gross reward. Settlement uses the authoritative legal
history/objective score. It happens once per contract; subsequent reloads cannot
repeat it. Undo is allowed before settlement, then disabled and guarded after
the money is paid. Rush keeps one contract across all puzzles and settles only
when the entire run ends. Skipping/replaying combat never awards money.

## Skin capsule and forge

One capsule costs **150 credits**. It unlocks a whole existing skin set, usable
on every piece and equipable separately in the armory. A collected skin unlocks
immediately without requiring its XP level; existing XP unlocks still work.

| Skin | Normal chance | Duplicate shards | Forge cost |
| --- | ---: | ---: | ---: |
| Ember Knights | 32% | 20 | 60 |
| Frost Guard | 32% | 20 | 60 |
| Astral Order | 26% | 35 | 120 |
| Golden Sovereign | 10% | 80 | 240 |

After seven consecutive capsules without Golden Sovereign, the eighth is
guaranteed to contain it. Any Golden Sovereign result resets that counter. The
screen shows the actual chance for the next pull, including 100% at guarantee.
An already-owned or XP-unlocked skin gives shards. Forge spends only shards to
unlock a chosen unowned skin. Skins remain cosmetic and do not alter chess rules.
The client uses `crypto.getRandomValues` for capsule selection; results are saved
before the reveal/audio, and rapid repeated presses are gated during the reveal.

## Files and verification

Shared transaction/probability logic: `shared/economy.js` and its TypeScript
declarations. Profile migration/unlocks: `src/profile.ts`. Game settlement and
entry handling: `src/main.ts`. Menu and treasury: `src/title.ts`,
`src/economy-ui.ts`, `src/economy.css`. Account backup normalization:
`server/accounts.mjs`. The single-file offline game is rebuilt for Pages.

```sh
npm test
npm run build
npm run build:offline
npm run test:economy
npm run test:title
npm run test:modes
npm run build:pages
npm run test:pages
```

Native tests verify probability boundaries, guarantee/reset, duplicate shards,
forge, legacy saves, entry binding, draw/loss caps, reward deduplication and account
backup round trips. The offline browser harness exercises actual menu actions,
responsive layouts, independent equipment, five playable launches, saved resume,
five legal-result settlements, Rush totals and the post-settlement undo guard.
These checks do not establish a real iPhone/Safari frame rate or a cash economy.
