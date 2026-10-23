// Lantern backend for the Node server (server.js). The UI talks only to window.LanternBackend,
// so the same app also runs on other backends (see artifact/backend-artifact.js).
//
//   init()                         -> { ai, posts: "none" | "read" | "write", postsNote }
//   chat(history, portrait, crisis, onText) -> { reply, crisis }; rejects with { message, offline? }
//   subscribePosts(onPosts, onError)        -> unsubscribe; posts are normalized (see norm)
//   addPost({text, name}), addComment(id, {text, name}), relate(id), report(id), deletePost(id)
//   deleteAllMine()                -> number of shared posts that could not be deleted
//   saveFile(filename, text)       -> offers a file download
//   privacy                        -> { shared, ai } wording for the privacy page
(function () {
  "use strict";

  const KEY = "lantern.server.v1";
  let local = { tokens: {}, related: [] };
  try {
    // Owner tokens were kept in the app's own storage before the backend split.
    const old = JSON.parse(localStorage.getItem("lantern.v1") || "{}");
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    local = saved || { tokens: old.myPosts || {}, related: old.related || [] };
  } catch (e) {}
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(local));
    } catch (e) {}
  }

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

  function norm(p) {
    return Object.assign({}, p, { mine: Boolean(local.tokens[p.id]), canDelete: Boolean(local.tokens[p.id]), related: local.related.includes(p.id) });
  }

  const listeners = new Set();
  function refresh() {
    listeners.forEach((load) => load());
  }

  async function deletePost(id) {
    await api("DELETE", `api/posts/${id}`, null, { "X-Owner-Token": local.tokens[id] });
    delete local.tokens[id];
    save();
    refresh();
  }

  window.LanternBackend = {
    async init() {
      try {
        const j = await api("GET", "api/health");
        return { ai: Boolean(j.ai), posts: "write", postsNote: "" };
      } catch (e) {
        return { ai: false, posts: "none", postsNote: "Shared thoughts need the Lantern server, which isn't reachable right now." };
      }
    },

    async chat(history, portrait, crisis, onText) {
      try {
        const res = await api("POST", "api/chat", { messages: history, portrait });
        if (onText) onText(res.reply);
        return res;
      } catch (e) {
        if (e.status === 503) e.offline = true;
        throw e;
      }
    },

    subscribePosts(onPosts, onError) {
      let stopped = false;
      const load = () =>
        api("GET", "api/posts")
          .then((j) => !stopped && onPosts(j.posts.map(norm)))
          .catch((e) => !stopped && onError(e));
      listeners.add(load);
      load();
      const timer = setInterval(load, 30000);
      return () => {
        stopped = true;
        clearInterval(timer);
        listeners.delete(load);
      };
    },

    async addPost(input) {
      const res = await api("POST", "api/posts", input);
      local.tokens[res.post.id] = res.token;
      save();
      refresh();
    },
    async addComment(id, input) {
      await api("POST", `api/posts/${id}/comments`, input);
      refresh();
    },
    async relate(id) {
      await api("POST", `api/posts/${id}/relate`);
      local.related = local.related.concat(id).slice(-500);
      save();
      refresh();
    },
    async report(id) {
      await api("POST", `api/posts/${id}/report`);
      refresh();
    },
    deletePost,

    async deleteAllMine() {
      // Keep the tokens of posts we couldn't delete, so they can be retried later.
      const remaining = {};
      for (const id of Object.keys(local.tokens)) {
        try {
          await api("DELETE", `api/posts/${id}`, null, { "X-Owner-Token": local.tokens[id] });
        } catch (e) {
          if (e.status !== 404) remaining[id] = local.tokens[id];
        }
      }
      local = { tokens: remaining, related: [] };
      save();
      return Object.keys(remaining).length;
    },

    async saveFile(filename, text) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      a.download = filename;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },

    privacy: {
      shared: "Only thoughts and comments you choose to share, with whatever name you type. You can delete your own shared thoughts at any time.",
      ai: "To reply, your conversation is sent to Anthropic's Claude AI. Lantern's server does not store it.",
    },
  };
})();
