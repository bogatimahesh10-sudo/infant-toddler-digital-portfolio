# Pace prototype

Interactive prototype for **Pace**, a calm, practical budgeting app that helps people understand what they can safely spend. It is built against Product Specification v1.0 and the Claude project brief (both dated 22 October 2026).

**This is a responsive web prototype, not a native app.** See [Moving to iOS and Android](#moving-to-ios-and-android).

All data is synthetic. Bank connections use a mock provider, and nothing reads or moves real money. State is saved in the browser's localStorage on this device only. It isn't encrypted, backed up or synced.

## Run it

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000   # then open http://localhost:8000/pace/
```

`index.html` has no `<!doctype>` or `<head>` because it is published as a claude.ai artifact, which adds them. It still works when opened directly.

Run the unit tests from the repository root with `npm test`.

## Files

| File | What it holds |
| --- | --- |
| `core.js` | The financial rules (Safe to Spend, forecast, budgets, bills, goals, bank import, deduplication and insights) as pure functions over a state object. It has no UI code, so it can move into a React Native / Expo app unchanged. |
| `provider.js` | The bank-provider adapter interface and a deterministic mock provider. |
| `seed.js` | Synthetic sample data (Mia, four months of history) and the builder for the first-time setup. |
| `app.js` | Screens, forms, sheets and flows. It holds no money logic. |
| `../tests/pace-core.test.js` | Unit tests for the rules above. |

## Safe to Spend

There is one implementation, `safeToSpend()` in `core.js`, and every screen calls it.

```
S = A + E − B − G − O − R
```

| Term | Meaning | Rules applied |
| --- | --- | --- |
| A | Available cash | Only accounts marked as available cash, and only cash, everyday or savings types. Credit limits, loans and investments are never counted. Pending outflows are subtracted. |
| E | Expected income in the window | Off by default (the conservative view). When the user turns it on, it is labelled, and the figure without it is still shown. It is never used for the "Until payday" window. |
| B | Unpaid bills in the window | Overdue unpaid bills are included. Paid, skipped, paused and cancelled bills are excluded. A bill matched to a payment is not deducted again. |
| G | Planned savings transfers in the window | Only transfers to a goal's reserved account, paid from available cash. Virtual goals move no money and aren't deducted. |
| O | Other reserved commitments | Money the user has set aside, such as paying a friend back. |
| R | Safety buffer | Set by the user. |

**Ledger model.** An account's balance is its opening balance plus every posted transaction. Spending that is already recorded is therefore inside A, and is never subtracted a second time. Pending outflows aren't in the posted balance yet, so they are subtracted once. Paying a bill moves its amount from B into A, which leaves S unchanged. Refunds are stored as money coming in, but they reduce spending in their category and aren't counted as income.

**Windows.** The user can choose one of three windows:
- **Until payday** is the default.
- **Next 7 days** covers the coming week.
- **This [budget period]** is only offered when the period ends on a different day from payday. A fortnight anchored to payday would just repeat "Until payday".

The window is shown next to the number. A negative result is shown as a shortfall with an explanation, never as $0. The brief's worked example ($900 / $400 / $250 / $100 / $50 → $900, or $500 in the conservative view) is a unit test.

## Screens and flows

The main screens are Home, Budget, Activity, Goals and Insights. The supporting screens are Onboarding, Accounts, Bills & calendar, Connect a bank, and Settings & privacy.

- **Flow A, first-time setup:** Settings → Prototype tools, the "Set up my own" button on Home, or the guide panel on desktop.
- **Flow B, record an expense:** the Add button. Activity, the budget rows and the forecast update, and a message shows how Safe to Spend changed.
- **Flow C, connect a bank:** Accounts → Connect a bank. The flow covers consent, the secure handoff (simulated), import, duplicate merging and balance reconciliation. Declining or choosing "Unavailable Bank" returns the user to manual entry. A connection shows connected, syncing, failed and disconnected states. Use "Simulate a failed sync" to see the failed state.
- **Flow D, avoid a cash shortfall:** the sample data projects a shortfall in about two and a half weeks. Home offers three fixes: spend less each day, pause a goal, or review the bill.

## Data model notes

- Money is stored as integer cents, and every account and transaction stores its own `currency`.
- Transactions record `status` (posted, pending, reversed or excluded) and `source` (manual, csv_import or bank). Bank transactions also record `provider_tx_id`, `original_description` (kept separate from the editable `merchant`), an `audit` trail and `deleted_at` for soft deletes.
- Bill occurrences are generated from recurring rules. Their status comes from `bill_status` overrides and from transactions linked through `bill_occurrence_id`.
- Goal contributions are stored separately from goal targets. Transfers into a reserved account are not counted as spending.
- Connections store a consent reference, status, sync cursor, last sync time and error history. They never store credentials.

## Not built in the prototype

The prototype has no authentication, server, row-level security, real notifications or real bank provider. These are planned for weeks 4–6+ of the spec. State is kept in the browser's localStorage.

## Moving to iOS and Android

The recommended stack is React Native with Expo and TypeScript. The migration is incremental:

1. Move `core.js` into a shared TypeScript package unchanged, add types for the state, and keep the unit tests. This is the part to trust first.
2. Rebuild the screens in React Native. Use `app.js` as the behaviour reference rather than porting its DOM code.
3. Replace localStorage with authenticated storage: Supabase/Postgres with row-level security, so every record is scoped to its user.
4. Put a real Consumer Data Right provider behind the interface in `provider.js`. This needs provider selection, contracts, and security and legal review before any real user connects a bank. No live provider, paid API or auth service has been added.

## Changelog

**22 Oct 2026, project brief pass**
- Switched to the brief's palette: forest #174D3A, warm white #FAF8F2, soft mint #EAF3ED and charcoal #202820.
- Safe to Spend now has three windows (until payday, next 7 days, budget period), expected income as a separate labelled term with a conservative default, and other set-asides.
- Added income editing, refunds, recent transactions on Home, a recurring bills summary in Insights, and a notice that data is stored only on this device.
- Added tests for the brief's worked example, period boundaries, expected income, refunds, paid bills and double counting.

**22 Oct 2026, spec v1.0 build**
- Built the five main screens, the supporting screens, flows A–D, the mock bank provider and the sample data.
