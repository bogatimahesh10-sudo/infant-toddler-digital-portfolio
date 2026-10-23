// Synthetic demo data. Every record here is made up and flagged as sample data.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./core.js"));
  else root.PaceSeed = factory(root.PaceCore);
})(typeof self !== "undefined" ? self : this, function (C) {
  "use strict";

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const CATEGORIES = [
    { id: "c_rent", name: "Rent", icon: "home", flexible: false },
    { id: "c_groceries", name: "Groceries", icon: "cart", flexible: true },
    { id: "c_transport", name: "Transport", icon: "bus", flexible: true },
    { id: "c_eating", name: "Eating out", icon: "cup", flexible: true },
    { id: "c_utilities", name: "Utilities", icon: "bolt", flexible: false },
    { id: "c_phone", name: "Phone & internet", icon: "phone", flexible: false },
    { id: "c_debt", name: "Debt repayments", icon: "card", flexible: false },
    { id: "c_edu", name: "Uni & study", icon: "book", flexible: false },
    { id: "c_health", name: "Health & fitness", icon: "heart", flexible: true },
    { id: "c_subs", name: "Subscriptions", icon: "play", flexible: false },
    { id: "c_shopping", name: "Shopping", icon: "bag", flexible: true },
    { id: "c_fun", name: "Going out & fun", icon: "star", flexible: true },
    { id: "c_other", name: "Other", icon: "dots", flexible: true },
  ];
  const INCOME_CATEGORIES = [
    { id: "c_pay", name: "Pay", icon: "wallet" },
    { id: "c_other_income", name: "Other income", icon: "gift" },
  ];

  function baseCategories() {
    return [
      ...CATEGORIES.map((c, i) => ({ ...c, type: "expense", order: i, archived_at: null })),
      ...INCOME_CATEGORIES.map((c, i) => ({ ...c, type: "income", flexible: false, order: 100 + i, archived_at: null })),
    ];
  }

  function allocationsFromFortnightly(fn) {
    const out = { weekly: {}, fortnightly: { ...fn }, monthly: {} };
    for (const [k, v] of Object.entries(fn)) {
      out.weekly[k] = C.scaleAllocation(v, "fortnightly", "weekly");
      out.monthly[k] = C.scaleAllocation(v, "fortnightly", "monthly");
    }
    return out;
  }

  function baseSettings() {
    return {
      buffer: 10000, period: "fortnightly", rollover: true, hide_balances: false, tight_per_day: 1500,
      sts_window: "payday", sts_include_expected: false,
      notifications: { bills: true, shortfall: true, weekly_summary: false },
      app_lock: false, offline: false,
    };
  }

  // Mia: a made-up uni student in Melbourne with casual café shifts paid fortnightly.
  function sample(today) {
    const r = rng(20261022);
    const between = (lo, hi) => Math.round(lo + r() * (hi - lo));
    let n = 0;
    const id = (p) => p + "_" + (++n).toString(36);
    const T = today;
    const histStart = C.addDays(T, -120);

    const accounts = [
      { id: "a_every", name: "Everyday", institution: "Demo Bank", type: "transaction", currency: "AUD", opening_balance: 0, available_cash: true, status: "active", source: "manual", updated_at: C.addDays(T, -1) + "T19:12:00" },
      { id: "a_cash", name: "Cash wallet", institution: "Cash", type: "cash", currency: "AUD", opening_balance: 0, available_cash: true, status: "active", source: "manual", updated_at: C.addDays(T, -3) + "T12:00:00" },
      { id: "a_save", name: "Bonus Saver", institution: "Demo Bank", type: "savings", currency: "AUD", opening_balance: 0, available_cash: false, reserved_for_goal_id: "g_emergency", status: "active", source: "manual", updated_at: C.addDays(T, -1) + "T19:12:00" },
      { id: "a_cc", name: "Credit card", institution: "Demo Bank", type: "credit", currency: "AUD", opening_balance: 0, credit_limit: 100000, available_cash: false, status: "active", source: "manual", updated_at: C.addDays(T, -1) + "T19:12:00" },
      { id: "a_bnpl", name: "Afterpay", institution: "Buy now, pay later", type: "loan", currency: "AUD", opening_balance: 0, available_cash: false, status: "active", source: "manual", updated_at: C.addDays(T, -4) + "T09:00:00" },
      { id: "a_help", name: "HECS-HELP", institution: "Study loan", type: "loan", currency: "AUD", opening_balance: 1432000, available_cash: false, status: "active", source: "manual", note: "Repaid through tax once your income passes the repayment threshold. No monthly bill.", updated_at: C.addDays(T, -30) + "T09:00:00" },
      { id: "a_inv", name: "Micro-investing", institution: "Demo Invest", type: "investment", currency: "AUD", opening_balance: 41260, available_cash: false, status: "active", source: "manual", updated_at: C.addDays(T, -7) + "T09:00:00" },
    ];

    const back = (date, freq, k) => freq === "weekly" ? C.addDays(date, -7 * k) : freq === "fortnightly" ? C.addDays(date, -14 * k) : C.addMonths(date, -({ monthly: 1, quarterly: 3 }[freq] * k));
    const rule = (o) => ({ status: "active", account_id: "a_every", reminder_days: 2, ...o });
    const recurring = [
      rule({ id: "r_pay", kind: "income", name: "Café shifts", amount: 100320, frequency: "fortnightly", start_date: back(C.addDays(T, 6), "fortnightly", 12), variable: true, category_id: "c_pay" }),
      rule({ id: "r_rent", kind: "bill", name: "Rent", amount: 18500, frequency: "weekly", start_date: back(C.addDays(T, 1), "weekly", 24), category_id: "c_rent", match: "rent" }),
      rule({ id: "r_myki", kind: "bill", name: "Myki top-up", amount: 5000, frequency: "fortnightly", start_date: back(C.addDays(T, 2), "fortnightly", 12), category_id: "c_transport", match: "myki" }),
      rule({ id: "r_bnpl", kind: "bill", name: "Afterpay instalment", amount: 4500, frequency: "fortnightly", start_date: C.addDays(T, -39), end_date: C.addDays(T, 45), category_id: "c_debt", pay_to_account_id: "a_bnpl", match: "afterpay" }),
      rule({ id: "r_phone", kind: "bill", name: "Phone plan", amount: 3500, frequency: "monthly", start_date: back(C.addDays(T, 4), "monthly", 6), category_id: "c_phone", match: "mobile" }),
      rule({ id: "r_net", kind: "bill", name: "Internet (share)", amount: 3250, frequency: "monthly", start_date: back(C.addDays(T, 9), "monthly", 6), category_id: "c_phone", match: "internet" }),
      rule({ id: "r_gym", kind: "bill", name: "Gym", amount: 1995, frequency: "fortnightly", start_date: back(C.addDays(T, 9), "fortnightly", 12), category_id: "c_health", match: "gym" }),
      rule({ id: "r_power", kind: "bill", name: "Electricity", amount: 28640, frequency: "quarterly", start_date: back(C.addDays(T, 11), "quarterly", 2), category_id: "c_utilities", match: "energy", reminder_days: 7 }),
      rule({ id: "r_spotify", kind: "bill", name: "Spotify", amount: 1399, frequency: "monthly", start_date: back(C.addDays(T, 12), "monthly", 6), category_id: "c_subs", match: "spotify" }),
      rule({ id: "r_books", kind: "bill", name: "Textbooks", amount: 13900, frequency: "once", start_date: C.addDays(T, 13), category_id: "c_edu", reminder_days: 3 }),
    ];

    const goals = [
      { id: "g_emergency", kind: "emergency", name: "Emergency fund", target: 200000, deadline: null, account_id: "a_save", starting_amount: 0, created_at: histStart,
        plan: { amount: 2000, frequency: "weekly", next_date: C.addDays(T, 4), from_account_id: "a_every", paused: false } },
      { id: "g_japan", kind: "custom", name: "Japan trip", target: 240000, deadline: C.addMonths(T, 9), account_id: null, starting_amount: 2000, created_at: histStart,
        plan: { amount: 4000, frequency: "fortnightly", next_date: C.addDays(T, 6), from_account_id: "a_every", paused: false } },
    ];

    const transactions = [];
    const contributions = [];
    const src = (d) => (d < C.addDays(T, -21) ? "csv_import" : "manual");
    const tx = (o) => transactions.push({ id: id("t"), currency: "AUD", status: "posted", note: "", audit: [], account_id: "a_every", ...o, source: o.source || src(o.date) });

    // Bills and pay from the same recurring rules, so history and schedule agree.
    for (const rl of recurring) {
      for (const d of C.occurrences(rl.start_date, rl.frequency, histStart, T, rl.end_date)) {
        if (rl.kind === "income") {
          tx({ type: "income", amount: rl.amount + between(-16000, 12000), date: d, category_id: "c_pay", merchant: "Corner Café payroll", income_rule_id: rl.id });
        } else if (rl.pay_to_account_id) {
          tx({ type: "transfer", amount: rl.amount, date: d, to_account_id: rl.pay_to_account_id, category_id: rl.category_id, merchant: rl.name, bill_occurrence_id: C.occurrenceId(rl.id, d) });
        } else {
          tx({ type: "expense", amount: rl.amount, date: d, category_id: rl.category_id, merchant: rl.name, bill_occurrence_id: C.occurrenceId(rl.id, d) });
        }
      }
    }
    // Weekly transfers into the reserved emergency-fund account.
    for (const d of C.occurrences(back(goals[0].plan.next_date, "weekly", 20), "weekly", histStart, T)) {
      const t = { type: "transfer", amount: 2000, date: d, to_account_id: "a_save", category_id: null, merchant: "Transfer to Bonus Saver" };
      tx(t);
      const made = transactions[transactions.length - 1];
      contributions.push({ id: id("k"), goal_id: "g_emergency", amount: 2000, date: d, occurrence_id: C.occurrenceId("g_emergency", d), transaction_id: made.id });
    }
    // Virtual Japan target: pledges only, no money moves.
    for (const d of C.occurrences(back(goals[1].plan.next_date, "fortnightly", 9), "fortnightly", histStart, T)) {
      contributions.push({ id: id("k"), goal_id: "g_japan", amount: 4000, date: d, occurrence_id: C.occurrenceId("g_japan", d), transaction_id: null });
    }

    // Everyday spending. Eating out runs higher this month so Insights has something to explain.
    const thisMonth = C.startOfMonth(T);
    const shops = {
      c_groceries: [["Woolworths", 3500, 9200], ["Aldi", 2500, 6800], ["Coles", 1800, 5400]],
      c_eating: [["Campus café", 450, 900], ["Grill'd", 1600, 2600], ["Lune Croissanterie", 700, 1500], ["Pho Hung", 1400, 2200], ["Domino's", 1200, 2400]],
      c_transport: [["Uber", 1200, 3200], ["Lime scooter", 300, 900]],
      c_shopping: [["Kmart", 1000, 5500], ["Uniqlo", 2500, 6000], ["JB Hi-Fi", 2000, 9000]],
      c_fun: [["Palace Cinemas", 1600, 2400], ["Corner Hotel", 1500, 4500], ["Steam", 900, 3500]],
      c_health: [["Chemist Warehouse", 800, 3500]],
      c_other: [["Australia Post", 400, 1600], ["Officeworks", 600, 2500]],
    };
    const pick = (list) => list[Math.floor(r() * list.length)];
    for (let d = histStart; d < T; d = C.addDays(d, 1)) {
      const dow = C.parseDate(d).getDay();
      const boost = d >= thisMonth ? 1.45 : 1;
      if (r() < 0.27) { const [m, lo, hi] = pick(shops.c_groceries); tx({ type: "expense", amount: between(lo, hi), date: d, category_id: "c_groceries", merchant: m }); }
      if (r() < 0.28 * boost) { const [m, lo, hi] = pick(shops.c_eating); tx({ type: "expense", amount: between(lo, hi), date: d, category_id: "c_eating", merchant: m, account_id: r() < 0.2 ? "a_cash" : "a_every" }); }
      if (r() < 0.09) { const [m, lo, hi] = pick(shops.c_transport); tx({ type: "expense", amount: between(lo, hi), date: d, category_id: "c_transport", merchant: m }); }
      if (r() < 0.08) { const [m, lo, hi] = pick(shops.c_shopping); tx({ type: "expense", amount: between(lo, hi), date: d, category_id: "c_shopping", merchant: m, account_id: r() < 0.5 ? "a_cc" : "a_every" }); }
      if ((dow === 5 || dow === 6) && r() < 0.35) { const [m, lo, hi] = pick(shops.c_fun); tx({ type: "expense", amount: between(lo, hi), date: d, category_id: "c_fun", merchant: m }); }
      if (r() < 0.03) { const [m, lo, hi] = pick(shops.c_health); tx({ type: "expense", amount: between(lo, hi), date: d, category_id: "c_health", merchant: m }); }
      if (r() < 0.03) { const [m, lo, hi] = pick(shops.c_other); tx({ type: "expense", amount: between(lo, hi), date: d, category_id: "c_other", merchant: m }); }
    }
    // A refund reduces Shopping instead of counting as income.
    tx({ type: "income", refund: true, amount: 2999, date: C.addDays(T, -4), category_id: "c_shopping", merchant: "Uniqlo refund", note: "Returned jacket", source: "manual" });
    // A recent manual entry that the demo bank will later import again (duplicate detection).
    tx({ type: "expense", amount: 6420, date: C.addDays(T, -2), category_id: "c_groceries", merchant: "Woolworths", note: "Weekly shop", source: "manual" });
    // Monthly credit card repayment from Everyday.
    for (const d of C.occurrences(C.addMonths(C.startOfMonth(T), -4), "monthly", histStart, T).map((x) => C.addDays(x, 20)).filter((x) => x < T)) {
      tx({ type: "transfer", amount: 15000, date: d, to_account_id: "a_cc", category_id: null, merchant: "Credit card repayment" });
    }

    let state = {
      schema: 3, sample: true, created_at: T,
      user: { id: "u_demo", name: "Mia", email: "mia@example.com", country: "AU", currency: "AUD", locale: "en-AU", timezone: "Australia/Melbourne" },
      settings: baseSettings(),
      accounts, categories: baseCategories(), recurring, goals, contributions, transactions,
      allocations: allocationsFromFortnightly({ c_rent: 37000, c_groceries: 12000, c_transport: 7000, c_eating: 5000, c_utilities: 4500, c_phone: 3500, c_debt: 4500, c_edu: 2000, c_health: 3000, c_subs: 700, c_shopping: 3000, c_fun: 3000, c_other: 1000 }),
      bill_status: {}, category_rules: {}, connections: [], dismissed: {},
      reservations: [{ id: "res_1", name: "Paying Sam back for concert ticket", amount: 4000, created_at: C.addDays(T, -2) }],
    };

    // Set opening balances so today's balances land on round, believable figures.
    const targets = { a_every: 61240, a_cash: 4500, a_save: 125000, a_cc: 34000, a_bnpl: 18000 };
    state.accounts = state.accounts.map((a) => {
      if (!(a.id in targets)) return a;
      const now = C.accountBalance(state, { ...a, opening_balance: 0 });
      return { ...a, opening_balance: targets[a.id] - now };
    });
    return state;
  }

  // Builds a fresh state from the first-time setup answers.
  function fromOnboarding(a, today) {
    const T = today;
    const accounts = [
      { id: "a_every", name: "Everyday", institution: "Entered by you", type: "transaction", currency: a.currency, opening_balance: a.everyday, available_cash: true, status: "active", source: "manual", updated_at: T + "T09:00:00" },
    ];
    if (a.cash > 0) accounts.push({ id: "a_cash", name: "Cash", institution: "Cash", type: "cash", currency: a.currency, opening_balance: a.cash, available_cash: true, status: "active", source: "manual", updated_at: T + "T09:00:00" });
    if (a.savings > 0) accounts.push({ id: "a_save", name: "Savings", institution: "Entered by you", type: "savings", currency: a.currency, opening_balance: a.savings, available_cash: false, status: "active", source: "manual", updated_at: T + "T09:00:00" });
    const categoryFor = { rent: "c_rent", phone: "c_phone", internet: "c_phone", power: "c_utilities", transport: "c_transport", subs: "c_subs" };
    const recurring = [
      { id: "r_pay", kind: "income", name: a.payName || "Pay", amount: a.pay, frequency: a.payFrequency, start_date: a.nextPay, variable: a.variable, status: "active", account_id: "a_every", category_id: "c_pay" },
      ...a.bills.map((b, i) => ({ id: "r_b" + i, kind: "bill", name: b.name, amount: b.amount, frequency: b.frequency, start_date: b.next, status: "active", account_id: "a_every", category_id: categoryFor[b.key] || "c_other", reminder_days: 2 })),
    ];
    const goals = a.goal ? [{
      id: "g_first", kind: a.goal.kind, name: a.goal.name, target: a.goal.target, deadline: null,
      account_id: accounts.some((x) => x.id === "a_save") ? "a_save" : null, starting_amount: 0, created_at: T,
      plan: { amount: a.goal.perPay, frequency: a.payFrequency, next_date: a.nextPay, from_account_id: "a_every", paused: false },
    }] : [];
    if (goals[0] && goals[0].account_id) accounts.find((x) => x.id === "a_save").reserved_for_goal_id = "g_first";
    const settings = { ...baseSettings(), buffer: a.buffer, period: a.payFrequency };
    const state = {
      schema: 3, sample: false, created_at: T,
      user: { id: "u_local", name: a.name || "", email: a.email || "", country: "AU", currency: a.currency, locale: "en-AU", timezone: "Australia/Melbourne" },
      settings, accounts, categories: baseCategories(), recurring, goals, contributions: [], transactions: [],
      allocations: { weekly: {}, fortnightly: {}, monthly: {} },
      bill_status: {}, category_rules: {}, connections: [], dismissed: {}, reservations: [],
    };
    let s = state;
    for (const [cat, cents] of Object.entries(a.allocations || {})) s = C.setAllocation(s, a.payFrequency, cat, cents);
    return s;
  }

  // Suggested plan for one pay period: bills first, then the goal, then a split of what's left.
  function suggestAllocations(a) {
    const perYear = { weekly: 52, fortnightly: 26, monthly: 12, quarterly: 4, yearly: 1, once: 0 };
    const p = perYear[a.payFrequency];
    const out = {};
    const categoryFor = { rent: "c_rent", phone: "c_phone", internet: "c_phone", power: "c_utilities", transport: "c_transport", subs: "c_subs" };
    let billTotal = 0;
    for (const b of a.bills) {
      const cat = categoryFor[b.key] || "c_other";
      const per = Math.round((b.amount * perYear[b.frequency]) / p);
      out[cat] = (out[cat] || 0) + per;
      billTotal += per;
    }
    const left = Math.max(0, a.pay - billTotal - (a.goal ? a.goal.perPay : 0));
    const split = { c_groceries: 0.4, c_transport: 0.1, c_eating: 0.15, c_fun: 0.15, c_shopping: 0.1, c_other: 0.1 };
    for (const [cat, share] of Object.entries(split)) out[cat] = (out[cat] || 0) + Math.floor(left * share);
    return out;
  }

  return { sample, fromOnboarding, suggestAllocations, baseCategories };
});
