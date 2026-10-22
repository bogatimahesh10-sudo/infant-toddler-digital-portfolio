(function () {
  "use strict";

  const B = window.Budget;
  const STORAGE_KEY = "budget-app-v1";
  const $ = (id) => document.getElementById(id);

  let state = load();
  let currentMonth = todayISO().slice(0, 7);
  let editingId = null;

  // ---------- persistence ----------

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? B.normalizeState(JSON.parse(raw)) : B.emptyState();
    } catch (e) {
      return B.emptyState();
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // Storage may be full or blocked; the app keeps working for this session.
    }
  }

  function commit(next) {
    state = next;
    save();
    render();
  }

  // ---------- formatting ----------

  function todayISO() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }

  function money(cents) {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: state.currency }).format(B.fromCents(cents));
    } catch (e) {
      return B.fromCents(cents).toFixed(2);
    }
  }

  function monthLabel(month) {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }

  function dayLabel(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "text") node.textContent = v;
      else if (k === "class") node.className = v;
      else node.setAttribute(k, v);
    }
    for (const c of children || []) node.append(c);
    return node;
  }

  // ---------- rendering ----------

  function render() {
    $("month-label").textContent = monthLabel(currentMonth);
    $("currency").value = state.currency;
    renderSummary();
    renderBudgets();
    renderTransactions();
    if (!$("budget-form").hidden) renderBudgetInputs();
  }

  function renderSummary() {
    const s = B.summarize(B.transactionsForMonth(state, currentMonth));
    $("sum-income").textContent = money(s.income);
    $("sum-expense").textContent = money(s.expense);
    const bal = $("sum-balance");
    bal.textContent = money(s.balance);
    bal.classList.toggle("negative", s.balance < 0);
  }

  function renderBudgets() {
    const list = $("budget-list");
    list.replaceChildren();
    const rows = B.budgetReport(state, currentMonth);
    if (!rows.length) {
      list.append(el("p", { class: "empty", text: "No budgets yet. Click Edit to set monthly limits." }));
      return;
    }
    for (const r of rows) {
      const amounts = r.limit ? `${money(r.spent)} / ${money(r.limit)}` : `${money(r.spent)} · no limit`;
      const item = el("div", { class: "budget-item" }, [
        el("div", { class: "budget-top" }, [
          el("span", { text: r.category }),
          el("span", { class: "amounts", text: amounts }),
        ]),
      ]);
      if (r.limit) {
        const pct = Math.min(100, Math.round(r.ratio * 100));
        const fill = el("div", { class: r.over ? "over" : r.ratio >= 0.8 ? "warn" : "" });
        fill.style.width = pct + "%";
        item.append(el("div", { class: "bar", role: "progressbar", "aria-valuenow": String(pct), "aria-valuemin": "0", "aria-valuemax": "100", "aria-label": r.category }, [fill]));
        item.append(
          el("div", {
            class: "budget-note" + (r.over ? " over" : ""),
            text: r.over ? `${money(-r.remaining)} over budget` : `${money(r.remaining)} left`,
          })
        );
      }
      list.append(item);
    }
  }

  function renderBudgetInputs() {
    const wrap = $("budget-inputs");
    wrap.replaceChildren();
    for (const cat of state.categories.expense) {
      const input = el("input", { type: "number", min: "0", step: "0.01", inputmode: "decimal", "data-category": cat, "aria-label": cat + " budget", placeholder: "No limit" });
      if (state.budgets[cat]) input.value = B.fromCents(state.budgets[cat]).toFixed(2);
      wrap.append(el("div", { class: "budget-input-row" }, [el("span", { text: cat }), input]));
    }
  }

  function renderCategoryOptions(selected) {
    const type = selectedType();
    const select = $("tx-category");
    const cats = state.categories[type];
    select.replaceChildren(...cats.map((c) => el("option", { value: c, text: c })));
    if (selected && cats.includes(selected)) select.value = selected;
  }

  function renderTransactions() {
    const list = $("tx-list");
    const query = $("search").value.trim().toLowerCase();
    const type = $("filter-type").value;
    const txs = B.transactionsForMonth(state, currentMonth).filter(
      (t) =>
        (type === "all" || t.type === type) &&
        (!query || t.category.toLowerCase().includes(query) || t.note.toLowerCase().includes(query))
    );
    list.replaceChildren();
    for (const t of txs) {
      const sign = t.type === "income" ? "+" : "−";
      const meta = dayLabel(t.date) + (t.note ? " · " + t.note : "");
      const editBtn = el("button", { type: "button", text: "Edit", "aria-label": "Edit transaction" });
      const delBtn = el("button", { type: "button", class: "danger", text: "Delete", "aria-label": "Delete transaction" });
      editBtn.addEventListener("click", () => startEdit(t.id));
      delBtn.addEventListener("click", () => {
        if (confirm("Delete this transaction?")) {
          if (editingId === t.id) resetForm();
          commit(B.deleteTransaction(state, t.id));
        }
      });
      list.append(
        el("li", { class: "tx" }, [
          el("div", { class: "tx-main" }, [el("div", { class: "tx-cat", text: t.category }), el("div", { class: "tx-meta", text: meta })]),
          el("div", { class: "tx-amount " + t.type, text: sign + money(t.amount) }),
          el("div", { class: "tx-actions" }, [editBtn, delBtn]),
        ])
      );
    }
    $("tx-empty").hidden = txs.length > 0;
    $("tx-empty").textContent = state.transactions.length && !txs.length && (query || type !== "all") ? "No matching transactions." : "No transactions this month yet.";
  }

  // ---------- transaction form ----------

  function selectedType() {
    return document.querySelector('input[name="type"]:checked').value;
  }

  function setType(type) {
    document.querySelector(`input[name="type"][value="${type}"]`).checked = true;
  }

  function defaultDate() {
    const today = todayISO();
    return today.slice(0, 7) === currentMonth ? today : currentMonth + "-01";
  }

  function resetForm() {
    editingId = null;
    $("tx-form").reset();
    setType("expense");
    renderCategoryOptions();
    $("tx-date").value = defaultDate();
    $("form-error").textContent = "";
    $("form-title").textContent = "Add transaction";
    $("submit-btn").textContent = "Add";
    $("cancel-edit").hidden = true;
  }

  function startEdit(id) {
    const t = state.transactions.find((x) => x.id === id);
    if (!t) return;
    editingId = id;
    setType(t.type);
    renderCategoryOptions(t.category);
    $("tx-amount").value = B.fromCents(t.amount).toFixed(2);
    $("tx-date").value = t.date;
    $("tx-note").value = t.note;
    $("form-error").textContent = "";
    $("form-title").textContent = "Edit transaction";
    $("submit-btn").textContent = "Save";
    $("cancel-edit").hidden = false;
    $("tx-amount").focus();
  }

  $("tx-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const tx = {
      type: selectedType(),
      amount: B.toCents($("tx-amount").value),
      category: $("tx-category").value,
      date: $("tx-date").value,
      note: $("tx-note").value,
    };
    try {
      const next = editingId ? B.updateTransaction(state, editingId, tx) : B.addTransaction(state, tx);
      const keepType = tx.type;
      const keepDate = tx.date;
      currentMonth = B.monthKey(tx.date);
      commit(next);
      resetForm();
      // Keep type and date so entering several items in a row is quick.
      setType(keepType);
      renderCategoryOptions();
      $("tx-date").value = keepDate;
      $("tx-amount").focus();
    } catch (err) {
      $("form-error").textContent = err.message;
    }
  });

  $("cancel-edit").addEventListener("click", resetForm);
  document.querySelectorAll('input[name="type"]').forEach((r) => r.addEventListener("change", () => renderCategoryOptions()));

  // ---------- budgets ----------

  $("toggle-budget-edit").addEventListener("click", () => {
    const form = $("budget-form");
    form.hidden = !form.hidden;
    $("toggle-budget-edit").textContent = form.hidden ? "Edit" : "Close";
    if (!form.hidden) renderBudgetInputs();
  });

  $("budget-form").addEventListener("submit", (e) => {
    e.preventDefault();
    let next = state;
    $("budget-inputs").querySelectorAll("input").forEach((input) => {
      const cents = input.value.trim() ? B.toCents(input.value) : 0;
      next = B.setBudget(next, input.dataset.category, Number.isFinite(cents) ? cents : 0);
    });
    $("budget-form").hidden = true;
    $("toggle-budget-edit").textContent = "Edit";
    commit(next);
  });

  $("add-category").addEventListener("click", () => {
    const input = $("new-category");
    const name = input.value.trim();
    if (!name) return;
    // Preserve limits typed but not yet saved.
    const pending = {};
    $("budget-inputs").querySelectorAll("input").forEach((i) => (pending[i.dataset.category] = i.value));
    commit(B.addCategory(state, "expense", name));
    $("budget-inputs").querySelectorAll("input").forEach((i) => {
      if (i.dataset.category in pending) i.value = pending[i.dataset.category];
    });
    input.value = "";
    renderCategoryOptions($("tx-category").value);
  });

  // ---------- navigation & filters ----------

  $("prev-month").addEventListener("click", () => {
    currentMonth = B.shiftMonth(currentMonth, -1);
    render();
    if (!editingId) $("tx-date").value = defaultDate();
  });
  $("next-month").addEventListener("click", () => {
    currentMonth = B.shiftMonth(currentMonth, 1);
    render();
    if (!editingId) $("tx-date").value = defaultDate();
  });
  $("search").addEventListener("input", renderTransactions);
  $("filter-type").addEventListener("change", renderTransactions);
  $("currency").addEventListener("change", (e) => commit({ ...state, currency: e.target.value }));

  // ---------- data tools ----------

  function download(filename, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = el("a", { href: url, download: filename });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  $("export-csv").addEventListener("click", () => {
    const txs = [...state.transactions].sort((a, b) => a.date.localeCompare(b.date));
    download(`budget-transactions-${todayISO()}.csv`, B.toCSV(txs), "text/csv");
  });

  $("export-json").addEventListener("click", () => {
    download(`budget-backup-${todayISO()}.json`, JSON.stringify(state, null, 2), "application/json");
  });

  $("import-json").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const imported = B.normalizeState(JSON.parse(await file.text()));
      if (confirm(`Replace current data with ${imported.transactions.length} transactions from this backup?`)) {
        commit(imported);
        resetForm();
      }
    } catch (err) {
      alert("That file isn't a valid budget backup.");
    }
  });

  $("reset").addEventListener("click", () => {
    if (confirm("Erase all transactions and budgets? This cannot be undone.")) {
      commit(B.emptyState());
      resetForm();
    }
  });

  // ---------- start ----------

  render();
  resetForm();
})();
