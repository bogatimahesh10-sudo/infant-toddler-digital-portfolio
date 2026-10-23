// Lantern UI. Personal things (portraits, notes, chats, moods) stay in this browser's
// localStorage. Only thoughts someone chooses to share go to the server.
(function () {
  "use strict";

  const C = window.LanternCore;
  const KEY = "lantern.v1";
  const view = document.getElementById("view");

  // --- storage ----------------------------------------------------------------------------

  function blank() {
    return { portraits: [], notes: [], chat: [], moods: [], sharePortrait: true, myPosts: {}, related: [], name: "" };
  }
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      if (saved && typeof saved === "object") return Object.assign(blank(), saved);
    } catch (e) {}
    return blank();
  }
  let data = load();
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {}
  }

  // --- server -----------------------------------------------------------------------------

  let server = { online: false, ai: false };
  const ready = fetch("api/health")
    .then((r) => r.json())
    .then((j) => (server = { online: Boolean(j.ok), ai: Boolean(j.ai) }))
    .catch(() => (server = { online: false, ai: false }));

  async function api(method, path, body, headers) {
    const res = await fetch(path, {
      method,
      headers: Object.assign({ "Content-Type": "application/json" }, headers || {}),
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = {};
    try {
      json = await res.json();
    } catch (e) {}
    if (!res.ok) {
      const err = new Error(json.error || "Something went wrong. Please try again.");
      err.status = res.status;
      throw err;
    }
    return json;
  }

  // --- DOM helpers ------------------------------------------------------------------------

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    kids.flat(Infinity).forEach((c) => {
      if (c == null || c === false) return;
      el.append(c.nodeType ? c : document.createTextNode(String(c)));
    });
    return el;
  }
  function mount(...nodes) {
    view.replaceChildren(...nodes.filter((n) => n != null && n !== false));
  }
  function svg(tag, attrs) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }
  function fmtDate(iso) {
    return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }
  function charCounter(textarea, max) {
    const el = h("span", { class: "counter" });
    const update = () => (el.textContent = `${textarea.value.length} / ${max}`);
    textarea.addEventListener("input", update);
    update();
    return el;
  }

  // --- router -----------------------------------------------------------------------------

  let cleanup = null;
  const routes = { home, discover, companion, thoughts, create, breathe, help, privacy };
  const titles = { discover: "Who am I?", companion: "Talk", thoughts: "Thoughts", create: "Create", breathe: "Breathe", help: "Get help now", privacy: "Your privacy" };
  let firstRender = true;

  function router() {
    if (cleanup) cleanup();
    cleanup = null;
    const [name, sub] = location.hash.slice(1).split("/");
    const fn = routes[name] || home;
    document.querySelectorAll(".nav a").forEach((a) => {
      if (a.dataset.route === name) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    document.title = titles[name] ? `${titles[name]} · Lantern` : "Lantern";
    fn(sub);
    window.scrollTo(0, 0);
    if (!firstRender) view.focus({ preventScroll: true });
    firstRender = false;
  }
  window.addEventListener("hashchange", router);

  // --- shared pieces ----------------------------------------------------------------------

  function crisisCard() {
    return h(
      "div",
      { class: "card crisis", role: "alert" },
      h("h3", null, "You don't have to go through this alone"),
      h("p", null, "If you're thinking about suicide or hurting yourself, please reach out to someone right now. Talking to a real person can help."),
      h("p", null, "If you're in immediate danger, call your local emergency number."),
      h("a", { class: "btn", href: "#help" }, "Find a helpline near you")
    );
  }

  // --- home -------------------------------------------------------------------------------

  function home() {
    const suggestion = h("div");
    const moodButtons = C.MOODS.map((m) =>
      h(
        "button",
        {
          class: "mood",
          type: "button",
          "aria-pressed": "false",
          onclick: (ev) => {
            moodButtons.forEach((b) => b.setAttribute("aria-pressed", String(b === ev.currentTarget)));
            data.moods = [{ mood: m.id, at: new Date().toISOString() }].concat(data.moods).slice(0, 60);
            save();
            const s = C.MOOD_SUGGESTIONS[m.id];
            suggestion.replaceChildren(
              h(
                "div",
                { class: "fade-in" },
                h("p", null, s.message),
                h("div", { class: "row" }, s.actions.map((a, i) => h("a", { class: i === 0 ? "btn" : "btn ghost", href: "#" + a.route }, a.label)))
              )
            );
          },
        },
        h("span", { "aria-hidden": "true" }, m.emoji),
        h("span", null, m.label)
      )
    );

    const latest = data.portraits[0];
    mount(
      h(
        "section",
        { class: "hero" },
        h("h1", null, "You belong here."),
        h("p", null, "A quiet place to discover who you are, say what's on your mind, and feel a little less alone.")
      ),
      h(
        "section",
        { class: "card", "aria-labelledby": "mood-h" },
        h("h2", { id: "mood-h", style: "text-align:center" }, "How are you feeling right now?"),
        h("div", { class: "moods" }, moodButtons),
        suggestion
      ),
      latest &&
        h(
          "a",
          { class: "tile", href: "#discover", style: "margin-bottom:16px" },
          h("p", null, "Your portrait"),
          h("h3", null, latest.title),
          h("p", null, `From ${fmtDate(latest.created_at)}. Tap to revisit or retake.`)
        ),
      h(
        "div",
        { class: "grid" },
        tile("#discover", "✦", "Discover who you are", "Ten simple questions, and a portrait of you at the end."),
        tile("#companion", "✿", "Talk to someone", "A gentle AI companion that listens, any time of day."),
        tile("#thoughts", "❖", "Share your thoughts", "Write privately, or share and see you're not alone."),
        tile("#create", "✎", "Create", "Creative prompts to help you hear yourself."),
        tile("#breathe", "○", "Breathe", "One calm minute when everything feels like too much.")
      )
    );
  }

  function tile(href, icon, title, text) {
    return h("a", { class: "tile", href }, h("div", { class: "ico", "aria-hidden": "true" }, icon), h("h3", null, title), h("p", null, text));
  }

  // --- discover ---------------------------------------------------------------------------

  function discover() {
    const latest = data.portraits[0];
    if (!latest) return discoverIntro();
    mount(
      h("h1", null, "Who am I?"),
      portraitCard(latest),
      data.portraits.length > 1 &&
        h(
          "section",
          { class: "card" },
          h("h3", null, "You over time"),
          h("p", { class: "muted small" }, "People change. Each time you retake the questions, your portrait is saved here."),
          h("ul", null, data.portraits.map((p) => h("li", null, `${fmtDate(p.created_at)}: ${p.title}`)))
        ),
      h("div", { class: "row" }, h("button", { type: "button", onclick: startQuiz }, "Retake the questions"))
    );
  }

  function discoverIntro() {
    mount(
      h("h1", null, "Who am I?"),
      h(
        "section",
        { class: "card" },
        h("p", null, "Ten simple questions about what you enjoy, what you value and how you connect with people."),
        h("p", null, "There are no right or wrong answers. Go with your first feeling. Your answers stay on this device."),
        h("button", { type: "button", onclick: startQuiz }, "Begin")
      )
    );
  }

  function startQuiz() {
    const answers = {};
    let index = 0;
    const total = C.QUESTIONS.length;

    function show() {
      if (index >= total) return finish();
      const q = C.QUESTIONS[index];
      const buttons = q.options.map((o, i) =>
        h(
          "button",
          {
            class: "option",
            type: "button",
            "aria-pressed": String(answers[q.id] === i),
            onclick: () => {
              answers[q.id] = i;
              buttons.forEach((b, j) => b.setAttribute("aria-pressed", String(i === j)));
              setTimeout(() => {
                index += 1;
                show();
              }, 220);
            },
          },
          o.label
        )
      );
      mount(
        h("div", { class: "progress", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(total), "aria-valuenow": String(index) }, h("div", { style: `width:${(index / total) * 100}%` })),
        h(
          "section",
          { class: "fade-in" },
          h("p", { class: "muted small" }, `Question ${index + 1} of ${total}`),
          h("h1", { class: "question" }, q.text),
          h("div", { class: "options" }, buttons),
          h(
            "div",
            { class: "row spread", style: "margin-top:16px" },
            h(
              "button",
              {
                class: "link",
                type: "button",
                disabled: index === 0,
                onclick: () => {
                  index -= 1;
                  show();
                },
              },
              "← Back"
            ),
            h(
              "button",
              {
                class: "link",
                type: "button",
                onclick: () => {
                  delete answers[q.id];
                  index += 1;
                  show();
                },
              },
              "Skip this one"
            )
          )
        )
      );
    }

    function finish() {
      let portrait;
      try {
        portrait = C.buildPortrait(answers);
      } catch (e) {
        return discoverIntro();
      }
      portrait.created_at = new Date().toISOString();
      data.portraits = [portrait].concat(data.portraits).slice(0, 20);
      save();
      mount(h("h1", null, "Here's a little of who you are"), portraitCard(portrait), h("div", { class: "row" }, h("button", { class: "ghost", type: "button", onclick: startQuiz }, "Retake")));
    }

    show();
  }

  function portraitCard(p) {
    return h(
      "section",
      { class: "card fade-in" },
      constellation(p.scores),
      h("h2", null, p.title),
      h("p", null, p.summary),
      h("h3", null, "Your strengths"),
      h("ul", { class: "chips" }, p.strengths.map((s) => h("li", null, s))),
      h("h3", null, "Something to remember"),
      h("p", null, p.care),
      h("h3", null, "Ways to connect that suit you"),
      h("ul", null, p.connect.map((c) => h("li", null, c))),
      h("p", { class: "muted small" }, "This is a mirror, not a label. Take what feels true and leave the rest."),
      h(
        "div",
        { class: "row" },
        h("a", { class: "btn", href: "#companion" }, "Talk about it"),
        h("a", { class: "btn ghost", href: "#create" }, "Write about it")
      )
    );
  }

  // Each thread is a star on a ring; brighter, bigger stars are the stronger threads.
  function constellation(scores) {
    const names = C.THREAD_ORDER;
    const max = Math.max(1, ...names.map((n) => scores[n] || 0));
    const el = svg("svg", { class: "constellation", viewBox: "0 0 300 300", role: "img", "aria-label": "Your constellation: larger stars are your stronger threads." });
    const pts = names.map((n, i) => {
      const a = (i / names.length) * Math.PI * 2 - Math.PI / 2;
      const score = scores[n] || 0;
      return { n, score, x: 150 + Math.cos(a) * 95, y: 150 + Math.sin(a) * 95, lx: 150 + Math.cos(a) * 128, ly: 150 + Math.sin(a) * 128 };
    });
    const lit = pts.filter((p) => p.score > 0);
    lit.forEach((p, i) => {
      const q = lit[(i + 1) % lit.length];
      if (lit.length > 1 && q !== p) el.append(svg("line", { class: "line", x1: p.x, y1: p.y, x2: q.x, y2: q.y }));
    });
    pts.forEach((p) => {
      const r = 2 + (10 * p.score) / max;
      el.append(svg("circle", { class: "star", cx: p.x, cy: p.y, r: r * 2.2, opacity: p.score ? 0.18 : 0.06 }));
      el.append(svg("circle", { class: "star", cx: p.x, cy: p.y, r, opacity: p.score ? 1 : 0.35 }));
      const label = svg("text", { x: p.lx, y: p.ly + 4, "text-anchor": "middle" });
      label.textContent = C.THREADS[p.n].name.replace(/^The /, "");
      el.append(label);
    });
    return el;
  }

  // --- companion --------------------------------------------------------------------------

  const GREETING = "Hi, I'm Lantern's companion. I'm an AI, here to listen without judging. What's on your mind today?";
  const OFFLINE_PROMPTS = [
    "Thank you for sharing that. What do you think is underneath that feeling?",
    "That sounds like a lot to hold. What would feel even a little bit helpful right now?",
    "If a close friend told you this, what would you want to say to them?",
    "What's one small thing you could do for yourself in the next hour?",
    "Is there someone in your life you could tell a little of this to?",
  ];

  async function companion() {
    mount(h("h1", null, "Talk"), h("p", { class: "muted" }, "Getting things ready…"));
    await ready;
    if (location.hash.slice(1).split("/")[0] !== "companion") return;
    const live = server.ai;
    const chatEl = h("div", { class: "chat", "aria-live": "polite" });
    const alerts = h("div");
    const errorEl = h("p", { class: "error", role: "alert" });
    const input = h("textarea", { id: "msg", rows: "2", maxlength: String(C.LIMITS.chatMessage), placeholder: "Type what's on your mind…", "aria-label": "Your message" });
    const sendBtn = h("button", { type: "button" }, "Send");
    let busy = false;

    function bubble(role, text) {
      return h("div", { class: "bubble " + role }, text);
    }
    function renderChat() {
      chatEl.replaceChildren(bubble("assistant", GREETING), ...data.chat.map((m) => bubble(m.role, m.content)));
    }

    async function send() {
      const text = input.value.trim();
      if (!text || busy) return;
      errorEl.textContent = "";
      input.value = "";
      data.chat.push({ role: "user", content: text });
      save();
      renderChat();
      if (C.detectCrisis(text)) alerts.replaceChildren(crisisCard());
      const typing = h("div", { class: "bubble assistant typing", "aria-label": "Companion is typing" }, h("span"), h("span"), h("span"));
      chatEl.append(typing);
      typing.scrollIntoView({ block: "nearest", behavior: "smooth" });
      busy = true;
      sendBtn.disabled = true;
      try {
        let reply;
        if (live) {
          const portrait = data.sharePortrait ? C.portraitForCompanion(data.portraits[0]) : "";
          const res = await api("POST", "api/chat", { messages: data.chat, portrait });
          reply = res.reply;
          if (res.crisis) alerts.replaceChildren(crisisCard());
        } else {
          await new Promise((r) => setTimeout(r, 700));
          reply = OFFLINE_PROMPTS[data.chat.filter((m) => m.role === "user").length % OFFLINE_PROMPTS.length];
        }
        data.chat.push({ role: "assistant", content: reply });
        data.chat = data.chat.slice(-100);
        save();
      } catch (e) {
        errorEl.textContent = e.message;
      } finally {
        busy = false;
        sendBtn.disabled = false;
        renderChat();
        chatEl.lastChild.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }

    sendBtn.addEventListener("click", send);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });

    const portraitToggle =
      live &&
      data.portraits[0] &&
      h(
        "label",
        { class: "small muted", style: "font-weight:400;display:flex;gap:8px;align-items:center;margin-top:8px" },
        h("input", {
          type: "checkbox",
          checked: data.sharePortrait,
          onchange: (e) => {
            data.sharePortrait = e.target.checked;
            save();
          },
        }),
        "Let the companion know my portrait so it understands me better"
      );

    renderChat();
    mount(
      h("h1", null, "Talk"),
      h("p", { class: "muted" }, "A gentle companion to talk with, any time. It's an AI, not a person or a therapist, but it's here to listen."),
      !live &&
        h(
          "div",
          { class: "card notice" },
          h("strong", null, "Offline mode. "),
          "The live AI companion isn't connected right now, so you'll get pre-written reflection prompts instead. You can still write freely; it all stays on your device."
        ),
      chatEl,
      alerts,
      errorEl,
      h("div", { class: "composer" }, input, sendBtn),
      portraitToggle,
      h(
        "div",
        { class: "row spread", style: "margin-top:8px" },
        h("span", { class: "small muted" }, "Your conversation is saved only on this device."),
        h(
          "button",
          {
            class: "link",
            type: "button",
            onclick: () => {
              if (!confirm("Clear this conversation from your device?")) return;
              data.chat = [];
              save();
              alerts.replaceChildren();
              renderChat();
            },
          },
          "Clear conversation"
        )
      )
    );
  }

  // --- thoughts ---------------------------------------------------------------------------

  async function thoughts(sub) {
    mount(h("h1", null, "Thoughts"), h("p", { class: "muted" }, "Getting things ready…"));
    await ready;
    if (location.hash.slice(1).split("/")[0] !== "thoughts") return;
    let tab = sub === "mine" ? "mine" : "everyone";
    let visibility = server.online ? "share" : "private";

    const text = h("textarea", { id: "thought", maxlength: String(C.LIMITS.thought), placeholder: "What's on your mind?" });
    const name = h("input", { type: "text", id: "name", maxlength: String(C.LIMITS.name), placeholder: "Someone", value: data.name || "" });
    const nameRow = h("div", { style: "margin-top:10px" }, h("label", { for: "name" }, "Name to show (optional)"), name);
    const alerts = h("div");
    const errorEl = h("p", { class: "error", role: "alert" });
    const submit = h("button", { type: "button" });
    let crisisAcknowledged = false;

    const segPrivate = h("button", { type: "button", onclick: () => setVisibility("private") }, "Keep private");
    const segShare = h("button", { type: "button", disabled: !server.online, onclick: () => setVisibility("share") }, "Share with everyone");
    function setVisibility(v) {
      visibility = v;
      segPrivate.setAttribute("aria-pressed", String(v === "private"));
      segShare.setAttribute("aria-pressed", String(v === "share"));
      nameRow.hidden = v !== "share";
      submit.textContent = v === "share" ? "Share" : "Save privately";
      crisisAcknowledged = false;
    }
    text.addEventListener("input", () => (crisisAcknowledged = false));

    submit.addEventListener("click", async () => {
      errorEl.textContent = "";
      let value;
      try {
        value = C.validateText(text.value, C.LIMITS.thought, "Your thought");
      } catch (e) {
        errorEl.textContent = e.message;
        return;
      }
      if (C.detectCrisis(value) && !crisisAcknowledged) {
        alerts.replaceChildren(crisisCard());
        crisisAcknowledged = true;
        if (visibility === "share") {
          submit.textContent = "Share anyway";
          return;
        }
      }
      if (visibility === "private") {
        data.notes = [{ id: String(Date.now()), text: value, created_at: new Date().toISOString() }].concat(data.notes);
        save();
        text.value = "";
        tab = "mine";
        renderTabs();
        renderList();
        return;
      }
      submit.disabled = true;
      try {
        data.name = C.cleanText(name.value);
        const res = await api("POST", "api/posts", { text: value, name: data.name });
        data.myPosts[res.post.id] = res.token;
        save();
        text.value = "";
        setVisibility("share");
        tab = "everyone";
        renderTabs();
        renderList();
      } catch (e) {
        errorEl.textContent = e.message;
      } finally {
        submit.disabled = false;
      }
    });

    const list = h("div");
    const tabEveryone = h("button", { type: "button", onclick: () => switchTab("everyone") }, "Everyone");
    const tabMine = h("button", { type: "button", onclick: () => switchTab("mine") }, "My private notes");
    function switchTab(t) {
      tab = t;
      renderTabs();
      renderList();
    }
    function renderTabs() {
      tabEveryone.setAttribute("aria-pressed", String(tab === "everyone"));
      tabMine.setAttribute("aria-pressed", String(tab === "mine"));
    }

    async function renderList() {
      if (tab === "mine") return renderNotes();
      if (!server.online) {
        list.replaceChildren(h("div", { class: "card notice" }, "Shared thoughts need the Lantern server, which isn't reachable right now. Your private notes still work."));
        return;
      }
      list.replaceChildren(h("p", { class: "muted" }, "Loading…"));
      try {
        const { posts } = await api("GET", "api/posts");
        if (tab !== "everyone") return;
        list.replaceChildren(...(posts.length ? posts.map(postCard) : [h("p", { class: "muted" }, "No shared thoughts yet. Yours could be the first.")]));
      } catch (e) {
        list.replaceChildren(h("p", { class: "error" }, e.message));
      }
    }

    function renderNotes() {
      if (!data.notes.length) {
        list.replaceChildren(h("p", { class: "muted" }, "Nothing here yet. Private notes, and anything you write in Create, are kept here on your device."));
        return;
      }
      list.replaceChildren(
        ...data.notes.map((n) =>
          h(
            "article",
            { class: "card" },
            h("div", { class: "post-meta" }, fmtDate(n.created_at), " ", h("span", { class: "badge" }, "Private")),
            n.prompt && h("p", { class: "muted small" }, n.prompt),
            h("p", { class: "post-text" }, n.text),
            h(
              "button",
              {
                class: "link",
                type: "button",
                onclick: () => {
                  if (!confirm("Delete this note?")) return;
                  data.notes = data.notes.filter((x) => x.id !== n.id);
                  save();
                  renderNotes();
                },
              },
              "Delete"
            )
          )
        )
      );
    }

    function postCard(p) {
      const mine = Boolean(data.myPosts[p.id]);
      const related = data.related.includes(p.id);
      const relateBtn = h(
        "button",
        {
          class: "ghost",
          type: "button",
          "aria-pressed": String(related),
          disabled: related,
          onclick: async () => {
            relateBtn.disabled = true;
            try {
              await api("POST", `api/posts/${p.id}/relate`);
              data.related = data.related.concat(p.id).slice(-500);
              save();
              relateBtn.textContent = `\u{1F91D} I relate · ${p.relates + 1}`;
            } catch (e) {
              relateBtn.disabled = false;
            }
          },
        },
        `\u{1F91D} I relate${p.relates ? " · " + p.relates : ""}`
      );
      const comments = h("div", { class: "comments", hidden: true });
      const commentList = h("div", null, p.comments.map(commentEl));
      const cText = h("textarea", { rows: "2", maxlength: String(C.LIMITS.comment), placeholder: "Write something kind…", "aria-label": "Your comment", style: "min-height:60px" });
      const cError = h("p", { class: "error", role: "alert" });
      const cSend = h(
        "button",
        {
          type: "button",
          onclick: async () => {
            cError.textContent = "";
            cSend.disabled = true;
            try {
              const { comment } = await api("POST", `api/posts/${p.id}/comments`, { text: cText.value, name: data.name });
              p.comments.push(comment);
              commentList.append(commentEl(comment));
              cText.value = "";
              toggle.textContent = `Comments · ${p.comments.length}`;
            } catch (e) {
              cError.textContent = e.message;
            } finally {
              cSend.disabled = false;
            }
          },
        },
        "Reply"
      );
      comments.append(commentList, cText, cError, h("div", { class: "row", style: "margin-top:8px" }, cSend));
      const toggle = h(
        "button",
        {
          class: "ghost",
          type: "button",
          onclick: () => (comments.hidden = !comments.hidden),
        },
        p.comments.length ? `Comments · ${p.comments.length}` : "Comment"
      );
      const card = h(
        "article",
        { class: "card" },
        h("div", { class: "post-meta" }, `${p.name} · ${C.timeAgo(p.created_at)}`, mine ? " " : "", mine && h("span", { class: "badge" }, "You")),
        h("p", { class: "post-text" }, p.text),
        h(
          "div",
          { class: "row" },
          relateBtn,
          toggle,
          h("span", { style: "flex:1" }),
          mine
            ? h(
                "button",
                {
                  class: "link",
                  type: "button",
                  onclick: async () => {
                    if (!confirm("Delete this thought for everyone?")) return;
                    try {
                      await api("DELETE", `api/posts/${p.id}`, null, { "X-Owner-Token": data.myPosts[p.id] });
                      delete data.myPosts[p.id];
                      save();
                      card.remove();
                    } catch (e) {
                      alert(e.message);
                    }
                  },
                },
                "Delete"
              )
            : h(
                "button",
                {
                  class: "link",
                  type: "button",
                  onclick: async (ev) => {
                    if (!confirm("Report this as unkind or unsafe? Thoughts with several reports are hidden.")) return;
                    try {
                      await api("POST", `api/posts/${p.id}/report`);
                      ev.target.textContent = "Reported";
                      ev.target.disabled = true;
                    } catch (e) {
                      alert(e.message);
                    }
                  },
                },
                "Report"
              )
        ),
        comments
      );
      return card;
    }

    function commentEl(c) {
      return h("div", { class: "comment" }, h("div", { class: "post-meta" }, `${c.name} · ${C.timeAgo(c.created_at)}`), h("p", { class: "post-text" }, c.text));
    }

    setVisibility(visibility);
    renderTabs();
    mount(
      h("h1", null, "Thoughts"),
      h("p", { class: "muted" }, "Say what's on your mind. Keep it private, or share it anonymously so others know they're not alone."),
      h(
        "section",
        { class: "card" },
        h("label", { for: "thought" }, "Your thought"),
        text,
        h("div", { class: "row spread", style: "margin-top:6px" }, h("div", { class: "seg", role: "group", "aria-label": "Who can see this" }, segPrivate, segShare), charCounter(text, C.LIMITS.thought)),
        nameRow,
        !server.online && h("p", { class: "small muted", style: "margin-top:8px" }, "Sharing is unavailable right now because the Lantern server can't be reached."),
        alerts,
        errorEl,
        h("div", { class: "row", style: "margin-top:12px" }, submit),
        h("p", { class: "small muted", style: "margin:10px 0 0" }, "Be kind. Shared thoughts are public, so leave out anything that identifies you or others.")
      ),
      h("div", { class: "seg", role: "group", "aria-label": "Show", style: "margin-bottom:12px" }, tabEveryone, tabMine),
      list
    );
    renderList();
  }

  // --- create -----------------------------------------------------------------------------

  function create() {
    let prompt = C.CREATIVE_PROMPTS[Math.floor(Math.random() * C.CREATIVE_PROMPTS.length)];
    const promptEl = h("p", { class: "question", style: "font-size:1.3rem" }, prompt);
    const text = h("textarea", { id: "create-text", maxlength: String(C.LIMITS.thought), "aria-label": "Your response", placeholder: "Write as much or as little as you like…" });
    const status = h("p", { class: "small muted", role: "status" });
    mount(
      h("h1", null, "Create"),
      h("p", { class: "muted" }, "Small creative prompts to help you hear yourself. Nobody else sees what you write here."),
      h(
        "section",
        { class: "card" },
        promptEl,
        text,
        h("div", { class: "row spread", style: "margin-top:6px" }, charCounter(text, C.LIMITS.thought), status),
        h(
          "div",
          { class: "row", style: "margin-top:12px" },
          h(
            "button",
            {
              type: "button",
              onclick: () => {
                const value = C.cleanText(text.value);
                if (!value) {
                  status.textContent = "Write something first.";
                  return;
                }
                data.notes = [{ id: String(Date.now()), prompt, text: value.slice(0, C.LIMITS.thought), created_at: new Date().toISOString() }].concat(data.notes);
                save();
                text.value = "";
                status.replaceChildren("Saved to your private notes. ", h("a", { href: "#thoughts/mine" }, "See them"));
              },
            },
            "Save to my notes"
          ),
          h(
            "button",
            {
              class: "ghost",
              type: "button",
              onclick: () => {
                const others = C.CREATIVE_PROMPTS.filter((p) => p !== prompt);
                prompt = others[Math.floor(Math.random() * others.length)];
                promptEl.textContent = prompt;
                status.textContent = "";
              },
            },
            "Another prompt"
          )
        )
      ),
      h("div", { class: "grid" }, tile("#breathe", "○", "Breathe", "One calm minute."), tile("#discover", "✦", "Who am I?", "See your portrait and constellation."))
    );
  }

  // --- breathe ----------------------------------------------------------------------------

  function breathe() {
    const circle = h("div", { class: "breath-circle", "aria-hidden": "true" });
    const label = h("div", { class: "breath-label", "aria-live": "polite" }, "Ready when you are");
    const btn = h("button", { type: "button" }, "Start");
    const steps = [
      { text: "Breathe in…", scale: 1, ms: 4000 },
      { text: "Hold…", scale: 1, ms: 4000 },
      { text: "Breathe out…", scale: 0.6, ms: 6000 },
    ];
    let timer = null;
    let cycles = 0;

    function step(i) {
      if (i === steps.length) {
        cycles += 1;
        if (cycles >= 4) return stop("Well done. Notice how you feel now.");
        i = 0;
      }
      const s = steps[i];
      label.textContent = s.text;
      circle.style.transitionDuration = s.ms + "ms";
      circle.style.transform = `scale(${s.scale})`;
      timer = setTimeout(() => step(i + 1), s.ms);
    }
    function stop(message) {
      clearTimeout(timer);
      timer = null;
      circle.style.transitionDuration = "1s";
      circle.style.transform = "scale(.6)";
      label.textContent = message || "Ready when you are";
      btn.textContent = "Start";
    }
    btn.addEventListener("click", () => {
      if (timer) return stop();
      cycles = 0;
      btn.textContent = "Stop";
      step(0);
    });
    cleanup = () => clearTimeout(timer);

    mount(
      h("h1", null, "Breathe"),
      h("p", { class: "muted" }, "About one minute. Breathe in for 4, hold for 4, and breathe out slowly for 6. Follow the light."),
      h("section", { class: "card breathe" }, circle, label, h("div", { style: "margin-top:16px" }, btn))
    );
  }

  // --- help -------------------------------------------------------------------------------

  const HELPLINES = [
    { where: "United States", name: "988 Suicide & Crisis Lifeline", how: "Call or text 988", tel: "988" },
    { where: "Canada", name: "9-8-8 Suicide Crisis Helpline", how: "Call or text 988", tel: "988" },
    { where: "UK & Ireland", name: "Samaritans", how: "Call 116 123, free, any time", tel: "116123" },
    { where: "Australia", name: "Lifeline", how: "Call 13 11 14", tel: "131114" },
    { where: "New Zealand", name: "Need to talk?", how: "Call or text 1737", tel: "1737" },
    { where: "India", name: "Tele-MANAS", how: "Call 14416", tel: "14416" },
  ];

  function help() {
    mount(
      h("h1", null, "Get help now"),
      h(
        "section",
        { class: "card crisis" },
        h("h3", null, "If you or someone else is in immediate danger"),
        h("p", null, "Call your local emergency number now (for example 911, 999, 112 or 000), or go to the nearest emergency department."),
        h("p", { style: "margin:0" }, "You matter, and you deserve support from a real person.")
      ),
      h(
        "section",
        { class: "card" },
        h("h2", null, "Talk to someone now"),
        h("p", { class: "muted" }, "Free, confidential support from trained people."),
        h(
          "ul",
          null,
          HELPLINES.map((l) => h("li", { style: "margin-bottom:8px" }, h("strong", null, l.where), `: ${l.name}. `, h("a", { href: "tel:" + l.tel }, l.how)))
        ),
        h(
          "p",
          null,
          h("strong", null, "Anywhere else: "),
          h("a", { href: "https://findahelpline.com", target: "_blank", rel: "noopener noreferrer" }, "findahelpline.com"),
          " lists free helplines in many countries."
        )
      ),
      h(
        "section",
        { class: "card" },
        h("h2", null, "Not in crisis, but struggling?"),
        h(
          "ul",
          null,
          h("li", null, "Tell one person you trust how you're really doing."),
          h("li", null, "A doctor or counsellor can help, and it's a sign of strength to ask."),
          h("li", null, h("a", { href: "#companion" }, "Talk with the companion"), " or ", h("a", { href: "#breathe" }, "take a calm minute"), ".")
        )
      )
    );
  }

  // --- privacy ----------------------------------------------------------------------------

  function privacy() {
    const status = h("p", { class: "small muted", role: "status" });
    mount(
      h("h1", null, "Your privacy & data"),
      h(
        "section",
        { class: "card" },
        h("h3", null, "On this device only"),
        h("p", null, "Your portraits, private notes, mood check-ins and companion conversation are saved in this browser. No account, no email."),
        h("h3", null, "On the Lantern server"),
        h("p", null, "Only thoughts and comments you choose to share, with whatever name you type. You can delete your own shared thoughts at any time."),
        h("h3", null, "The AI companion"),
        h("p", null, "To reply, your conversation is sent to Anthropic's Claude AI. Lantern's server does not store it.")
      ),
      h(
        "section",
        { class: "card" },
        h("h3", null, "Your data, your choice"),
        h(
          "div",
          { class: "row" },
          h(
            "button",
            {
              class: "ghost",
              type: "button",
              onclick: () => {
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                const a = h("a", { href: URL.createObjectURL(blob), download: "lantern-my-data.json" });
                document.body.append(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(a.href), 1000);
              },
            },
            "Download my data"
          ),
          h(
            "button",
            {
              class: "ghost",
              type: "button",
              style: "border-color:var(--danger);color:var(--danger)",
              onclick: async () => {
                if (!confirm("Delete everything Lantern has saved on this device, and your shared thoughts? This can't be undone.")) return;
                // Keep the owner tokens of any shared thought we couldn't delete, so it can be retried.
                const remaining = {};
                for (const id of Object.keys(data.myPosts)) {
                  try {
                    await api("DELETE", `api/posts/${id}`, null, { "X-Owner-Token": data.myPosts[id] });
                  } catch (e) {
                    if (e.status !== 404) remaining[id] = data.myPosts[id];
                  }
                }
                const failed = Object.keys(remaining).length;
                data = blank();
                data.myPosts = remaining;
                if (failed) save();
                else {
                  try {
                    localStorage.removeItem(KEY);
                  } catch (e) {}
                }
                status.textContent = failed
                  ? `Your device data is deleted. ${failed} shared thought(s) couldn't be removed because the server wasn't reachable.`
                  : "Everything is deleted.";
              },
            },
            "Delete everything"
          )
        ),
        status
      )
    );
  }

  router();
})();
