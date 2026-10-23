// Lantern backend for a claude.ai Artifact: shared thoughts live in the artifact's `db`, the
// companion uses the `sample` capability (the viewer's own Claude account), and `user` tells us
// who is viewing. Same interface as public/backend-server.js.
//
// Each thought is one document in "thoughts". Relates, reports and comments are maps keyed by
// viewer or comment id, so concurrent updates merge instead of overwriting each other.
(function () {
  "use strict";

  const C = window.LanternCore;
  const HIDE_AFTER_REPORTS = 3;
  let db = null;
  let sample = null;
  let user = null;
  let uid = null;
  let owner = false;
  let readOnly = false;

  const ready = (async () => {
    const c = window.claude;
    if (!c || typeof c.use !== "function") return;
    [db, sample, user] = await Promise.all([c.use("db"), c.use("sample"), c.use("user")]);
    if (user) {
      uid = await user.id();
      owner = await user.isOwner();
      if ((await user.can("data.write")) === false) readOnly = true;
    }
  })();

  function friendly(e, fallback) {
    const err = new Error(fallback);
    if (e && e.code === "invalid_argument") {
      readOnly = true;
      err.message = "Posting isn't open to you on this page. You can still read what others have shared.";
    } else if (e && e.code === "quota_exceeded") {
      err.message = "Lantern is full right now. Please try again later.";
    } else if (e && e.code === "resource_exhausted") {
      err.message = "You're going a little fast. Please wait a moment and try again.";
    } else if (e && e.status === 400) {
      err.message = e.message;
    }
    return err;
  }

  function norm(doc) {
    const d = doc.data() || {};
    const relates = d.relates || {};
    return {
      id: doc.id,
      name: String(d.name || "Someone"),
      text: String(d.text || ""),
      created_at: String(d.created_at || ""),
      relates: Object.keys(relates).length,
      reports: Object.keys(d.reports || {}).length,
      comments: Object.values(d.comments || {})
        .map((c) => ({ name: String(c.name || "Someone"), text: String(c.text || ""), created_at: String(c.created_at || "") }))
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
      mine: Boolean(uid) && d.author === uid,
      canDelete: Boolean(uid) && (d.author === uid || owner),
      related: Boolean(uid && relates[uid]),
    };
  }

  function thought(id) {
    return db.collection("thoughts").doc(id);
  }

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  window.LanternBackend = {
    async init() {
      await ready;
      let posts = "none";
      let postsNote = "Shared thoughts are only available when you're signed in to Claude.";
      if (db) {
        posts = readOnly || !uid ? "read" : "write";
        postsNote = posts === "read" ? "You can read what people have shared. Posting is open to people the owner invites as editors." : "";
      }
      return { ai: Boolean(sample), posts, postsNote };
    },

    async chat(history, portrait, crisis, onText) {
      if (!sample) throw Object.assign(new Error("The live companion isn't available here."), { offline: true });
      const rules = C.COMPANION_PROMPT + (portrait ? `\n\nThe person chose to share this about themselves. ${portrait}` : "");
      const turns = [{ role: "user", content: rules }].concat(history);
      if (crisis) turns.push({ role: "user", content: `(A note from Lantern, not from the person: ${C.CRISIS_NOTE})` });
      try {
        const { text } = await sample(turns, { cache: false, effort: "low", onText: ({ text }) => onText && onText(text) });
        return { reply: text, crisis };
      } catch (e) {
        const code = e && e.code;
        if (code === "refused") return { reply: "I'm not able to respond to that, but I'm still here with you. How are you feeling right now?", crisis };
        const err = new Error("The companion couldn't reply just now. Please try again.");
        if (["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"].includes(code)) {
          sample = null;
          err.offline = true;
          err.message = "The live companion isn't available for you here, so you'll get reflection prompts instead.";
        } else if (code === "rate_limited") err.message = "You've reached a usage limit for now. Please try again a little later.";
        else if (code === "session_expired") err.message = "Please sign in to Claude again, then try once more.";
        throw err;
      }
    },

    subscribePosts(onPosts, onError) {
      if (!db) {
        onPosts([]);
        return () => {};
      }
      return db
        .collection("thoughts")
        .orderBy("created_at", "desc")
        .limit(200)
        .onSnapshot(
          (snap) => onPosts(snap.docs.map(norm).filter((p) => p.reports < HIDE_AFTER_REPORTS)),
          () => onError(new Error("Shared thoughts couldn't be loaded. Try reloading the page."))
        );
    },

    async addPost(input) {
      try {
        const text = C.validateText(input.text, C.LIMITS.thought, "Your thought");
        await thought(newId()).set({ text, name: C.cleanName(input.name), author: uid, created_at: new Date().toISOString(), relates: {}, reports: {}, comments: {} });
      } catch (e) {
        throw friendly(e, "Your thought couldn't be shared. Please try again.");
      }
    },
    async addComment(id, input) {
      try {
        const text = C.validateText(input.text, C.LIMITS.comment, "Your comment");
        await thought(id).update({ comments: { [newId()]: { text, name: C.cleanName(input.name), author: uid, created_at: new Date().toISOString() } } });
      } catch (e) {
        throw friendly(e, "Your comment couldn't be posted. Please try again.");
      }
    },
    async relate(id) {
      try {
        await thought(id).update({ relates: { [uid]: true } });
      } catch (e) {
        throw friendly(e, "That didn't go through. Please try again.");
      }
    },
    async report(id) {
      try {
        await thought(id).update({ reports: { [uid]: true } });
      } catch (e) {
        throw friendly(e, "The report didn't go through. Please try again.");
      }
    },
    async deletePost(id) {
      try {
        await thought(id).delete();
      } catch (e) {
        throw friendly(e, "That thought couldn't be deleted. Please try again.");
      }
    },

    async deleteAllMine() {
      if (!db || !uid) return 0;
      let failed = 0;
      try {
        const snap = await db.collection("thoughts").where("author", "==", uid).get();
        for (const doc of snap.docs) {
          try {
            await thought(doc.id).delete();
          } catch (e) {
            failed += 1;
          }
        }
      } catch (e) {
        return 1;
      }
      return failed;
    },

    async saveFile(filename, text) {
      const downloads = window.claude && (await window.claude.use("downloads"));
      if (!downloads) throw new Error("Downloads aren't available here.");
      await downloads.save({ filename, data: text });
    },

    privacy: {
      shared: "Only thoughts and comments you choose to share, with the name you type. Shared thoughts are visible to everyone who can open this page. You can delete your own at any time.",
      ai: "The companion uses your own Claude account. Claude asks your permission the first time, and your conversation is not stored in Lantern's shared data.",
    },
  };
})();
