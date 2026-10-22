// Bank-data provider adapters. Pace talks to every provider through the same interface,
// so a real Consumer Data Right provider can replace the mock without touching the app.
//
//   listInstitutions()                       -> [{ id, name, unavailable? }]
//   authorize(institutionId, { approve })    -> { consent_reference, institution_id, expires_at }
//                                               rejects with code "consent_declined" | "provider_unavailable"
//   fetchAccounts(consentReference)          -> [{ account_ref, name, mask, type, currency, balance }]
//   fetchTransactions(consentReference, cursor)
//                                            -> { transactions: [raw], next_cursor }
//                                               raw: { provider_tx_id, account_ref, amount, currency, direction,
//                                                      date, description, status: "pending"|"posted"|"reversed", category_hint }
//   revoke(consentReference)                 -> void
//
// The mock below is deterministic: what it returns depends only on the consent reference and
// the sync cursor, so it behaves the same after a page reload. It never touches a real bank.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./core.js"));
  else root.PaceProvider = factory(root.PaceCore);
})(typeof self !== "undefined" ? self : this, function (C) {
  "use strict";

  function providerError(code, message) {
    const e = new Error(message);
    e.code = code;
    return e;
  }

  const INSTITUTIONS = [
    { id: "demo-bank", name: "Demo Bank" },
    { id: "sim-cu", name: "Simulated Credit Union" },
    { id: "down-bank", name: "Unavailable Bank", unavailable: true },
  ];

  function createMockProvider(opts) {
    const today = opts.today;
    const wait = (ms) => new Promise((res) => setTimeout(res, ms == null ? opts.delayMs : ms));
    let failNext = false;
    const instFromRef = (ref) => INSTITUTIONS.find((i) => ref && ref.indexOf("DEMO-" + i.id + "-") === 0);

    // Synthetic feed for each sync cursor. Cursor 0 is the first import.
    function feed(instId, cursor) {
      const T = today();
      if (instId === "demo-bank") {
        const batches = [
          [
            { provider_tx_id: "db-1001", account_ref: "db-every", amount: 6420, direction: "debit", date: C.addDays(T, -2), description: "WOOLWORTHS 3021 CARLTON AU", status: "posted", category_hint: "c_groceries" },
            { provider_tx_id: "db-1002", account_ref: "db-every", amount: 450, direction: "debit", date: C.addDays(T, -1), description: "7-ELEVEN 2231 CARLTON", status: "posted", category_hint: "c_eating" },
            { provider_tx_id: "db-1003", account_ref: "db-every", amount: 520, direction: "debit", date: T, description: "CAMPUS CAFE PARKVILLE", status: "posted", category_hint: "c_eating" },
            { provider_tx_id: "db-1004", account_ref: "db-every", amount: 1890, direction: "debit", date: T, description: "UBER *TRIP HELP.UBER.COM", status: "pending", category_hint: "c_transport" },
          ],
          [
            { provider_tx_id: "db-1004", account_ref: "db-every", amount: 1890, direction: "debit", date: T, description: "UBER *TRIP HELP.UBER.COM", status: "posted", category_hint: "c_transport" },
            { provider_tx_id: "db-1005", account_ref: "db-every", amount: 2310, direction: "debit", date: T, description: "COLES 0921 MELBOURNE", status: "posted", category_hint: "c_groceries" },
          ],
          [
            { provider_tx_id: "db-1002", account_ref: "db-every", amount: 450, direction: "debit", date: C.addDays(T, -1), description: "7-ELEVEN 2231 CARLTON", status: "reversed", category_hint: "c_eating" },
          ],
        ];
        return batches[cursor] || [];
      }
      if (instId === "sim-cu") {
        return cursor === 0 ? [
          { provider_tx_id: "cu-1", account_ref: "cu-access", amount: 2500, direction: "credit", date: C.addDays(T, -3), description: "TRANSFER FROM MUM", status: "posted", category_hint: "c_other_income" },
        ] : [];
      }
      return [];
    }
    // Balances move with the feed so a re-sync shows the bank's view changing.
    function balances(instId, cursor) {
      if (instId === "demo-bank") {
        const every = [59030, 54830, 55280][Math.min(cursor, 2)];
        return [
          { account_ref: "db-every", name: "Everyday", mask: "4821", type: "transaction", currency: "AUD", balance: every },
          { account_ref: "db-save", name: "Bonus Saver", mask: "7730", type: "savings", currency: "AUD", balance: 125000 },
        ];
      }
      if (instId === "sim-cu") return [{ account_ref: "cu-access", name: "Access Account", mask: "0193", type: "transaction", currency: "AUD", balance: 15000 }];
      return [];
    }

    return {
      id: "mock",
      name: "Demo connection (simulated)",
      simulated: true,
      listInstitutions: () => INSTITUTIONS.slice(),
      failNextSync() { failNext = true; },
      async authorize(institutionId, o) {
        await wait();
        const inst = INSTITUTIONS.find((i) => i.id === institutionId);
        if (!inst) throw providerError("unknown_institution", "We couldn't find that bank.");
        if (!o || !o.approve) throw providerError("consent_declined", "You declined access, so nothing was shared.");
        if (inst.unavailable) throw providerError("provider_unavailable", inst.name + " isn't responding right now.");
        return { consent_reference: "DEMO-" + inst.id + "-" + Math.random().toString(36).slice(2, 8).toUpperCase(), institution_id: inst.id, expires_at: C.addMonths(today(), 12) };
      },
      async fetchAccounts(ref, cursor) {
        await wait(opts.delayMs / 2);
        const inst = instFromRef(ref);
        if (!inst) throw providerError("consent_revoked", "This connection's consent is no longer valid.");
        return balances(inst.id, cursor || 0);
      },
      async fetchTransactions(ref, cursor) {
        await wait();
        if (failNext) { failNext = false; throw providerError("sync_failed", "The bank didn't respond in time."); }
        const inst = instFromRef(ref);
        if (!inst) throw providerError("consent_revoked", "This connection's consent is no longer valid.");
        return { transactions: feed(inst.id, cursor), next_cursor: cursor + 1 };
      },
      async revoke() { await wait(opts.delayMs / 2); },
    };
  }

  return { createMockProvider, INSTITUTIONS };
});
