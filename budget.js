// Pure budget logic, shared by the browser UI (window.Budget) and Node tests (require).
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Budget = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DEFAULT_CATEGORIES = {
    income: ["Salary", "Freelance", "Gifts", "Other income"],
    expense: [
      "Housing",
      "Groceries",
      "Transport",
      "Utilities",
      "Dining out",
      "Health",
      "Entertainment",
      "Shopping",
      "Savings",
      "Other",
    ],
  };

  function emptyState() {
    return {
      version: 1,
      currency: "USD",
      transactions: [],
      // budgets: { [category]: monthly limit }
      budgets: {},
      categories: {
        income: DEFAULT_CATEGORIES.income.slice(),
        expense: DEFAULT_CATEGORIES.expense.slice(),
      },
    };
  }

  // Store money as integer cents to avoid floating-point drift.
  function toCents(value) {
    const n = typeof value === "number" ? value : parseFloat(String(value).replace(/[^0-9.\-]/g, ""));
    if (!Number.isFinite(n)) return NaN;
    return Math.round(n * 100);
  }

  function fromCents(cents) {
    return cents / 100;
  }

  function monthKey(dateStr) {
    // "2026-10-22" -> "2026-10"
    return String(dateStr).slice(0, 7);
  }

  function validateTransaction(tx) {
    const errors = [];
    if (tx.type !== "income" && tx.type !== "expense") errors.push("Type must be income or expense.");
    if (!Number.isInteger(tx.amount) || tx.amount <= 0) errors.push("Amount must be greater than zero.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tx.date || "")) errors.push("Date is required.");
    if (!tx.category) errors.push("Category is required.");
    return errors;
  }

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function addTransaction(state, tx) {
    const record = {
      id: tx.id || newId(),
      type: tx.type,
      amount: tx.amount,
      category: tx.category,
      date: tx.date,
      note: (tx.note || "").trim(),
    };
    const errors = validateTransaction(record);
    if (errors.length) throw new Error(errors.join(" "));
    return { ...state, transactions: [...state.transactions, record] };
  }

  function updateTransaction(state, id, changes) {
    let found = false;
    const transactions = state.transactions.map((t) => {
      if (t.id !== id) return t;
      found = true;
      const next = { ...t, ...changes, id };
      const errors = validateTransaction(next);
      if (errors.length) throw new Error(errors.join(" "));
      return next;
    });
    if (!found) throw new Error("Transaction not found.");
    return { ...state, transactions };
  }

  function deleteTransaction(state, id) {
    return { ...state, transactions: state.transactions.filter((t) => t.id !== id) };
  }

  function setBudget(state, category, cents) {
    const budgets = { ...state.budgets };
    if (!cents || cents <= 0) delete budgets[category];
    else budgets[category] = cents;
    return { ...state, budgets };
  }

  function addCategory(state, type, name) {
    const clean = String(name || "").trim();
    if (!clean) return state;
    const list = state.categories[type];
    if (list.some((c) => c.toLowerCase() === clean.toLowerCase())) return state;
    return { ...state, categories: { ...state.categories, [type]: [...list, clean] } };
  }

  function transactionsForMonth(state, month) {
    return state.transactions
      .filter((t) => monthKey(t.date) === month)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }

  function summarize(transactions) {
    let income = 0;
    let expense = 0;
    for (const t of transactions) {
      if (t.type === "income") income += t.amount;
      else expense += t.amount;
    }
    return { income, expense, balance: income - expense };
  }

  function spendingByCategory(transactions) {
    const totals = {};
    for (const t of transactions) {
      if (t.type !== "expense") continue;
      totals[t.category] = (totals[t.category] || 0) + t.amount;
    }
    return totals;
  }

  // One row per category that has a budget or spending this month.
  function budgetReport(state, month) {
    const spent = spendingByCategory(transactionsForMonth(state, month));
    const names = new Set([...Object.keys(state.budgets), ...Object.keys(spent)]);
    return [...names]
      .map((category) => {
        const limit = state.budgets[category] || 0;
        const used = spent[category] || 0;
        return {
          category,
          limit,
          spent: used,
          remaining: limit - used,
          ratio: limit > 0 ? used / limit : null,
          over: limit > 0 && used > limit,
        };
      })
      .sort((a, b) => b.spent - a.spent || a.category.localeCompare(b.category));
  }

  function shiftMonth(month, delta) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    return d.toISOString().slice(0, 7);
  }

  function toCSV(transactions) {
    const esc = (v) => {
      const s = String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const rows = [["date", "type", "category", "amount", "note"]];
    for (const t of transactions) {
      rows.push([t.date, t.type, t.category, fromCents(t.amount).toFixed(2), t.note || ""]);
    }
    return rows.map((r) => r.map(esc).join(",")).join("\n");
  }

  // Accepts previously exported JSON; fills in anything missing.
  function normalizeState(raw) {
    const base = emptyState();
    if (!raw || typeof raw !== "object") return base;
    const transactions = Array.isArray(raw.transactions)
      ? raw.transactions.filter((t) => t && validateTransaction(t).length === 0)
      : [];
    return {
      ...base,
      currency: typeof raw.currency === "string" ? raw.currency : base.currency,
      transactions,
      budgets: raw.budgets && typeof raw.budgets === "object" ? { ...raw.budgets } : {},
      categories: {
        income: Array.isArray(raw.categories?.income) ? raw.categories.income : base.categories.income,
        expense: Array.isArray(raw.categories?.expense) ? raw.categories.expense : base.categories.expense,
      },
    };
  }

  return {
    DEFAULT_CATEGORIES,
    emptyState,
    toCents,
    fromCents,
    monthKey,
    validateTransaction,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    setBudget,
    addCategory,
    transactionsForMonth,
    summarize,
    spendingByCategory,
    budgetReport,
    shiftMonth,
    toCSV,
    normalizeState,
  };
});
