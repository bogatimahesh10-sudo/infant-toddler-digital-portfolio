// Pace financial core. Pure functions over a plain state object; no UI code.
// All money is integer cents. Dates are local ISO strings "YYYY-MM-DD".
// Loaded as window.PaceCore in the browser and via require() in tests.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PaceCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ---------- dates ----------
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const parseDate = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return iso(d); };
  function addMonths(s, n) {
    const d = parseDate(s), day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + n);
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    return iso(d);
  }
  const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 864e5);
  const startOfWeek = (s) => { const d = parseDate(s); return addDays(s, -((d.getDay() + 6) % 7)); };
  const startOfMonth = (s) => s.slice(0, 8) + "01";
  const minDate = (a, b) => (a < b ? a : b);
  const maxDate = (a, b) => (a > b ? a : b);

  const FREQUENCIES = ["weekly", "fortnightly", "monthly", "quarterly", "yearly", "once"];
  function stepDate(s, freq) {
    switch (freq) {
      case "weekly": return addDays(s, 7);
      case "fortnightly": return addDays(s, 14);
      case "monthly": return addMonths(s, 1);
      case "quarterly": return addMonths(s, 3);
      case "yearly": return addMonths(s, 12);
      default: return null;
    }
  }
  // Monthly steps are taken from the anchor so the 31st stays the last day of each month.
  function occurrences(anchor, freq, from, to, until) {
    const out = [];
    if (!anchor) return out;
    if (freq === "once") {
      if (anchor >= from && anchor < to && (!until || anchor <= until)) out.push(anchor);
      return out;
    }
    const monthsPer = { monthly: 1, quarterly: 3, yearly: 12 }[freq];
    let d = anchor, i = 0;
    while (d < to && i < 5000) {
      if (until && d > until) break;
      if (d >= from) out.push(d);
      i++;
      d = monthsPer ? addMonths(anchor, monthsPer * i) : stepDate(d, freq);
    }
    return out;
  }

  // ---------- money ----------
  // Parses user input like "1,234.5" into cents without floating-point maths.
  function parseMoney(input) {
    const s = String(input == null ? "" : input).replace(/[^0-9.\-]/g, "");
    const m = /^(-)?(\d*)(?:\.(\d*))?$/.exec(s);
    if (!m || (m[2] === "" && (m[3] || "") === "")) return NaN;
    const cents = Number(m[2] || "0") * 100 + Number(((m[3] || "") + "00").slice(0, 2));
    return m[1] ? -cents : cents;
  }
  function formatMoney(cents, currency, locale) {
    const v = cents / 100;
    try {
      return new Intl.NumberFormat(locale || "en-AU", { style: "currency", currency: currency || "AUD" }).format(v).replace("-", "−");
    } catch (e) {
      return (v < 0 ? "−" : "") + "$" + Math.abs(v).toFixed(2);
    }
  }

  // ---------- periods ----------
  const PERIODS = ["weekly", "fortnightly", "monthly"];
  // Fortnights are anchored to the main payday so a budget period matches a pay cycle.
  function periodRange(period, today, payAnchor) {
    let start, end;
    if (period === "weekly") {
      start = startOfWeek(today);
      end = addDays(start, 7);
    } else if (period === "fortnightly") {
      const anchor = payAnchor || startOfWeek(today);
      const k = Math.floor(daysBetween(anchor, today) / 14);
      start = addDays(anchor, k * 14);
      end = addDays(start, 14);
    } else {
      start = startOfMonth(today);
      end = addMonths(start, 1);
    }
    return { period, start, end, days: daysBetween(start, end) };
  }
  function previousRange(range) {
    if (range.period === "monthly") {
      const start = addMonths(range.start, -1);
      return { period: range.period, start, end: range.start, days: daysBetween(start, range.start) };
    }
    return { period: range.period, start: addDays(range.start, -range.days), end: range.start, days: range.days };
  }

  // ---------- accounts & transactions ----------
  const CASH_TYPES = ["transaction", "savings", "cash"];
  const LIABILITY_TYPES = ["credit", "loan"];
  const canBeAvailableCash = (a) => CASH_TYPES.includes(a.type);
  const isLiability = (a) => LIABILITY_TYPES.includes(a.type);
  const isCountable = (t) => !t.deleted_at && t.status !== "reversed" && t.status !== "excluded";
  const isPosted = (t) => isCountable(t) && t.status === "posted";
  const isPending = (t) => isCountable(t) && t.status === "pending";
  // A refund is money back for an earlier purchase. It's stored as income on the account,
  // but reduces spending in its expense category instead of counting as income.
  const isRefund = (t) => t.type === "income" && !!t.refund;

  // Signed effect of a transaction on one account's cash position.
  function txEffect(t, accountId) {
    if (t.type === "income") return t.account_id === accountId ? t.amount : 0;
    if (t.type === "expense") return t.account_id === accountId ? -t.amount : 0;
    if (t.type === "transfer") {
      if (t.account_id === accountId) return -t.amount;
      if (t.to_account_id === accountId) return t.amount;
    }
    return 0;
  }
  // Posted balance. Liabilities are shown as the amount owed (positive).
  function accountBalance(state, account) {
    let sum = 0;
    for (const t of state.transactions) if (isPosted(t)) sum += txEffect(t, account.id);
    return isLiability(account) ? account.opening_balance - sum : account.opening_balance + sum;
  }
  function pendingOutflow(state, account) {
    let sum = 0;
    for (const t of state.transactions) if (isPending(t)) { const e = txEffect(t, account.id); if (e < 0) sum += -e; }
    return sum;
  }

  function validateTransaction(t, state) {
    const errors = [];
    if (!["income", "expense", "transfer"].includes(t.type)) errors.push("Choose income, expense or transfer.");
    if (!Number.isInteger(t.amount) || t.amount <= 0) errors.push("Enter an amount above $0.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date || "")) errors.push("Choose a date.");
    if (!t.account_id) errors.push("Choose an account.");
    if (t.type === "transfer") {
      if (!t.to_account_id) errors.push("Choose the account the money goes to.");
      else if (t.to_account_id === t.account_id) errors.push("Choose two different accounts.");
    } else if (!t.category_id) errors.push("Choose a category.");
    if (state && t.account_id && !state.accounts.some((a) => a.id === t.account_id)) errors.push("That account no longer exists.");
    return errors;
  }

  // Manual entries that look like another active entry: same account, type and amount within two days.
  function findPossibleDuplicates(state, t) {
    return state.transactions.filter((o) =>
      o.id !== t.id && isCountable(o) && o.account_id === t.account_id && o.type === t.type &&
      o.amount === t.amount && Math.abs(daysBetween(o.date, t.date)) <= 2);
  }

  const AUDITED = ["amount", "type", "date", "merchant", "category_id", "account_id", "to_account_id", "note", "status"];
  function upsertTransaction(state, input, now) {
    const errors = validateTransaction(input, state);
    if (errors.length) throw new Error(errors.join(" "));
    const existing = state.transactions.find((t) => t.id === input.id);
    if (!existing) {
      const t = { currency: state.user.currency, status: "posted", source: "manual", audit: [], ...input };
      return { ...state, transactions: [...state.transactions, t] };
    }
    const changes = AUDITED.filter((k) => (existing[k] ?? null) !== (input[k] ?? null)).map((k) => ({ field: k, from: existing[k] ?? null, to: input[k] ?? null }));
    const next = { ...existing, ...input, audit: [...(existing.audit || []), ...(changes.length ? [{ at: now, changes }] : [])] };
    return { ...state, transactions: state.transactions.map((t) => (t.id === input.id ? next : t)) };
  }
  function softDeleteTransaction(state, id, now) {
    return { ...state, transactions: state.transactions.map((t) => t.id === id ? { ...t, deleted_at: now, audit: [...(t.audit || []), { at: now, changes: [{ field: "deleted", from: false, to: true }] }] } : t) };
  }
  function restoreTransaction(state, id, now) {
    return { ...state, transactions: state.transactions.map((t) => t.id === id ? { ...t, deleted_at: null, audit: [...(t.audit || []), { at: now, changes: [{ field: "deleted", from: true, to: false }] }] } : t) };
  }
  // Changes one transaction's category and optionally remembers it for the merchant.
  function recategorize(state, id, categoryId, rememberForMerchant, now) {
    const t = state.transactions.find((x) => x.id === id);
    let next = upsertTransaction(state, { ...t, category_id: categoryId }, now);
    if (rememberForMerchant && t.merchant) {
      const key = t.merchant.toLowerCase();
      next = { ...next, category_rules: { ...(next.category_rules || {}), [key]: categoryId } };
      next = { ...next, transactions: next.transactions.map((x) => x.id !== id && x.merchant && x.merchant.toLowerCase() === key && x.type === t.type && x.category_id !== categoryId ? { ...x, category_id: categoryId, audit: [...(x.audit || []), { at: now, changes: [{ field: "category_id", from: x.category_id, to: categoryId }] }] } : x) };
    }
    return next;
  }

  // ---------- bills ----------
  const occurrenceId = (ruleId, date) => ruleId + "@" + date;
  function billOccurrences(state, from, to, today) {
    const linked = {};
    for (const t of state.transactions) if (t.bill_occurrence_id && isCountable(t)) linked[t.bill_occurrence_id] = t.id;
    const out = [];
    for (const r of state.recurring) {
      if (r.kind !== "bill" || r.status === "cancelled") continue;
      for (const date of occurrences(r.start_date, r.frequency, from, to, r.end_date)) {
        const id = occurrenceId(r.id, date);
        const override = (state.bill_status || {})[id];
        let status;
        if (override && override.status === "skipped") status = "skipped";
        else if (linked[id]) status = "paid";
        else if (r.status === "paused") status = "paused";
        else if (date < today) status = "overdue";
        else if (date === today) status = "due";
        else status = "upcoming";
        out.push({ id, rule_id: r.id, rule: r, date, amount: r.amount, status, linked_transaction_id: linked[id] || null });
      }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount);
  }
  const UNPAID = ["upcoming", "due", "overdue"];

  // Links bank or manual payments to the bill they pay, so a bill is never deducted twice.
  function autoMatchBills(state, today) {
    const open = billOccurrences(state, addDays(today, -10), addDays(today, 5), today).filter((o) => UNPAID.includes(o.status));
    if (!open.length) return state;
    const taken = new Set(state.transactions.filter((t) => t.bill_occurrence_id).map((t) => t.bill_occurrence_id));
    let txs = state.transactions;
    for (const o of open) {
      if (taken.has(o.id)) continue;
      const tolerance = Math.max(100, Math.round(o.amount * 0.05));
      const hit = txs.find((t) => isCountable(t) && !t.bill_occurrence_id && (t.type === "expense" || t.type === "transfer") &&
        Math.abs(t.amount - o.amount) <= tolerance && Math.abs(daysBetween(t.date, o.date)) <= 4 &&
        (t.category_id === o.rule.category_id || (o.rule.match && (t.merchant + " " + (t.original_description || "")).toLowerCase().includes(o.rule.match))));
      if (hit) {
        taken.add(o.id);
        txs = txs.map((t) => (t.id === hit.id ? { ...t, bill_occurrence_id: o.id } : t));
      }
    }
    return txs === state.transactions ? state : { ...state, transactions: txs };
  }

  // ---------- income ----------
  function incomeOccurrences(state, from, to) {
    const out = [];
    for (const r of state.recurring) {
      if (r.kind !== "income" || r.status !== "active") continue;
      for (const date of occurrences(r.start_date, r.frequency, from, to, r.end_date)) {
        const received = state.transactions.some((t) => isCountable(t) && t.type === "income" && t.income_rule_id === r.id && Math.abs(daysBetween(t.date, date)) <= 1);
        out.push({ id: occurrenceId(r.id, date), rule: r, date, amount: r.amount, received, estimated: !!r.variable });
      }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }
  function nextPayday(state, today) {
    const next = incomeOccurrences(state, today, addDays(today, 400)).find((o) => !o.received && o.date >= today);
    return next || null;
  }

  // ---------- goals ----------
  function goalSaved(state, g) {
    if (g.account_id) {
      const a = state.accounts.find((x) => x.id === g.account_id);
      return a ? accountBalance(state, a) : 0;
    }
    return (g.starting_amount || 0) + state.contributions.filter((c) => c.goal_id === g.id && !c.deleted_at).reduce((s, c) => s + c.amount, 0);
  }
  // Scheduled contributions still to happen. Only goals with a real reserved account move money.
  function goalContributionsDue(state, from, to) {
    const out = [];
    for (const g of state.goals) {
      const p = g.plan;
      if (!p || p.paused || !p.amount || g.archived_at) continue;
      for (const date of occurrences(p.next_date, p.frequency, from, to)) {
        const id = occurrenceId(g.id, date);
        if (state.contributions.some((c) => c.occurrence_id === id && !c.deleted_at)) continue;
        if (p.paused_until && date < p.paused_until) continue;
        out.push({ id, goal: g, date, amount: p.amount, reserved: !!g.account_id, from_account_id: p.from_account_id });
      }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }
  function perDayRate(amount, freq) {
    return amount / ({ weekly: 7, fortnightly: 14, monthly: 365 / 12, quarterly: 365 / 4, yearly: 365 }[freq] || Infinity);
  }
  function goalProjection(state, g, today) {
    const saved = goalSaved(state, g);
    const remaining = Math.max(0, g.target - saved);
    const pct = g.target > 0 ? Math.min(1, saved / g.target) : 0;
    if (remaining === 0) return { saved, remaining, pct, done: true, eta: null, onTrack: true };
    const rate = g.plan && !g.plan.paused ? perDayRate(g.plan.amount, g.plan.frequency) : 0;
    if (!rate) return { saved, remaining, pct, done: false, eta: null, onTrack: false, paused: !!(g.plan && g.plan.paused) };
    const eta = addDays(today, Math.ceil(remaining / rate));
    const needed = g.deadline && g.deadline > today ? Math.ceil(remaining / daysBetween(today, g.deadline) / perDayRate(1, g.plan.frequency)) : null;
    return { saved, remaining, pct, done: false, eta, onTrack: !g.deadline || eta <= g.deadline, neededPerContribution: needed };
  }

  // ---------- Safe to Spend (the single shared rule) ----------
  // Ledger model: an account's balance already includes every posted transaction, so spending
  // that has happened is never subtracted again. Pending outflows are not in the posted balance
  // yet, so they are subtracted once.
  //
  //   S = A + E − B − G − O − R
  //   A: available cash (posted balances of accounts marked as available cash, less pending outflows)
  //   E: expected income within the window (only for the "budget period" window, and only if included)
  //   B: unpaid bills due within the window (overdue ones included; paid/skipped/paused/cancelled excluded)
  //   G: scheduled transfers to reserved goal accounts, paid from available cash, within the window
  //   O: other reserved commitments the user has set aside
  //   R: the user's safety buffer
  //
  // The window is "payday" (today until the next expected pay, the default, which never relies on
  // expected income), "week" (the next seven days) or "period" (until the end of the budget period).
  // The two longer windows can include expected income, which is labelled and can be switched off.
  function safeToSpendFormula(i) {
    const committed = i.bills + i.savings + i.reserved + (i.buffer || 0);
    const conservative = i.cash - committed;
    return { total: conservative + (i.includeExpected ? i.expected : 0), conservative };
  }

  function safeToSpend(state, today, opts) {
    opts = opts || {};
    const settings = state.settings || {};
    const windowKind = opts.window || settings.sts_window || "payday";
    const includeExpected = opts.includeExpected != null ? opts.includeExpected : settings.sts_include_expected === true;
    const pay = nextPayday(state, today);
    const payDate = pay ? pay.date : periodRange("monthly", today).end;
    const range = periodRange(settings.period || "fortnightly", today, pay ? pay.date : null);
    const end = windowKind === "period" ? range.end : windowKind === "week" ? addDays(today, 7) : payDate;
    const days = Math.max(1, daysBetween(today, end));
    const included = [], excluded = [];
    for (const a of state.accounts) {
      if (a.status === "closed") continue;
      if (a.available_cash && canBeAvailableCash(a)) included.push({ account: a, balance: accountBalance(state, a), pending: pendingOutflow(state, a) });
      else excluded.push({ account: a, reason: !canBeAvailableCash(a) ? (a.type === "investment" ? "Investments aren't spendable cash" : a.type === "credit" ? "Credit limits aren't spendable cash" : "Loans aren't spendable cash") : a.reserved_for_goal_id ? "Reserved for a goal" : "Not marked as available cash" });
    }
    const cashIds = new Set(included.map((x) => x.account.id));
    const postedCash = included.reduce((s, x) => s + x.balance, 0);
    const pending = included.reduce((s, x) => s + x.pending, 0);
    const pendingItems = state.transactions.filter((t) => isPending(t) && cashIds.has(t.account_id) && (t.type === "expense" || t.type === "transfer"));
    const A = postedCash - pending;
    const expectedItems = windowKind !== "payday"
      ? incomeOccurrences(state, today, end).filter((o) => !o.received && (!o.rule.account_id || cashIds.has(o.rule.account_id)))
      : [];
    const E = expectedItems.reduce((s, o) => s + o.amount, 0);
    const bills = billOccurrences(state, addDays(today, -14), end, today)
      .filter((o) => UNPAID.includes(o.status) && (!o.rule.account_id || cashIds.has(o.rule.account_id)));
    const B = bills.reduce((s, o) => s + o.amount, 0);
    const goals = goalContributionsDue(state, today, end)
      .filter((c) => c.reserved && cashIds.has(c.from_account_id) && !cashIds.has(c.goal.account_id));
    const G = goals.reduce((s, c) => s + c.amount, 0);
    const reservedItems = (state.reservations || []).filter((r) => !r.released_at);
    const O = reservedItems.reduce((s, r) => s + r.amount, 0);
    const R = settings.buffer || 0;
    const f = safeToSpendFormula({ cash: A, expected: E, bills: B, savings: G, reserved: O, buffer: R, includeExpected });
    const S = f.total;
    const perDay = S > 0 ? Math.floor(S / days) : 0;
    return {
      today, window: windowKind, end, range, payday: payDate, payIncome: pay, noIncome: !pay, estimated: !!(pay && pay.estimated), days,
      A, postedCash, pending, pendingItems, included, excluded, E, expectedItems, includeExpected,
      bills, B, goals, G, reservedItems, O, R, S, conservative: f.conservative, perDay,
      status: S < 0 ? "shortfall" : perDay < (settings.tight_per_day || 1500) ? "tight" : "ok",
    };
  }

  // Recurring bills as a monthly equivalent, for the Insights summary.
  function recurringSpending(state) {
    const perYear = { weekly: 52, fortnightly: 26, monthly: 12, quarterly: 4, yearly: 1 };
    const items = state.recurring.filter((r) => r.kind === "bill" && r.status === "active" && perYear[r.frequency])
      .map((r) => ({ rule: r, monthly: Math.round((r.amount * perYear[r.frequency]) / 12) }))
      .sort((a, b) => b.monthly - a.monthly);
    return { items, total: items.reduce((s, x) => s + x.monthly, 0) };
  }

  // ---------- forecast ----------
  // Planned spending in flexible categories that isn't already covered by a scheduled bill.
  function discretionaryPerDay(state, today) {
    const pay = nextPayday(state, today);
    const period = state.settings.period;
    const range = periodRange(period, today, pay ? pay.date : null);
    const bills = billOccurrences(state, range.start, range.end, today);
    let total = 0;
    for (const c of state.categories) {
      if (c.archived_at || c.type !== "expense" || !c.flexible) continue;
      const planned = ((state.allocations[period] || {})[c.id]) || 0;
      const billed = bills.filter((b) => b.rule.category_id === c.id).reduce((s, b) => s + b.amount, 0);
      total += Math.max(0, planned - billed);
    }
    return Math.round(total / range.days);
  }

  function forecast(state, today, horizon) {
    horizon = horizon || 42;
    const end = addDays(today, horizon);
    const sts = safeToSpend(state, today, { window: "payday" });
    const cashIds = new Set(sts.included.map((x) => x.account.id));
    const daily = discretionaryPerDay(state, today);
    const events = {};
    const add = (d, e) => (events[d] = events[d] || []).push(e);
    for (const o of billOccurrences(state, addDays(today, -14), end, today)) {
      if (!UNPAID.includes(o.status) || (o.rule.account_id && !cashIds.has(o.rule.account_id))) continue;
      add(maxDate(o.date, today), { kind: "bill", label: o.rule.name, amount: -o.amount, ref: o.id, overdue: o.status === "overdue" });
    }
    for (const c of goalContributionsDue(state, today, end)) {
      if (c.reserved && cashIds.has(c.from_account_id)) add(c.date, { kind: "goal", label: c.goal.name, amount: -c.amount, ref: c.id });
    }
    for (const i of incomeOccurrences(state, today, end)) {
      if (!i.received && (!i.rule.account_id || cashIds.has(i.rule.account_id))) add(i.date, { kind: "income", label: i.rule.name, amount: i.amount, ref: i.id, estimated: i.estimated });
    }
    const points = [];
    let bal = sts.A;
    for (let k = 0; k < horizon; k++) {
      const d = addDays(today, k);
      if (k > 0) bal -= daily;
      for (const e of events[d] || []) bal += e.amount;
      points.push({ date: d, balance: bal, events: events[d] || [] });
    }
    let low = points[0];
    for (const p of points) if (p.balance < low.balance) low = p;
    return {
      points, low, daily, buffer: state.settings.buffer,
      firstNegative: points.find((p) => p.balance < 0) || null,
      firstBelowBuffer: points.find((p) => p.balance < state.settings.buffer) || null,
      incomeEstimated: Object.values(events).some((list) => list.some((e) => e.kind === "income" && e.estimated)),
    };
  }

  // Options for Flow D: what would close a projected shortfall.
  function shortfallOptions(state, today) {
    const fc = forecast(state, today);
    if (!fc.firstNegative) return null;
    const lowPoint = fc.low;
    const need = -lowPoint.balance;
    const days = Math.max(1, daysBetween(today, lowPoint.date));
    const cutPerDay = Math.ceil(need / days);
    const goals = goalContributionsDue(state, today, addDays(lowPoint.date, 1)).filter((c) => c.reserved);
    const goalTotal = goals.reduce((s, c) => s + c.amount, 0);
    const bills = billOccurrences(state, today, addDays(lowPoint.date, 1), today).filter((o) => UNPAID.includes(o.status)).sort((a, b) => b.amount - a.amount);
    return {
      date: fc.firstNegative.date, lowDate: lowPoint.date, need, days,
      spending: { cutPerDay, feasible: cutPerDay <= fc.daily, daily: fc.daily },
      goals: { items: goals, total: goalTotal, fixes: goalTotal >= need },
      bills: bills.slice(0, 3),
      trigger: (fc.firstNegative.events.find((e) => e.amount < 0) || lowPoint.events.find((e) => e.amount < 0) || null),
    };
  }

  // Lowers flexible allocations proportionally by a total amount for the given period.
  function reduceFlexibleAllocations(state, period, cents) {
    const flex = state.categories.filter((c) => c.flexible && !c.archived_at && c.type === "expense");
    const alloc = { ...(state.allocations[period] || {}) };
    const total = flex.reduce((s, c) => s + (alloc[c.id] || 0), 0);
    if (!total) return state;
    let left = Math.min(cents, total);
    flex.forEach((c, i) => {
      const share = i === flex.length - 1 ? left : Math.min(left, Math.round(cents * (alloc[c.id] || 0) / total));
      alloc[c.id] = Math.max(0, (alloc[c.id] || 0) - share);
      left -= share;
    });
    return { ...state, allocations: { ...state.allocations, [period]: alloc } };
  }

  // ---------- budgets ----------
  function budgetSummary(state, period, today) {
    const pay = nextPayday(state, today);
    const range = periodRange(period, today, pay ? pay.date : null);
    const prev = previousRange(range);
    const alloc = state.allocations[period] || {};
    const inRange = (t, r) => t.date >= r.start && t.date < r.end;
    const spendTx = (t) => t.type === "expense" || (t.type === "transfer" && t.category_id);
    const bills = billOccurrences(state, maxDate(range.start, today), range.end, today).filter((o) => UNPAID.includes(o.status));
    const rows = [];
    for (const c of state.categories.filter((x) => x.type === "expense" && !x.archived_at).sort((a, b) => a.order - b.order)) {
      const mine = state.transactions.filter((t) => isCountable(t) && spendTx(t) && t.category_id === c.id);
      const refunds = state.transactions.filter((t) => isPosted(t) && isRefund(t) && t.category_id === c.id && inRange(t, range)).reduce((s, t) => s + t.amount, 0);
      const completed = Math.max(0, mine.filter((t) => t.status === "posted" && inRange(t, range)).reduce((s, t) => s + t.amount, 0) - refunds);
      const pending = mine.filter((t) => t.status === "pending" && inRange(t, range)).reduce((s, t) => s + t.amount, 0);
      const scheduledItems = bills.filter((b) => b.rule.category_id === c.id);
      const scheduled = scheduledItems.reduce((s, b) => s + b.amount, 0);
      const planned = alloc[c.id] || 0;
      const prevUsed = mine.filter((t) => inRange(t, prev)).reduce((s, t) => s + t.amount, 0);
      const rolled = state.settings.rollover ? Math.max(0, planned - prevUsed) : 0;
      const available = planned + rolled;
      const spent = completed + pending;
      const used = spent + scheduled;
      const status = available === 0 && used === 0 ? "none" : spent > available ? "over" : used > available ? "at-risk" : available > 0 && used >= available * 0.9 ? "close" : "ok";
      rows.push({ category: c, planned, rolled, available, completed, pending, scheduled, scheduledItems, spent, used, remaining: available - used, status });
    }
    const income = state.transactions.filter((t) => isPosted(t) && t.type === "income" && !isRefund(t) && inRange(t, range)).reduce((s, t) => s + t.amount, 0);
    const refunded = state.transactions.filter((t) => isPosted(t) && isRefund(t) && inRange(t, range)).reduce((s, t) => s + t.amount, 0);
    const expectedIncome = incomeOccurrences(state, range.start, range.end).filter((o) => !o.received).reduce((s, o) => s + o.amount, 0);
    const expenses = state.transactions.filter((t) => isCountable(t) && t.type === "expense" && inRange(t, range)).reduce((s, t) => s + t.amount, 0) - refunded;
    const planned = rows.reduce((s, r) => s + r.planned, 0);
    const savingsPlanned = state.goals.filter((g) => g.plan && !g.plan.paused && !g.archived_at)
      .reduce((s, g) => s + Math.round(perDayRate(g.plan.amount, g.plan.frequency) * range.days), 0);
    const plannedIncome = Math.round(state.recurring.filter((r) => r.kind === "income" && r.status === "active").reduce((s, r) => s + perDayRate(r.amount, r.frequency), 0) * range.days);
    return {
      range, rows, income, expectedIncome, expenses, planned, savingsPlanned, plannedIncome,
      unassigned: plannedIncome - planned - savingsPlanned,
      alerts: rows.filter((r) => r.status === "over" || r.status === "at-risk"),
    };
  }

  function transferAllocation(state, period, fromId, toId, cents) {
    const alloc = { ...(state.allocations[period] || {}) };
    if (!Number.isInteger(cents) || cents <= 0) throw new Error("Enter an amount above $0.");
    if (fromId === toId) throw new Error("Choose two different categories.");
    if ((alloc[fromId] || 0) < cents) throw new Error("That category doesn't have that much planned.");
    alloc[fromId] -= cents;
    alloc[toId] = (alloc[toId] || 0) + cents;
    return { ...state, allocations: { ...state.allocations, [period]: alloc } };
  }

  // Keeps weekly, fortnightly and monthly plans consistent when one changes.
  function scaleAllocation(cents, fromPeriod, toPeriod) {
    const perYear = { weekly: 52, fortnightly: 26, monthly: 12 };
    return Math.round((cents * perYear[fromPeriod]) / perYear[toPeriod]);
  }
  function setAllocation(state, period, categoryId, cents) {
    const allocations = { ...state.allocations };
    for (const p of PERIODS) allocations[p] = { ...(allocations[p] || {}), [categoryId]: p === period ? cents : scaleAllocation(cents, period, p) };
    return { ...state, allocations };
  }

  // ---------- bank import ----------
  // Turns provider records into Pace transactions. Re-importing the same provider id updates
  // the existing record (for example pending → posted) instead of adding a duplicate.
  function cleanMerchant(desc) {
    const s = String(desc || "").replace(/\b(\d{3,}|AU|AUS|NSW|VIC|QLD|PTY|LTD|CARD|VISA|EFTPOS|PURCHASE)\b/gi, "").replace(/\s{2,}/g, " ").trim();
    return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) || "Bank transaction";
  }
  function importProviderTransactions(state, connection, raws, accountMap, now, newId) {
    let txs = state.transactions.slice();
    const added = [], updated = [], duplicates = [];
    const rules = state.category_rules || {};
    for (const raw of raws) {
      const accountId = accountMap[raw.account_ref];
      if (!accountId) continue;
      const existingIdx = txs.findIndex((t) => t.provider_tx_id === raw.provider_tx_id && t.connection_id === connection.id);
      const status = raw.status === "reversed" ? "reversed" : raw.status === "pending" ? "pending" : "posted";
      if (existingIdx >= 0) {
        const old = txs[existingIdx];
        if (old.status !== status || old.amount !== raw.amount) {
          txs[existingIdx] = { ...old, status, amount: raw.amount, date: raw.date, audit: [...(old.audit || []), { at: now, changes: [{ field: "status", from: old.status, to: status }] }] };
          updated.push(txs[existingIdx]);
        }
        continue;
      }
      const merchant = cleanMerchant(raw.description);
      const type = raw.direction === "credit" ? "income" : "expense";
      const t = {
        id: newId(), account_id: accountId, amount: raw.amount, currency: raw.currency || state.user.currency, type, date: raw.date,
        category_id: rules[merchant.toLowerCase()] || raw.category_hint || (type === "income" ? "c_pay" : "c_other"),
        merchant, original_description: raw.description, note: "", status, source: "bank",
        provider_tx_id: raw.provider_tx_id, provider_account_id: raw.account_ref, connection_id: connection.id, audit: [],
      };
      const dup = txs.find((o) => isCountable(o) && o.source !== "bank" && o.account_id === accountId && o.type === type &&
        o.amount === t.amount && Math.abs(daysBetween(o.date, t.date)) <= 3);
      if (dup) { t.possible_duplicate_of = dup.id; duplicates.push(t); }
      txs.push(t);
      added.push(t);
    }
    return { state: { ...state, transactions: txs }, added, updated, duplicates };
  }
  // "merge" keeps the bank record and excludes the manual copy; "keep" treats them as separate.
  function resolveDuplicate(state, bankTxId, action, now) {
    const bank = state.transactions.find((t) => t.id === bankTxId);
    if (!bank || !bank.possible_duplicate_of) return state;
    const manualId = bank.possible_duplicate_of;
    return {
      ...state,
      transactions: state.transactions.map((t) => {
        if (t.id === bankTxId) {
          const manual = state.transactions.find((x) => x.id === manualId);
          return { ...t, possible_duplicate_of: null, duplicate_resolution: action,
            bill_occurrence_id: t.bill_occurrence_id || (action === "merge" && manual ? manual.bill_occurrence_id : null) || null,
            category_id: action === "merge" && manual ? manual.category_id : t.category_id,
            merchant: action === "merge" && manual ? manual.merchant : t.merchant,
            note: action === "merge" && manual && manual.note ? manual.note : t.note };
        }
        if (action === "merge" && t.id === manualId) return { ...t, status: "excluded", excluded_reason: "Merged with a bank transaction", bill_occurrence_id: null, audit: [...(t.audit || []), { at: now, changes: [{ field: "status", from: t.status, to: "excluded" }] }] };
        return t;
      }),
    };
  }
  // Sets an account's opening balance so its posted balance matches the bank.
  function reconcileAccount(state, accountId, targetBalance, now) {
    const a = state.accounts.find((x) => x.id === accountId);
    const diff = targetBalance - accountBalance(state, a);
    if (!diff) return state;
    return { ...state, accounts: state.accounts.map((x) => x.id === accountId ? { ...x, opening_balance: x.opening_balance + diff, reconciled_at: now, reconciliations: [...(x.reconciliations || []), { at: now, adjustment: diff }] } : x) };
  }

  // ---------- insights ----------
  function monthlyTotals(state, today, months) {
    const out = [];
    let start = addMonths(startOfMonth(today), -(months - 1));
    for (let i = 0; i < months; i++) {
      const end = addMonths(start, 1);
      const txs = state.transactions.filter((t) => isPosted(t) && t.date >= start && t.date < end && t.date <= today);
      const income = txs.filter((t) => t.type === "income" && !isRefund(t)).reduce((s, t) => s + t.amount, 0);
      const expenses = txs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0) - txs.filter(isRefund).reduce((s, t) => s + t.amount, 0);
      out.push({ month: start.slice(0, 7), start, end: minDate(end, addDays(today, 1)), income, expenses, net: income - expenses, savingsRate: income > 0 ? (income - expenses) / income : null, partial: end > today, txIds: txs.map((t) => t.id) });
      start = end;
    }
    return out;
  }
  function spendingByCategory(state, from, to) {
    const map = {};
    for (const t of state.transactions) {
      if (!isPosted(t) || (t.type !== "expense" && !isRefund(t)) || t.date < from || t.date >= to) continue;
      const m = (map[t.category_id] = map[t.category_id] || { category_id: t.category_id, total: 0, txIds: [] });
      m.total += isRefund(t) ? -t.amount : t.amount;
      m.txIds.push(t.id);
    }
    return Object.values(map).filter((m) => m.total > 0).sort((a, b) => b.total - a.total);
  }
  // Month-to-date compared with the same number of days last month, so partial months compare fairly.
  function monthOverMonth(state, today) {
    const thisStart = startOfMonth(today);
    const end = addDays(today, 1);
    const lastStart = addMonths(thisStart, -1);
    const lastEnd = minDate(addDays(lastStart, daysBetween(thisStart, end)), thisStart);
    const cur = spendingByCategory(state, thisStart, end);
    const prev = spendingByCategory(state, lastStart, lastEnd);
    const ids = new Set([...cur, ...prev].map((x) => x.category_id));
    const rows = [...ids].map((id) => {
      const a = cur.find((x) => x.category_id === id) || { total: 0, txIds: [] };
      const b = prev.find((x) => x.category_id === id) || { total: 0, txIds: [] };
      return { category_id: id, current: a.total, previous: b.total, change: a.total - b.total, pct: b.total ? (a.total - b.total) / b.total : null, txIds: [...a.txIds, ...b.txIds] };
    }).sort((x, y) => Math.abs(y.change) - Math.abs(x.change));
    return { current: { start: thisStart, end }, previous: { start: lastStart, end: lastEnd }, rows };
  }
  function buildInsights(state, today, catName) {
    const out = [];
    const mom = monthOverMonth(state, today);
    const biggest = mom.rows.find((r) => r.previous > 0 && Math.abs(r.pct) >= 0.2 && Math.abs(r.change) >= 2000);
    if (biggest) {
      out.push({ id: "mom", tone: biggest.change > 0 ? "caution" : "success",
        title: `${catName(biggest.category_id)} is ${biggest.change > 0 ? "up" : "down"} ${Math.round(Math.abs(biggest.pct) * 100)}% on last month`,
        detail: `${formatMoney(biggest.current)} so far this month, compared with ${formatMoney(biggest.previous)} by the same day last month.`,
        range: { from: mom.previous.start, to: addDays(mom.current.end, -1) }, txIds: biggest.txIds });
    }
    const months = monthlyTotals(state, today, 4).filter((m) => !m.partial && m.income > 0);
    const lastFull = months[months.length - 1];
    if (lastFull) {
      out.push({ id: "rate", tone: lastFull.savingsRate >= 0.1 ? "success" : lastFull.savingsRate >= 0 ? "info" : "caution",
        title: lastFull.savingsRate >= 0 ? `You kept ${Math.round(lastFull.savingsRate * 100)}% of your income in ${monthName(lastFull.start)}` : `You spent more than you earned in ${monthName(lastFull.start)}`,
        detail: `Income ${formatMoney(lastFull.income)}, spending ${formatMoney(lastFull.expenses)}. Transfers to savings aren't counted as spending.`,
        range: { from: lastFull.start, to: addDays(lastFull.end, -1) }, txIds: lastFull.txIds });
    }
    const from = addMonths(startOfMonth(today), -3), to = startOfMonth(today);
    const cats = spendingByCategory(state, from, to);
    const total = cats.reduce((s, c) => s + c.total, 0);
    if (cats[0] && total) {
      out.push({ id: "top", tone: "info",
        title: `${catName(cats[0].category_id)} is ${Math.round((cats[0].total / total) * 100)}% of your spending`,
        detail: `${formatMoney(cats[0].total)} of ${formatMoney(total)} over the last three full months.`,
        range: { from, to: addDays(to, -1) }, txIds: cats[0].txIds });
    }
    return out;
  }
  const monthName = (s) => parseDate(s).toLocaleDateString("en-AU", { month: "long" });

  // ---------- goal conflict check ----------
  // Would this contribution plan create or worsen a shortfall before the next payday or in the forecast?
  function contributionConflict(state, goal, today) {
    const withGoal = { ...state, goals: [...state.goals.filter((g) => g.id !== goal.id), goal] };
    const before = forecast(state, today);
    const after = forecast(withGoal, today);
    const sBefore = safeToSpend(state, today, { window: "payday" }).S, sAfter = safeToSpend(withGoal, today, { window: "payday" }).S;
    if (sAfter < 0 && sAfter < sBefore) return { kind: "payday", amount: -sAfter, date: safeToSpend(withGoal, today, { window: "payday" }).payday };
    if (after.firstNegative && !before.firstNegative) return { kind: "forecast", amount: -after.low.balance, date: after.firstNegative.date };
    if (after.firstNegative && after.low.balance < before.low.balance) return { kind: "worsens", amount: before.low.balance - after.low.balance, date: before.firstNegative.date };
    return null;
  }

  return {
    // dates & money
    iso, parseDate, addDays, addMonths, daysBetween, startOfWeek, startOfMonth, occurrences, stepDate, FREQUENCIES,
    parseMoney, formatMoney, PERIODS, periodRange, previousRange,
    // accounts & transactions
    CASH_TYPES, canBeAvailableCash, isLiability, isCountable, isPosted, isPending, isRefund, accountBalance, pendingOutflow,
    validateTransaction, findPossibleDuplicates, upsertTransaction, softDeleteTransaction, restoreTransaction, recategorize,
    // bills, income, goals
    occurrenceId, billOccurrences, autoMatchBills, incomeOccurrences, nextPayday,
    goalSaved, goalContributionsDue, goalProjection, contributionConflict,
    // safe to spend & forecast
    safeToSpend, safeToSpendFormula, recurringSpending, forecast, discretionaryPerDay, shortfallOptions, reduceFlexibleAllocations,
    // budgets
    budgetSummary, transferAllocation, setAllocation, scaleAllocation,
    // bank
    cleanMerchant, importProviderTransactions, resolveDuplicate, reconcileAccount,
    // insights
    monthlyTotals, spendingByCategory, monthOverMonth, buildInsights,
  };
});
