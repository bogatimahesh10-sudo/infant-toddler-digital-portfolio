# Pace prototype

Interactive prototype for **Pace**: *Know your money. Control your pace.* It is built against Product Specification v1.0 (22 October 2026).

All data is synthetic. Bank connections use a mock provider, and nothing reads or moves real money.

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

`S = A − B − G − R`. There is one implementation, `safeToSpend()` in `core.js`, and every screen calls it.

| Term | Meaning | Rules applied |
| --- | --- | --- |
| A | Available cash | Only accounts marked as available cash, and only cash, everyday or savings types. Credit limits, loans and investments are never counted. Pending outflows are subtracted. |
| B | Unpaid bills before the next payday | Overdue unpaid bills are included. Paid, skipped, paused and cancelled bills are excluded. A bill matched to a transaction is not deducted again (`autoMatchBills`). |
| G | Planned savings contributions before payday | Only transfers to a goal's reserved account, paid from available cash. Virtual goals move no money and are not deducted. |
| R | Safety buffer | Set by the user. |

The pay period ends at the next expected income date. Variable income is labelled as an estimate. A negative result is shown as a shortfall with an explanation, never as $0.

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
