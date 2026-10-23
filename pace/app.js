// Pace prototype UI. All money logic lives in core.js; this file renders screens and handles input.
(function () {
  "use strict";

  const C = window.PaceCore, Seed = window.PaceSeed, Prov = window.PaceProvider;
  const KEY = "pace-prototype-v3";
  const today = () => C.iso(new Date());
  const now = () => new Date().toISOString();
  const uid = (p) => (p || "x") + "_" + Math.random().toString(36).slice(2, 9);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));

  // ---------- state ----------
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && s.schema === 3) { s.reservations = s.reservations || []; return s; }
        if (s && s.deleted) return null;
      }
    } catch (e) { /* storage unavailable: fall back to sample data */ }
    // The store build starts with first-time setup; the web prototype starts with sample data.
    return window.PACE_START === "onboarding" ? null : Seed.sample(today());
  }
  let S = load();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S || { deleted: true })); } catch (e) { /* keep working without storage */ }
  }

  const ui = {
    tab: "home", stack: [], connect: null, onb: null, locked: !!(S && S.settings.app_lock),
    af: { q: "", type: "all", source: "all", status: "all", account: "all", category: "all", ids: null, idsLabel: "" },
    actLimit: 60, insRange: "3m", reorder: false, calMonth: C.startOfMonth(today()), calSel: today(), receiptDraft: undefined,
  };
  const TABS = ["home", "budget", "activity", "goals", "insights"];
  // Store builds (Android and iOS) leave out prototype-only features: the simulated bank
  // connection and the prototype tools. The web prototype keeps them for user testing.
  const STORE = window.PACE_STORE === true;
  if (TABS.includes(location.hash.slice(1))) ui.tab = location.hash.slice(1);
  const provider = Prov.createMockProvider({ today, delayMs: 900 });

  // ---------- icons ----------
  const ICONS = {
    home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M3 4h2l2.5 11h11L21 8H6.2"/>',
    bus: '<rect x="5" y="3" width="14" height="15" rx="3"/><path d="M5 11h14M8 21v-3M16 21v-3"/>',
    cup: '<path d="M4 8h13v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6z"/><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 2v3M12 2v3"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
    book: '<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-6a3 3 0 0 0-3 3M20 4v14h-7"/>',
    heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
    play: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5l5 3.5-5 3.5z"/>',
    bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    dots: '<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>',
    wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="16.5" cy="13.5" r="1.2"/>',
    gift: '<rect x="3" y="8" width="18" height="5"/><path d="M5 13v8h14v-8M12 8v13M12 8S10.5 3 8 4s0 4 4 4zM12 8s1.5-5 4-4 0 4-4 4z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeoff: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    chev: '<path d="M9 5l7 7-7 7"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    alert: '<path d="M12 3L2 20h20z"/><path d="M12 10v4M12 17.2v.1"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.8v.1"/>',
    offline: '<path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 4.3-2.6M2 9.5a15 15 0 0 1 4.4-2.8M22 9.5A15 15 0 0 0 12 5.5c-.7 0-1.3 0-2 .1"/><circle cx="12" cy="20" r=".8"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    bank: '<path d="M3 9l9-5 9 5M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 20h18"/>',
    sync: '<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 13a8 8 0 0 0 14.5 4.5L20 16M4 4v4h4M20 20v-4h-4"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
    swap: '<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
    receipt: '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h4"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    pie: '<path d="M21 12A9 9 0 1 1 12 3v9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>',
    up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    down: '<path d="M12 5v14M5 12l7 7 7-7"/>',
    pause: '<path d="M9 5v14M15 5v14"/>',
    resume: '<path d="M7 5l12 7-12 7z"/>',
    car: '<path d="M5 16h14M3 16v-4l2.5-5h13L21 12v4"/><circle cx="7" cy="17.5" r="1.5"/><circle cx="17" cy="17.5" r="1.5"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    cap: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    pace: '<circle cx="12" cy="12" r="9.5" opacity=".3"/><path d="M12 2.5a9.5 9.5 0 0 1 9.5 9.5"/><circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none"/>',
  };
  const ico = (n, cls) => `<svg class="i ${cls || ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ICONS.dots}</svg>`;
  const GOAL_KINDS = { emergency: ["Emergency fund", "shield"], car: ["Car", "car"], tuition: ["Tuition", "cap"], custom: ["Custom goal", "flag"] };

  // ---------- formatting & lookups ----------
  const hidden = () => S && S.settings.hide_balances;
  const money = (c) => (hidden() ? "$•••" : C.formatMoney(c, S ? S.user.currency : "AUD", S ? S.user.locale : "en-AU"));
  const plain = (c) => (c / 100).toFixed(2);
  // Whole dollars for dense tables on narrow screens.
  const money0 = (c) => (hidden() ? "$•••" : C.formatMoney(Math.round(c / 100) * 100, S.user.currency, S.user.locale).replace(/\.00$/, ""));
  const fmt = (s, o) => C.parseDate(s).toLocaleDateString("en-AU", o || { weekday: "short", day: "numeric", month: "short" });
  const dShort = (s) => fmt(s, { day: "numeric", month: "short" });
  const dMonth = (s) => fmt(s, { month: "short", year: "numeric" });
  function relDay(s) {
    const n = C.daysBetween(today(), s);
    if (n === 0) return "Today";
    if (n === 1) return "Tomorrow";
    if (n === -1) return "Yesterday";
    if (n > 1 && n < 7) return fmt(s, { weekday: "long" });
    return fmt(s);
  }
  function ago(stamp) {
    const m = Math.round((Date.now() - new Date(stamp).getTime()) / 60000);
    if (m < 1) return "just now";
    if (m < 60) return m + " min ago";
    const h = Math.round(m / 60);
    if (h < 24) return h + (h === 1 ? " hour ago" : " hours ago");
    const d = Math.round(h / 24);
    return d === 1 ? "yesterday" : d + " days ago";
  }
  const WORD = { weekly: "week", fortnightly: "fortnight", monthly: "month" };
  const FREQ = { weekly: "Weekly", fortnightly: "Fortnightly", monthly: "Monthly", quarterly: "Quarterly", yearly: "Yearly", once: "Once" };
  const cat = (id) => S.categories.find((c) => c.id === id);
  const catName = (id) => (cat(id) || { name: id ? "Uncategorised" : "No category" }).name;
  const acct = (id) => S.accounts.find((a) => a.id === id);
  const acctName = (id) => (acct(id) || { name: "Unknown account" }).name;
  const goalOf = (id) => S.goals.find((g) => g.id === id);
  const ruleOf = (id) => S.recurring.find((r) => r.id === id);
  const connOf = (id) => S.connections.find((c) => c.id === id);
  const liveAccounts = () => S.accounts.filter((a) => a.status !== "closed");
  const cashAccounts = () => liveAccounts().filter((a) => a.available_cash && C.canBeAvailableCash(a));
  const TYPE_NAMES = { transaction: "Everyday", savings: "Savings", cash: "Cash", credit: "Credit card", loan: "Loan", investment: "Investment" };

  // ---------- shared UI pieces ----------
  function notice(tone, title, body, actions) {
    const icon = { success: "check", caution: "alert", error: "alert", info: "info", offline: "offline", sample: "info" }[tone] || "info";
    return `<div class="notice ${tone}"><span class="mark">${ico(icon)}</span><div class="body">${title ? `<b>${title}</b>` : ""}${body ? `<span>${body}</span>` : ""}${actions ? `<div class="actions">${actions}</div>` : ""}</div></div>`;
  }
  const emptyState = (icon, title, body, action) => `<div class="empty">${ico(icon)}<b>${title}</b><span class="small">${body}</span>${action || ""}</div>`;
  const catIcon = (c, extra) => `<span class="cat ${extra || ""}">${ico(c ? c.icon : "dots")}</span>`;
  const switchCtl = (id, checked, live, attrs, label) => `<span class="switch"><input type="checkbox" role="switch" id="${id}" ${checked ? "checked" : ""} data-live="${live}" ${attrs || ""} aria-label="${esc(label)}"><span></span></span>`;
  const seg = (act, value, options, label) => `<div class="seg" role="group" aria-label="${esc(label)}">${options.map(([v, l]) => `<button type="button" data-act="${act}" data-v="${v}" aria-pressed="${v === value}">${l}</button>`).join("")}</div>`;
  const moneyField = (name, label, value, opts) => `<label class="field">${label}${opts && opts.hint ? ` <span class="hint">${opts.hint}</span>` : ""}<span class="money-wrap"><span>$</span><input class="input money" name="${name}" inputmode="decimal" autocomplete="off" ${value != null && value !== "" ? `value="${esc(value)}"` : ""} ${opts && opts.placeholder ? `placeholder="${opts.placeholder}"` : ""} ${opts && opts.required ? "required" : ""} ${opts && opts.disabled ? "disabled" : ""} ${opts && opts.live ? `data-live="${opts.live}"` : ""}></span></label>`;
  const options = (list, sel) => list.map(([v, l]) => `<option value="${esc(v)}" ${v === sel ? "selected" : ""}>${esc(l)}</option>`).join("");
  const amountSplit = (c) => {
    if (hidden()) return "$•••";
    const [d, ce] = C.formatMoney(Math.abs(c), S ? S.user.currency : "AUD", S ? S.user.locale : "en-AU").split(".");
    return `${c < 0 ? "−" : ""}${d}<span class="c">.${ce || "00"}</span>`;
  };

  function budgetBar(r) {
    const total = Math.max(r.available, r.used, 1);
    const w = (v) => (v / total) * 100;
    return `<div class="bar ${r.spent > r.available ? "over" : ""}" aria-hidden="true">
      <div class="done" style="width:${w(r.completed)}%"></div><div class="pend" style="width:${w(r.pending)}%"></div><div class="sched" style="width:${w(r.scheduled)}%"></div>
      ${r.used > r.available && r.available > 0 ? `<div class="limit" style="left:${w(r.available)}%"></div>` : ""}</div>`;
  }
  const STATUS_CHIP = { over: ["error", "Over"], "at-risk": ["caution", "At risk"], close: ["caution", "Nearly used"], ok: ["ok", "On track"], none: ["", "No plan"] };

  function freshness(a) {
    if (a.connection_id) {
      const c = connOf(a.connection_id);
      if (c && c.status === "syncing") return `<span class="chip">${ico("sync", "s")}Syncing</span>`;
      if (c && c.status === "failed") return `<span class="chip error">Sync failed</span>`;
      if (c) return `<span>Synced ${ago(c.last_synced_at)}</span><span class="chip sample">Demo connection</span>`;
    }
    return `<span>Updated by you ${ago(a.updated_at)}</span>${S.sample ? `<span class="chip sample">Sample</span>` : ""}`;
  }

  // ---------- sheets, dialogs, toasts ----------
  const overlay = $("#overlay");
  let sheet = null, lastFocus = null;
  function openSheet(title, body, opts) {
    opts = opts || {};
    lastFocus = document.activeElement;
    overlay.className = "overlay" + (opts.center ? " center" : "");
    overlay.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-head"><h2 id="sheet-title">${title}</h2><button type="button" class="icon-btn plain" data-act="close-sheet" aria-label="Close">${ico("x")}</button></div>${body}</div>`;
    overlay.hidden = false;
    sheet = opts;
    const first = overlay.querySelector("[autofocus]") || overlay.querySelector("input:not([type=hidden]):not([disabled]), select, textarea, .sheet button:not([data-act=close-sheet])");
    if (first) first.focus();
    if (opts.onMount) opts.onMount(overlay.querySelector(".sheet"));
  }
  function closeSheet() {
    overlay.hidden = true;
    overlay.innerHTML = "";
    sheet = null;
    ui.receiptDraft = undefined;
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeSheet(); });
  document.addEventListener("keydown", (e) => {
    if (overlay.hidden) return;
    if (e.key === "Escape") { closeSheet(); return; }
    if (e.key === "Tab") {
      const f = $$("button, input, select, textarea, summary, [tabindex]:not([tabindex='-1'])", overlay).filter((x) => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  function confirmDialog(o) {
    openSheet(o.title, `<form data-form="confirm">
      <p>${o.body}</p>
      ${o.extra || ""}
      ${o.requireText ? `<label class="field">Type ${o.requireText} to confirm<input class="input" name="confirm_text" autocomplete="off" required></label>` : ""}
      <p class="err" id="confirm-err"></p>
      <div class="btn-row"><button type="button" class="btn" data-act="close-sheet">Cancel</button><button class="btn ${o.danger ? "danger solid" : "primary"}">${o.confirm}</button></div>
    </form>`, { center: true, onConfirm: o.onConfirm, requireText: o.requireText });
  }
  let toastTimer;
  function toast(msg, opts) {
    const t = $("#toast");
    t.innerHTML = `<span>${esc(msg)}</span>${opts && opts.undo ? `<button type="button" id="toast-undo">Undo</button>` : ""}`;
    t.hidden = false;
    if (opts && opts.undo) $("#toast-undo").onclick = () => { opts.undo(); t.hidden = true; };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), opts && opts.undo ? 6000 : 3600);
  }
  // Applies a change, re-links bills, and reports how Safe to Spend moved.
  function apply(label, next, opts) {
    const before = C.safeToSpend(S, today()).S;
    const prev = S;
    S = C.autoMatchBills(next, today());
    const after = C.safeToSpend(S, today()).S;
    render();
    const msg = before === after || hidden() ? label : `${label} Safe to Spend ${money(before)} → ${money(after)}.`;
    toast(msg, opts && opts.undoable ? { undo: () => { S = prev; render(); } } : null);
  }

  // ---------- navigation ----------
  function go(tab) {
    ui.tab = tab; ui.stack = [];
    try { history.replaceState(null, "", "#" + tab); } catch (e) { /* hash optional */ }
    render(); window.scrollTo(0, 0); $("#view").focus({ preventScroll: true });
  }
  function openSub(name, arg) { ui.stack.push({ name, arg }); render(); window.scrollTo(0, 0); $("#view").focus({ preventScroll: true }); }
  const sub = () => ui.stack[ui.stack.length - 1] || null;
  function back() { ui.stack.pop(); if (!ui.stack.length) ui.connect = null; render(); window.scrollTo(0, 0); }

  // ---------- render ----------
  const view = $("#view");
  function render() {
    $("#lock").hidden = !(S && S.settings.app_lock && ui.locked);
    if ($("#lock").hidden === false) renderLock();
    if (!S || ui.onb) { renderOnboarding(); renderGuide(); save(); return; }
    const s = sub();
    renderHeader(s);
    $("#tabs").hidden = !!s && ["connect"].includes(s.name);
    renderTabs();
    const body = s ? SUBS[s.name](s.arg) : SCREENS[ui.tab]();
    view.innerHTML = (S.settings.offline ? notice("offline", "You're offline (simulated)", "You can keep adding and editing entries. Bank sync is paused until you're back online.") : "") + body;
    renderGuide();
    save();
  }

  function renderHeader(s) {
    const titles = { accounts: "Accounts", bills: "Bills & calendar", connect: "Connect a bank", connection: "Bank connection", settings: "Settings & privacy" };
    const eye = `<button class="icon-btn" data-act="toggle-hide" aria-label="${hidden() ? "Show balances" : "Hide balances"}" aria-pressed="${!!hidden()}">${ico(hidden() ? "eyeoff" : "eye")}</button>`;
    $("#top").innerHTML = s
      ? `<button class="icon-btn" data-act="back" aria-label="Back">${ico("back")}</button><h1 class="title">${titles[s.name]}</h1>${eye}`
      : `<div class="wordmark">${ico("pace")}<span>Pace</span>${S.sample ? `<span class="chip sample">Sample data</span>` : ""}</div>${eye}<button class="icon-btn" data-act="open" data-sub="settings" aria-label="Settings and privacy">${ico("gear")}</button>`;
  }
  function renderTabs() {
    const items = [["home", "Home", "home"], ["budget", "Budget", "pie"], ["activity", "Activity", "list"], ["goals", "Goals", "flag"], ["insights", "Insights", "chart"]];
    const active = sub() ? null : ui.tab;
    $("#tabs").innerHTML = items.map(([id, label, icon]) => `<button data-tab="${id}" ${active === id ? 'aria-current="page"' : ""}>${ico(icon)}${label}</button>`).join("");
  }

  // ===== 01 Home =====
  function renderHome() {
    const T = today();
    const period = S.settings.period;
    const windows = stsWindows(T);
    const st = C.safeToSpend(S, T, { window: windows.current });
    const fc = C.forecast(S, T);
    const sf = C.shortfallOptions(S, T);
    const bs = C.budgetSummary(S, period, T);
    const out = [];

    if (S.sample && !S.dismissed.sample) {
      out.push(notice("sample", "You're looking at sample data", "Mia is a made-up student. Every account, bill and transaction here is simulated, no real bank is connected, and changes are saved only on this device.",
        `<button class="btn small" data-act="start-onboarding">Set up my own</button><button class="btn small ghost" data-act="dismiss" data-key="sample">Hide this</button>`));
    }
    out.push(`<div class="card-head"><h1 style="font-size:1.25rem">${S.user.name ? "Hi " + esc(S.user.name) : "Your money"}</h1></div>`);
    out.push(`<div class="field"><span class="eyebrow">Budget period</span>${seg("set-period", period, [["weekly", "Week"], ["fortnightly", "Fortnight"], ["monthly", "Month"]], "Budget period")}</div>`);

    // Safe to Spend hero
    const pay = S.recurring.find((r) => r.kind === "income" && r.status === "active");
    const cycle = pay ? ({ weekly: 7, fortnightly: 14, monthly: 30 }[pay.frequency] || 14) : 30;
    const payDays = Math.max(0, C.daysBetween(T, st.payday));
    const elapsed = Math.max(0, Math.min(1, 1 - payDays / cycle));
    const windowLabel = { payday: "payday", week: "the next 7 days", period: `the end of this ${WORD[period]}` }[st.window];
    const statusChip = st.status === "shortfall" ? `<span class="chip bad">Shortfall</span>` : st.status === "tight" ? `<span class="chip warn">Tight</span>` : `<span class="chip">On track</span>`;
    out.push(`<section class="card hero ${st.status}" aria-labelledby="sts-label">
      <div class="card-head"><span class="eyebrow" id="sts-label">${st.S < 0 ? "Shortfall" : "Safe to Spend"} · ${st.window === "week" ? "" : "until "}${windowLabel}</span>${statusChip}</div>
      <div class="hero-amt">${amountSplit(st.S)}</div>
      <div class="meta"><span>${st.S > 0 ? `${money(st.perDay)} a day for ${st.days} day${st.days === 1 ? "" : "s"}` : "Nothing safe to spend yet"}</span><span>Until ${st.window === "payday" && st.noIncome ? "the end of the month" : fmt(st.end)}</span></div>
      ${st.S < 0 ? `<p class="small">Your bills, savings, set-asides and buffer ${st.window === "payday" ? "before payday" : "in this window"} are ${money(-st.S)} more than you have${st.window !== "payday" && st.includeExpected ? ", including expected pay" : ""}. Pace shows the shortfall instead of $0 so you can fix it.</p>` : ""}
      ${seg("sts-window", st.window, windows.options, "Time window for Safe to Spend")}
      ${st.window !== "payday" ? `<div class="switch-row" style="border:0;padding:0"><div class="grow small">${st.expectedItems.length ? `Count ${money(st.E)} expected pay${st.estimated ? " (estimate)" : ""}` : "No pay expected in this window"}${st.includeExpected && st.E ? `<div class="tiny" style="opacity:.8">Without it: ${money(st.conservative)}</div>` : ""}</div>${st.expectedItems.length ? switchCtl("sts-expected", st.includeExpected, "sts-expected", "", "Count expected pay") : ""}</div>` : ""}
      <div class="countdown" aria-label="Payday countdown">
        <div class="track"><div style="width:${Math.round(elapsed * 100)}%"></div></div>
        <div class="labels"><span>${st.noIncome ? "No payday set" : `Payday in ${payDays} day${payDays === 1 ? "" : "s"}${st.estimated ? " (estimated)" : ""}`}</span><span>${st.payIncome ? `${money(st.payIncome.amount)}${st.estimated ? " expected" : ""} · <button class="link" data-act="income-edit" data-id="${st.payIncome.rule.id}">Edit pay</button>` : `<button class="link" data-act="income-edit">Add pay</button>`}</span></div>
      </div>
      ${st.estimated ? `<p class="tiny" style="opacity:.8">Your pay changes, so the payday amount is an estimate.</p>` : ""}
      <p class="tiny" style="opacity:.8">An estimate from the information in Pace, not a guarantee of money you can withdraw.</p>
    </section>`);

    // Flow D: avoid a cash shortfall
    if (sf) {
      const trig = sf.trigger;
      const goalLine = sf.goals.items.length ? (() => {
        const g = sf.goals.items[0].goal;
        const n = sf.goals.items.filter((x) => x.goal.id === g.id).length;
        const total = sf.goals.items.filter((x) => x.goal.id === g.id).reduce((s, x) => s + x.amount, 0);
        return `<div class="option"><span class="cat goal">${ico("flag")}</span><div class="grow"><b>Pause ${esc(g.name)} until ${dShort(C.addDays(sf.lowDate, 1))}</b><span class="small muted">Skips ${n} contribution${n === 1 ? "" : "s"} worth ${money(total)}${total >= sf.need ? ", which covers the gap" : ""}.</span></div><button class="btn small" data-act="fix-goal" data-id="${g.id}" data-until="${C.addDays(sf.lowDate, 1)}">Pause</button></div>`;
      })() : "";
      const bill = sf.bills[0];
      out.push(`<section class="card" id="shortfall" aria-labelledby="sf-h" style="border-color:var(--error-mark)">
        ${notice("error", `Projected shortfall on ${fmt(sf.date)}`, `${trig ? `${esc(trig.label)} (${money(-trig.amount)}) is due then. ` : ""}Your cash could drop to ${money(fc.low.balance)} by ${dShort(sf.lowDate)}${fc.incomeEstimated ? ", based on your estimated pay" : ""}.`)}
        <h2 id="sf-h">Ways to avoid it</h2>
        <div>
          <div class="option"><span class="cat">${ico("cart")}</span><div class="grow"><b>Spend ${money(sf.spending.cutPerDay)} less a day</b><span class="small muted">Lowers your everyday spending plan from ${money(sf.spending.daily)} to ${money(Math.max(0, sf.spending.daily - sf.spending.cutPerDay))} a day until then.</span></div><button class="btn small" data-act="fix-spend" data-cut="${sf.spending.cutPerDay}" ${sf.spending.feasible ? "" : "disabled"}>Apply</button></div>
          ${goalLine}
          ${bill ? `<div class="option"><span class="cat bill">${ico("bolt")}</span><div class="grow"><b>Review ${esc(bill.rule.name)}</b><span class="small muted">${money(bill.amount)} due ${relDay(bill.date)}. Change the amount or date if it's wrong, or skip it if it's already paid.</span></div><button class="btn small" data-act="edit-occ" data-id="${bill.id}">Review</button></div>` : ""}
        </div>
      </section>`);
    } else if (fc.firstBelowBuffer) {
      out.push(notice("caution", `Your cash may dip below your buffer on ${fmt(fc.firstBelowBuffer.date)}`, `The lowest point is ${money(fc.low.balance)} on ${dShort(fc.low.date)}. You'd still be above $0.`, `<button class="btn small" data-act="open" data-sub="bills">See the calendar</button>`));
    } else {
      out.push(notice("success", "No shortfalls in the next 6 weeks", `Your lowest projected cash is ${money(fc.low.balance)} on ${dShort(fc.low.date)}.`));
    }

    // Breakdown: the user can challenge each part
    out.push(`<section class="card" aria-labelledby="bd-h">
      <div class="card-head"><h2 id="bd-h">How it's worked out</h2><span class="chip">${dShort(T)} – ${dShort(C.addDays(st.end, -1))}</span></div>
      <div>
        <details><summary class="bd-line">${ico("chev", "s chev")}<span class="grow">Available cash</span><span class="amt">${money(st.A)}</span></summary>
          <div class="detail-body">
            ${st.included.map((x) => `<div class="mini"><span>${esc(x.account.name)}</span><span class="amt">${money(x.balance)}</span></div>`).join("")}
            ${st.pending ? `<div class="mini"><span>Pending, not yet in your balance (${st.pendingItems.length})</span><span class="amt">−${money(st.pending)}</span></div>` : ""}
            ${st.excluded.length ? `<p class="tiny muted" style="padding-top:6px">Not counted: ${st.excluded.map((x) => `${esc(x.account.name)} (${x.reason.toLowerCase()})`).join(", ")}.</p>` : ""}
          </div></details>
        ${st.window !== "payday" ? `<details><summary class="bd-line">${ico("chev", "s chev")}<span class="grow">Expected pay (${st.expectedItems.length})${st.includeExpected ? "" : " · not counted"}</span><span class="amt">${st.includeExpected ? "+" + money(st.E) : money(0)}</span></summary>
          <div class="detail-body">${st.expectedItems.map((o) => `<button class="mini" data-act="income-edit" data-id="${o.rule.id}"><span>${esc(o.rule.name)} · ${relDay(o.date)}${o.estimated ? " · estimate" : ""}</span><span class="amt">${money(o.amount)}</span></button>`).join("") || `<p class="tiny muted">No pay expected in this window.</p>`}
          <p class="tiny muted">Expected pay hasn't arrived yet. Turn it off in the card above for a conservative figure.</p></div></details>` : ""}
        <details><summary class="bd-line">${ico("chev", "s chev")}<span class="grow">Bills ${st.window === "payday" ? "before payday" : "in this window"} (${st.bills.length})</span><span class="amt">−${money(st.B)}</span></summary>
          <div class="detail-body">${st.bills.map((o) => `<button class="mini" data-act="edit-occ" data-id="${o.id}"><span>${esc(o.rule.name)} · ${relDay(o.date)}${o.status === "overdue" ? " · overdue" : ""}</span><span class="amt">${money(o.amount)}</span></button>`).join("") || `<p class="tiny muted">Nothing due before payday.</p>`}
          <p class="tiny muted">Paid, skipped and cancelled bills aren't counted. A bill already matched to a bank payment is only deducted once.</p></div></details>
        <details><summary class="bd-line">${ico("chev", "s chev")}<span class="grow">Savings commitments (${st.goals.length})</span><span class="amt">−${money(st.G)}</span></summary>
          <div class="detail-body">${st.goals.map((c) => `<button class="mini" data-act="goal-edit" data-id="${c.goal.id}"><span>${esc(c.goal.name)} · ${relDay(c.date)}</span><span class="amt">${money(c.amount)}</span></button>`).join("") || `<p class="tiny muted">No transfers to savings before payday.</p>`}
          <p class="tiny muted">Virtual goals don't move money, so they aren't deducted.</p></div></details>
        <details><summary class="bd-line">${ico("chev", "s chev")}<span class="grow">Other set-asides (${st.reservedItems.length})</span><span class="amt">−${money(st.O)}</span></summary>
          <div class="detail-body">${st.reservedItems.map((r) => `<button class="mini" data-act="res-edit" data-id="${r.id}"><span>${esc(r.name)}</span><span class="amt">${money(r.amount)}</span></button>`).join("") || `<p class="tiny muted">Nothing set aside.</p>`}
          <button class="link" data-act="res-edit">${ico("plus", "s")}Set money aside</button>
          <p class="tiny muted">For money you've promised elsewhere, like paying a friend back.</p></div></details>
        <div class="bd-line"><span style="width:16px"></span><span class="grow">Safety buffer</span><button class="link" data-act="edit-buffer">Change</button><span class="amt">−${money(st.R)}</span></div>
        <div class="bd-line" style="border-top:2px solid var(--ink)"><span style="width:16px"></span><span class="grow">${st.S < 0 ? "Shortfall" : "Safe to Spend"}</span><span class="amt">${money(st.S)}</span></div>
      </div>
      <p class="tiny muted">Spending you've already recorded is in your balance, so it isn't subtracted again. Tap a bill, goal, set-aside or the buffer to change it. Safe to Spend updates straight away.</p>
    </section>`);

    // Cash and freshness
    out.push(`<section class="card" aria-labelledby="cash-h">
      <div class="card-head"><h2 id="cash-h">Cash</h2><button class="link" data-act="open" data-sub="accounts">All accounts ${ico("chev", "s")}</button></div>
      <div class="rows">${st.included.map((x) => `<div class="row"><span class="cat">${ico(x.account.type === "cash" ? "wallet" : "bank")}</span><div class="grow"><div class="t">${esc(x.account.name)}</div><div class="s">${freshness(x.account)}</div></div><div class="amt">${money(x.balance)}</div></div>`).join("")}</div>
    </section>`);

    // Recent transactions
    const recent = S.transactions.filter((t) => !t.deleted_at).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
    out.push(`<section class="card" aria-labelledby="rt-h">
      <div class="card-head"><h2 id="rt-h">Recent transactions</h2><button class="link" data-tab="activity">Activity ${ico("chev", "s")}</button></div>
      <div class="rows">${recent.map(txRow).join("") || emptyState("list", "No transactions yet", "Add your first expense to see it here.")}</div>
    </section>`);

    // This period
    out.push(`<section class="card" aria-labelledby="per-h">
      <div class="card-head"><h2 id="per-h">This ${WORD[period]}</h2><span class="small muted">${dShort(bs.range.start)} – ${dShort(C.addDays(bs.range.end, -1))}</span></div>
      <div class="stats"><div class="stat"><span class="l">Income received</span><span class="v">${money(bs.income)}</span></div><div class="stat"><span class="l">Spent</span><span class="v">${money(bs.expenses)}</span></div><div class="stat"><span class="l">Pay still expected</span><span class="v">${money(bs.expectedIncome)}</span></div></div>
    </section>`);

    // Budget progress
    const order = { over: 0, "at-risk": 1, close: 2, ok: 3, none: 4 };
    const top = bs.rows.filter((r) => r.status !== "none").sort((a, b) => order[a.status] - order[b.status] || b.used - a.used).slice(0, 4);
    out.push(`<section class="card" aria-labelledby="bp-h">
      <div class="card-head"><h2 id="bp-h">Budget progress</h2><button class="link" data-tab="budget">Budget ${ico("chev", "s")}</button></div>
      <div>${top.map((r) => budgetRow(r, true)).join("") || emptyState("pie", "No budget yet", "Plan your spending in Budget.")}</div>
    </section>`);

    // Upcoming bills
    const upcoming = C.billOccurrences(S, C.addDays(T, -14), C.addDays(T, 15), T).filter((o) => ["overdue", "due", "upcoming"].includes(o.status)).slice(0, 5);
    out.push(`<section class="card" aria-labelledby="ub-h">
      <div class="card-head"><h2 id="ub-h">Upcoming bills</h2><button class="link" data-act="open" data-sub="bills">Bills & calendar ${ico("chev", "s")}</button></div>
      <div class="rows">${upcoming.map(occRow).join("") || emptyState("cal", "No bills in the next two weeks", "Add rent, phone and other bills so Pace can plan for them.")}</div>
    </section>`);

    // Quick actions
    const conn = S.connections.find((c) => c.status !== "disconnected");
    out.push(`<section class="card" aria-labelledby="qa-h"><h2 id="qa-h">Quick actions</h2><div class="qa">
      <button class="btn" data-act="add-tx">${ico("plus")}Add transaction</button>
      <button class="btn" data-act="add-bill">${ico("cal")}Add bill</button>
      <button class="btn" data-act="add-tx" data-type="transfer">${ico("swap")}Move money</button>
      ${STORE ? `<button class="btn" data-act="open" data-sub="bills">${ico("cal")}Bills & calendar</button>` : conn ? `<button class="btn" data-act="open" data-sub="connection" data-arg="${conn.id}">${ico("sync")}Bank sync</button>` : `<button class="btn" data-act="connect-start">${ico("bank")}Connect bank</button>`}
    </div></section>`);
    out.push(`<button class="btn primary fab" data-act="add-tx">${ico("plus")}Add</button>`);
    return out.join("");
  }

  // Windows offered for Safe to Spend. A budget period that ends on payday would repeat
  // "Until payday", so it's only offered when it ends on a different day.
  function stsWindows(T) {
    const period = S.settings.period;
    const base = C.safeToSpend(S, T, { window: "payday" });
    const options = [["payday", "Until payday"], ["week", "Next 7 days"]];
    if (base.range.end !== base.payday) options.push(["period", `This ${WORD[period]}`]);
    const want = S.settings.sts_window || "payday";
    return { options, current: options.some(([v]) => v === want) ? want : "payday" };
  }

  function occRow(o) {
    const chip = { overdue: ["error", "Overdue"], due: ["caution", "Due today"], upcoming: ["", relDay(o.date)], paid: ["ok", "Paid"], skipped: ["", "Skipped"], paused: ["", "Paused"] }[o.status];
    const reminder = !STORE && S.settings.notifications.bills && o.rule.reminder_days && ["upcoming", "due"].includes(o.status) ? `<span>${ico("bell", "s")} ${o.rule.reminder_days} day${o.rule.reminder_days === 1 ? "" : "s"} before</span>` : "";
    return `<button class="row" data-act="edit-occ" data-id="${o.id}"><span class="cat bill">${ico((cat(o.rule.category_id) || {}).icon || "cal")}</span><div class="grow"><div class="t">${esc(o.rule.name)}</div><div class="s"><span class="chip ${chip[0]}">${chip[1]}</span><span>${FREQ[o.rule.frequency]}</span>${reminder}</div></div><div class="amt ${["paid", "skipped"].includes(o.status) ? "strike" : ""}">${money(o.amount)}</div></button>`;
  }

  function budgetRow(r, compact) {
    const [tone, label] = STATUS_CHIP[r.status];
    const left = r.remaining >= 0 ? `${money(r.remaining)} left` : `${money(-r.remaining)} over`;
    const parts = [`Spent ${money(r.completed)}`];
    if (r.pending) parts.push(`pending ${money(r.pending)}`);
    if (r.scheduled) parts.push(`scheduled ${money(r.scheduled)}`);
    return `<button class="budget-row" data-act="edit-cat" data-id="${r.category.id}" aria-label="${esc(r.category.name)}: ${label}, ${left}">
      <div class="top-line">${compact ? "" : catIcon(r.category)}<span class="name">${esc(r.category.name)}</span><span class="chip ${tone}">${label}</span><span class="num small" style="font-weight:600">${left}</span></div>
      ${budgetBar(r)}
      <div class="figs"><span>${parts.join(" · ")}</span><span>of ${money(r.available)}${r.rolled ? ` (incl. ${money(r.rolled)} rolled over)` : ""}</span></div>
    </button>`;
  }

  // ===== 02 Budget =====
  function renderBudget() {
    const T = today();
    const period = S.settings.period;
    const bs = C.budgetSummary(S, period, T);
    const out = [];
    out.push(seg("set-period", period, [["weekly", "Weekly"], ["fortnightly", "Fortnightly"], ["monthly", "Monthly"]], "Budget period"));
    const un = bs.unassigned;
    const unTone = Math.abs(un) < 100 ? "ok" : un > 0 ? "caution" : "error";
    out.push(`<section class="card" aria-labelledby="plan-h">
      <div class="card-head"><div><span class="eyebrow">${dShort(bs.range.start)} – ${dShort(C.addDays(bs.range.end, -1))}</span><h2 id="plan-h">Give every dollar a job</h2></div></div>
      <div class="rows">
        <div class="row"><div class="grow">Expected income this ${WORD[period]}</div><div class="amt">${money(bs.plannedIncome)}</div></div>
        <div class="row"><div class="grow">Planned spending</div><div class="amt">−${money(bs.planned)}</div></div>
        <div class="row"><div class="grow">Savings goals</div><div class="amt">−${money(bs.savingsPlanned)}</div></div>
        <div class="row total"><div class="grow">${un >= 0 ? "Left to assign" : "Over-assigned"}</div><span class="chip ${unTone}">${unTone === "ok" ? "Every dollar has a job" : un > 0 ? "Give it a job" : "Plan exceeds income"}</span><div class="amt">${money(un)}</div></div>
      </div>
      <p class="tiny muted">Planned amounts are not spending. Only real transactions count as spent.</p>
    </section>`);
    for (const r of bs.alerts) {
      out.push(r.status === "over"
        ? notice("error", `${esc(r.category.name)} is ${money(r.spent - r.available)} over`, `You've spent ${money(r.spent)} of ${money(r.available)} this ${WORD[period]}.`, `<button class="btn small" data-act="transfer-alloc" data-to="${r.category.id}">Move money in</button>`)
        : notice("caution", `${esc(r.category.name)} will go over when scheduled bills come out`, `Spent ${money(r.spent)}, with ${money(r.scheduled)} still scheduled, against ${money(r.available)} planned.`, `<button class="btn small" data-act="transfer-alloc" data-to="${r.category.id}">Move money in</button>`));
    }
    const rows = bs.rows;
    out.push(`<section class="card" aria-labelledby="cats-h">
      <div class="card-head"><h2 id="cats-h">Categories</h2><button class="btn small" data-act="toggle-reorder" aria-pressed="${ui.reorder}">${ui.reorder ? "Done" : "Reorder"}</button></div>
      <div class="legend"><span><i class="done"></i>Completed</span><span><i class="pend"></i>Pending</span><span><i class="sched"></i>Scheduled bills</span></div>
      <div>${ui.reorder
        ? rows.map((r, i) => `<div class="row">${catIcon(r.category)}<div class="grow"><div class="t">${esc(r.category.name)}</div></div><div class="reorder"><button data-act="move-cat" data-id="${r.category.id}" data-dir="-1" aria-label="Move ${esc(r.category.name)} up" ${i === 0 ? "disabled" : ""}>${ico("up", "s")}</button><button data-act="move-cat" data-id="${r.category.id}" data-dir="1" aria-label="Move ${esc(r.category.name)} down" ${i === rows.length - 1 ? "disabled" : ""}>${ico("down", "s")}</button></div></div>`).join("")
        : rows.map((r) => budgetRow(r, false)).join("") || emptyState("pie", "No categories", "Add a category to start planning.")}</div>
      <div class="btn-row"><button class="btn" data-act="add-cat">${ico("plus")}Add category</button><button class="btn" data-act="transfer-alloc">${ico("swap")}Move money</button></div>
    </section>`);
    out.push(`<section class="card"><div class="switch-row"><div class="grow"><b>Roll over unspent money</b><div class="small muted">Money left in a category last ${WORD[period]} is added to this ${WORD[period]}. Overspending isn't carried forward.</div></div>${switchCtl("rollover", S.settings.rollover, "rollover", "", "Roll over unspent money")}</div></section>`);
    const archived = S.categories.filter((c) => c.archived_at && c.type === "expense");
    if (archived.length) {
      out.push(`<section class="card"><details><summary class="bd-line">${ico("chev", "s chev")}<span class="grow">Archived categories (${archived.length})</span></summary>
        <div class="rows">${archived.map((c) => `<div class="row">${catIcon(c)}<div class="grow"><div class="t">${esc(c.name)}</div><div class="s">Archived ${dShort(c.archived_at.slice(0, 10))}. Past transactions keep this category.</div></div><button class="btn small" data-act="unarchive-cat" data-id="${c.id}">Restore</button></div>`).join("")}</div></details></section>`);
    }
    return out.join("");
  }

  // ===== 03 Activity =====
  function filteredTx() {
    const f = ui.af;
    const q = f.q.trim().toLowerCase();
    return S.transactions.filter((t) => {
      if (t.deleted_at) return false;
      if (f.ids) return f.ids.includes(t.id);
      if (f.type !== "all" && t.type !== f.type) return false;
      if (f.source !== "all" && t.source !== f.source) return false;
      if (f.status === "pending" && t.status !== "pending") return false;
      if (f.status === "posted" && t.status !== "posted") return false;
      if (f.status === "excluded" && !["excluded", "reversed"].includes(t.status)) return false;
      if (f.status === "duplicates" && !t.possible_duplicate_of) return false;
      if (f.account !== "all" && t.account_id !== f.account && t.to_account_id !== f.account) return false;
      if (f.category !== "all" && t.category_id !== f.category) return false;
      if (q && ![t.merchant, t.note, t.original_description, catName(t.category_id), acctName(t.account_id)].join(" ").toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => b.date.localeCompare(a.date) || (a.status === "pending" ? -1 : 0));
  }
  function txRow(t) {
    const c = cat(t.category_id);
    const chips = [];
    if (t.status === "pending") chips.push(`<span class="chip caution">Pending</span>`);
    if (t.status === "reversed") chips.push(`<span class="chip">Reversed</span>`);
    if (t.status === "excluded") chips.push(`<span class="chip">Excluded</span>`);
    if (t.possible_duplicate_of) chips.push(`<span class="chip error">Possible duplicate</span>`);
    if (t.refund) chips.push(`<span class="chip ok">Refund</span>`);
    chips.push(t.source === "bank" ? `<span class="chip sample">Bank · demo</span>` : t.source === "csv_import" ? `<span class="chip">CSV import</span>` : `<span class="chip">Manual</span>`);
    if (t.receipt) chips.push(`<span title="Receipt attached">${ico("receipt", "s")}</span>`);
    const amt = t.type === "income" ? `+${money(t.amount)}` : t.type === "transfer" ? money(t.amount) : `−${money(t.amount)}`;
    const sub = t.type === "transfer" ? `${esc(acctName(t.account_id))} → ${esc(acctName(t.to_account_id))}` : `${esc(catName(t.category_id))} · ${esc(acctName(t.account_id))}`;
    return `<button class="row" data-act="tx-detail" data-id="${t.id}"><span class="cat ${t.type === "income" ? "income" : ""}">${ico(t.type === "transfer" ? "swap" : c ? c.icon : "dots")}</span><div class="grow"><div class="t">${esc(t.merchant || "Transaction")}</div><div class="s"><span>${sub}</span>${chips.join("")}</div></div><div class="amt ${t.type === "income" ? "in" : ""} ${["excluded", "reversed"].includes(t.status) ? "strike" : ""}">${amt}</div></button>`;
  }
  function activityListHTML() {
    const list = filteredTx();
    if (!list.length) {
      return S.transactions.some((t) => !t.deleted_at)
        ? emptyState("search", "No matching transactions", "Try a different search or clear your filters.", `<button class="btn small" data-act="af-clear">Clear filters</button>`)
        : emptyState("list", "No transactions yet", "Add your first expense or income, or connect a bank to import them.", `<button class="btn small primary" data-act="add-tx">Add transaction</button>`);
    }
    const shown = list.slice(0, ui.actLimit);
    let html = "", day = null;
    for (const t of shown) {
      if (t.date !== day) { day = t.date; html += `<div class="eyebrow" style="padding:12px 0 4px">${relDay(day)}</div>`; }
      html += txRow(t);
    }
    if (list.length > shown.length) html += `<button class="btn block" style="margin-top:12px" data-act="act-more">Show more (${list.length - shown.length})</button>`;
    return `<p class="tiny muted">${list.length} transaction${list.length === 1 ? "" : "s"}</p><div class="rows">${html}</div>`;
  }
  function renderActivity() {
    const f = ui.af;
    const nFilters = ["source", "status", "account", "category"].filter((k) => f[k] !== "all").length;
    const dups = S.transactions.filter((t) => t.possible_duplicate_of && !t.deleted_at);
    const out = [];
    if (dups.length) out.push(notice("caution", `${dups.length} possible duplicate${dups.length === 1 ? "" : "s"}`, "Some bank transactions match entries you added yourself. Review them so nothing is counted twice.", `<button class="btn small" data-act="review-dups">Review</button>`));
    out.push(`<div class="search">${ico("search", "s")}<input class="input" type="search" id="act-search" placeholder="Search merchant, note or category" aria-label="Search transactions" value="${esc(f.q)}" data-live="search"></div>`);
    out.push(`<div style="display:flex;gap:8px;align-items:center">${seg("af-type", f.type, [["all", "All"], ["expense", "Expenses"], ["income", "Income"], ["transfer", "Transfers"]], "Type")}<button class="icon-btn" data-act="af-sheet" aria-label="More filters${nFilters ? `, ${nFilters} active` : ""}" style="position:relative">${ico("filter")}${nFilters ? `<span class="chip solid" style="position:absolute;top:-6px;right:-6px;padding:0 6px">${nFilters}</span>` : ""}</button></div>`);
    if (f.ids) out.push(`<div class="chips"><button aria-pressed="true" data-act="af-clear">${esc(f.idsLabel)} ${ico("x", "s")}</button></div>`);
    out.push(`<section class="card" id="act-list" aria-label="Transactions">${activityListHTML()}</section>`);
    out.push(`<button class="btn primary fab" data-act="add-tx">${ico("plus")}Add</button>`);
    return out.join("");
  }

  // ===== 04 Goals =====
  function renderGoals() {
    const T = today();
    const st = C.safeToSpend(S, T);
    const goals = S.goals.filter((g) => !g.archived_at);
    const out = [];
    if (!goals.length) {
      out.push(`<section class="card">${emptyState("flag", "No goals yet", "Save for an emergency fund, a car, tuition or anything else.", `<button class="btn primary" data-act="goal-new">Create a goal</button>`)}</section>`);
      return out.join("");
    }
    const total = goals.reduce((s, g) => s + C.goalSaved(S, g), 0);
    out.push(`<section class="card"><div class="stats"><div class="stat"><span class="l">Saved towards goals</span><span class="v">${money(total)}</span></div><div class="stat"><span class="l">Goals</span><span class="v">${goals.length}</span></div><div class="stat"><span class="l">Contributions</span><span class="v">${goals.filter((g) => g.plan && !g.plan.paused).length} active</span></div></div></section>`);
    if (st.S < 0 && st.goals.length) {
      const c = st.goals[0];
      out.push(notice("caution", `${esc(c.goal.name)} clashes with your bills`, `The ${money(c.amount)} transfer on ${relDay(c.date)} happens while you're ${money(-st.S)} short before payday. Pause or lower it until your bills are covered.`, `<button class="btn small" data-act="fix-goal" data-id="${c.goal.id}" data-until="${st.payday}">Pause until payday</button><button class="btn small ghost" data-act="goal-edit" data-id="${c.goal.id}">Change amount</button>`));
    }
    for (const g of goals) {
      const p = C.goalProjection(S, g, T);
      const [kindLabel, kindIcon] = GOAL_KINDS[g.kind] || GOAL_KINDS.custom;
      const reserved = g.account_id ? acct(g.account_id) : null;
      const plan = g.plan;
      const paused = plan && plan.paused;
      const pausedUntil = plan && plan.paused_until && plan.paused_until > T;
      let eta;
      if (p.done) eta = notice("success", "Goal reached", `You've saved ${money(p.saved)}.`);
      else if (!p.eta) eta = `<p class="small muted">${paused ? "Contributions are paused, so there's no completion date." : "Add a contribution to see a completion date."}</p>`;
      else if (g.deadline && !p.onTrack) eta = notice("caution", `Estimated ${dMonth(p.eta)}, after your ${dMonth(g.deadline)} target`, p.neededPerContribution ? `To finish on time, put aside about ${money(p.neededPerContribution)} ${FREQ[plan.frequency].toLowerCase()}.` : "");
      else eta = `<p class="small">Estimated completion <b>${dMonth(p.eta)}</b>${g.deadline ? ` · on track for ${dMonth(g.deadline)}` : ""}</p>`;
      out.push(`<section class="card" aria-labelledby="g-${g.id}">
        <div class="card-head"><div style="display:flex;gap:12px;align-items:center;min-width:0"><span class="cat goal">${ico(kindIcon)}</span><div style="min-width:0"><h2 id="g-${g.id}">${esc(g.name)}</h2><div class="small muted">${kindLabel}</div></div></div>
          <span class="chip ${reserved ? "ok" : ""}">${reserved ? `Reserved · ${esc(reserved.name)}` : "Virtual target"}</span></div>
        <div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px"><span style="font-size:1.5rem;font-weight:700" class="num">${money(p.saved)}</span><span class="small muted num">of ${money(g.target)} · ${Math.round(p.pct * 100)}%</span></div>
        <div class="progress" role="progressbar" aria-label="${esc(g.name)} progress" aria-valuenow="${Math.round(p.pct * 100)}" aria-valuemin="0" aria-valuemax="100"><div style="width:${Math.round(p.pct * 100)}%"></div></div>
        ${eta}
        <p class="small muted">${plan && plan.amount ? `${money(plan.amount)} ${FREQ[plan.frequency].toLowerCase()} from ${esc(acctName(plan.from_account_id))}${paused ? " · <b>paused</b>" : pausedUntil ? ` · paused until ${dShort(plan.paused_until)}` : ` · next ${relDay(nextContribution(g) || plan.next_date)}`}` : "No regular contribution"}</p>
        ${reserved ? "" : `<p class="tiny muted">Virtual target: Pace tracks progress, but the money stays in your everyday account and still counts in Safe to Spend.</p>`}
        <div class="btn-row"><button class="btn small" data-act="goal-add" data-id="${g.id}">${ico("plus", "s")}Add money</button><button class="btn small" data-act="goal-pause" data-id="${g.id}">${ico(paused || pausedUntil ? "resume" : "pause", "s")}${paused || pausedUntil ? "Resume" : "Pause"}</button><button class="btn small" data-act="goal-edit" data-id="${g.id}">Edit</button></div>
      </section>`);
    }
    out.push(`<button class="btn primary block" data-act="goal-new">${ico("plus")}New goal</button>`);
    return out.join("");
  }
  function nextContribution(g) {
    const T = today();
    const due = C.goalContributionsDue(S, T, C.addDays(T, 400)).find((c) => c.goal.id === g.id);
    return due ? due.date : null;
  }

  // ===== 05 Insights =====
  function rangeFor(key) {
    const T = today(), m0 = C.startOfMonth(T);
    if (key === "1m") return { from: m0, to: C.addDays(T, 1), months: 3, label: "this month" };
    if (key === "6m") return { from: C.addMonths(m0, -5), to: C.addDays(T, 1), months: 6, label: "the last 6 months" };
    return { from: C.addMonths(m0, -2), to: C.addDays(T, 1), months: 3, label: "the last 3 months" };
  }
  function renderInsights() {
    const T = today();
    const out = [];
    out.push(seg("ins-range", ui.insRange, [["1m", "This month"], ["3m", "3 months"], ["6m", "6 months"]], "Date range"));
    if (!S.transactions.some((t) => C.isPosted(t))) {
      out.push(`<section class="card">${emptyState("chart", "Not enough data yet", "Insights appear once you have a few weeks of transactions.", `<button class="btn small primary" data-act="add-tx">Add transaction</button>`)}</section>`);
      return out.join("");
    }
    const R = rangeFor(ui.insRange);
    // Explainable insights
    for (const ins of C.buildInsights(S, T, catName)) {
      const txs = ins.txIds.map((id) => S.transactions.find((t) => t.id === id)).filter(Boolean).sort((a, b) => b.date.localeCompare(a.date));
      out.push(`<section class="card">${notice(ins.tone, esc(ins.title), hidden() ? "Amounts are hidden." : esc(ins.detail))}
        <details><summary class="link" style="display:inline-flex">${ico("chev", "s chev")}Based on ${txs.length} transaction${txs.length === 1 ? "" : "s"}, ${dShort(ins.range.from)} – ${dShort(ins.range.to)}</summary>
          <div class="rows" style="padding-top:8px">${txs.slice(0, 6).map(txRow).join("")}</div>
          ${txs.length > 6 ? `<button class="btn small" style="margin-top:8px" data-act="ins-activity" data-key="${ins.id}">View all ${txs.length} in Activity</button>` : ""}
        </details></section>`);
    }
    // Upcoming shortfalls (forward cash flow)
    const fc = C.forecast(S, T);
    out.push(`<section class="card" aria-labelledby="fc-h"><div class="card-head"><h2 id="fc-h">Cash flow, next 6 weeks</h2>${fc.firstNegative ? `<span class="chip error">Shortfall ${dShort(fc.firstNegative.date)}</span>` : fc.firstBelowBuffer ? `<span class="chip caution">Below buffer</span>` : `<span class="chip ok">Clear</span>`}</div>
      ${forecastChart(fc)}
      <div class="legend"><span><i class="line"></i>Projected cash</span><span><i class="dash"></i>Buffer ${money(S.settings.buffer)}</span><span><i class="done" style="width:8px;height:8px;border-radius:50%"></i>Payday</span></div>
      <p class="tiny muted">Source: your available-cash balances today, scheduled bills, goal transfers and expected pay${fc.incomeEstimated ? " (estimated)" : ""}, plus ${money(fc.daily)} a day of planned everyday spending.</p></section>`);
    // Income vs expenses by month
    const months = C.monthlyTotals(S, T, R.months);
    out.push(`<section class="card" aria-labelledby="ie-h"><div class="card-head"><h2 id="ie-h">Income and spending by month</h2></div>
      ${monthChart(months)}
      <div class="legend"><span><i class="done"></i>Income</span><span><i style="background:var(--ink);opacity:.7"></i>Spending</span></div>
      <div class="table-wrap"><table><thead><tr><th>Month</th><th>Income</th><th>Spending</th><th>Net</th><th>Saved</th></tr></thead><tbody>
      ${months.map((m) => `<tr><td>${fmt(m.start, { month: "short" })}${m.partial ? " (so far)" : ""}</td><td>${money0(m.income)}</td><td>${money0(m.expenses)}</td><td class="${m.net < 0 ? "up" : "down"}">${money0(m.net)}</td><td>${m.savingsRate == null ? "–" : Math.round(m.savingsRate * 100) + "%"}</td></tr>`).join("")}
      </tbody></table></div>
      <p class="tiny muted">Saved = income minus spending, as a share of income. Transfers between your accounts aren't counted.</p></section>`);
    // Recurring spending
    const rec = C.recurringSpending(S);
    out.push(`<section class="card" aria-labelledby="rec-h"><div class="card-head"><h2 id="rec-h">Recurring bills</h2><span class="num small" style="font-weight:600">${money(rec.total)} a month</span></div>
      <div class="rows">${rec.items.slice(0, 6).map((x) => `<button class="row" data-act="rule-edit" data-id="${x.rule.id}"><span class="cat bill">${ico((cat(x.rule.category_id) || {}).icon || "cal")}</span><div class="grow"><div class="t">${esc(x.rule.name)}</div><div class="s">${money(x.rule.amount)} ${FREQ[x.rule.frequency].toLowerCase()}</div></div><div class="amt">${money(x.monthly)}<div class="tiny muted">a month</div></div></button>`).join("") || `<p class="small muted">No recurring bills yet.</p>`}</div>
      <p class="tiny muted">Source: your active recurring bills, converted to a monthly amount. One-off bills aren't included.</p></section>`);
    // Spending by category
    const cats = C.spendingByCategory(S, R.from, R.to);
    const total = cats.reduce((s, c) => s + c.total, 0) || 1;
    out.push(`<section class="card" aria-labelledby="sc-h"><div class="card-head"><h2 id="sc-h">Spending by category</h2><span class="small muted">${dShort(R.from)} – ${dShort(C.addDays(R.to, -1))}</span></div>
      ${cats.length ? cats.slice(0, 8).map((c) => `<button class="hbar" style="background:none;border:0;padding:0;text-align:left;cursor:pointer;color:inherit" data-act="ins-cat" data-id="${c.category_id}" aria-label="${esc(catName(c.category_id))}: ${money(c.total)}, view transactions"><div class="line"><span>${esc(catName(c.category_id))}</span><span class="num">${money(c.total)} · ${Math.round((c.total / total) * 100)}%</span></div><div class="track"><div style="width:${(c.total / cats[0].total) * 100}%"></div></div></button>`).join("") : `<p class="small muted">No spending in ${R.label}.</p>`}
      <p class="tiny muted">Tap a category to see its transactions.</p></section>`);
    // Month over month
    const mom = C.monthOverMonth(S, T);
    out.push(`<section class="card" aria-labelledby="mom-h"><div class="card-head"><h2 id="mom-h">Compared with last month</h2></div>
      <p class="tiny muted">${dShort(mom.current.start)} – ${dShort(C.addDays(mom.current.end, -1))} compared with ${dShort(mom.previous.start)} – ${dShort(C.addDays(mom.previous.end, -1))}, so both cover the same number of days.</p>
      <div class="table-wrap"><table><thead><tr><th>Category</th><th>Now</th><th>Then</th><th>Change</th></tr></thead><tbody>
      ${mom.rows.slice(0, 8).map((r) => `<tr><td>${esc(catName(r.category_id))}</td><td>${money0(r.current)}</td><td>${money0(r.previous)}</td><td class="${r.change > 0 ? "up" : r.change < 0 ? "down" : ""}">${r.change > 0 ? "+" : r.change < 0 ? "−" : ""}${money0(Math.abs(r.change))}${r.pct != null ? ` (${r.change >= 0 ? "+" : "−"}${Math.round(Math.abs(r.pct) * 100)}%)` : ""}</td></tr>`).join("")}
      </tbody></table></div></section>`);
    return out.join("");
  }

  function niceStep(span) { return [2000, 5000, 10000, 20000, 25000, 50000, 100000, 200000, 500000].find((s) => span / s <= 5) || 1000000; }
  function forecastChart(fc) {
    const W = 340, H = 170, L = 44, Rr = 8, Tt = 12, B = 22;
    const pts = fc.points;
    const vals = pts.map((p) => p.balance).concat([0, fc.buffer]);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    const step = niceStep(hi - lo || 1);
    lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
    const x = (i) => L + (i / (pts.length - 1)) * (W - L - Rr);
    const y = (v) => Tt + (1 - (v - lo) / (hi - lo || 1)) * (H - Tt - B);
    let g = "";
    for (let v = lo; v <= hi; v += step) g += `<line x1="${L}" x2="${W - Rr}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="${v === 0 ? 1.5 : .8}"/><text x="${L - 6}" y="${y(v) + 3}" text-anchor="end">${hidden() ? "" : C.formatMoney(v, S.user.currency).replace(/\.00$/, "")}</text>`;
    pts.forEach((p, i) => { if (i % 7 === 0) g += `<text x="${x(i)}" y="${H - 6}" text-anchor="${i === 0 ? "start" : "middle"}">${i === 0 ? "Today" : dShort(p.date)}</text>`; });
    const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.balance).toFixed(1)}`).join("");
    const area = `${line}L${x(pts.length - 1).toFixed(1)},${y(lo)}L${L},${y(lo)}Z`;
    const pays = pts.map((p, i) => p.events.some((e) => e.kind === "income") ? `<circle cx="${x(i)}" cy="${y(p.balance)}" r="3.5" fill="var(--sage)" stroke="var(--surface)" stroke-width="1.5"/>` : "").join("");
    const li = pts.indexOf(fc.low);
    const lc = fc.low.balance < 0 ? "var(--error-mark)" : fc.low.balance < fc.buffer ? "var(--caution-mark)" : "var(--sage-ink)";
    const ly = y(fc.low.balance) > H - B - 26 ? y(fc.low.balance) - 9 : y(fc.low.balance) + 16;
    const lx = Math.min(Math.max(x(li), L + 34), W - Rr - 34);
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Projected cash for six weeks. Lowest ${money(fc.low.balance)} on ${dShort(fc.low.date)}.">${g}
      <path d="${area}" fill="var(--sage)" fill-opacity=".14"/>
      <line x1="${L}" x2="${W - Rr}" y1="${y(fc.buffer)}" y2="${y(fc.buffer)}" stroke="var(--caution-mark)" stroke-width="1.2" stroke-dasharray="4 3"/>
      <path d="${line}" fill="none" stroke="var(--sage-ink)" stroke-width="2" stroke-linejoin="round"/>${pays}
      <circle cx="${x(li)}" cy="${y(fc.low.balance)}" r="4.5" fill="${lc}" stroke="var(--surface)" stroke-width="1.5"/>
      <text x="${lx}" y="${ly}" text-anchor="middle" style="fill:${lc};font-weight:700">Low ${money(fc.low.balance)}</text></svg>`;
  }
  function monthChart(months) {
    const W = 340, H = 160, L = 44, Rr = 6, Tt = 10, B = 22;
    const hi0 = Math.max(1, ...months.map((m) => Math.max(m.income, m.expenses)));
    const step = niceStep(hi0);
    const hi = Math.ceil(hi0 / step) * step;
    const y = (v) => Tt + (1 - v / hi) * (H - Tt - B);
    const gw = (W - L - Rr) / months.length, bw = Math.min(18, gw / 3);
    let g = "";
    for (let v = 0; v <= hi; v += step) g += `<line x1="${L}" x2="${W - Rr}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width=".8"/><text x="${L - 6}" y="${y(v) + 3}" text-anchor="end">${hidden() ? "" : C.formatMoney(v, S.user.currency).replace(/\.00$/, "")}</text>`;
    months.forEach((m, i) => {
      const cx = L + gw * i + gw / 2;
      g += `<rect x="${cx - bw - 1}" y="${y(m.income)}" width="${bw}" height="${Math.max(0, y(0) - y(m.income))}" rx="2" fill="var(--sage)"/>`;
      g += `<rect x="${cx + 1}" y="${y(m.expenses)}" width="${bw}" height="${Math.max(0, y(0) - y(m.expenses))}" rx="2" fill="var(--ink)" fill-opacity=".7"/>`;
      g += `<text x="${cx}" y="${H - 6}" text-anchor="middle">${fmt(m.start, { month: "short" })}</text>`;
    });
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Income and spending for ${months.length} months">${g}</svg>`;
  }

  // ===== 07 Accounts =====
  function renderAccounts() {
    const groups = [["Available cash", (a) => a.available_cash && C.canBeAvailableCash(a)], ["Savings", (a) => a.type === "savings" && !a.available_cash], ["Credit cards", (a) => a.type === "credit"], ["Loans", (a) => a.type === "loan"], ["Investments", (a) => a.type === "investment"], ["Other", (a) => a.type === "cash" && !a.available_cash || a.type === "transaction" && !a.available_cash]];
    const live = liveAccounts();
    const assets = live.filter((a) => !C.isLiability(a)).reduce((s, a) => s + C.accountBalance(S, a), 0);
    const debts = live.filter(C.isLiability).reduce((s, a) => s + C.accountBalance(S, a), 0);
    const out = [];
    if (STORE) out.push(notice("info", "Accounts you enter yourself", "Pace doesn't connect to banks. Tap an account to update its balance."));
    else if (!S.connections.some((c) => c.status === "connected")) out.push(notice("sample", "No real bank is connected", "Accounts are entered manually or come from the demo connection. Pace never asks for your banking password."));
    out.push(`<section class="card"><div class="stats"><div class="stat"><span class="l">You own</span><span class="v">${money(assets)}</span></div><div class="stat"><span class="l">You owe</span><span class="v">${money(debts)}</span></div><div class="stat"><span class="l">Net position</span><span class="v">${money(assets - debts)}</span></div></div></section>`);
    for (const [title, test] of groups) {
      const list = live.filter(test);
      if (!list.length) continue;
      out.push(`<section class="card" aria-label="${title}"><h2>${title}</h2><div class="rows">${list.map((a) => {
        const bal = C.accountBalance(S, a);
        const counted = a.available_cash && C.canBeAvailableCash(a);
        const g = a.reserved_for_goal_id ? goalOf(a.reserved_for_goal_id) : null;
        return `<button class="row" data-act="acct-edit" data-id="${a.id}"><span class="cat">${ico(a.type === "credit" ? "card" : a.type === "investment" ? "chart" : a.type === "loan" ? "cap" : a.type === "cash" ? "wallet" : "bank")}</span><div class="grow"><div class="t">${esc(a.name)}${a.mask ? ` ••${esc(a.mask)}` : ""}</div><div class="s"><span>${esc(a.institution)}</span>${freshness(a)}${counted ? `<span class="chip ok">In Safe to Spend</span>` : ""}${g ? `<span class="chip">For ${esc(g.name)}</span>` : ""}</div>${a.note ? `<div class="tiny muted">${esc(a.note)}</div>` : ""}</div><div class="amt">${money(bal)}${C.isLiability(a) ? `<div class="tiny muted">owed</div>` : ""}</div></button>`;
      }).join("")}</div></section>`);
    }
    out.push(`<div class="btn-row"><button class="btn" data-act="acct-new">${ico("plus")}Add account</button></div>`);
    const conns = S.connections;
    if (STORE) return out.join("");
    out.push(`<section class="card"><div class="card-head"><h2>Bank connections</h2><span class="chip sample">Demo only</span></div>
      <div class="rows">${conns.map((c) => `<button class="row" data-act="open" data-sub="connection" data-arg="${c.id}"><span class="cat">${ico("bank")}</span><div class="grow"><div class="t">${esc(c.institution_name)}</div><div class="s">${statePill(c.status)}<span>Demo connection</span></div></div>${ico("chev", "s")}</button>`).join("") || `<p class="small muted">No banks connected. Connecting is optional; you can keep using Pace with manual entries.</p>`}</div>
      <button class="btn primary" data-act="connect-start" ${S.settings.offline ? "disabled" : ""}>${ico("bank")}Connect a bank</button>
      ${S.settings.offline ? `<p class="tiny muted">Connecting needs a connection. You're offline (simulated).</p>` : ""}</section>`);
    return out.join("");
  }
  function statePill(status) {
    const m = { connected: ["check", "Connected"], syncing: ["sync", "Syncing"], failed: ["alert", "Sync failed"], disconnected: ["x", "Disconnected"] }[status];
    return `<span class="state-pill ${status}">${ico(m[0], "s")}${m[1]}</span>`;
  }

  // ===== 08 Bills & calendar =====
  function renderBills() {
    const T = today();
    const fc = C.forecast(S, T, 60);
    const balOn = (d) => { const p = fc.points.find((x) => x.date === d); return p ? p.balance : null; };
    const m0 = ui.calMonth, m1 = C.addMonths(m0, 1);
    const occ = C.billOccurrences(S, C.addDays(m0, -7), C.addDays(m1, 7), T);
    const pays = C.incomeOccurrences(S, C.addDays(m0, -7), C.addDays(m1, 7));
    const gridStart = C.startOfWeek(m0);
    let cells = "";
    for (let i = 0; i < 42; i++) {
      const d = C.addDays(gridStart, i);
      if (i >= 35 && d >= m1) break;
      const dots = occ.filter((o) => o.date === d).map((o) => `<i class="${["paid", "skipped"].includes(o.status) ? "paid" : ""}"></i>`).slice(0, 3).join("") + (pays.some((p) => p.date === d) ? `<i class="pay"></i>` : "");
      const label = `${fmt(d, { weekday: "long", day: "numeric", month: "long" })}${dots ? ", has events" : ""}`;
      cells += `<button data-act="cal-day" data-d="${d}" class="${d < m0 || d >= m1 ? "out" : ""} ${d === T ? "today" : ""}" aria-pressed="${d === ui.calSel}" aria-label="${label}"><span>${C.parseDate(d).getDate()}</span><span class="dots">${dots}</span></button>`;
    }
    const sel = ui.calSel;
    const selOcc = C.billOccurrences(S, sel, C.addDays(sel, 1), T);
    const selPay = C.incomeOccurrences(S, sel, C.addDays(sel, 1));
    const selBal = balOn(sel);
    const out = [];
    out.push(`<section class="card" aria-label="Calendar">
      <div class="card-head"><button class="icon-btn" data-act="cal-nav" data-dir="-1" aria-label="Previous month">${ico("back")}</button><h2>${fmt(m0, { month: "long", year: "numeric" })}</h2><button class="icon-btn" data-act="cal-nav" data-dir="1" aria-label="Next month">${ico("chev")}</button></div>
      <div class="cal">${["M", "T", "W", "T", "F", "S", "S"].map((d) => `<span class="dow" aria-hidden="true">${d}</span>`).join("")}${cells}</div>
      <div class="legend"><span><i style="width:8px;height:8px;border-radius:50%;background:var(--caution-mark)"></i>Bill due</span><span><i style="width:8px;height:8px;border-radius:50%;background:var(--muted)"></i>Paid or skipped</span><span><i class="done" style="width:8px;height:8px;border-radius:50%"></i>Payday</span></div>
    </section>`);
    out.push(`<section class="card" aria-label="Selected day"><div class="card-head"><h2>${relDay(sel)}</h2>${selBal != null ? `<span class="small muted num">Projected cash ${money(selBal)}</span>` : ""}</div>
      <div class="rows">${selPay.map((p) => `<div class="row"><span class="cat income">${ico("wallet")}</span><div class="grow"><div class="t">${esc(p.rule.name)}</div><div class="s">${p.received ? "Received" : p.estimated ? "Expected · estimate" : "Expected"}</div></div><div class="amt in">+${money(p.amount)}</div></div>`).join("")}${selOcc.map(occRow).join("")}</div>
      ${!selOcc.length && !selPay.length ? `<p class="small muted">Nothing scheduled.</p>` : ""}</section>`);
    // Upcoming with forecast balances
    const upcoming = C.billOccurrences(S, C.addDays(T, -14), C.addDays(T, 45), T).filter((o) => ["overdue", "due", "upcoming", "paused"].includes(o.status));
    const groups = {};
    for (const o of upcoming) (groups[o.date < T ? T : o.date] = groups[o.date < T ? T : o.date] || []).push(o);
    out.push(`<section class="card" aria-labelledby="up-h"><div class="card-head"><h2 id="up-h">Next 45 days</h2><button class="btn small" data-act="add-bill">${ico("plus", "s")}Add bill</button></div>
      ${Object.keys(groups).sort().map((d) => { const b = balOn(d); return `<div class="card-head" style="padding-top:8px"><span class="eyebrow">${relDay(d)}</span>${b != null ? `<span class="tiny num ${b < 0 ? "err" : "muted"}">Cash after: ${money(b)}</span>` : ""}</div><div class="rows">${groups[d].map(occRow).join("")}</div>`; }).join("") || emptyState("cal", "No bills coming up", "Add a bill so Pace can plan for it.")}</section>`);
    const paid = C.billOccurrences(S, C.addDays(T, -30), C.addDays(T, 1), T).filter((o) => ["paid", "skipped"].includes(o.status)).reverse();
    if (paid.length) out.push(`<section class="card"><details><summary class="bd-line">${ico("chev", "s chev")}<span class="grow">Paid and skipped, last 30 days (${paid.length})</span></summary><div class="rows">${paid.map(occRow).join("")}</div></details></section>`);
    const incomes = S.recurring.filter((r) => r.kind === "income");
    out.push(`<section class="card"><div class="card-head"><h2>Income</h2><button class="btn small" data-act="income-edit">${ico("plus", "s")}Add income</button></div><div class="rows">${incomes.map((r) => { const nx = C.incomeOccurrences(S, T, C.addDays(T, 400)).find((o) => o.rule.id === r.id && !o.received); return `<button class="row" data-act="income-edit" data-id="${r.id}"><span class="cat income">${ico("wallet")}</span><div class="grow"><div class="t">${esc(r.name)}</div><div class="s"><span>${FREQ[r.frequency]}</span>${r.variable ? `<span class="chip caution">Estimate</span>` : ""}${r.status !== "active" ? `<span class="chip">Paused</span>` : nx ? `<span>Next ${relDay(nx.date)}</span>` : ""}</div></div><div class="amt in">${money(r.amount)}</div></button>`; }).join("") || `<p class="small muted">No income added. Safe to Spend runs to the end of the month until you add your pay.</p>`}</div></section>`);
    const rules = S.recurring.filter((r) => r.kind === "bill");
    out.push(`<section class="card"><h2>All bills</h2><div class="rows">${rules.map((r) => `<button class="row" data-act="rule-edit" data-id="${r.id}"><span class="cat bill">${ico((cat(r.category_id) || {}).icon || "cal")}</span><div class="grow"><div class="t">${esc(r.name)}</div><div class="s"><span>${FREQ[r.frequency]}</span>${r.status !== "active" ? `<span class="chip">${r.status === "paused" ? "Paused" : "Cancelled"}</span>` : ""}${r.end_date ? `<span>Ends ${dShort(r.end_date)}</span>` : ""}</div></div><div class="amt">${money(r.amount)}</div></button>`).join("") || `<p class="small muted">No bills yet.</p>`}</div></section>`);
    return out.join("");
  }

  // ===== 09 Connect a bank (Flow C) =====
  function renderConnect() {
    const c = ui.connect || { step: "intro" };
    const inst = c.inst ? Prov.INSTITUTIONS.find((i) => i.id === c.inst) : null;
    const demo = notice("sample", "Demo connection", "This prototype uses a simulated provider and synthetic data. No real bank is contacted.");
    const steps = ["intro", "choose", "consent", "auth", "review", "reconcile"];
    const idx = Math.max(0, steps.indexOf(c.step === "fetching" ? "auth" : c.step));
    const bar = `<div class="steps" aria-label="Step ${idx + 1} of ${steps.length}">${steps.map((_, i) => `<i class="${i <= idx ? "on" : ""}"></i>`).join("")}</div>`;
    if (c.step === "intro") return `${bar}${demo}<section class="card"><h2>Connect your bank to Pace</h2>
      <div class="rows">
        <div class="row"><span class="cat goal">${ico("shield")}</span><div class="grow"><b>Read-only access</b><div class="small muted">Pace can see balances and transactions. It can't move money.</div></div></div>
        <div class="row"><span class="cat goal">${ico("lock")}</span><div class="grow"><b>You sign in with your bank, not Pace</b><div class="small muted">Pace never sees or stores your banking password.</div></div></div>
        <div class="row"><span class="cat goal">${ico("clock")}</span><div class="grow"><b>You stay in control</b><div class="small muted">Choose what to share, for how long, and disconnect at any time.</div></div></div>
      </div>
      <p class="small muted">In Australia this uses the Consumer Data Right (open banking) through an accredited provider.</p>
      <div class="btn-row"><button class="btn" data-act="back">Not now</button><button class="btn primary" data-act="connect-go" data-step="choose">Continue</button></div></section>`;
    if (c.step === "choose") return `${bar}${demo}<section class="card"><h2>Choose your bank</h2><div class="rows">${provider.listInstitutions().map((i) => `<button class="row" data-act="connect-inst" data-id="${i.id}"><span class="cat">${ico("bank")}</span><div class="grow"><div class="t">${esc(i.name)}</div><div class="s">${i.unavailable ? "Simulates a provider outage" : "Simulated bank"}</div></div>${ico("chev", "s")}</button>`).join("")}</div></section>`;
    if (c.step === "consent") return `${bar}${demo}<section class="card"><h2>Share data from ${esc(inst.name)}?</h2>
      <p class="small">Pace is asking for:</p>
      <div class="rows"><div class="row">${ico("check", "s")}<div class="grow">Account names, numbers and balances</div></div><div class="row">${ico("check", "s")}<div class="grow">Transactions, including pending ones</div></div></div>
      <div class="rows"><div class="row"><div class="grow muted small">How long</div><b>12 months</b></div><div class="row"><div class="grow muted small">Used for</div><b>Budgets, Safe to Spend and forecasts</b></div></div>
      <p class="tiny muted">You can withdraw consent at any time in Settings &amp; privacy. If you withdraw, Pace stops collecting data and you can delete what was imported.</p>
      <div class="btn-row"><button class="btn" data-act="connect-decline">Don't share</button><button class="btn primary" data-act="connect-go" data-step="auth">Continue to ${esc(inst.name)}</button></div></section>`;
    if (c.step === "auth") return `${bar}<div class="handoff" role="region" aria-label="Simulated bank sign-in">
      <span class="eyebrow">Secure handoff · simulated</span>
      <h2>${esc(inst.name)}</h2>
      <p class="small">In the real app, this step opens ${esc(inst.name)}'s own app or website, where you sign in and approve access. Pace receives a consent reference, never your password.</p>
      <div class="btn-row"><button class="btn" data-act="connect-decline">Cancel</button><button class="btn primary" data-act="connect-approve">Approve access</button></div></div>`;
    if (c.step === "fetching") return `${bar}<section class="card" aria-busy="true"><h2>${esc(c.message || "Fetching your accounts…")}</h2><div class="skeleton" style="width:70%"></div><div class="skeleton" style="width:90%"></div><div class="skeleton" style="width:55%"></div><p class="small muted">This usually takes a few seconds.</p></section>`;
    if (c.step === "declined") return `${notice("info", "Nothing was shared", "You declined access, so Pace didn't connect to your bank. You can keep using Pace with manual entries and connect later.")}<div class="btn-row"><button class="btn" data-act="connect-go" data-step="choose">Try again</button><button class="btn primary" data-act="back">Keep entering manually</button></div>`;
    if (c.step === "unavailable" || c.step === "error") return `${notice("error", c.step === "unavailable" ? `${esc(inst ? inst.name : "The bank")} isn't available right now` : "We couldn't finish connecting", `${esc(c.error || "")} Your manual entries are untouched, so you can keep using Pace.`)}<div class="btn-row"><button class="btn" data-act="connect-go" data-step="choose">Choose another bank</button><button class="btn primary" data-act="back">Keep entering manually</button></div>`;
    if (c.step === "review") {
      const preview = C.importProviderTransactions(S, { id: "preview" }, c.feed.transactions, Object.fromEntries(c.accounts.map((a) => [a.account_ref, c.suggest[a.account_ref] && c.suggest[a.account_ref] !== "new" ? c.suggest[a.account_ref] : "__new_" + a.account_ref])), now(), () => uid("p"));
      const pending = c.feed.transactions.filter((t) => t.status === "pending").length;
      return `${bar}${demo}<form data-form="connect-review" class="card"><h2>Review what we found</h2>
        <p class="small muted">${c.accounts.length} account${c.accounts.length === 1 ? "" : "s"} and ${c.feed.transactions.length} recent transaction${c.feed.transactions.length === 1 ? "" : "s"}${pending ? `, ${pending} pending` : ""}.</p>
        ${c.accounts.map((a) => `<div class="field"><span>${esc(a.name)} ••${esc(a.mask)} · ${money(a.balance)}</span><select class="input" name="map_${a.account_ref}">${options([["new", "Add as a new account"], ...liveAccounts().filter((x) => !x.connection_id && x.type === a.type).map((x) => [x.id, "Link to my " + x.name + " account"]), ["skip", "Don't import"]], c.suggest[a.account_ref])}</select></div>`).join("")}
        ${preview.duplicates.length ? notice("caution", `${preview.duplicates.length} possible duplicate${preview.duplicates.length === 1 ? "" : "s"}`, preview.duplicates.map((d) => `${esc(d.merchant)} ${money(d.amount)} on ${dShort(d.date)} matches an entry you added.`).join(" ")) + `<label class="check"><input type="checkbox" name="merge" checked> Merge them with my entries (recommended)</label>` : ""}
        <div class="btn-row"><button type="button" class="btn" data-act="connect-decline">Cancel</button><button class="btn primary">Import</button></div></form>`;
    }
    if (c.step === "reconcile") {
      return `${bar}<form data-form="connect-reconcile" class="card"><h2>Check your balances</h2>
        <p class="small muted">Your bank's balance and Pace's balance don't match yet. This usually means a transaction wasn't entered, or an opening balance was off.</p>
        ${c.reconcile.map((r) => `<fieldset class="card" style="padding:12px"><legend class="small" style="font-weight:600;padding:0 4px">${esc(acctName(r.accountId))}</legend>
          <div class="rows"><div class="row"><div class="grow small">Pace balance</div><div class="amt">${money(r.pace)}</div></div><div class="row"><div class="grow small">Bank balance</div><div class="amt">${money(r.bank)}</div></div></div>
          <label class="check"><input type="radio" name="rec_${r.accountId}" value="bank" checked> Use the bank balance (adjusts by ${money(r.bank - r.pace)})</label>
          <label class="check"><input type="radio" name="rec_${r.accountId}" value="keep"> Keep Pace's balance for now</label></fieldset>`).join("")}
        <button class="btn primary">Finish</button></form>`;
    }
    return "";
  }

  function renderConnection(id) {
    const c = connOf(id);
    if (!c) return emptyState("bank", "Connection not found", "It may have been removed.");
    const accts = S.accounts.filter((a) => a.connection_id === c.id && a.status !== "closed");
    const diffs = accts.map((a) => ({ a, bank: (c.bank_balances || {})[a.mask] })).filter((x) => x.bank != null && x.bank !== C.accountBalance(S, x.a));
    const out = [];
    out.push(notice("sample", "Demo connection", "Simulated data from a mock provider. No real bank account is connected."));
    out.push(`<section class="card" aria-labelledby="conn-h"><div class="card-head"><h2 id="conn-h">${esc(c.institution_name)}</h2>${statePill(c.status)}</div>
      ${c.status === "failed" ? notice("error", "The last sync failed", `${esc(c.last_error || "")} Your data from ${ago(c.last_synced_at)} is still shown.`) : ""}
      ${c.status === "syncing" ? `<div aria-busy="true"><div class="skeleton" style="width:80%"></div></div>` : ""}
      ${c.status === "disconnected" ? notice("info", "Disconnected", `Consent was withdrawn ${c.disconnected_at ? ago(c.disconnected_at) : ""}. Pace is no longer collecting data from this bank.`) : ""}
      <div class="rows">
        <div class="row"><div class="grow small muted">Last successful sync</div><div class="small">${c.last_synced_at ? ago(c.last_synced_at) : "Never"}</div></div>
        <div class="row"><div class="grow small muted">Provider</div><div class="small">${esc(provider.name)}</div></div>
        <div class="row"><div class="grow small muted">Consent reference</div><div class="small num">${esc(c.consent_reference)}</div></div>
        <div class="row"><div class="grow small muted">Consent expires</div><div class="small">${c.consent_expires_at ? fmt(c.consent_expires_at, { day: "numeric", month: "short", year: "numeric" }) : "–"}</div></div>
        <div class="row"><div class="grow small muted">Accounts</div><div class="small">${accts.map((a) => esc(a.name)).join(", ") || "None"}</div></div>
      </div>
      ${c.status !== "disconnected" ? `<div class="btn-row"><button class="btn primary ${c.status === "syncing" ? "loading" : ""}" data-act="sync" data-id="${c.id}" ${S.settings.offline || c.status === "syncing" ? "disabled" : ""}>${c.status === "syncing" ? "Syncing" : c.status === "failed" ? "Try again" : "Sync now"}</button><button class="btn danger" data-act="disconnect" data-id="${c.id}" ${c.status === "syncing" ? "disabled" : ""}>Disconnect</button></div>` : `<button class="btn primary" data-act="connect-start">Connect again</button>`}
      ${S.settings.offline ? `<p class="tiny muted">Sync is paused while you're offline.</p>` : ""}
    </section>`);
    if (diffs.length && c.status !== "disconnected") out.push(notice("caution", "Balances don't match", diffs.map((x) => `${esc(x.a.name)}: Pace ${money(C.accountBalance(S, x.a))}, bank ${money(x.bank)}.`).join(" "), `<button class="btn small" data-act="match-bank" data-id="${c.id}">Use bank balances</button>`));
    if (c.status !== "disconnected") out.push(`<section class="card"><h2>Prototype tools</h2><p class="small muted">Use these to see how Pace handles problems.</p><div class="btn-row"><button class="btn small" data-act="sim-fail" data-id="${c.id}" ${c.status === "syncing" ? "disabled" : ""}>Simulate a failed sync</button></div></section>`);
    if ((c.errors || []).length) out.push(`<section class="card"><h2>Sync history</h2><div class="rows">${c.errors.slice().reverse().map((e) => `<div class="row"><span class="cat">${ico(e.ok ? "check" : "alert")}</span><div class="grow"><div class="t">${esc(e.message)}</div><div class="s">${ago(e.at)}</div></div></div>`).join("")}</div></section>`);
    return out.join("");
  }

  // ===== 10 Settings & privacy =====
  function renderSettings() {
    const n = S.settings.notifications;
    const row = (title, desc, ctl) => `<div class="switch-row"><div class="grow"><b>${title}</b>${desc ? `<div class="small muted">${desc}</div>` : ""}</div>${ctl}</div>`;
    return `
      <section class="card"><h2>Preferences</h2>
        <div class="field">Default budget period${seg("set-period", S.settings.period, [["weekly", "Weekly"], ["fortnightly", "Fortnightly"], ["monthly", "Monthly"]], "Default budget period")}</div>
        <label class="field">Currency<select class="input" data-live="currency">${options([["AUD", "Australian dollar (AUD)"]], S.user.currency)}<option disabled>More currencies later</option></select><span class="hint">Every account and transaction stores its own currency, so more can be added later.</span></label>
        <div class="rows">${row("Safety buffer", `${money(S.settings.buffer)} kept aside in Safe to Spend`, `<button class="btn small" data-act="edit-buffer">Change</button>`)}
        ${row("Hide balances", "Show $••• instead of amounts", switchCtl("set-hide", S.settings.hide_balances, "hide", "", "Hide balances"))}
        ${row("Roll over unspent money", "Carry leftover category money into the next period", switchCtl("set-roll", S.settings.rollover, "rollover", "", "Roll over unspent money"))}</div>
      </section>
      ${STORE ? "" : `<section class="card"><h2>Notifications</h2><div class="rows">
        ${row("Bill reminders", "Before each bill is due, using each bill's reminder setting", switchCtl("n-bills", n.bills, "notif", 'data-key="bills"', "Bill reminders"))}
        ${row("Shortfall alerts", "When the forecast shows you'll run short", switchCtl("n-short", n.shortfall, "notif", 'data-key="shortfall"', "Shortfall alerts"))}
        ${row("Weekly summary", "A Monday recap of last week", switchCtl("n-week", n.weekly_summary, "notif", 'data-key="weekly_summary"', "Weekly summary"))}
      </div><p class="tiny muted">The prototype doesn't send real notifications.</p></section>
      <section class="card"><h2>Security & privacy</h2><div class="rows">
        ${row("App lock", "Ask for Face ID, fingerprint or passcode when Pace opens (simulated)", switchCtl("set-lock", S.settings.app_lock, "applock", "", "App lock"))}
        <div class="switch-row"><div class="grow"><b>Linked providers</b><div class="small muted">${S.connections.length ? S.connections.map((c) => `${esc(c.institution_name)}: ${c.status}`).join(", ") : "None"}</div></div><button class="btn small" data-act="open" data-sub="accounts">Manage</button></div>
      </div><p class="tiny muted">Pace never stores bank passwords. Bank access uses consent references that you can withdraw.</p></section>`}
      <section class="card"><h2>Your data</h2>${notice("info", "Stored on this device only", STORE ? "Pace keeps your data on this phone. It isn't backed up or synced, so deleting the app deletes your data. Export it first if you want a copy." : "This prototype keeps your data in this browser's local storage. It isn't encrypted, backed up or synced to the cloud, so don't enter real bank details.")}<div class="btn-row"><button class="btn" data-act="export">Export my data</button><button class="btn danger" data-act="delete-all">Delete all data</button></div></section>
      ${STORE ? "" : `<section class="card"><h2>Prototype tools</h2><div class="rows">
        ${row("Simulate offline", "See how Pace behaves without a connection", switchCtl("set-offline", S.settings.offline, "offline", "", "Simulate offline"))}
      </div>${guideFlows()}<div class="btn-row"><button class="btn" data-act="reset-sample">Reset sample data</button></div></section>`}`;
  }

  function guideFlows() {
    return `<div class="flows">
      <button class="flow-btn" data-act="start-onboarding"><span class="k">A</span><div><b>First-time setup</b><span>Currency, pay, balances, bills, buffer and a first goal</span></div></button>
      <button class="flow-btn" data-act="add-tx"><span class="k">B</span><div><b>Record an expense</b><span>Watch Budget, Activity and the forecast update</span></div></button>
      ${STORE ? "" : `<button class="flow-btn" data-act="connect-start"><span class="k">C</span><div><b>Connect a bank</b><span>Consent, handoff, import, duplicates and reconciliation</span></div></button>`}
      <button class="flow-btn" data-act="flow-d"><span class="k">D</span><div><b>Avoid a cash shortfall</b><span>See the projected shortfall and the ways to fix it</span></div></button>
    </div>`;
  }
  function renderGuide() {
    $("#guide").innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px"><span class="eyebrow">Interactive prototype · ${fmt(today(), { day: "numeric", month: "long", year: "numeric" })}</span>
      <p class="tag">Know your money. Control your pace.</p>
      <p class="lede">Know what you have, what you owe, and what you can safely spend before your next payday.</p></div>
      <div><h3 style="margin-bottom:8px">Try the core flows</h3>${guideFlows()}</div>
      <div class="formula"><b>Safe to Spend = A − B − G − R</b>
        <code>A  available cash, less pending</code><code>B  unpaid bills before the next payday</code><code>G  planned transfers to savings goals</code><code>R  your safety buffer</code>
        <span class="muted">An estimate, not a guarantee. A negative result is shown as a shortfall.</span></div>
      <p class="small muted">${S && S.sample ? "All data is sample data for a made-up student, Mia. " : ""}Bank connections use a simulated provider. Nothing here reads or moves real money.</p>`;
  }

  // ===== 06 Onboarding (Flow A) =====
  function onbDefaults() {
    const T = today();
    return {
      step: 0,
      a: {
        name: "", email: "", currency: "AUD", payFrequency: "fortnightly", pay: null, payName: "Pay", nextPay: C.addDays(T, 7), variable: true,
        everyday: null, savings: 0, cash: 0, buffer: 10000,
        bills: [
          { key: "rent", name: "Rent", on: true, amount: null, frequency: "weekly", next: C.addDays(T, 3) },
          { key: "phone", name: "Phone", on: true, amount: null, frequency: "monthly", next: C.addDays(T, 10) },
          { key: "internet", name: "Internet", on: false, amount: null, frequency: "monthly", next: C.addDays(T, 14) },
          { key: "power", name: "Electricity", on: false, amount: null, frequency: "quarterly", next: C.addDays(T, 30) },
          { key: "transport", name: "Transport", on: false, amount: null, frequency: "fortnightly", next: C.addDays(T, 5) },
          { key: "subs", name: "Subscriptions", on: false, amount: null, frequency: "monthly", next: C.addDays(T, 12) },
        ],
        goal: { kind: "emergency", name: "Emergency fund", target: 100000, perPay: 2000 }, skipGoal: false,
      },
    };
  }
  function renderOnboarding() {
    $("#tabs").hidden = true;
    const o = ui.onb || (ui.onb = onbDefaults());
    const a = o.a;
    const total = 6;
    $("#top").innerHTML = o.step > 0 ? `<button class="icon-btn" data-act="onb-back" aria-label="Back">${ico("back")}</button><h1 class="title">Set up Pace</h1><span class="small muted">Step ${o.step} of ${total}</span>` : `<div class="wordmark">${ico("pace")}<span>Pace</span></div>`;
    const bar = o.step > 0 ? `<div class="steps" aria-hidden="true">${Array.from({ length: total }, (_, i) => `<i class="${i < o.step ? "on" : ""}"></i>`).join("")}</div>` : "";
    let body = "";
    if (o.step === 0) {
      body = `<div style="display:flex;flex-direction:column;gap:12px;padding-top:12px"><svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="var(--sage-ink)" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">${ICONS.pace}</svg>
        <h1 style="font-size:2rem;line-height:1.1">Know your money. Control your pace.</h1>
        <p class="muted">Pace shows how much you can safely spend before your next payday, after your bills and savings.</p></div>
        <form data-form="onb" class="card" novalidate>
          <label class="field">Your first name<input class="input" name="name" autocomplete="given-name" value="${esc(a.name)}"></label>
          <label class="field">Email<input class="input" type="email" name="email" autocomplete="email" value="${esc(a.email)}"><span class="hint">This prototype doesn't create a real account or send anything.</span></label>
          <button class="btn primary">Create account</button>
        </form>
        <div class="btn-row"><button class="btn" data-act="onb-sample">Explore with sample data</button>${S ? `<button class="btn ghost" data-act="onb-cancel">Cancel</button>` : ""}</div>`;
    } else if (o.step === 1) {
      body = `<form data-form="onb" class="card" novalidate><h2>Where do you live?</h2>
        <label class="field">Country<select class="input" name="country"><option value="AU" selected>Australia</option><option disabled>More countries later</option></select></label>
        <label class="field">Currency<select class="input" name="currency"><option value="AUD" selected>Australian dollar (AUD)</option></select></label>
        <p class="small muted">Pace starts with Australia and AUD. Amounts are stored with their currency so others can be added later.</p>
        <button class="btn primary">Continue</button></form>`;
    } else if (o.step === 2) {
      body = `<form data-form="onb" class="card" novalidate><h2>How are you paid?</h2>
        <div class="field">How often${seg("onb-freq", a.payFrequency, [["weekly", "Weekly"], ["fortnightly", "Fortnightly"], ["monthly", "Monthly"]], "Pay frequency")}</div>
        ${moneyField("pay", "Take-home pay each time", a.pay != null ? plain(a.pay) : "", { required: true, placeholder: "950.00" })}
        <label class="field">Next payday<input class="input" type="date" name="nextPay" value="${a.nextPay}" required></label>
        <label class="check"><input type="checkbox" name="variable" ${a.variable ? "checked" : ""}> My pay changes (shifts, casual or gig work). Pace will label pay amounts as estimates.</label>
        <p class="err" id="onb-err"></p><button class="btn primary">Continue</button></form>`;
    } else if (o.step === 3) {
      body = `<form data-form="onb" class="card" novalidate><h2>What do you have right now?</h2>
        ${moneyField("everyday", "Everyday account balance", a.everyday != null ? plain(a.everyday) : "", { required: true, placeholder: "540.00" })}
        ${moneyField("savings", "Savings account", a.savings ? plain(a.savings) : "", { placeholder: "0.00", hint: "(optional, not counted as spendable)" })}
        ${moneyField("cash", "Cash on hand", a.cash ? plain(a.cash) : "", { placeholder: "0.00", hint: "(optional)" })}
        <p class="err" id="onb-err"></p><button class="btn primary">Continue</button></form>`;
    } else if (o.step === 4) {
      body = `<form data-form="onb" class="card" novalidate><h2>Which bills do you pay?</h2><p class="small muted">Tick the ones you have and add the amount and next due date.</p>
        ${a.bills.map((b, i) => `<fieldset class="card" style="padding:12px;gap:10px"><label class="check"><input type="checkbox" name="on_${i}" ${b.on ? "checked" : ""}> <b>${esc(b.name)}</b></label>
          <div class="grid2">${moneyField("amt_" + i, "Amount", b.amount != null ? plain(b.amount) : "", { placeholder: "0.00" })}<label class="field">How often<select class="input" name="freq_${i}">${options(["weekly", "fortnightly", "monthly", "quarterly"].map((f) => [f, FREQ[f]]), b.frequency)}</select></label></div>
          <label class="field">Next due<input class="input" type="date" name="next_${i}" value="${b.next}"></label></fieldset>`).join("")}
        <button type="button" class="btn" data-act="onb-add-bill">${ico("plus", "s")}Add another bill</button>
        <p class="err" id="onb-err"></p><button class="btn primary">Continue</button></form>`;
    } else if (o.step === 5) {
      const g = a.goal || {};
      body = `<form data-form="onb" class="card" novalidate><h2>Protect and progress</h2>
        ${moneyField("buffer", "Safety buffer", plain(a.buffer), { hint: "Kept aside for surprises. Most people start with $50 to $200." })}
        <h3 style="padding-top:8px">Your first savings goal</h3>
        <div class="chips" role="group" aria-label="Goal type">${Object.entries(GOAL_KINDS).map(([k, [l]]) => `<button type="button" data-act="onb-goal-kind" data-v="${k}" aria-pressed="${!a.skipGoal && g.kind === k}">${l}</button>`).join("")}<button type="button" data-act="onb-goal-kind" data-v="skip" aria-pressed="${a.skipGoal}">Skip for now</button></div>
        ${a.skipGoal ? "" : `<label class="field">Goal name<input class="input" name="goalName" value="${esc(g.name || "")}" required></label>
        <div class="grid2">${moneyField("goalTarget", "Target", g.target ? plain(g.target) : "", { required: true })}${moneyField("goalPer", "Each payday", g.perPay ? plain(g.perPay) : "", { required: true })}</div>`}
        <p class="err" id="onb-err"></p><button class="btn primary">Continue</button></form>`;
    } else if (o.step === 6) {
      const alloc = Seed.suggestAllocations({ ...a, goal: a.skipGoal ? null : a.goal });
      o.alloc = o.alloc || alloc;
      const preview = Seed.fromOnboarding({ ...a, goal: a.skipGoal ? null : a.goal, allocations: o.alloc }, today());
      const st = C.safeToSpend(preview, today());
      const planned = Object.values(o.alloc).reduce((s, v) => s + v, 0);
      const left = a.pay - planned - (a.skipGoal ? 0 : a.goal.perPay);
      body = `<section class="card hero ${st.status}"><span class="eyebrow">Your Safe to Spend until ${fmt(st.payday)}</span><div class="hero-amt">${amountSplit(st.S)}</div><p class="small">${st.S > 0 ? `${money(st.perDay)} a day.` : "You're short before payday. You can change bills or your buffer later."} Based on what you entered.</p></section>
        <form data-form="onb" class="card" novalidate><h2>Review your ${WORD[a.payFrequency]}ly budget</h2><p class="small muted">Bills come first, then your goal. What's left is split across everyday spending. Change anything you like.</p>
        ${Object.entries(o.alloc).map(([cid, v]) => `<div class="row" style="padding-block:6px"><div class="grow">${esc(catNameAny(cid))}</div><span class="money-wrap" style="width:120px"><span>$</span><input class="input money" name="alloc_${cid}" inputmode="decimal" value="${plain(v)}" aria-label="${esc(catNameAny(cid))} per ${WORD[a.payFrequency]}"></span></div>`).join("")}
        <div class="row total"><div class="grow">Left to assign</div><div class="amt">${money(left)}</div></div>
        <button class="btn primary">Go to my dashboard</button></form>`;
    }
    view.innerHTML = `<div class="flow">${bar}${body}</div>`;
  }
  // Category names exist before a state does (onboarding preview).
  const BASE_CATS = Seed.baseCategories();
  const catNameAny = (id) => (S && cat(id) ? cat(id).name : (BASE_CATS.find((c) => c.id === id) || { name: id }).name);

  function onbSubmit(form) {
    const o = ui.onb, a = o.a;
    const fd = new FormData(form);
    const err = (m) => { const e = $("#onb-err", form); if (e) e.textContent = m; };
    if (o.step === 0) { a.name = fd.get("name").trim(); a.email = fd.get("email").trim(); }
    if (o.step === 2) {
      const pay = C.parseMoney(fd.get("pay"));
      if (!(pay > 0)) return err("Enter your take-home pay.");
      if (!fd.get("nextPay") || fd.get("nextPay") < today()) return err("Choose today or a later date for your next payday.");
      a.pay = pay; a.nextPay = fd.get("nextPay"); a.variable = !!fd.get("variable");
    }
    if (o.step === 3) {
      const e = C.parseMoney(fd.get("everyday"));
      if (Number.isNaN(e)) return err("Enter your everyday balance. Use 0 if it's empty.");
      a.everyday = e; a.savings = Math.max(0, C.parseMoney(fd.get("savings")) || 0); a.cash = Math.max(0, C.parseMoney(fd.get("cash")) || 0);
    }
    if (o.step === 4) {
      for (let i = 0; i < a.bills.length; i++) {
        const b = a.bills[i];
        b.on = !!fd.get("on_" + i); b.amount = C.parseMoney(fd.get("amt_" + i)); b.frequency = fd.get("freq_" + i); b.next = fd.get("next_" + i);
        if (Number.isNaN(b.amount)) b.amount = null;
        if (b.on && !(b.amount > 0)) return err(`Add an amount for ${b.name}, or untick it.`);
        if (b.on && !b.next) return err(`Add the next due date for ${b.name}.`);
      }
    }
    if (o.step === 5) {
      const buf = C.parseMoney(fd.get("buffer"));
      a.buffer = Number.isNaN(buf) ? 0 : Math.max(0, buf);
      if (!a.skipGoal) {
        const t = C.parseMoney(fd.get("goalTarget")), p = C.parseMoney(fd.get("goalPer"));
        if (!(t > 0)) return err("Enter a target above $0, or skip the goal.");
        if (Number.isNaN(p) || p < 0) return err("Enter how much to put aside each payday.");
        a.goal = { ...a.goal, name: fd.get("goalName").trim() || GOAL_KINDS[a.goal.kind][0], target: t, perPay: p };
      }
      o.alloc = null;
    }
    if (o.step === 6) {
      const alloc = {};
      for (const [k, v] of fd.entries()) if (k.startsWith("alloc_")) alloc[k.slice(6)] = Math.max(0, C.parseMoney(v) || 0);
      const answers = { ...a, bills: a.bills.filter((b) => b.on), goal: a.skipGoal ? null : a.goal, allocations: alloc };
      S = Seed.fromOnboarding(answers, today());
      ui.onb = null; ui.stack = []; ui.tab = "home";
      render(); window.scrollTo(0, 0);
      toast("You're set up. This is your own data, saved only in this browser.");
      return;
    }
    o.step++;
    render(); window.scrollTo(0, 0);
  }

  // ---------- forms in sheets ----------
  function txForm(t, preset) {
    const isNew = !t;
    t = t || { type: (preset && preset.type) || "expense", date: today(), account_id: (cashAccounts()[0] || liveAccounts()[0] || {}).id };
    const bank = t.source === "bank";
    const type = t.type;
    const fromAccts = liveAccounts().filter((a) => a.type !== "investment" && a.type !== "loan");
    const toAccts = liveAccounts();
    const catsFor = (ty) => S.categories.filter((c) => c.type === (ty === "income" ? "income" : "expense") && (!c.archived_at || c.id === t.category_id)).sort((x, y) => x.order - y.order);
    ui.receiptDraft = undefined;
    openSheet(isNew ? "Add transaction" : "Edit transaction", `<form data-form="tx" data-id="${isNew ? "" : t.id}" novalidate>
      ${bank ? notice("info", "Imported from your bank (demo)", "Amount, date and account come from the bank. You can change the label, category and note.") : ""}
      <input type="hidden" name="type" value="${type}">
      ${bank ? "" : seg("tx-type", type, [["expense", "Expense"], ["income", "Income"], ["transfer", "Transfer"]], "Transaction type")}
      ${moneyField("amount", "Amount", t.amount ? plain(t.amount) : "", { required: true, placeholder: "0.00", disabled: bank })}
      <div class="grid2">
        <label class="field" data-show="expense income transfer"><span data-label-from>${type === "transfer" ? "From" : "Account"}</span><select class="input" name="account_id" ${bank ? "disabled" : ""}>${options(fromAccts.map((a) => [a.id, a.name]), t.account_id)}</select></label>
        <label class="field" data-show="transfer" ${type === "transfer" ? "" : "hidden"}>To<select class="input" name="to_account_id">${options(toAccts.map((a) => [a.id, a.name]), t.to_account_id || (toAccts.find((a) => a.id !== t.account_id) || {}).id)}</select></label>
        <label class="field" data-show="expense income" ${type === "transfer" ? "hidden" : ""}>Category<select class="input" name="category_id" data-cats>${options(catsFor(t.refund ? "expense" : type).map((c) => [c.id, c.name]), t.category_id)}</select></label>
      </div>
      <label class="check" data-show="income" ${type === "income" ? "" : "hidden"}><input type="checkbox" name="refund" ${t.refund ? "checked" : ""}> This is a refund for something I bought. It lowers spending in that category instead of counting as income.</label>
      <label class="field">${type === "income" ? "From" : "Merchant or payee"}<input class="input" name="merchant" value="${esc(t.merchant || "")}" maxlength="60" autocomplete="off"></label>
      <div class="grid2"><label class="field">Date<input class="input" type="date" name="date" value="${t.date}" ${bank ? "disabled" : ""} required></label>
      ${isNew ? `<label class="field" data-show="expense income">Repeats<select class="input" name="repeat">${options([["none", "Doesn't repeat"], ["weekly", "Weekly"], ["fortnightly", "Fortnightly"], ["monthly", "Monthly"]], "none")}</select></label>` : ""}</div>
      <label class="field">Note<input class="input" name="note" value="${esc(t.note || "")}" maxlength="120" autocomplete="off"></label>
      <div class="field">Receipt<input type="file" accept="image/*,application/pdf" id="receipt-input" data-live="receipt" class="input"><div id="receipt-preview">${t.receipt ? receiptHTML(t.receipt) : ""}</div></div>
      <div id="dup-warn"></div>
      <p class="err" id="tx-err"></p>
      <button class="btn primary">${isNew ? "Save" : "Save changes"}</button>
    </form>`, {
      onMount: (el) => {
        el.addEventListener("click", (e) => {
          const b = e.target.closest("[data-act=tx-type]");
          if (!b) return;
          const v = b.dataset.v;
          $$("[data-act=tx-type]", el).forEach((x) => x.setAttribute("aria-pressed", x === b));
          $("[name=type]", el).value = v;
          $$("[data-show]", el).forEach((f) => (f.hidden = !f.dataset.show.split(" ").includes(v)));
          $("[data-label-from]", el).textContent = v === "transfer" ? "From" : "Account";
          $("[data-cats]", el).innerHTML = options(catsFor(v === "income" && $("[name=refund]", el).checked ? "expense" : v).map((c) => [c.id, c.name]));
          $("#dup-warn", el).innerHTML = "";
        });
        $("[name=refund]", el).addEventListener("change", (e) => {
          $("[data-cats]", el).innerHTML = options(catsFor(e.target.checked ? "expense" : "income").map((c) => [c.id, c.name]));
        });
      },
    });
  }
  const receiptHTML = (r) => r.dataUrl ? `<img class="receipt" src="${r.dataUrl}" alt="Receipt photo: ${esc(r.name)}">` : `<span class="chip">${ico("receipt", "s")}${esc(r.name)}</span>`;

  function txSubmit(form, submitter) {
    const fd = new FormData(form);
    const id = form.dataset.id;
    const existing = id ? S.transactions.find((t) => t.id === id) : null;
    const bank = existing && existing.source === "bank";
    const type = fd.get("type");
    const t = existing ? { ...existing } : { id: uid("t"), source: "manual", status: "posted", currency: S.user.currency };
    if (!bank) {
      t.type = type;
      t.amount = C.parseMoney(fd.get("amount"));
      t.account_id = fd.get("account_id");
      t.date = fd.get("date");
      t.to_account_id = type === "transfer" ? fd.get("to_account_id") : null;
    }
    t.category_id = t.type === "transfer" ? (existing ? existing.category_id : null) : fd.get("category_id");
    t.refund = t.type === "income" && !!fd.get("refund");
    t.merchant = fd.get("merchant").trim() || (t.type === "transfer" ? "Transfer to " + acctName(t.to_account_id) : catName(t.category_id));
    t.note = fd.get("note").trim();
    if (ui.receiptDraft !== undefined) t.receipt = ui.receiptDraft;
    const errs = C.validateTransaction(t, S);
    if (errs.length) { $("#tx-err").textContent = errs.join(" "); return; }
    if (!existing && !(submitter && submitter.dataset.dupok)) {
      const dups = C.findPossibleDuplicates(S, t);
      if (dups.length) {
        const d = dups[0];
        $("#dup-warn").innerHTML = notice("caution", "This might be a duplicate", `You already have ${esc(d.merchant)} for ${money(d.amount)} on ${dShort(d.date)} in ${esc(acctName(d.account_id))}.`, `<button class="btn small" data-dupok="1" type="submit">Save anyway</button><button class="btn small ghost" type="button" data-act="close-sheet">Don't save</button>`);
        return;
      }
    }
    let next = C.upsertTransaction(S, t, now());
    const repeat = fd.get("repeat");
    if (!existing && repeat && repeat !== "none" && t.type !== "transfer" && !t.refund) {
      const rule = { id: uid("r"), kind: t.type === "income" ? "income" : "bill", name: t.merchant, amount: t.amount, frequency: repeat, start_date: t.date, status: "active", account_id: t.account_id, category_id: t.category_id, reminder_days: 2, variable: false };
      next = { ...next, recurring: [...next.recurring, rule], transactions: next.transactions.map((x) => x.id === t.id ? { ...x, [t.type === "income" ? "income_rule_id" : "bill_occurrence_id"]: t.type === "income" ? rule.id : C.occurrenceId(rule.id, t.date) } : x) };
    }
    // A transfer into a goal's reserved account is a contribution, not spending.
    const toAcct = t.type === "transfer" && acct(t.to_account_id);
    if (!existing && toAcct && toAcct.reserved_for_goal_id) next = { ...next, contributions: [...next.contributions, { id: uid("k"), goal_id: toAcct.reserved_for_goal_id, amount: t.amount, date: t.date, occurrence_id: null, transaction_id: t.id }] };
    closeSheet();
    apply(existing ? "Changes saved." : t.type === "expense" ? "Expense added." : t.refund ? "Refund added." : t.type === "income" ? "Income added." : "Transfer added.", next, { undoable: !existing });
  }

  function txDetail(id) {
    const t = S.transactions.find((x) => x.id === id);
    if (!t) return;
    const bank = t.source === "bank";
    const occ = t.bill_occurrence_id ? t.bill_occurrence_id.split("@") : null;
    const dup = t.possible_duplicate_of ? S.transactions.find((x) => x.id === t.possible_duplicate_of) : null;
    const rows = [
      ["Date", fmt(t.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })],
      ["Type", { expense: "Expense", income: "Income", transfer: "Transfer" }[t.type]],
      [t.type === "transfer" ? "From" : "Account", esc(acctName(t.account_id))],
      ...(t.type === "transfer" ? [["To", esc(acctName(t.to_account_id))]] : []),
      ["Status", { posted: "Completed", pending: "Pending: may still change", reversed: "Reversed by the bank", excluded: "Excluded" + (t.excluded_reason ? `: ${esc(t.excluded_reason)}` : "") }[t.status]],
      ["Source", bank ? "Imported from bank (demo connection)" : t.source === "csv_import" ? "CSV import" : "Added by you"],
      ...(bank ? [["Bank description", `<span class="num">${esc(t.original_description)}</span>`]] : []),
      ...(occ ? [["Pays bill", `${esc((ruleOf(occ[0]) || { name: "Bill" }).name)} due ${dShort(occ[1])}`]] : []),
      ...(t.note ? [["Note", esc(t.note)]] : []),
    ];
    const catsSame = S.categories.filter((c) => c.type === (t.type === "income" ? "income" : "expense") && !c.archived_at);
    openSheet(esc(t.merchant || "Transaction"), `
      <div style="font-size:2rem;font-weight:700" class="num ${["excluded", "reversed"].includes(t.status) ? "muted" : ""}">${t.type === "income" ? "+" : t.type === "expense" ? "−" : ""}${money(t.amount)}</div>
      ${dup ? notice("caution", "Possible duplicate", `This bank transaction matches ${esc(dup.merchant)} (${money(dup.amount)}, ${dShort(dup.date)}) that you added yourself.`, `<button class="btn small" data-act="dup-merge" data-id="${t.id}">Merge</button><button class="btn small ghost" data-act="dup-keep" data-id="${t.id}">Keep both</button>`) : ""}
      <div class="rows">${rows.map(([k, v]) => `<div class="row"><div class="grow small muted">${k}</div><div class="small" style="text-align:right">${v}</div></div>`).join("")}</div>
      ${t.receipt ? `<div class="field">Receipt${receiptHTML(t.receipt)}</div>` : ""}
      ${t.type !== "transfer" && !["excluded", "reversed"].includes(t.status) ? `<form data-form="recat" data-id="${t.id}" class="card" style="padding:12px;gap:10px">
        <label class="field">Category<select class="input" name="category_id">${options(catsSame.map((c) => [c.id, c.name]), t.category_id)}</select></label>
        ${t.merchant ? `<label class="check"><input type="checkbox" name="remember"> Always use this for ${esc(t.merchant)}</label>` : ""}
        <button class="btn small">Update category</button></form>` : ""}
      ${(t.audit || []).length ? `<details><summary class="link">${ico("chev", "s chev")}Change history (${t.audit.length})</summary><div class="rows" style="padding-top:6px">${t.audit.slice().reverse().map((a) => `<div class="row"><div class="grow small">${a.changes.map((c) => `${esc(c.field.replace("_id", ""))}: ${esc(fmtAudit(c.field, c.from))} → ${esc(fmtAudit(c.field, c.to))}`).join("; ")}</div><div class="tiny muted">${ago(a.at)}</div></div>`).join("")}</div></details>` : ""}
      <div class="btn-row">
        <button class="btn" data-act="tx-edit" data-id="${t.id}">${ico("edit", "s")}Edit</button>
        ${bank ? (t.status === "excluded" ? `<button class="btn" data-act="tx-include" data-id="${t.id}">Include again</button>` : `<button class="btn danger" data-act="tx-exclude" data-id="${t.id}">Exclude</button>`) : `<button class="btn danger" data-act="tx-delete" data-id="${t.id}">Delete</button>`}
      </div>
      ${bank ? `<p class="tiny muted">Bank records can't be deleted, but you can exclude them from budgets and Safe to Spend.</p>` : ""}`);
  }
  function fmtAudit(field, v) {
    if (v == null) return "none";
    if (field === "amount") return money(v);
    if (field === "category_id") return catName(v);
    if (field === "account_id" || field === "to_account_id") return acctName(v);
    return String(v);
  }

  function ruleForm(r) {
    const isNew = !r;
    const T = today();
    const nextDue = r ? ((C.billOccurrences(S, C.addDays(T, -14), C.addDays(T, 400), T).find((o) => o.rule_id === r.id && ["overdue", "due", "upcoming", "paused"].includes(o.status)) || {}).date || r.start_date) : C.addDays(T, 7);
    r = r || { name: "", amount: null, frequency: "monthly", category_id: "c_other", account_id: (cashAccounts()[0] || {}).id, reminder_days: 2, status: "active" };
    openSheet(isNew ? "Add bill" : "Edit bill", `<form data-form="rule" data-id="${isNew ? "" : r.id}" data-orig-next="${nextDue}" novalidate>
      <label class="field">Name<input class="input" name="name" value="${esc(r.name)}" maxlength="40" required placeholder="e.g. Tuition instalment"></label>
      <div class="grid2">${moneyField("amount", "Amount", r.amount ? plain(r.amount) : "", { required: true, placeholder: "0.00" })}
      <label class="field">Repeats<select class="input" name="frequency">${options(C.FREQUENCIES.map((f) => [f, FREQ[f]]), r.frequency)}</select></label></div>
      <div class="grid2"><label class="field">Next due<input class="input" type="date" name="next" value="${nextDue}" required></label>
      <label class="field" ${STORE ? "hidden" : ""}>Remind me<select class="input" name="reminder">${options([["0", "No reminder"], ["1", "1 day before"], ["2", "2 days before"], ["3", "3 days before"], ["7", "1 week before"]], String(r.reminder_days || 0))}</select></label></div>
      <div class="grid2"><label class="field">Category<select class="input" name="category_id">${options(S.categories.filter((c) => c.type === "expense" && !c.archived_at).map((c) => [c.id, c.name]), r.category_id)}</select></label>
      <label class="field">Paid from<select class="input" name="account_id">${options(liveAccounts().filter((a) => a.type !== "investment" && a.type !== "loan").map((a) => [a.id, a.name]), r.account_id)}</select></label></div>
      ${isNew ? "" : `<div class="field">Status${seg("rule-status", r.status, [["active", "Active"], ["paused", "Paused"], ["cancelled", "Cancelled"]], "Bill status")}<input type="hidden" name="status" value="${r.status}"></div>`}
      <p class="err" id="rule-err"></p>
      <button class="btn primary">${isNew ? "Add bill" : "Save bill"}</button>
    </form>`, {
      onMount: (el) => el.addEventListener("click", (e) => {
        const b = e.target.closest("[data-act=rule-status]");
        if (!b) return;
        $$("[data-act=rule-status]", el).forEach((x) => x.setAttribute("aria-pressed", x === b));
        $("[name=status]", el).value = b.dataset.v;
      }),
    });
  }
  function ruleSubmit(form) {
    const fd = new FormData(form);
    const id = form.dataset.id;
    const name = fd.get("name").trim(), amount = C.parseMoney(fd.get("amount")), next = fd.get("next");
    if (!name || !(amount > 0) || !next) { $("#rule-err").textContent = "Add a name, an amount above $0 and the next due date."; return; }
    const base = { name, amount, frequency: fd.get("frequency"), category_id: fd.get("category_id"), account_id: fd.get("account_id"), reminder_days: Number(fd.get("reminder")) };
    let nextState;
    if (!id) {
      if (next < today()) { $("#rule-err").textContent = "Choose today or a later date."; return; }
      nextState = { ...S, recurring: [...S.recurring, { id: uid("r"), kind: "bill", status: "active", start_date: next, ...base }] };
    } else {
      const old = ruleOf(id);
      const moved = next !== form.dataset.origNext;
      nextState = { ...S, recurring: S.recurring.map((r) => r.id === id ? { ...r, ...base, status: fd.get("status") || r.status, start_date: moved ? next : r.start_date, end_date: old.end_date && moved && next > old.end_date ? null : old.end_date } : r) };
    }
    closeSheet();
    apply(id ? "Bill updated." : "Bill added.", nextState, { undoable: true });
  }

  function occSheet(occId) {
    const [ruleId, date] = occId.split("@");
    const r = ruleOf(ruleId);
    if (!r) return;
    const o = C.billOccurrences(S, date, C.addDays(date, 1), today()).find((x) => x.id === occId) || { status: "upcoming", amount: r.amount, date, rule: r };
    const linked = o.linked_transaction_id ? S.transactions.find((t) => t.id === o.linked_transaction_id) : null;
    const label = { upcoming: "Upcoming", due: "Due today", overdue: "Overdue", paid: "Paid", skipped: "Skipped", paused: "Paused" }[o.status];
    openSheet(esc(r.name), `
      <div style="font-size:2rem;font-weight:700" class="num">${money(o.amount)}</div>
      <div class="rows">
        <div class="row"><div class="grow small muted">Due</div><div class="small">${fmt(date, { weekday: "long", day: "numeric", month: "long" })}</div></div>
        <div class="row"><div class="grow small muted">Status</div><div class="small">${label}</div></div>
        <div class="row"><div class="grow small muted">Repeats</div><div class="small">${FREQ[r.frequency]}${r.end_date ? ` until ${dShort(r.end_date)}` : ""}</div></div>
        <div class="row"><div class="grow small muted">Paid from</div><div class="small">${esc(acctName(r.account_id))}</div></div>
        ${linked ? `<div class="row"><div class="grow small muted">Payment</div><div class="small">${esc(linked.merchant)} on ${dShort(linked.date)} (${linked.source === "bank" ? "from bank" : "added by you"})</div></div>` : ""}
      </div>
      ${o.status === "paid" ? notice("success", "Paid", "This bill is matched to a payment, so Safe to Spend doesn't deduct it again.") : ""}
      <div class="btn-row">
        ${["upcoming", "due", "overdue"].includes(o.status) ? `<button class="btn primary" data-act="occ-pay" data-id="${occId}">Mark as paid</button><button class="btn" data-act="occ-skip" data-id="${occId}">Skip this one</button>` : ""}
        ${o.status === "paid" ? `<button class="btn" data-act="occ-unpay" data-id="${occId}">Mark as unpaid</button>` : ""}
        ${o.status === "skipped" ? `<button class="btn" data-act="occ-unskip" data-id="${occId}">Undo skip</button>` : ""}
        <button class="btn" data-act="rule-edit" data-id="${r.id}">${ico("edit", "s")}Edit bill</button>
      </div>
      <p class="tiny muted">Marking as paid records a payment from ${esc(acctName(r.account_id))}. If your bank later imports the same payment, Pace links them instead of counting it twice.</p>`);
  }

  function incomeForm(r) {
    const isNew = !r;
    const T = today();
    const nextPay = r ? ((C.incomeOccurrences(S, T, C.addDays(T, 400)).find((o) => o.rule.id === r.id && !o.received) || {}).date || r.start_date) : C.addDays(T, 7);
    r = r || { name: "Pay", amount: null, frequency: "fortnightly", variable: false, account_id: (cashAccounts()[0] || {}).id, status: "active" };
    openSheet(isNew ? "Add income" : "Edit income", `<form data-form="income" data-id="${isNew ? "" : r.id}" data-orig-next="${nextPay}" novalidate>
      <label class="field">Name<input class="input" name="name" value="${esc(r.name)}" maxlength="40" required></label>
      <div class="grid2">${moneyField("amount", "Take-home amount", r.amount ? plain(r.amount) : "", { required: true, placeholder: "0.00" })}
      <label class="field">How often<select class="input" name="frequency">${options([["weekly", "Weekly"], ["fortnightly", "Fortnightly"], ["monthly", "Monthly"]], r.frequency)}</select></label></div>
      <div class="grid2"><label class="field">Next payday<input class="input" type="date" name="next" value="${nextPay}" required></label>
      <label class="field">Paid into<select class="input" name="account_id">${options(cashAccounts().map((a) => [a.id, a.name]), r.account_id)}</select></label></div>
      <label class="check"><input type="checkbox" name="variable" ${r.variable ? "checked" : ""}> This amount changes (shifts or casual work). Pace will label it as an estimate.</label>
      ${isNew ? "" : `<label class="field">Status<select class="input" name="status">${options([["active", "Active"], ["paused", "Paused (not expected)"]], r.status)}</select></label>`}
      <p class="err" id="inc-err"></p>
      <button class="btn primary">${isNew ? "Add income" : "Save"}</button>
    </form>`);
  }
  function resForm(r) {
    openSheet(r ? "Edit set-aside" : "Set money aside", `<form data-form="res" data-id="${r ? r.id : ""}" novalidate>
      <label class="field">What it's for<input class="input" name="name" value="${esc(r ? r.name : "")}" maxlength="50" required placeholder="e.g. Paying Sam back"></label>
      ${moneyField("amount", "Amount", r ? plain(r.amount) : "", { required: true, placeholder: "0.00" })}
      <p class="small muted">Set-asides are subtracted from Safe to Spend until you release them. No money moves.</p>
      <p class="err" id="res-err"></p>
      <button class="btn primary">${r ? "Save" : "Set aside"}</button>
      ${r ? `<button type="button" class="btn" data-act="res-release" data-id="${r.id}">Release this money</button>` : ""}
    </form>`);
  }

  function goalForm(g) {
    const isNew = !g;
    const T = today();
    const st = C.safeToSpend(S, T);
    g = g || { kind: "emergency", name: "", target: null, deadline: "", account_id: null, starting_amount: 0, plan: { amount: null, frequency: "fortnightly", next_date: st.noIncome ? C.addDays(T, 7) : st.payday, from_account_id: (cashAccounts()[0] || {}).id, paused: false } };
    const savings = liveAccounts().filter((a) => a.type === "savings" && (!a.reserved_for_goal_id || a.reserved_for_goal_id === g.id));
    const funding = g.account_id ? "reserved" : isNew ? (savings.length ? "reserved" : "new") : "virtual";
    openSheet(isNew ? "New goal" : "Edit goal", `<form data-form="goal" data-id="${isNew ? "" : g.id}" novalidate>
      <input type="hidden" name="kind" value="${g.kind}">
      <div class="chips" role="group" aria-label="Goal type">${Object.entries(GOAL_KINDS).map(([k, [l]]) => `<button type="button" data-act="goal-kind" data-v="${k}" aria-pressed="${g.kind === k}">${l}</button>`).join("")}</div>
      <label class="field">Name<input class="input" name="name" value="${esc(g.name)}" maxlength="40" placeholder="${esc(GOAL_KINDS[g.kind][0])}" data-live="goal-check"></label>
      <div class="grid2">${moneyField("target", "Target", g.target ? plain(g.target) : "", { required: true, live: "goal-check" })}<label class="field">Target date <span class="hint">(optional)</span><input class="input" type="date" name="deadline" value="${g.deadline || ""}" data-live="goal-check"></label></div>
      <h3>Contribution</h3>
      <div class="grid2">${moneyField("amount", "Amount", g.plan && g.plan.amount ? plain(g.plan.amount) : "", { live: "goal-check", placeholder: "0.00" })}<label class="field">How often<select class="input" name="frequency" data-live="goal-check">${options([["weekly", "Weekly"], ["fortnightly", "Fortnightly"], ["monthly", "Monthly"]], g.plan ? g.plan.frequency : "fortnightly")}</select></label></div>
      <div class="grid2"><label class="field">Starting<input class="input" type="date" name="next_date" value="${g.plan ? g.plan.next_date : T}" data-live="goal-check"></label><label class="field">From<select class="input" name="from_account_id" data-live="goal-check">${options(cashAccounts().map((a) => [a.id, a.name]), g.plan && g.plan.from_account_id)}</select></label></div>
      <fieldset class="field" style="border:0;padding:0;margin:0"><legend style="margin-bottom:6px">Where the money goes</legend>
        ${savings.length ? `<label class="check"><input type="radio" name="funding" value="reserved" ${funding === "reserved" ? "checked" : ""} data-live="goal-check"> <span>Reserved account: <select class="input" name="account_id" style="margin-top:6px">${options(savings.map((a) => [a.id, a.name]), g.account_id)}</select></span></label>` : ""}
        <label class="check"><input type="radio" name="funding" value="new" ${funding === "new" ? "checked" : ""} data-live="goal-check"> New savings account for this goal</label>
        <label class="check"><input type="radio" name="funding" value="virtual" ${funding === "virtual" ? "checked" : ""} data-live="goal-check"> Virtual target (money stays in your everyday account)</label>
      </fieldset>
      <div id="goal-conflict"></div>
      <p class="err" id="goal-err"></p>
      <button class="btn primary">${isNew ? "Create goal" : "Save goal"}</button>
      ${isNew ? "" : `<button type="button" class="btn danger" data-act="goal-delete" data-id="${g.id}">Delete goal</button>`}
    </form>`, {
      onMount: (el) => {
        el.addEventListener("click", (e) => {
          const b = e.target.closest("[data-act=goal-kind]");
          if (!b) return;
          $$("[data-act=goal-kind]", el).forEach((x) => x.setAttribute("aria-pressed", x === b));
          $("[name=kind]", el).value = b.dataset.v;
          $("[name=name]", el).placeholder = GOAL_KINDS[b.dataset.v][0];
        });
        goalCheck($("form", el));
      },
    });
  }
  function goalFromForm(form) {
    const fd = new FormData(form);
    const id = form.dataset.id || "g_new";
    const old = form.dataset.id ? goalOf(form.dataset.id) : null;
    const kind = fd.get("kind");
    const funding = fd.get("funding");
    return {
      ...(old || {}), id, kind, name: fd.get("name").trim() || GOAL_KINDS[kind][0], target: C.parseMoney(fd.get("target")), deadline: fd.get("deadline") || null,
      account_id: funding === "reserved" ? fd.get("account_id") : funding === "new" ? "__new" : null, funding,
      plan: { ...((old && old.plan) || {}), amount: Math.max(0, C.parseMoney(fd.get("amount")) || 0), frequency: fd.get("frequency"), next_date: fd.get("next_date"), from_account_id: fd.get("from_account_id"), paused: old && old.plan ? old.plan.paused : false },
    };
  }
  // Warns when a planned contribution would collide with upcoming bills.
  function goalCheck(form) {
    const g = goalFromForm(form);
    const out = $("#goal-conflict");
    if (!out) return;
    if (!(g.plan.amount > 0) || !g.plan.next_date) { out.innerHTML = ""; return; }
    let probe = S, probeGoal = { ...g };
    if (g.funding === "new") {
      probe = { ...S, accounts: [...S.accounts, { id: "__new", type: "savings", opening_balance: 0, available_cash: false, status: "active" }] };
      probeGoal.account_id = "__new";
    }
    const conflict = C.contributionConflict(probe, probeGoal, today());
    out.innerHTML = conflict
      ? notice("caution", "This contribution clashes with upcoming bills", conflict.kind === "payday" ? `You'd be ${money(conflict.amount)} short before payday on ${dShort(conflict.date)}.` : conflict.kind === "worsens" ? `You already have a projected shortfall on ${dShort(conflict.date)}. This contribution makes it ${money(conflict.amount)} deeper. Try a later start date.` : `Your cash could go ${money(conflict.amount)} below $0 on ${dShort(conflict.date)}. Try a smaller amount or a later start date.`)
      : (g.funding === "virtual" ? "" : notice("success", "No clash with your bills", "Your forecast stays above $0 with this contribution."));
  }
  function goalSubmit(form) {
    const g = goalFromForm(form);
    if (!(g.target > 0)) { $("#goal-err").textContent = "Enter a target above $0."; return; }
    if (g.plan.amount > 0 && !g.plan.next_date) { $("#goal-err").textContent = "Choose when contributions start."; return; }
    const isNew = !form.dataset.id;
    let next = S;
    const gid = isNew ? uid("g") : g.id;
    let accountId = g.account_id;
    if (g.funding === "new") {
      accountId = uid("a");
      next = { ...next, accounts: [...next.accounts, { id: accountId, name: g.name + " saver", institution: "Entered by you", type: "savings", currency: S.user.currency, opening_balance: 0, available_cash: false, reserved_for_goal_id: gid, status: "active", source: "manual", updated_at: now() }] };
    }
    // Release a previously reserved account if the goal moved elsewhere.
    next = { ...next, accounts: next.accounts.map((a) => a.reserved_for_goal_id === gid && a.id !== accountId ? { ...a, reserved_for_goal_id: null } : a.id === accountId ? { ...a, reserved_for_goal_id: gid, available_cash: false } : a) };
    const goal = { ...g, id: gid, account_id: accountId, created_at: g.created_at || today(), starting_amount: g.starting_amount || 0 };
    delete goal.funding;
    next = { ...next, goals: isNew ? [...next.goals, goal] : next.goals.map((x) => (x.id === gid ? goal : x)) };
    closeSheet();
    if (isNew) { ui.tab = "goals"; ui.stack = []; }
    apply(isNew ? `${goal.name} created.` : "Goal updated.", next, { undoable: true });
  }

  function goalAddSheet(id) {
    const g = goalOf(id);
    openSheet(`Add money to ${esc(g.name)}`, `<form data-form="goal-add" data-id="${id}" novalidate>
      ${moneyField("amount", "Amount", "", { required: true, placeholder: "0.00" })}
      <label class="field">Date<input class="input" type="date" name="date" value="${today()}"></label>
      ${g.account_id ? `<label class="field">From<select class="input" name="from">${options(cashAccounts().map((a) => [a.id, a.name]), g.plan && g.plan.from_account_id)}</select></label><p class="small muted">Pace records a transfer to ${esc(acctName(g.account_id))}. Transfers aren't counted as spending.</p>` : `<p class="small muted">This is a virtual target, so no money moves. Pace just records your progress.</p>`}
      <p class="err" id="ga-err"></p><button class="btn primary">Add</button></form>`);
  }

  function catForm(c) {
    const isNew = !c;
    const period = S.settings.period;
    c = c || { name: "", flexible: true, icon: "dots" };
    const planned = isNew ? 0 : (S.allocations[period] || {})[c.id] || 0;
    openSheet(isNew ? "Add category" : "Edit category", `<form data-form="cat" data-id="${isNew ? "" : c.id}" novalidate>
      <label class="field">Name<input class="input" name="name" value="${esc(c.name)}" maxlength="30" required></label>
      ${moneyField("planned", `Planned per ${WORD[period]}`, planned ? plain(planned) : "", { placeholder: "0.00", hint: "Weekly, fortnightly and monthly plans are kept in step." })}
      <label class="check"><input type="checkbox" name="flexible" ${c.flexible ? "checked" : ""}> Everyday spending (used for the daily forecast). Untick for fixed bills.</label>
      <p class="err" id="cat-err"></p>
      <button class="btn primary">${isNew ? "Add category" : "Save"}</button>
      ${isNew ? "" : `<button type="button" class="btn" data-act="archive-cat" data-id="${c.id}">Archive category</button><p class="tiny muted">Archiving hides it from budgets and new transactions. Past transactions keep it.</p>`}
    </form>`);
  }

  function transferAllocSheet(toId) {
    const period = S.settings.period;
    const bs = C.budgetSummary(S, period, today());
    const rows = bs.rows;
    const from = rows.filter((r) => r.category.id !== toId).sort((a, b) => b.remaining - a.remaining)[0];
    openSheet("Move money between categories", `<form data-form="xfer" novalidate>
      <p class="small muted">Changes your ${WORD[period]}ly plan. No real money moves.</p>
      <label class="field">From<select class="input" name="from">${options(rows.map((r) => [r.category.id, `${r.category.name} (${money(r.remaining)} left)`]), from && from.category.id)}</select></label>
      <label class="field">To<select class="input" name="to">${options(rows.map((r) => [r.category.id, `${r.category.name} (${money(r.remaining)} left)`]), toId || (rows[0] && rows[0].category.id))}</select></label>
      ${moneyField("amount", "Amount", "", { required: true, placeholder: "0.00" })}
      <p class="err" id="xfer-err"></p><button class="btn primary">Move</button></form>`);
  }

  function acctForm(a) {
    const isNew = !a;
    a = a || { name: "", type: "transaction", institution: "", available_cash: true };
    const bank = !!a.connection_id;
    const bal = isNew ? null : C.accountBalance(S, a);
    openSheet(isNew ? "Add account" : esc(a.name), `<form data-form="acct" data-id="${isNew ? "" : a.id}" novalidate>
      ${bank ? notice("sample", "Linked to a demo connection", "The balance comes from the simulated bank.") : ""}
      <label class="field">Name<input class="input" name="name" value="${esc(a.name)}" maxlength="30" required></label>
      <div class="grid2"><label class="field">Type<select class="input" name="type" ${isNew ? "" : "disabled"}>${options(Object.entries(TYPE_NAMES), a.type)}</select></label>
      <label class="field">Institution<input class="input" name="institution" value="${esc(a.institution || "")}" maxlength="30"></label></div>
      ${moneyField("balance", C.isLiability(a) ? "Amount owed" : "Current balance", bal != null ? plain(bal) : "", { required: true, disabled: bank })}
      <div class="switch-row"><div class="grow"><b>Count as available cash</b><div class="small muted">${C.canBeAvailableCash(a) ? "Included in Safe to Spend" + (a.reserved_for_goal_id ? `. This account is reserved for ${esc((goalOf(a.reserved_for_goal_id) || {}).name || "a goal")}, so counting it would let you spend your savings.` : ".") : "Credit, loans and investments are never counted as spendable cash."}</div></div>${switchCtl("acct-cash", a.available_cash && C.canBeAvailableCash(a), "", `name="available_cash" ${C.canBeAvailableCash(a) ? "" : "disabled"}`, "Count as available cash")}</div>
      <p class="err" id="acct-err"></p>
      <button class="btn primary">${isNew ? "Add account" : "Save"}</button>
      ${isNew || bank ? "" : `<button type="button" class="btn danger" data-act="acct-close" data-id="${a.id}">Close account</button>`}
    </form>`);
  }

  // ---------- bank sync ----------
  async function syncConnection(id) {
    let c = connOf(id);
    if (!c || S.settings.offline) return;
    const setConn = (patch) => { S = { ...S, connections: S.connections.map((x) => (x.id === id ? { ...x, ...patch } : x)) }; };
    setConn({ status: "syncing" });
    render();
    try {
      const feed = await provider.fetchTransactions(c.consent_reference, c.sync_cursor);
      const accts = await provider.fetchAccounts(c.consent_reference, feed.next_cursor - 1);
      c = connOf(id);
      const res = C.importProviderTransactions(S, c, feed.transactions, c.account_map, now(), () => uid("t"));
      S = C.autoMatchBills(res.state, today());
      setConn({ status: "connected", sync_cursor: feed.next_cursor, last_synced_at: now(), last_error: null, bank_balances: Object.fromEntries(accts.map((a) => [a.mask, a.balance])), errors: [...(c.errors || []), { at: now(), ok: true, message: `Synced: ${res.added.length} new, ${res.updated.length} updated` }] });
      render();
      toast(res.added.length || res.updated.length ? `Synced. ${res.added.length} new, ${res.updated.length} updated.` : "Synced. Nothing new.");
    } catch (e) {
      c = connOf(id);
      setConn({ status: "failed", last_error: e.message, errors: [...(c.errors || []), { at: now(), ok: false, code: e.code, message: e.message }] });
      render();
      toast("Sync failed. Your existing data is still here.");
    }
  }

  async function connectApprove() {
    const c = ui.connect;
    ui.connect = { ...c, step: "fetching", message: "Waiting for " + Prov.INSTITUTIONS.find((i) => i.id === c.inst).name + "…" };
    render();
    try {
      const consent = await provider.authorize(c.inst, { approve: true });
      ui.connect = { ...ui.connect, message: "Fetching your accounts and transactions…" };
      render();
      const accounts = await provider.fetchAccounts(consent.consent_reference, 0);
      const feed = await provider.fetchTransactions(consent.consent_reference, 0);
      const suggest = {};
      for (const a of accounts) {
        const match = liveAccounts().find((x) => !x.connection_id && x.type === a.type && x.name.toLowerCase() === a.name.toLowerCase());
        suggest[a.account_ref] = match ? match.id : "new";
      }
      ui.connect = { ...ui.connect, step: "review", consent, accounts, feed, suggest };
    } catch (e) {
      ui.connect = { ...ui.connect, step: e.code === "provider_unavailable" ? "unavailable" : e.code === "consent_declined" ? "declined" : "error", error: e.message };
    }
    render();
  }
  async function connectDecline() {
    const c = ui.connect;
    ui.connect = { ...c, step: "fetching", message: "Cancelling…" };
    render();
    try { await provider.authorize(c.inst, { approve: false }); } catch (e) { /* declining always rejects */ }
    ui.connect = { ...ui.connect, step: "declined" };
    render();
  }
  function connectImport(form) {
    const c = ui.connect;
    const fd = new FormData(form);
    const inst = Prov.INSTITUTIONS.find((i) => i.id === c.inst);
    const conn = { id: uid("bc"), provider: provider.id, institution_id: inst.id, institution_name: inst.name, status: "connected", consent_reference: c.consent.consent_reference, consent_expires_at: c.consent.expires_at, created_at: now(), last_synced_at: now(), sync_cursor: 1, account_map: {}, errors: [{ at: now(), ok: true, message: "Connected and imported" }], simulated: true, bank_balances: Object.fromEntries(c.accounts.map((a) => [a.mask, a.balance])) };
    let next = S;
    const created = [], linked = [];
    for (const a of c.accounts) {
      const choice = fd.get("map_" + a.account_ref);
      if (choice === "skip") continue;
      if (choice === "new") {
        const id = uid("a");
        next = { ...next, accounts: [...next.accounts, { id, name: a.name, institution: inst.name, type: a.type, currency: a.currency, opening_balance: a.balance, available_cash: a.type === "transaction", status: "active", source: "bank", connection_id: conn.id, created_by_connection: conn.id, mask: a.mask, updated_at: now() }] };
        conn.account_map[a.account_ref] = id; created.push({ id, balance: a.balance });
      } else {
        next = { ...next, accounts: next.accounts.map((x) => (x.id === choice ? { ...x, source: "bank", connection_id: conn.id, mask: a.mask } : x)) };
        conn.account_map[a.account_ref] = choice; linked.push({ id: choice, balance: a.balance });
      }
    }
    next = { ...next, connections: [...next.connections.filter((x) => x.institution_id !== inst.id || x.status !== "disconnected"), conn] };
    const res = C.importProviderTransactions(next, conn, c.feed.transactions, conn.account_map, now(), () => uid("t"));
    next = res.state;
    if (fd.get("merge")) for (const d of res.duplicates) next = C.resolveDuplicate(next, d.id, "merge", now());
    for (const x of created) next = C.reconcileAccount(next, x.id, x.balance, now());
    S = C.autoMatchBills(next, today());
    const reconcile = linked.map((x) => ({ accountId: x.id, bank: x.balance, pace: C.accountBalance(S, acct(x.id)) })).filter((x) => x.bank !== x.pace);
    ui.connect = { ...c, connId: conn.id, imported: res.added.length, dups: res.duplicates.length, merged: !!fd.get("merge") };
    if (reconcile.length) { ui.connect.step = "reconcile"; ui.connect.reconcile = reconcile; render(); }
    else finishConnect();
  }
  function finishConnect() {
    const c = ui.connect;
    ui.connect = null;
    ui.stack = ui.stack.filter((s) => s.name !== "connect");
    ui.stack.push({ name: "connection", arg: c.connId });
    render(); window.scrollTo(0, 0);
    toast(`Demo Bank connected (simulated). Imported ${c.imported} transactions${c.dups ? `, ${c.merged ? "merged" : "found"} ${c.dups} duplicate${c.dups === 1 ? "" : "s"}` : ""}.`);
  }

  // ---------- export ----------
  function exportSheet() {
    const clean = JSON.parse(JSON.stringify(S));
    clean.transactions.forEach((t) => { if (t.receipt && t.receipt.dataUrl) t.receipt = { name: t.receipt.name, note: "image omitted from export" }; });
    const json = JSON.stringify(clean, null, 2);
    const csvEsc = (v) => { const s = String(v == null ? "" : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const csv = [["date", "type", "amount", "currency", "account", "to_account", "category", "merchant", "status", "source", "note"].join(",")]
      .concat(S.transactions.filter((t) => !t.deleted_at).sort((a, b) => a.date.localeCompare(b.date)).map((t) => [t.date, t.type, plain(t.amount), t.currency, acctName(t.account_id), t.to_account_id ? acctName(t.to_account_id) : "", t.category_id ? catName(t.category_id) : "", t.merchant, t.status, t.source, t.note].map(csvEsc).join(","))).join("\n");
    openSheet("Export my data", `
      ${seg("export-fmt", "csv", [["csv", "Transactions (CSV)"], ["json", "Everything (JSON)"]], "Export format")}
      <label class="field"><span id="export-label">Copy this into a spreadsheet or a file.</span><textarea class="input" id="export-text" readonly>${esc(csv)}</textarea></label>
      <button class="btn primary" data-act="copy-export">Copy to clipboard</button>
      <p class="tiny muted">The real app would save a file. This prototype shows the data so you can copy it.</p>`, {
      onMount: (el) => el.addEventListener("click", (e) => {
        const b = e.target.closest("[data-act=export-fmt]");
        if (!b) return;
        $$("[data-act=export-fmt]", el).forEach((x) => x.setAttribute("aria-pressed", x === b));
        $("#export-text").value = b.dataset.v === "csv" ? csv : json;
      }),
    });
  }

  // ---------- lock ----------
  function renderLock() {
    $("#lock").innerHTML = `<svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">${ICONS.lock}</svg><h1>Pace is locked</h1><p style="opacity:.85">Unlock with Face ID, fingerprint or your passcode.</p><button class="btn on-dark" style="background:rgba(245,245,239,.14);color:inherit;border-color:rgba(245,245,239,.3)" data-act="unlock">Unlock (simulated)</button>`;
  }

  // ---------- event wiring ----------
  const SCREENS = { home: renderHome, budget: renderBudget, activity: renderActivity, goals: renderGoals, insights: renderInsights };
  const SUBS = { accounts: renderAccounts, bills: renderBills, connect: renderConnect, connection: renderConnection, settings: renderSettings };

  const ACTIONS = {
    "close-sheet": closeSheet,
    back,
    open: (el) => openSub(el.dataset.sub, el.dataset.arg),
    "toggle-hide": () => { S = { ...S, settings: { ...S.settings, hide_balances: !S.settings.hide_balances } }; render(); },
    "set-period": (el) => { S = { ...S, settings: { ...S.settings, period: el.dataset.v } }; render(); },
    dismiss: (el) => { S = { ...S, dismissed: { ...S.dismissed, [el.dataset.key]: true } }; render(); },
    unlock: () => { ui.locked = false; render(); },
    "sts-window": (el) => { S = { ...S, settings: { ...S.settings, sts_window: el.dataset.v } }; render(); const b = $(`[data-act=sts-window][data-v=${el.dataset.v}]`); if (b) b.focus(); },
    "income-edit": (el) => { closeSheet(); incomeForm(el.dataset.id ? ruleOf(el.dataset.id) : null); },
    "res-edit": (el) => resForm(el.dataset.id ? (S.reservations || []).find((r) => r.id === el.dataset.id) : null),
    "res-release": (el) => { const id = el.dataset.id; closeSheet(); apply("Set-aside released.", { ...S, reservations: S.reservations.map((r) => r.id === id ? { ...r, released_at: now() } : r) }, { undoable: true }); },

    "add-tx": (el) => { closeSheet(); txForm(null, { type: el.dataset.type }); },
    "tx-detail": (el) => txDetail(el.dataset.id),
    "tx-edit": (el) => txForm(S.transactions.find((t) => t.id === el.dataset.id)),
    "tx-delete": (el) => {
      const id = el.dataset.id;
      confirmDialog({ title: "Delete this transaction?", body: "It will be removed from Activity, budgets and Safe to Spend. You can undo straight after.", confirm: "Delete", danger: true,
        onConfirm: () => apply("Transaction deleted.", C.softDeleteTransaction(S, id, now()), { undoable: true }) });
    },
    "tx-exclude": (el) => { const id = el.dataset.id; closeSheet(); apply("Excluded from budgets.", { ...S, transactions: S.transactions.map((t) => t.id === id ? { ...t, status: "excluded", excluded_reason: "Excluded by you", bill_occurrence_id: null, audit: [...(t.audit || []), { at: now(), changes: [{ field: "status", from: t.status, to: "excluded" }] }] } : t) }, { undoable: true }); },
    "tx-include": (el) => { const id = el.dataset.id; closeSheet(); apply("Included again.", { ...S, transactions: S.transactions.map((t) => t.id === id ? { ...t, status: "posted", excluded_reason: null, audit: [...(t.audit || []), { at: now(), changes: [{ field: "status", from: "excluded", to: "posted" }] }] } : t) }); },
    "dup-merge": (el) => { closeSheet(); apply("Merged. Counted once.", C.resolveDuplicate(S, el.dataset.id, "merge", now()), { undoable: true }); },
    "dup-keep": (el) => { closeSheet(); apply("Kept both.", C.resolveDuplicate(S, el.dataset.id, "keep", now()), { undoable: true }); },
    "review-dups": () => {
      const dups = S.transactions.filter((t) => t.possible_duplicate_of && !t.deleted_at);
      openSheet("Possible duplicates", dups.map((t) => { const m = S.transactions.find((x) => x.id === t.possible_duplicate_of); return `<div class="card" style="padding:12px"><div class="rows"><div class="row"><div class="grow"><div class="t">${esc(t.merchant)}</div><div class="s"><span class="chip sample">Bank · demo</span>${dShort(t.date)} · ${esc(t.original_description)}</div></div><div class="amt">${money(t.amount)}</div></div>${m ? `<div class="row"><div class="grow"><div class="t">${esc(m.merchant)}</div><div class="s"><span class="chip">Manual</span>${dShort(m.date)}${m.note ? " · " + esc(m.note) : ""}</div></div><div class="amt">${money(m.amount)}</div></div>` : ""}</div><div class="btn-row"><button class="btn small primary" data-act="dup-merge" data-id="${t.id}">Merge</button><button class="btn small" data-act="dup-keep" data-id="${t.id}">Keep both</button></div></div>`; }).join("") + `<p class="tiny muted">Merging keeps the bank record and your category and note, and excludes your manual copy.</p>`);
    },
    "af-type": (el) => { ui.af.type = el.dataset.v; ui.af.ids = null; ui.actLimit = 60; render(); },
    "af-clear": () => { ui.af = { q: "", type: "all", source: "all", status: "all", account: "all", category: "all", ids: null, idsLabel: "" }; render(); },
    "af-sheet": () => {
      const f = ui.af;
      openSheet("Filter transactions", `<form data-form="filters">
        <label class="field">Source<select class="input" name="source">${options([["all", "All sources"], ["bank", "Bank (demo)"], ["manual", "Added by you"], ["csv_import", "CSV import"]], f.source)}</select></label>
        <label class="field">Status<select class="input" name="status">${options([["all", "All"], ["posted", "Completed"], ["pending", "Pending"], ["excluded", "Reversed or excluded"], ["duplicates", "Possible duplicates"]], f.status)}</select></label>
        <label class="field">Account<select class="input" name="account">${options([["all", "All accounts"], ...liveAccounts().map((a) => [a.id, a.name])], f.account)}</select></label>
        <label class="field">Category<select class="input" name="category">${options([["all", "All categories"], ...S.categories.filter((c) => !c.archived_at).map((c) => [c.id, c.name])], f.category)}</select></label>
        <div class="btn-row"><button type="button" class="btn" data-act="af-reset">Reset</button><button class="btn primary">Show results</button></div></form>`);
    },
    "af-reset": () => { closeSheet(); ACTIONS["af-clear"](); },
    "act-more": () => { ui.actLimit += 60; render(); },

    "add-bill": () => ruleForm(null),
    "rule-edit": (el) => { closeSheet(); ruleForm(ruleOf(el.dataset.id)); },
    "edit-occ": (el) => occSheet(el.dataset.id),
    "occ-pay": (el) => {
      const [rid, date] = el.dataset.id.split("@");
      const r = ruleOf(rid);
      const t = { id: uid("t"), type: r.pay_to_account_id ? "transfer" : "expense", amount: r.amount, account_id: r.account_id, to_account_id: r.pay_to_account_id || null, category_id: r.category_id, merchant: r.name, date: today() < date ? today() : date, note: "", bill_occurrence_id: el.dataset.id, created_by: "mark_paid" };
      closeSheet();
      apply(`${r.name} marked as paid.`, C.upsertTransaction(S, t, now()), { undoable: true });
    },
    "occ-unpay": (el) => {
      const id = el.dataset.id;
      closeSheet();
      apply("Marked as unpaid.", { ...S, transactions: S.transactions.map((t) => t.bill_occurrence_id !== id ? t : t.created_by === "mark_paid" ? { ...t, deleted_at: now(), bill_occurrence_id: null } : { ...t, bill_occurrence_id: null }) }, { undoable: true });
    },
    "occ-skip": (el) => { closeSheet(); apply("Skipped this time.", { ...S, bill_status: { ...S.bill_status, [el.dataset.id]: { status: "skipped", at: now() } } }, { undoable: true }); },
    "occ-unskip": (el) => { const bsn = { ...S.bill_status }; delete bsn[el.dataset.id]; closeSheet(); apply("Skip undone.", { ...S, bill_status: bsn }); },
    "cal-nav": (el) => { ui.calMonth = C.addMonths(ui.calMonth, Number(el.dataset.dir)); render(); },
    "cal-day": (el) => { ui.calSel = el.dataset.d; render(); },

    "edit-buffer": () => openSheet("Safety buffer", `<form data-form="buffer" novalidate>${moneyField("buffer", "Keep this much aside", plain(S.settings.buffer), { required: true })}<p class="small muted">Safe to Spend leaves this amount untouched for surprises.</p><p class="err" id="buf-err"></p><button class="btn primary">Save</button></form>`),
    "fix-spend": (el) => {
      const cut = Number(el.dataset.cut);
      const period = S.settings.period;
      const days = C.periodRange(period, today()).days;
      apply(`Everyday spending plan lowered by ${money(cut)} a day.`, C.reduceFlexibleAllocations(S, period, cut * days + days), { undoable: true });
    },
    "fix-goal": (el) => {
      const g = goalOf(el.dataset.id);
      apply(`${g.name} paused until ${dShort(el.dataset.until)}.`, { ...S, goals: S.goals.map((x) => x.id === g.id ? { ...x, plan: { ...x.plan, paused_until: el.dataset.until } } : x) }, { undoable: true });
    },
    "flow-d": () => { go("home"); const el = $("#shortfall"); if (el) { el.scrollIntoView({ block: "start" }); el.querySelector("button") && el.querySelector("button").focus({ preventScroll: true }); } else toast("No shortfall right now. Try Reset sample data in Settings."); },

    "goal-new": () => goalForm(null),
    "goal-edit": (el) => goalForm(goalOf(el.dataset.id)),
    "goal-add": (el) => goalAddSheet(el.dataset.id),
    "goal-pause": (el) => {
      const g = goalOf(el.dataset.id);
      const paused = g.plan.paused || (g.plan.paused_until && g.plan.paused_until > today());
      apply(paused ? `${g.name} resumed.` : `${g.name} paused.`, { ...S, goals: S.goals.map((x) => x.id === g.id ? { ...x, plan: { ...x.plan, paused: !paused, paused_until: null } } : x) }, { undoable: true });
    },
    "goal-delete": (el) => {
      const g = goalOf(el.dataset.id);
      confirmDialog({ title: `Delete ${esc(g.name)}?`, body: g.account_id ? `Its savings account stays, but is no longer reserved for this goal.` : "Pace will stop tracking this goal.", confirm: "Delete goal", danger: true,
        onConfirm: () => apply(`${g.name} deleted.`, { ...S, goals: S.goals.map((x) => x.id === g.id ? { ...x, archived_at: now() } : x), accounts: S.accounts.map((a) => a.reserved_for_goal_id === g.id ? { ...a, reserved_for_goal_id: null } : a) }, { undoable: true }) });
    },

    "edit-cat": (el) => catForm(cat(el.dataset.id)),
    "add-cat": () => catForm(null),
    "archive-cat": (el) => { const id = el.dataset.id; closeSheet(); apply(`${catName(id)} archived.`, { ...S, categories: S.categories.map((c) => c.id === id ? { ...c, archived_at: now() } : c) }, { undoable: true }); },
    "unarchive-cat": (el) => { const id = el.dataset.id; apply(`${catName(id)} restored.`, { ...S, categories: S.categories.map((c) => c.id === id ? { ...c, archived_at: null } : c) }); },
    "toggle-reorder": () => { ui.reorder = !ui.reorder; render(); },
    "move-cat": (el) => {
      const list = S.categories.filter((c) => c.type === "expense" && !c.archived_at).sort((a, b) => a.order - b.order);
      const i = list.findIndex((c) => c.id === el.dataset.id), j = i + Number(el.dataset.dir);
      if (j < 0 || j >= list.length) return;
      const oi = list[i].order, oj = list[j].order;
      S = { ...S, categories: S.categories.map((c) => c.id === list[i].id ? { ...c, order: oj } : c.id === list[j].id ? { ...c, order: oi } : c) };
      render();
      const btn = $(`[data-act=move-cat][data-id="${el.dataset.id}"][data-dir="${el.dataset.dir}"]`);
      if (btn && !btn.disabled) btn.focus();
    },
    "transfer-alloc": (el) => transferAllocSheet(el.dataset.to),

    "ins-range": (el) => { ui.insRange = el.dataset.v; render(); },
    "ins-activity": (el) => {
      const ins = C.buildInsights(S, today(), catName).find((x) => x.id === el.dataset.key);
      ui.af = { ...ui.af, ids: ins.txIds, idsLabel: ins.title };
      go("activity");
    },
    "ins-cat": (el) => { ui.af = { q: "", type: "expense", source: "all", status: "all", account: "all", category: el.dataset.id, ids: null, idsLabel: "" }; go("activity"); },

    "acct-edit": (el) => acctForm(acct(el.dataset.id)),
    "acct-new": () => acctForm(null),
    "acct-close": (el) => {
      const a = acct(el.dataset.id);
      confirmDialog({ title: `Close ${esc(a.name)}?`, body: "It will be hidden from Pace. Its past transactions stay in Activity.", confirm: "Close account", danger: true,
        onConfirm: () => apply(`${a.name} closed.`, { ...S, accounts: S.accounts.map((x) => x.id === a.id ? { ...x, status: "closed" } : x) }, { undoable: true }) });
    },

    "connect-start": () => { if (STORE) return; closeSheet(); if (S.settings.offline) { toast("You're offline. Connect a bank when you're back online."); return; } ui.connect = { step: "intro" }; ui.stack = ui.stack.filter((s) => s.name !== "connect"); openSub("connect"); },
    "connect-go": (el) => { ui.connect = { ...ui.connect, step: el.dataset.step }; render(); window.scrollTo(0, 0); },
    "connect-inst": (el) => { ui.connect = { ...ui.connect, inst: el.dataset.id, step: "consent" }; render(); window.scrollTo(0, 0); },
    "connect-approve": connectApprove,
    "connect-decline": connectDecline,
    sync: (el) => syncConnection(el.dataset.id),
    "sim-fail": (el) => { provider.failNextSync(); syncConnection(el.dataset.id); },
    "match-bank": (el) => {
      const c = connOf(el.dataset.id);
      let next = S;
      for (const a of S.accounts.filter((x) => x.connection_id === c.id)) if ((c.bank_balances || {})[a.mask] != null) next = C.reconcileAccount(next, a.id, c.bank_balances[a.mask], now());
      apply("Balances matched to the bank.", next, { undoable: true });
    },
    disconnect: (el) => {
      const c = connOf(el.dataset.id);
      confirmDialog({ title: `Disconnect ${esc(c.institution_name)}?`, body: "Pace will withdraw consent and stop collecting data from this bank.", confirm: "Disconnect", danger: true,
        extra: `<fieldset class="field" style="border:0;padding:0;margin:0"><legend>Imported data</legend><label class="check"><input type="radio" name="keep" value="keep" checked> Keep imported transactions</label><label class="check"><input type="radio" name="keep" value="delete"> Delete imported transactions and accounts</label></fieldset>`,
        onConfirm: async (fd) => {
          const del = fd.get("keep") === "delete";
          try { await provider.revoke(c.consent_reference); } catch (e) { /* revoke is best effort in the mock */ }
          let next = { ...S, connections: S.connections.map((x) => x.id === c.id ? { ...x, status: "disconnected", disconnected_at: now(), errors: [...(x.errors || []), { at: now(), ok: true, message: "Consent withdrawn" + (del ? " and imported data deleted" : "") }] } : x) };
          next = { ...next, accounts: next.accounts.map((a) => a.connection_id !== c.id ? a : del && a.created_by_connection === c.id ? { ...a, status: "closed", connection_id: null } : { ...a, source: "manual", connection_id: null, updated_at: now() }) };
          if (del) next = { ...next, transactions: next.transactions.map((t) => t.connection_id === c.id ? { ...t, deleted_at: now(), possible_duplicate_of: null } : t) };
          apply("Bank disconnected.", next);
        } });
    },

    export: exportSheet,
    "copy-export": () => {
      const ta = $("#export-text");
      const done = () => toast("Copied.");
      const fallback = () => { ta.focus(); ta.select(); toast("Selected. Press Ctrl+C or Cmd+C to copy."); };
      try { navigator.clipboard.writeText(ta.value).then(done, fallback); } catch (e) { fallback(); }
    },
    "delete-all": () => confirmDialog({ title: "Delete all data?", body: "This removes every account, transaction, bill and goal from this device. It can't be undone.", confirm: "Delete everything", danger: true, requireText: "DELETE",
      onConfirm: () => { S = null; ui.stack = []; ui.onb = onbDefaults(); render(); window.scrollTo(0, 0); toast("All data deleted."); } }),
    "reset-sample": () => confirmDialog({ title: "Reset sample data?", body: "Your changes will be replaced with Mia's original sample data.", confirm: "Reset",
      onConfirm: () => { S = Seed.sample(today()); ui.stack = []; ui.tab = "home"; render(); window.scrollTo(0, 0); toast("Sample data reset."); } }),
    "start-onboarding": () => { closeSheet(); ui.onb = onbDefaults(); render(); window.scrollTo(0, 0); },
    "onb-back": () => { if (ui.onb.step > 0) ui.onb.step--; render(); },
    "onb-cancel": () => { ui.onb = null; render(); },
    "onb-sample": () => { S = Seed.sample(today()); ui.onb = null; ui.stack = []; ui.tab = "home"; render(); window.scrollTo(0, 0); },
    "onb-freq": (el) => { ui.onb.a.payFrequency = el.dataset.v; $$("[data-act=onb-freq]").forEach((b) => b.setAttribute("aria-pressed", b === el)); },
    "onb-goal-kind": (el) => {
      const a = ui.onb.a;
      if (el.dataset.v === "skip") a.skipGoal = true;
      else { a.skipGoal = false; a.goal = { ...a.goal, kind: el.dataset.v, name: GOAL_KINDS[el.dataset.v][0] }; }
      render();
    },
    "onb-add-bill": () => {
      const form = $("[data-form=onb]");
      const fd = new FormData(form);
      ui.onb.a.bills.forEach((b, i) => { b.on = !!fd.get("on_" + i); const v = C.parseMoney(fd.get("amt_" + i)); b.amount = Number.isNaN(v) ? null : v; b.frequency = fd.get("freq_" + i); b.next = fd.get("next_" + i); });
      const name = "Bill " + (ui.onb.a.bills.length + 1);
      ui.onb.a.bills.push({ key: "custom", name, on: true, amount: null, frequency: "monthly", next: C.addDays(today(), 14) });
      render();
    },
  };

  const FORMS = {
    confirm: async (form) => {
      const fd = new FormData(form);
      if (sheet.requireText && fd.get("confirm_text").trim() !== sheet.requireText) { $("#confirm-err").textContent = `Type ${sheet.requireText} exactly to confirm.`; return; }
      const fn = sheet.onConfirm;
      closeSheet();
      await fn(fd);
    },
    tx: txSubmit,
    rule: ruleSubmit,
    goal: goalSubmit,
    "goal-add": (form) => {
      const fd = new FormData(form);
      const g = goalOf(form.dataset.id);
      const amount = C.parseMoney(fd.get("amount"));
      if (!(amount > 0)) { $("#ga-err").textContent = "Enter an amount above $0."; return; }
      const date = fd.get("date") || today();
      let next = S, txId = null;
      if (g.account_id) {
        txId = uid("t");
        next = C.upsertTransaction(next, { id: txId, type: "transfer", amount, account_id: fd.get("from"), to_account_id: g.account_id, category_id: null, merchant: "Transfer to " + g.name, date, note: "" }, now());
      }
      next = { ...next, contributions: [...next.contributions, { id: uid("k"), goal_id: g.id, amount, date, occurrence_id: null, transaction_id: txId }] };
      closeSheet();
      apply(`Added ${money(amount)} to ${g.name}.`, next, { undoable: true });
    },
    recat: (form) => {
      const fd = new FormData(form);
      const id = form.dataset.id;
      const t = S.transactions.find((x) => x.id === id);
      const remember = !!fd.get("remember");
      const count = remember ? S.transactions.filter((x) => x.id !== id && x.merchant && x.merchant.toLowerCase() === (t.merchant || "").toLowerCase() && x.type === t.type && x.category_id !== fd.get("category_id")).length : 0;
      closeSheet();
      apply(remember ? `Category updated for ${t.merchant}${count ? ` and ${count} other transaction${count === 1 ? "" : "s"}` : ""}.` : "Category updated.", C.recategorize(S, id, fd.get("category_id"), remember, now()), { undoable: true });
    },
    filters: (form) => {
      const fd = new FormData(form);
      ui.af = { ...ui.af, source: fd.get("source"), status: fd.get("status"), account: fd.get("account"), category: fd.get("category"), ids: null };
      ui.actLimit = 60;
      closeSheet(); render();
    },
    buffer: (form) => {
      const v = C.parseMoney(new FormData(form).get("buffer"));
      if (Number.isNaN(v) || v < 0) { $("#buf-err").textContent = "Enter $0 or more."; return; }
      closeSheet();
      apply(`Buffer set to ${money(v)}.`, { ...S, settings: { ...S.settings, buffer: v } }, { undoable: true });
    },
    cat: (form) => {
      const fd = new FormData(form);
      const name = fd.get("name").trim();
      if (!name) { $("#cat-err").textContent = "Add a name."; return; }
      const planned = Math.max(0, C.parseMoney(fd.get("planned")) || 0);
      const id = form.dataset.id || uid("c");
      let next = form.dataset.id
        ? { ...S, categories: S.categories.map((c) => c.id === id ? { ...c, name, flexible: !!fd.get("flexible") } : c) }
        : { ...S, categories: [...S.categories, { id, name, type: "expense", icon: "dots", flexible: !!fd.get("flexible"), order: Math.max(...S.categories.filter((c) => c.type === "expense").map((c) => c.order)) + 1, archived_at: null }] };
      next = C.setAllocation(next, S.settings.period, id, planned);
      closeSheet();
      apply(form.dataset.id ? "Category saved." : `${name} added.`, next, { undoable: true });
    },
    xfer: (form) => {
      const fd = new FormData(form);
      try {
        const amt = C.parseMoney(fd.get("amount"));
        const next = C.transferAllocation(S, S.settings.period, fd.get("from"), fd.get("to"), amt);
        closeSheet();
        apply(`Moved ${money(amt)} from ${catName(fd.get("from"))} to ${catName(fd.get("to"))}.`, next, { undoable: true });
      } catch (e) { $("#xfer-err").textContent = e.message; }
    },
    acct: (form) => {
      const fd = new FormData(form);
      const id = form.dataset.id;
      const name = fd.get("name").trim();
      if (!name) { $("#acct-err").textContent = "Add a name."; return; }
      if (!id) {
        const type = fd.get("type");
        const bal = C.parseMoney(fd.get("balance"));
        if (Number.isNaN(bal)) { $("#acct-err").textContent = "Enter the current balance. Use 0 if it's empty."; return; }
        const a = { id: uid("a"), name, type, institution: fd.get("institution").trim() || "Entered by you", currency: S.user.currency, opening_balance: bal, available_cash: C.CASH_TYPES.includes(type) && !!fd.get("available_cash"), status: "active", source: "manual", updated_at: now() };
        closeSheet();
        apply(`${name} added.`, { ...S, accounts: [...S.accounts, a] }, { undoable: true });
        return;
      }
      const a = acct(id);
      let next = { ...S, accounts: S.accounts.map((x) => x.id === id ? { ...x, name, institution: fd.get("institution").trim() || x.institution, available_cash: C.canBeAvailableCash(x) && !!fd.get("available_cash"), updated_at: now() } : x) };
      if (!a.connection_id) {
        const bal = C.parseMoney(fd.get("balance"));
        if (Number.isNaN(bal)) { $("#acct-err").textContent = "Enter the current balance."; return; }
        next = C.reconcileAccount(next, id, bal, now());
      }
      closeSheet();
      apply(`${name} updated.`, next, { undoable: true });
    },
    income: (form) => {
      const fd = new FormData(form);
      const id = form.dataset.id;
      const name = fd.get("name").trim(), amount = C.parseMoney(fd.get("amount")), next = fd.get("next");
      if (!name || !(amount > 0) || !next) { $("#inc-err").textContent = "Add a name, an amount above $0 and the next payday."; return; }
      if (!id && next < today()) { $("#inc-err").textContent = "Choose today or a later date."; return; }
      const base = { name, amount, frequency: fd.get("frequency"), account_id: fd.get("account_id"), variable: !!fd.get("variable") };
      const next2 = id
        ? { ...S, recurring: S.recurring.map((r) => r.id === id ? { ...r, ...base, status: fd.get("status") || r.status, start_date: next !== form.dataset.origNext ? next : r.start_date } : r) }
        : { ...S, recurring: [...S.recurring, { id: uid("r"), kind: "income", status: "active", category_id: "c_pay", start_date: next, ...base }] };
      closeSheet();
      apply(id ? "Pay updated." : "Income added.", next2, { undoable: true });
    },
    res: (form) => {
      const fd = new FormData(form);
      const id = form.dataset.id;
      const name = fd.get("name").trim(), amount = C.parseMoney(fd.get("amount"));
      if (!name || !(amount > 0)) { $("#res-err").textContent = "Add what it's for and an amount above $0."; return; }
      const list = S.reservations || [];
      const next = id ? list.map((r) => (r.id === id ? { ...r, name, amount } : r)) : [...list, { id: uid("res"), name, amount, created_at: now() }];
      closeSheet();
      apply(id ? "Set-aside updated." : `${money(amount)} set aside.`, { ...S, reservations: next }, { undoable: true });
    },
    "connect-review": connectImport,
    "connect-reconcile": (form) => {
      const fd = new FormData(form);
      for (const r of ui.connect.reconcile) if (fd.get("rec_" + r.accountId) === "bank") S = C.reconcileAccount(S, r.accountId, r.bank, now());
      finishConnect();
    },
    onb: onbSubmit,
  };

  const LIVE = {
    search: (el) => { ui.af.q = el.value; ui.af.ids = null; ui.actLimit = 60; $("#act-list").innerHTML = activityListHTML(); },
    rollover: (el) => { S = { ...S, settings: { ...S.settings, rollover: el.checked } }; render(); const r = $(`#${el.id}`); if (r) r.focus(); },
    hide: (el) => { S = { ...S, settings: { ...S.settings, hide_balances: el.checked } }; render(); const r = $(`#${el.id}`); if (r) r.focus(); },
    notif: (el) => { S = { ...S, settings: { ...S.settings, notifications: { ...S.settings.notifications, [el.dataset.key]: el.checked } } }; save(); toast(el.checked ? "Turned on." : "Turned off."); },
    applock: (el) => { S = { ...S, settings: { ...S.settings, app_lock: el.checked } }; save(); toast(el.checked ? "App lock on. Pace will ask to unlock next time it opens." : "App lock off."); },
    offline: (el) => { S = { ...S, settings: { ...S.settings, offline: el.checked } }; render(); const r = $(`#${el.id}`); if (r) r.focus(); },
    currency: () => {},
    "sts-expected": (el) => { S = { ...S, settings: { ...S.settings, sts_include_expected: el.checked } }; render(); const r = $("#sts-expected"); if (r) r.focus(); },
    "goal-check": (el) => goalCheck(el.form),
    receipt: (el) => {
      const file = el.files && el.files[0];
      if (!file) return;
      const preview = $("#receipt-preview");
      if (!file.type.startsWith("image/")) { ui.receiptDraft = { name: file.name, type: file.type }; preview.innerHTML = receiptHTML(ui.receiptDraft); return; }
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, 640 / Math.max(img.width, img.height));
          const cv = document.createElement("canvas");
          cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale);
          cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
          ui.receiptDraft = { name: file.name, type: "image/jpeg", dataUrl: cv.toDataURL("image/jpeg", 0.72) };
          preview.innerHTML = receiptHTML(ui.receiptDraft);
        };
        img.onerror = () => { preview.innerHTML = `<p class="err">That image couldn't be read. Try another photo.</p>`; };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    },
  };

  document.addEventListener("click", (e) => {
    const tab = e.target.closest("[data-tab]");
    if (tab) { go(tab.dataset.tab); return; }
    const el = e.target.closest("[data-act]");
    if (!el || el.disabled) return;
    const fn = ACTIONS[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el, e); }
  });
  document.addEventListener("submit", (e) => {
    const form = e.target.closest("[data-form]");
    if (!form) return;
    e.preventDefault();
    const fn = FORMS[form.dataset.form];
    if (fn) fn(form, e.submitter);
  });
  const onLive = (e) => {
    const el = e.target.closest("[data-live]");
    if (!el) return;
    const kind = el.dataset.live;
    if (kind === "search" && e.type !== "input") return;
    if (kind !== "search" && kind !== "goal-check" && e.type === "input" && el.type !== "range") return;
    const fn = LIVE[kind];
    if (fn) fn(el, e);
  };
  document.addEventListener("input", onLive);
  document.addEventListener("change", onLive);
  // Native wrappers call this for the Android back button. Returns false when there's nowhere to go back to.
  window.PaceApp = {
    back() {
      if (!$("#lock").hidden) return false;
      if (!overlay.hidden) { closeSheet(); return true; }
      if (ui.onb && ui.onb.step > 0) { ui.onb.step--; render(); return true; }
      if (ui.onb && S) { ui.onb = null; render(); return true; }
      if (sub()) { back(); return true; }
      if (ui.tab !== "home") { go("home"); return true; }
      return false;
    },
  };
  window.addEventListener("hashchange", () => { const h = location.hash.slice(1); if (TABS.includes(h) && h !== ui.tab) go(h); });

  render();
})();
