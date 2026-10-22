const test = require("node:test");
const assert = require("node:assert/strict");
const B = require("../budget.js");

function seeded() {
  let s = B.emptyState();
  s = B.addTransaction(s, { id: "a", type: "income", amount: 300000, category: "Salary", date: "2026-10-01" });
  s = B.addTransaction(s, { id: "b", type: "expense", amount: 12050, category: "Groceries", date: "2026-10-05", note: "weekly shop" });
  s = B.addTransaction(s, { id: "c", type: "expense", amount: 9000, category: "Groceries", date: "2026-10-12" });
  s = B.addTransaction(s, { id: "d", type: "expense", amount: 4500, category: "Dining out", date: "2026-09-28" });
  return s;
}

test("toCents handles strings, numbers and float rounding", () => {
  assert.equal(B.toCents("12.34"), 1234);
  assert.equal(B.toCents(0.1 + 0.2), 30);
  assert.equal(B.toCents("$1,000.50"), 100050);
  assert.ok(Number.isNaN(B.toCents("abc")));
});

test("addTransaction rejects invalid input", () => {
  const s = B.emptyState();
  assert.throws(() => B.addTransaction(s, { type: "expense", amount: 0, category: "Other", date: "2026-10-01" }), /Amount/);
  assert.throws(() => B.addTransaction(s, { type: "expense", amount: 100, category: "", date: "2026-10-01" }), /Category/);
  assert.throws(() => B.addTransaction(s, { type: "expense", amount: 100, category: "Other", date: "" }), /Date/);
});

test("summarize totals only the selected month", () => {
  const s = seeded();
  const oct = B.summarize(B.transactionsForMonth(s, "2026-10"));
  assert.deepEqual(oct, { income: 300000, expense: 21050, balance: 278950 });
  const sep = B.summarize(B.transactionsForMonth(s, "2026-09"));
  assert.deepEqual(sep, { income: 0, expense: 4500, balance: -4500 });
});

test("transactionsForMonth is newest first", () => {
  const ids = B.transactionsForMonth(seeded(), "2026-10").map((t) => t.id);
  assert.deepEqual(ids, ["c", "b", "a"]);
});

test("budgetReport flags overspending and includes unbudgeted spending", () => {
  let s = seeded();
  s = B.setBudget(s, "Groceries", 20000);
  s = B.setBudget(s, "Transport", 5000);
  const report = B.budgetReport(s, "2026-10");
  const groceries = report.find((r) => r.category === "Groceries");
  assert.equal(groceries.spent, 21050);
  assert.equal(groceries.over, true);
  assert.equal(groceries.remaining, -1050);
  const transport = report.find((r) => r.category === "Transport");
  assert.equal(transport.spent, 0);
  assert.equal(transport.over, false);
  assert.equal(report.find((r) => r.category === "Dining out"), undefined);
  const sep = B.budgetReport(s, "2026-09").find((r) => r.category === "Dining out");
  assert.equal(sep.limit, 0);
  assert.equal(sep.ratio, null);
});

test("setBudget with zero removes the limit", () => {
  let s = B.setBudget(B.emptyState(), "Housing", 100000);
  assert.equal(s.budgets.Housing, 100000);
  s = B.setBudget(s, "Housing", 0);
  assert.equal("Housing" in s.budgets, false);
});

test("updateTransaction and deleteTransaction", () => {
  let s = seeded();
  s = B.updateTransaction(s, "b", { amount: 5000, note: "fixed" });
  assert.equal(s.transactions.find((t) => t.id === "b").amount, 5000);
  assert.throws(() => B.updateTransaction(s, "b", { amount: -1 }), /Amount/);
  assert.throws(() => B.updateTransaction(s, "zzz", { amount: 1 }), /not found/);
  s = B.deleteTransaction(s, "b");
  assert.equal(s.transactions.some((t) => t.id === "b"), false);
});

test("addCategory ignores duplicates and blanks", () => {
  let s = B.addCategory(B.emptyState(), "expense", "Pets");
  assert.ok(s.categories.expense.includes("Pets"));
  const len = s.categories.expense.length;
  s = B.addCategory(s, "expense", "pets");
  s = B.addCategory(s, "expense", "   ");
  assert.equal(s.categories.expense.length, len);
});

test("shiftMonth crosses year boundaries", () => {
  assert.equal(B.shiftMonth("2026-01", -1), "2025-12");
  assert.equal(B.shiftMonth("2026-12", 1), "2027-01");
});

test("toCSV escapes commas and quotes", () => {
  const csv = B.toCSV([{ date: "2026-10-01", type: "expense", category: "Other", amount: 1999, note: 'a, "b"' }]);
  assert.equal(csv, 'date,type,category,amount,note\n2026-10-01,expense,Other,19.99,"a, ""b"""');
});

test("normalizeState drops bad rows and fills defaults", () => {
  const s = B.normalizeState({ transactions: [{ id: "x", type: "expense", amount: 100, category: "Other", date: "2026-10-01" }, { bogus: true }] });
  assert.equal(s.transactions.length, 1);
  assert.equal(s.currency, "USD");
  assert.ok(s.categories.expense.length > 0);
  assert.deepEqual(B.normalizeState(null), B.emptyState());
});
