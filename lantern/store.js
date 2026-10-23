// Shared thoughts and comments. The operations are pure functions over a plain state object so
// they are easy to test; createFileStore wraps them with JSON-file persistence.
//
// Posting returns a secret owner token. Only its hash is stored, and the author's browser keeps
// the token so they (and only they) can delete the post later.
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const C = require("./public/core.js");

const HIDE_AFTER_REPORTS = 3;
const MAX_POSTS = 2000;

function emptyState() {
  return { posts: [] };
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function newId() {
  return crypto.randomUUID();
}

function addPost(state, input, now) {
  const text = C.validateText(input && input.text, C.LIMITS.thought, "Your thought");
  const token = crypto.randomBytes(24).toString("hex");
  const post = {
    id: newId(),
    name: C.cleanName(input && input.name),
    text,
    created_at: new Date(now || Date.now()).toISOString(),
    relates: 0,
    reports: 0,
    owner_hash: hashToken(token),
    comments: [],
  };
  const posts = [post].concat(state.posts).slice(0, MAX_POSTS);
  return { state: { ...state, posts }, post: publicPost(post), token };
}

function findPost(state, id) {
  const post = state.posts.find((p) => p.id === id);
  if (!post || post.reports >= HIDE_AFTER_REPORTS) throw notFound();
  return post;
}

function updatePost(state, id, fn) {
  findPost(state, id);
  const posts = state.posts.map((p) => (p.id === id ? fn(p) : p));
  return { ...state, posts };
}

function addComment(state, id, input, now) {
  const text = C.validateText(input && input.text, C.LIMITS.comment, "Your comment");
  const comment = { id: newId(), name: C.cleanName(input && input.name), text, created_at: new Date(now || Date.now()).toISOString() };
  const next = updatePost(state, id, (p) => ({ ...p, comments: p.comments.concat(comment) }));
  return { state: next, comment };
}

function relate(state, id) {
  return updatePost(state, id, (p) => ({ ...p, relates: p.relates + 1 }));
}

function report(state, id) {
  return updatePost(state, id, (p) => ({ ...p, reports: p.reports + 1 }));
}

function deletePost(state, id, token) {
  const post = findPost(state, id);
  if (!token || hashToken(token) !== post.owner_hash) {
    const e = new Error("Only the person who shared this can delete it.");
    e.status = 403;
    throw e;
  }
  return { ...state, posts: state.posts.filter((p) => p.id !== id) };
}

// Newest first, reported-away posts hidden, owner hashes never leave the server.
function listPosts(state, limit) {
  return state.posts
    .filter((p) => p.reports < HIDE_AFTER_REPORTS)
    .slice(0, limit || 100)
    .map(publicPost);
}

function publicPost(p) {
  return { id: p.id, name: p.name, text: p.text, created_at: p.created_at, relates: p.relates, comments: p.comments };
}

function notFound() {
  const e = new Error("That thought isn't available any more.");
  e.status = 404;
  return e;
}

function createFileStore(file) {
  let state = emptyState();
  try {
    state = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!Array.isArray(state.posts)) state = emptyState();
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  function save() {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(state));
    fs.renameSync(tmp, file);
  }
  return {
    get: () => state,
    // Apply a state transition and persist it; returns whatever the operation returned.
    apply(fn) {
      const result = fn(state);
      state = result && result.state ? result.state : result;
      save();
      return result;
    },
  };
}

module.exports = {
  HIDE_AFTER_REPORTS,
  emptyState,
  addPost,
  addComment,
  relate,
  report,
  deletePost,
  listPosts,
  createFileStore,
};
