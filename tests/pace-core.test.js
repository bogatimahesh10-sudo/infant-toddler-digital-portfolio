const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../pace/core.js");
const Seed = require("../pace/seed.js");
const P = require("../pace/provider.js");

const T = "2026-10-22"; // a Thursday

// Minimal state: one everyday account, fortnightly pay in 6 days, a buffer of $100.
function base(extra) {
  return {
    user: { currency: "AUD" },
    settings: { buffer: 10000, period: "fortnightly", rollover: false, tight_per_day: 1500 },
    accounts: [
      { id: "a1", name: "Everyday", type: "transaction", opening_balance: 50000, available_cash: true, status: "active" },
      { id: "a2", name: "Saver", type: "savings", opening_balance: 100000, available_cash: false, status: "active" },
      { id: "cc", name: "Card", type: "credit", opening_balance: 20000, available_cash: true, status: "active" },
      { id: "inv", name: "Shares", type: "investment", opening_balance: 90000, available_cash: true, status: "active" },
    ],
    categories: [
      { id: "c_rent", name: "Rent", type: "expense", flexible: false, order: 0 },
      { id: "c_food", name: "Food", type: "expense", flexible: true, order: 1 },
      { id: "c_pay", name: "Pay", type: "income", order: 2 },
    ],
    recurring: [
      { id: "pay", kind: "income", name: "Pay", amount: 90000, frequency: "fortnightly", start_date: "2026-10-28", status: "active", account_id: "a1", variable: true },
      { id: "rent", kind: "bill", name: "Rent", amount: 20000, frequency: "weekly", start_date: "2026-10-23", status: "active", account_id: "a1", category_id: "c_rent", match: "rent" },
    ],
    goals: [],
    contributions: [],
    transactions: [],
    allocations: { weekly: {}, fortnightly: { c_rent: 40000, c_food: 14000 }, monthly: {} },
    bill_status: {},
    ...extra,
  };
}

test("parseMoney handles input without floating-point drift", () => {
  assert.equal(C.parseMoney("12.34"), 1234);
  assert.equal(C.parseMoney("0.1"), 10);
  assert.equal(C.parseMoney("$1,234.5"), 123450);
  assert.equal(C.parseMoney("19.999"), 1999);
  assert.ok(Number.isNaN(C.parseMoney("")));
  assert.ok(Number.isNaN(C.parseMoney("abc")));
});

test("monthly occurrences keep the anchor day and clamp short months", () => {
  assert.deepEqual(C.occurrences("2026-01-31", "monthly", "2026-01-01", "2026-05-01"), ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  assert.deepEqual(C.occurrences("2026-10-23", "weekly", "2026-10-22", "2026-11-07"), ["2026-10-23", "2026-10-30", "2026-11-06"]);
  assert.deepEqual(C.occurrences("2026-10-01", "fortnightly", "2026-10-20", "2026-11-01", "2026-10-29"), ["2026-10-29"]);
});

test("Safe to Spend = A − B − G − R, counting only available cash", () => {
  const st = C.safeToSpend(base(), T);
  assert.equal(st.payday, "2026-10-28");
  assert.equal(st.days, 6);
  assert.equal(st.A, 50000); // credit card and investments never count, even if flagged
  assert.equal(st.B, 20000); // one rent payment before payday
  assert.equal(st.G, 0);
  assert.equal(st.R, 10000);
  assert.equal(st.S, 20000);
  assert.equal(st.perDay, 3333);
  assert.ok(st.estimated, "variable income is labelled as an estimate");
  assert.deepEqual(st.excluded.map((x) => x.account.id).sort(), ["a2", "cc", "inv"]);
});

test("pending outflows reduce available cash", () => {
  const s = base({ transactions: [{ id: "p", type: "expense", amount: 1500, account_id: "a1", category_id: "c_food", date: T, status: "pending" }] });
  const st = C.safeToSpend(s, T);
  assert.equal(st.postedCash, 50000);
  assert.equal(st.pending, 1500);
  assert.equal(st.A, 48500);
});

test("a bill paid by an imported transaction is not deducted twice", () => {
  let s = base({ transactions: [{ id: "b1", type: "expense", amount: 20000, account_id: "a1", category_id: "c_rent", merchant: "Rent", date: "2026-10-23", status: "posted", source: "bank" }] });
  // Before linking, the payment has reduced the balance AND the bill is still counted.
  assert.equal(C.safeToSpend(s, T).S, 30000 - 20000 - 10000);
  s = C.autoMatchBills(s, T);
  const st = C.safeToSpend(s, T);
  assert.equal(st.B, 0);
  assert.equal(st.A, 30000);
  assert.equal(st.S, 20000);
});

test("skipped, paused and cancelled bills are excluded", () => {
  const skipped = base({ bill_status: { "rent@2026-10-23": { status: "skipped" } } });
  assert.equal(C.safeToSpend(skipped, T).B, 0);
  const paused = base();
  paused.recurring[1].status = "paused";
  assert.equal(C.safeToSpend(paused, T).B, 0);
  const cancelled = base();
  cancelled.recurring[1].status = "cancelled";
  assert.equal(C.safeToSpend(cancelled, T).B, 0);
});

test("overdue unpaid bills still count", () => {
  const s = base();
  s.recurring[1].start_date = "2026-10-20";
  const st = C.safeToSpend(s, T);
  assert.equal(st.bills[0].status, "overdue");
  assert.equal(st.B, 20000 + 20000); // 20 Oct overdue and 27 Oct upcoming
});

test("a negative result is reported as a shortfall, not zero", () => {
  const s = base();
  s.accounts[0].opening_balance = 25000;
  const st = C.safeToSpend(s, T);
  assert.equal(st.S, -5000);
  assert.equal(st.status, "shortfall");
  assert.equal(st.perDay, 0);
});

test("only reserved-account goal transfers count as savings commitments", () => {
  const s = base({
    goals: [
      { id: "g1", name: "Emergency", target: 200000, account_id: "a2", plan: { amount: 2000, frequency: "weekly", next_date: "2026-10-26", from_account_id: "a1" } },
      { id: "g2", name: "Trip", target: 100000, account_id: null, plan: { amount: 5000, frequency: "weekly", next_date: "2026-10-26", from_account_id: "a1" } },
    ],
  });
  const st = C.safeToSpend(s, T);
  assert.equal(st.G, 2000);
  s.goals[0].plan.paused_until = "2026-10-28";
  assert.equal(C.safeToSpend(s, T).G, 0);
});

test("transfers to savings are not counted as spending in budgets or insights", () => {
  const s = base({ transactions: [
    { id: "t1", type: "transfer", amount: 5000, account_id: "a1", to_account_id: "a2", category_id: null, date: "2026-10-20", status: "posted" },
    { id: "t2", type: "expense", amount: 3000, account_id: "a1", category_id: "c_food", date: "2026-10-20", status: "posted" },
  ] });
  const bs = C.budgetSummary(s, "fortnightly", T);
  assert.equal(bs.expenses, 3000);
  assert.equal(C.spendingByCategory(s, "2026-10-01", "2026-11-01").reduce((x, c) => x + c.total, 0), 3000);
  assert.equal(C.accountBalance(s, s.accounts[1]), 105000);
});

test("budget rows separate completed, pending and scheduled amounts", () => {
  const s = base({ transactions: [
    { id: "t1", type: "expense", amount: 9000, account_id: "a1", category_id: "c_food", date: "2026-10-16", status: "posted" },
    { id: "t2", type: "expense", amount: 6000, account_id: "a1", category_id: "c_food", date: T, status: "pending" },
  ] });
  const bs = C.budgetSummary(s, "fortnightly", T);
  assert.equal(bs.range.start, "2026-10-14");
  const food = bs.rows.find((r) => r.category.id === "c_food");
  assert.equal(food.completed, 9000);
  assert.equal(food.pending, 6000);
  assert.equal(food.status, "over");
  const rent = bs.rows.find((r) => r.category.id === "c_rent");
  assert.equal(rent.scheduled, 20000); // only the 23 Oct rent falls in this fortnight
});

test("rollover adds last period's unspent amount", () => {
  const s = base({ transactions: [{ id: "t1", type: "expense", amount: 4000, account_id: "a1", category_id: "c_food", date: "2026-10-05", status: "posted" }] });
  s.settings.rollover = true;
  const food = C.budgetSummary(s, "fortnightly", T).rows.find((r) => r.category.id === "c_food");
  assert.equal(food.rolled, 10000);
  assert.equal(food.available, 24000);
});

test("allocation transfers move planned money without creating spending", () => {
  const s = C.transferAllocation(base(), "fortnightly", "c_rent", "c_food", 5000);
  assert.equal(s.allocations.fortnightly.c_rent, 35000);
  assert.equal(s.allocations.fortnightly.c_food, 19000);
  assert.throws(() => C.transferAllocation(base(), "fortnightly", "c_food", "c_rent", 99999), /doesn't have/);
  const scaled = C.setAllocation(base(), "fortnightly", "c_food", 14000);
  assert.equal(scaled.allocations.weekly.c_food, 7000);
  assert.equal(scaled.allocations.monthly.c_food, 30333);
});

test("forecast finds the first shortfall and offers fixes", () => {
  const s = base();
  s.accounts[0].opening_balance = 22000;
  const fc = C.forecast(s, T, 21);
  assert.ok(fc.firstNegative, "expected a projected shortfall");
  assert.ok(fc.incomeEstimated);
  const opts = C.shortfallOptions(s, T);
  assert.ok(opts.need > 0);
  assert.equal(opts.bills[0].rule.id, "rent");
  assert.ok(opts.spending.cutPerDay > 0);
});

test("bank import is idempotent and updates pending to posted", () => {
  const s0 = base();
  const conn = { id: "bc1" };
  let n = 0;
  const id = () => "imp" + ++n;
  const raw = { provider_tx_id: "x1", account_ref: "r1", amount: 1890, direction: "debit", date: T, description: "UBER *TRIP 1234 AU", status: "pending" };
  let r = C.importProviderTransactions(s0, conn, [raw], { r1: "a1" }, "now", id);
  assert.equal(r.added.length, 1);
  assert.equal(r.added[0].merchant, "Uber *Trip");
  assert.equal(r.added[0].original_description, "UBER *TRIP 1234 AU");
  r = C.importProviderTransactions(r.state, conn, [{ ...raw, status: "posted" }], { r1: "a1" }, "now", id);
  assert.equal(r.added.length, 0);
  assert.equal(r.updated.length, 1);
  assert.equal(r.state.transactions.length, 1);
  assert.equal(r.state.transactions[0].status, "posted");
  r = C.importProviderTransactions(r.state, conn, [{ ...raw, status: "reversed" }], { r1: "a1" }, "now", id);
  assert.equal(C.accountBalance(r.state, r.state.accounts[0]), 50000, "reversed transactions don't affect the balance");
});

test("imported duplicates of manual entries are flagged and can be merged", () => {
  const s0 = base({ transactions: [{ id: "m1", type: "expense", amount: 6420, account_id: "a1", category_id: "c_food", merchant: "Woolworths", note: "Weekly shop", date: "2026-10-20", status: "posted", source: "manual" }] });
  const r = C.importProviderTransactions(s0, { id: "bc" }, [{ provider_tx_id: "w", account_ref: "r1", amount: 6420, direction: "debit", date: "2026-10-20", description: "WOOLWORTHS 3021", status: "posted" }], { r1: "a1" }, "now", () => "b1");
  assert.equal(r.duplicates.length, 1);
  assert.equal(r.duplicates[0].possible_duplicate_of, "m1");
  const merged = C.resolveDuplicate(r.state, "b1", "merge", "now");
  assert.equal(merged.transactions.find((t) => t.id === "m1").status, "excluded");
  assert.equal(merged.transactions.find((t) => t.id === "b1").note, "Weekly shop");
  assert.equal(C.accountBalance(merged, merged.accounts[0]), 50000 - 6420);
});

test("edits keep an audit trail and deletes are soft", () => {
  let s = C.upsertTransaction(base(), { id: "t1", type: "expense", amount: 1000, account_id: "a1", category_id: "c_food", date: T, merchant: "Cafe" }, "t0");
  s = C.upsertTransaction(s, { ...s.transactions[0], amount: 1200 }, "t1");
  assert.deepEqual(s.transactions[0].audit[0].changes, [{ field: "amount", from: 1000, to: 1200 }]);
  s = C.softDeleteTransaction(s, "t1", "t2");
  assert.equal(s.transactions.length, 1);
  assert.equal(C.accountBalance(s, s.accounts[0]), 50000);
  s = C.restoreTransaction(s, "t1", "t3");
  assert.equal(C.accountBalance(s, s.accounts[0]), 48800);
});

test("recategorising can remember the merchant", () => {
  let s = base({ transactions: [
    { id: "a", type: "expense", amount: 100, account_id: "a1", category_id: "c_rent", merchant: "Aldi", date: T, status: "posted" },
    { id: "b", type: "expense", amount: 200, account_id: "a1", category_id: "c_rent", merchant: "ALDI", date: T, status: "posted" },
  ] });
  s = C.recategorize(s, "a", "c_food", true, "now");
  assert.equal(s.transactions.find((t) => t.id === "b").category_id, "c_food");
  assert.equal(s.category_rules.aldi, "c_food");
});

test("duplicate detection for manual entry", () => {
  const s = base({ transactions: [{ id: "a", type: "expense", amount: 500, account_id: "a1", category_id: "c_food", date: "2026-10-21", status: "posted" }] });
  assert.equal(C.findPossibleDuplicates(s, { id: "n", type: "expense", amount: 500, account_id: "a1", date: T }).length, 1);
  assert.equal(C.findPossibleDuplicates(s, { id: "n", type: "expense", amount: 501, account_id: "a1", date: T }).length, 0);
});

test("reconciling sets the balance to the bank's figure", () => {
  const s = C.reconcileAccount(base(), "a1", 48760, "now");
  assert.equal(C.accountBalance(s, s.accounts[0]), 48760);
  const owed = C.reconcileAccount(base(), "cc", 25000, "now");
  assert.equal(C.accountBalance(owed, owed.accounts[2]), 25000);
});

test("goal projection and contribution conflict", () => {
  const s = base();
  s.accounts[0].opening_balance = 32000;
  const goal = { id: "g", name: "Car", target: 300000, account_id: "a2", plan: { amount: 15000, frequency: "weekly", next_date: "2026-10-24", from_account_id: "a1" } };
  const conflict = C.contributionConflict(s, goal, T);
  assert.ok(conflict, "a large weekly transfer before payday should conflict");
  const p = C.goalProjection({ ...s, goals: [goal] }, goal, T);
  assert.equal(p.saved, 100000);
  assert.ok(p.eta > T);
});

test("sample data is internally consistent", () => {
  const s = Seed.sample(T);
  const byId = (id) => s.accounts.find((a) => a.id === id);
  assert.equal(C.accountBalance(s, byId("a_every")), 61240);
  assert.equal(C.accountBalance(s, byId("a_cc")), 34000);
  assert.equal(C.accountBalance(s, byId("a_bnpl")), 18000);
  const st = C.safeToSpend(s, T);
  assert.equal(st.S, st.A - st.B - st.G - st.R);
  assert.ok(st.S > 0);
  assert.ok(C.forecast(s, T).firstNegative, "sample data demonstrates Flow D");
  assert.ok(s.transactions.every((t) => C.validateTransaction(t, s).length === 0));
});

test("mock provider follows the adapter contract", async () => {
  const p = P.createMockProvider({ today: () => T, delayMs: 0 });
  await assert.rejects(p.authorize("demo-bank", { approve: false }), { code: "consent_declined" });
  await assert.rejects(p.authorize("down-bank", { approve: true }), { code: "provider_unavailable" });
  const consent = await p.authorize("demo-bank", { approve: true });
  const accounts = await p.fetchAccounts(consent.consent_reference, 0);
  assert.equal(accounts[0].account_ref, "db-every");
  const first = await p.fetchTransactions(consent.consent_reference, 0);
  assert.equal(first.next_cursor, 1);
  assert.ok(first.transactions.some((t) => t.status === "pending"));
  p.failNextSync();
  await assert.rejects(p.fetchTransactions(consent.consent_reference, 1), { code: "sync_failed" });
});
