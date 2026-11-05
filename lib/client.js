window.__ModuleLoader__.load({ id: "dsh-session-journal", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// client/src/index.js
var index_exports = {};
__export(index_exports, {
  ID: () => ID,
  KIND: () => KIND,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// client/src/Journal.jsx
var import_react2 = require("react");

// client/src/stores.js
var import_react = require("react");

// client/src/locales.js
var NS = "session-journal";
var zh = {
  "type.title": "\u5DE5\u4F5C\u65E5\u5FD7",
  "guide.description": "\u8FD9\u4E2A\u4F1A\u8BDD\u505A\u8FC7\u4EC0\u4E48\u3001\u73B0\u5728\u5728\u54EA\u4E00\u6B65",
  "error.notFound": "\u4F1A\u8BDD\u65E5\u5FD7\u8FD8\u6CA1\u6709\u5199\u5165",
  "error.load": "\u52A0\u8F7D\u5931\u8D25\uFF08{status}\uFF09",
  "kind.requirement": "\u9700\u6C42",
  "kind.research": "\u8C03\u7814",
  "kind.design": "\u65B9\u6848",
  "kind.implement": "\u5B9E\u73B0",
  "kind.review": "\u5BA1\u9605",
  "kind.fix": "\u4FEE\u6539",
  "kind.test": "\u6D4B\u8BD5",
  "kind.debug": "\u6392\u969C",
  "kind.deliver": "\u4EA4\u4ED8",
  "kind.discuss": "\u8BA8\u8BBA",
  "kind.other": "\u5176\u4ED6",
  "status.active": "\u8FDB\u884C\u4E2D",
  "status.blocked": "\u5361\u4F4F/\u5F85\u5B9A",
  "status.done": "\u5DF2\u5B8C\u6210",
  "status.doneOpen": "\u5DF2\u5B8C\u6210 \xB7 \u6709\u9057\u7559",
  "status.dropped": "\u5DF2\u653E\u5F03",
  "now.running": "\u8FDB\u884C\u4E2D",
  "now.stopped": "\u5DF2\u505C",
  "now.waiting": "\u7B49\u4F60",
  "count.open": "\u6CA1\u89E3\u51B3",
  "count.decided": "\u5B9A\u4E0B\u6765",
  "section.open": "\u6CA1\u89E3\u51B3",
  "section.decided": "\u5B9A\u4E0B\u6765\u7684",
  "stats.turns": "{n} \u8F6E",
  "stats.files": "{n} \u4E2A\u6587\u4EF6",
  "stats.tests": "\u6D4B\u8BD5 {passed}/{total}",
  "facts.files": "{n} \u6587\u4EF6",
  "facts.tests": "\u6D4B\u8BD5 {passed} \u8FC7",
  "facts.testsFailed": " {failed} \u8D25",
  "facts.reviews": "\u5BA1\u9605 {n} \u6B21",
  "turn.one": "\u7B2C {n} \u8F6E",
  "turn.range": "\u7B2C {from}\u2013{to} \u8F6E",
  "turn.running": "\u8FDB\u884C\u4E2D",
  "jump.title": "\u8DF3\u5230\u5BF9\u8BDD\u91CC\u7684\u7B2C {n} \u8F6E",
  "jump.noRail": "\u5148\u5207\u5230\u300C\u5BF9\u8BDD\u300D\u9875\u624D\u80FD\u8DF3\u8F6C",
  "jump.noTurn": "\u5BF9\u8BDD\u91CC\u6CA1\u627E\u5230\u8FD9\u4E00\u8F6E",
  "outcome.aborted": "\u88AB\u4E2D\u6B62",
  "outcome.interrupted": "\u88AB\u6253\u65AD",
  "outcome.error": "\u51FA\u9519",
  "outcome.canceled": "\u5DF2\u53D6\u6D88",
  "item.untitled": "\u8FD9\u4E2A\u4F1A\u8BDD",
  "item.noSummary": "\u8FD8\u6CA1\u6574\u7406\u51FA\u7ED3\u679C\uFF0C\u70B9\u4E0B\u9762\u7684\u8F6E\u6B21\u8DF3\u5230\u5BF9\u8BDD\u91CC\u770B\u3002",
  "tab.turns": "\u6309\u8F6E\u8DF3\u8F6C {n} \u8F6E",
  "tab.files": "\u6539\u52A8 {n} \u4E2A\u6587\u4EF6",
  "tab.collapseTurns": "\u6536\u8D77 {n} \u8F6E",
  "tab.collapseFiles": "\u6536\u8D77 {n} \u4E2A\u6587\u4EF6",
  "file.outside": "{path}\uFF08\u5DE5\u4F5C\u533A\u5916\uFF0C\u4E0D\u80FD\u5728\u53F3\u680F\u9884\u89C8\uFF09",
  "file.new": "\u65B0",
  "items.title": "\u505A\u4E86\u54EA\u4E9B\u4E8B",
  "items.count": "{n} \u4EF6",
  "todos.title": "\u5F53\u524D\u5F85\u529E",
  "todos.todo": "\u5F85\u529E",
  "todos.test": "\u6D4B\u8BD5",
  "todos.summary": "\u9057\u7559",
  "todos.inProgress": " \xB7 \u8FDB\u884C\u4E2D",
  "footer.off": "\u672A\u914D\u7F6E\u6458\u8981\u6A21\u578B\uFF0C\u53EA\u6309\u89C4\u5219\u6574\u7406",
  "footer.pending": "\u6B63\u5728\u603B\u7ED3 {n} \u8F6E\u2026\uFF08{done}/{total}\uFF09\uFF0C\u603B\u7ED3\u5B8C\u518D\u5206\u7EC4",
  "footer.outlining": "\u6B63\u5728\u6309\u5DE5\u4F5C\u9879\u6574\u7406\u2026",
  "footer.failed": "\u7B2C {turns} \u8F6E\u603B\u7ED3\u5931\u8D25",
  "footer.summarized": "\u5DF2\u603B\u7ED3 {done}/{total} \u8F6E",
  "footer.outlined": "\u6574\u7406\u4E8E {time}",
  "footer.refresh": "\u5237\u65B0",
  "footer.lang": "\u603B\u7ED3\u8BED\u8A00",
  "lang.auto": "\u8DDF\u968F\u754C\u9762",
  "lang.zh": "\u4E2D\u6587",
  "lang.en": "English",
  "empty.loading": "\u52A0\u8F7D\u4E2D\u2026",
  "empty.notStarted": "\u8FD9\u4E2A\u4F1A\u8BDD\u8FD8\u6CA1\u5F00\u59CB\u3002",
  "chip.waiting": "\u7B49\u4F60 \xB7 {label}",
  "chip.tipWaiting": "\u7B49\u4F60\uFF1A{text}",
  "chip.tipOpen": "\uFF08\u70B9\u51FB\u6253\u5F00\u5DE5\u4F5C\u65E5\u5FD7\uFF09"
};
var en = {
  "type.title": "Work log",
  "guide.description": "What this session has done and where it is now",
  "error.notFound": "The session log has not been written yet",
  "error.load": "Failed to load ({status})",
  "kind.requirement": "Requirements",
  "kind.research": "Research",
  "kind.design": "Design",
  "kind.implement": "Build",
  "kind.review": "Review",
  "kind.fix": "Fix",
  "kind.test": "Test",
  "kind.debug": "Debug",
  "kind.deliver": "Ship",
  "kind.discuss": "Discussion",
  "kind.other": "Other",
  "status.active": "In progress",
  "status.blocked": "Blocked",
  "status.done": "Done",
  "status.doneOpen": "Done \xB7 loose ends",
  "status.dropped": "Dropped",
  "now.running": "Running",
  "now.stopped": "Stopped",
  "now.waiting": "Your turn",
  "count.open": "Open",
  "count.decided": "Decided",
  "section.open": "Open",
  "section.decided": "Decided",
  "stats.turns": "{n} turns",
  "stats.files": "{n} files",
  "stats.tests": "Tests {passed}/{total}",
  "facts.files": "{n} files",
  "facts.tests": "Tests {passed} passed",
  "facts.testsFailed": ", {failed} failed",
  "facts.reviews": "{n} reviews",
  "turn.one": "Turn {n}",
  "turn.range": "Turns {from}\u2013{to}",
  "turn.running": "running",
  "jump.title": "Jump to turn {n} in the conversation",
  "jump.noRail": "Switch to the Chat view to jump",
  "jump.noTurn": "This turn is not in the conversation",
  "outcome.aborted": "stopped",
  "outcome.interrupted": "interrupted",
  "outcome.error": "failed",
  "outcome.canceled": "canceled",
  "item.untitled": "This session",
  "item.noSummary": "Not summarized yet. Click a turn below to read it in the chat.",
  "tab.turns": "Jump to a turn ({n})",
  "tab.files": "Changed files ({n})",
  "tab.collapseTurns": "Hide turns ({n})",
  "tab.collapseFiles": "Hide files ({n})",
  "file.outside": "{path} (outside the workspace, cannot preview in the sidebar)",
  "file.new": "new",
  "items.title": "What this session worked on",
  "items.count": "{n}",
  "todos.title": "Current todos",
  "todos.todo": "Todo",
  "todos.test": "Test",
  "todos.summary": "Left over",
  "todos.inProgress": " \xB7 in progress",
  "footer.off": "No summary model configured; grouped by rules only",
  "footer.pending": "Summarizing {n} turns\u2026 ({done}/{total}); grouping comes after",
  "footer.outlining": "Grouping into work items\u2026",
  "footer.failed": "Summary failed for turn {turns}",
  "footer.summarized": "Summarized {done}/{total} turns",
  "footer.outlined": "Updated {time}",
  "footer.refresh": "Refresh",
  "footer.lang": "Summary language",
  "lang.auto": "Same as UI",
  "lang.zh": "\u4E2D\u6587",
  "lang.en": "English",
  "empty.loading": "Loading\u2026",
  "empty.notStarted": "This session has not started yet.",
  "chip.waiting": "Your turn \xB7 {label}",
  "chip.tipWaiting": "Waiting for you: {text}",
  "chip.tipOpen": "(click to open the work log)"
};

// client/src/stores.js
var API = "/plugins/session-journal/api";
var FAST_MS = 4e3;
var SLOW_MS = 2e4;
var locale;
var bound;
function setLocale(service) {
  locale = service;
  bound = service?.bind(NS);
}
var fill = (text, vars) => vars === void 0 ? text : text.replace(/\{(\w+)\}/g, (m, k) => vars[k] === void 0 ? m : String(vars[k]));
function uiLang() {
  return locale?.getLocale?.().active ?? (typeof navigator !== "undefined" && /^zh/i.test(navigator.language) ? "zh" : "en");
}
function t(key, vars) {
  if (bound !== void 0) return bound(key, vars);
  const dict = uiLang().startsWith("zh") ? zh : en;
  return fill(dict[key] ?? en[key] ?? key, vars);
}
function useUiLocale() {
  return (0, import_react.useSyncExternalStore)(
    (fn) => locale?.subscribe?.(fn) ?? (() => {
    }),
    () => uiLang()
  );
}
var LANG_KEY = "dsh-session-journal:summary-lang";
var langListeners = /* @__PURE__ */ new Set();
function summaryLangPref() {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return v === "zh" || v === "en" ? v : "auto";
  } catch {
    return "auto";
  }
}
function setSummaryLangPref(value) {
  try {
    if (value === "auto") localStorage.removeItem(LANG_KEY);
    else localStorage.setItem(LANG_KEY, value);
  } catch {
  }
  for (const fn of langListeners) fn();
}
function resolveSummaryLang(pref, ui) {
  if (pref === "zh" || pref === "en") return pref;
  return String(ui).startsWith("zh") ? "zh" : "en";
}
function useSummaryLang() {
  const ui = useUiLocale();
  const pref = (0, import_react.useSyncExternalStore)(
    (fn) => {
      langListeners.add(fn);
      const onStorage = (e) => {
        if (e.key === LANG_KEY) fn();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        langListeners.delete(fn);
        window.removeEventListener("storage", onStorage);
      };
    },
    summaryLangPref
  );
  return { pref, lang: resolveSummaryLang(pref, ui) };
}
var entries = /* @__PURE__ */ new Map();
var keyOf = (id, lang) => `${id}|${lang}`;
function entryFor(id, lang) {
  const key = keyOf(id, lang);
  let entry = entries.get(key);
  if (entry === void 0) {
    entry = { id, lang, snapshot: { value: void 0, error: void 0, loading: false }, watchers: 0, timer: void 0, inflight: void 0, listeners: /* @__PURE__ */ new Set() };
    entries.set(key, entry);
  }
  return entry;
}
function emit(entry, patch) {
  entry.snapshot = { ...entry.snapshot, ...patch };
  for (const listener of entry.listeners) listener();
}
function refresh(id, lang = resolveSummaryLang(summaryLangPref(), uiLang())) {
  const entry = entryFor(id, lang);
  if (entry.inflight !== void 0) return entry.inflight;
  emit(entry, { loading: true });
  entry.inflight = fetch(`${API}/journal?session=${encodeURIComponent(id)}&lang=${lang}`, { credentials: "same-origin" }).then(async (res) => {
    if (!res.ok) throw new Error(res.status === 404 ? t("error.notFound") : t("error.load", { status: res.status }));
    emit(entry, { value: await res.json(), error: void 0, loading: false });
  }).catch((error) => emit(entry, { error: String(error?.message ?? error), loading: false })).finally(() => {
    entry.inflight = void 0;
    schedule(entry);
  });
  return entry.inflight;
}
function schedule(entry) {
  clearTimeout(entry.timer);
  entry.timer = void 0;
  if (entry.watchers === 0) return;
  const value = entry.snapshot.value;
  const busy = value === void 0 || value.running || value.pending > 0 || value.outlining;
  entry.timer = setTimeout(() => {
    if (document.visibilityState === "hidden") schedule(entry);
    else void refresh(entry.id, entry.lang);
  }, busy ? FAST_MS : SLOW_MS);
}
function useJournal(id) {
  const { lang } = useSummaryLang();
  const entry = id === void 0 ? void 0 : entryFor(id, lang);
  const snapshot = (0, import_react.useSyncExternalStore)(
    (listener) => {
      if (entry === void 0) return () => {
      };
      entry.listeners.add(listener);
      return () => entry.listeners.delete(listener);
    },
    () => entry?.snapshot ?? EMPTY
  );
  (0, import_react.useEffect)(() => {
    if (id === void 0) return void 0;
    const e = entryFor(id, lang);
    e.watchers++;
    if (e.snapshot.value === void 0 && e.inflight === void 0) void refresh(id, lang);
    else schedule(e);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh(id, lang);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      e.watchers--;
      if (e.watchers === 0) {
        clearTimeout(e.timer);
        e.timer = void 0;
      }
    };
  }, [id, lang]);
  return snapshot;
}
var EMPTY = Object.freeze({ value: void 0, error: void 0, loading: false });
var kindLabel = (kind) => t(`kind.${kind}`);
function phaseName(kind, round) {
  const label = kindLabel(kind);
  return round === void 0 ? label : `${label} #${round}`;
}
function duration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "";
  const s = Math.round(ms / 1e3);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h${String(m % 60).padStart(2, "0")}m`;
}
function clock(ms) {
  if (!Number.isFinite(ms)) return "";
  const d = new Date(ms);
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const today = /* @__PURE__ */ new Date();
  if (d.toDateString() === today.toDateString()) return hm;
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${hm}`;
}

// client/src/jump.js
var RAIL_LABELS = /* @__PURE__ */ new Set(["\u8F6E\u6B21\u5BFC\u822A", "Turn navigation", "\u30BF\u30FC\u30F3\u79FB\u52D5", "Navegaci\xF3n por turnos", "Navigation entre les tours", "Rundennavigation", "\u041D\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u044F \u043F\u043E \u0445\u043E\u0434\u0430\u043C", "Navega\xE7\xE3o entre turnos"]);
var MARK_SPACING_PX = 10;
var frames = async (n) => {
  for (let i = 0; i < n; i++) await new Promise((resolve) => requestAnimationFrame(() => resolve()));
};
function findRail() {
  for (const nav of document.querySelectorAll("nav[aria-label]")) {
    if (RAIL_LABELS.has(nav.getAttribute("aria-label"))) return nav;
  }
  return document.querySelector("nav button[data-index][aria-label]")?.closest("nav") ?? void 0;
}
function railMarks(rail) {
  return [...rail.querySelectorAll("button[data-index][aria-label]")].map((button) => ({ button, index: Number(button.dataset.index), turn: Number(button.getAttribute("aria-label").match(/\d+/)?.[0]) })).filter((mark) => Number.isInteger(mark.index) && Number.isInteger(mark.turn));
}
async function findMark(rail, n) {
  let marks = railMarks(rail);
  let hit = marks.find((mark) => mark.turn === n);
  if (hit !== void 0 || marks.length === 0) return hit;
  const ref = marks[0];
  const target = Math.max(0, ref.index + (n - ref.turn));
  const scroller = rail.firstElementChild;
  if (!(scroller instanceof HTMLElement)) return void 0;
  scroller.scrollTop = Math.max(0, target * MARK_SPACING_PX - scroller.clientHeight / 2);
  await frames(2);
  marks = railMarks(rail);
  hit = marks.find((mark) => mark.turn === n);
  return hit;
}
async function jumpToTurn(n) {
  const rail = findRail();
  if (rail === void 0) return "no-rail";
  const hidden = getComputedStyle(rail).display === "none";
  if (hidden) {
    rail.style.setProperty("display", "block", "important");
    rail.style.setProperty("visibility", "hidden", "important");
    await frames(3);
  }
  const restore = () => {
    if (!hidden) return;
    rail.style.removeProperty("visibility");
    rail.style.removeProperty("display");
  };
  const hit = await findMark(rail, n);
  if (hit === void 0) {
    restore();
    return "no-turn";
  }
  hit.button.click();
  if (hidden) setTimeout(restore, 4e3);
  return "ok";
}

// client/src/Journal.jsx
var import_jsx_runtime = require("react/jsx-runtime");
function JumpLink({ turn, className, children }) {
  const [note, setNote] = (0, import_react2.useState)("");
  (0, import_react2.useEffect)(() => {
    if (note === "") return void 0;
    const timer = setTimeout(() => setNote(""), 2500);
    return () => clearTimeout(timer);
  }, [note]);
  if (turn === void 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className, children });
  const onClick = async (event) => {
    event.stopPropagation();
    const result = await jumpToTurn(turn);
    if (result === "no-rail") setNote(t("jump.noRail"));
    else if (result === "no-turn") setNote(t("jump.noTurn"));
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dsj-jump-wrap", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: `dsj-jump ${className ?? ""}`, onClick, title: t("jump.title", { n: turn }), children }),
    note !== "" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsj-jump-note", role: "status", children: note })
  ] });
}
var encodeSegment = (s) => encodeURIComponent(s).replace(/%3A/gi, ":");
var encodePath = (p) => p.split("/").map(encodeSegment).join("/");
function fileAddress(sessionId, cwd, path) {
  const root = (cwd ?? "").replace(/\/+$/, "");
  if (root !== "" && path.startsWith(`${root}/`)) return `dsh-resource://file/session/${encodeSegment(sessionId)}/${encodePath(path.slice(root.length + 1))}`;
  return void 0;
}
var relative = (cwd, path) => {
  const root = (cwd ?? "").replace(/\/+$/, "");
  if (root !== "" && path.startsWith(`${root}/`)) return path.slice(root.length + 1);
  const parts = path.split("/").filter(Boolean);
  return parts.length <= 3 ? path : `\u2026/${parts.slice(-3).join("/")}`;
};
var STATUS_TONE = { active: "active", blocked: "warn", done: "good", dropped: "muted" };
var statusOf = (status) => ({ label: t(`status.${STATUS_TONE[status] === void 0 ? "done" : status}`), tone: STATUS_TONE[status] ?? "good" });
var turnRange = (turns) => {
  if (turns.length === 0) return "";
  const first = turns[0];
  const last = turns.at(-1);
  return first === last ? t("turn.one", { n: first }) : t("turn.range", { from: first, to: last });
};
function Now({ journal }) {
  const { stats, current, running } = journal;
  const elapsed = stats.startedAt === void 0 ? void 0 : (running ? Date.now() : stats.lastAt) - stats.startedAt;
  const phase = current === void 0 ? void 0 : phaseName(current.kind, current.round);
  const waiting = journal.waiting !== "" && !running;
  const items = journal.items ?? [];
  const openTotal = items.reduce((n, it) => n + it.open.length, 0);
  const decidedTotal = items.reduce((n, it) => n + it.decisions.length, 0);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "dsj-now-card", "data-running": running ? "" : void 0, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsj-now-line", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsj-dot", "data-running": running ? "" : void 0 }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsj-now-state", children: running ? t("now.running") : t("now.stopped") }),
      phase !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsj-now-phase", "data-kind": current.kind, children: phase }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsj-dim dsj-push", children: running ? duration(Date.now() - current.since) : clock(stats.lastAt) })
    ] }),
    journal.now !== "" && !waiting && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dsj-now-text", children: journal.now }),
    waiting && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { className: "dsj-waiting", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsj-waiting-tag", children: t("now.waiting") }),
      journal.waiting
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsj-stats", children: [
      openTotal > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { "data-tone": "warn", children: [
        t("count.open"),
        " ",
        openTotal
      ] }),
      decidedTotal > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        t("count.decided"),
        " ",
        decidedTotal
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("stats.turns", { n: stats.turns }) }),
      elapsed !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: duration(elapsed) }),
      stats.files > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        t("stats.files", { n: stats.files }),
        " ",
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dsj-add", children: [
          "+",
          stats.added
        ] }),
        " ",
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dsj-del", children: [
          "\u2212",
          stats.removed
        ] })
      ] }),
      (stats.tests.passed > 0 || stats.tests.failed > 0) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { "data-tone": stats.tests.failed > 0 ? "bad" : void 0, children: t("stats.tests", { passed: stats.tests.passed, total: stats.tests.passed + stats.tests.failed }) })
    ] })
  ] });
}
function ItemFacts({ item }) {
  const s = item.stats;
  const bits = [];
  if (item.fileCount > 0) bits.push(/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
    t("facts.files", { n: item.fileCount }),
    " ",
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dsj-add", children: [
      "+",
      s.added
    ] }),
    " ",
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dsj-del", children: [
      "\u2212",
      s.removed
    ] })
  ] }, "f"));
  if (s.passed + s.failed > 0) bits.push(/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { "data-tone": s.failed > 0 ? "bad" : void 0, children: [
    t("facts.tests", { passed: s.passed }),
    s.failed > 0 ? t("facts.testsFailed", { failed: s.failed }) : ""
  ] }, "t"));
  if (s.reviews > 0) bits.push(/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("facts.reviews", { n: s.reviews }) }, "r"));
  return bits;
}
var FLOW_ORDER = ["requirement", "research", "design", "implement", "review", "fix", "test", "debug", "deliver", "discuss", "other"];
function flowOf(phases) {
  const counts = /* @__PURE__ */ new Map();
  for (const p of phases) counts.set(p.kind, (counts.get(p.kind) ?? 0) + 1);
  return FLOW_ORDER.filter((kind) => counts.has(kind) && kind !== "discuss" && kind !== "other").map((kind) => ({ kind, label: kindLabel(kind), n: counts.get(kind) }));
}
function FileRows({ journal, files, onOpen }) {
  const phaseLabel = (id) => {
    const p = journal.phases[id];
    return p === void 0 ? "" : kindLabel(p.kind);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { className: "dsj-files", children: files.map((f) => {
    const rel = relative(journal.cwd, f.path);
    const address = fileAddress(journal.sessionId, journal.cwd, f.path);
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "button",
      {
        type: "button",
        className: "dsj-file",
        title: address === void 0 ? t("file.outside", { path: f.path }) : f.path,
        disabled: address === void 0,
        onClick: () => address !== void 0 && onOpen(address),
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dsj-file-path", children: [
            rel.split("/").at(-1),
            rel.includes("/") && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsj-file-dir", children: rel.split("/").slice(0, -1).join("/") })
          ] }),
          f.created && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsj-new", children: t("file.new") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dsj-file-delta", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dsj-add", children: [
              "+",
              f.added
            ] }),
            " ",
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dsj-del", children: [
              "\u2212",
              f.removed
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsj-file-phases", children: [...new Set(f.phases.map(phaseLabel))].join(" ") })
        ]
      }
    ) }, f.path);
  }) });
}
function Item({ journal, item, defaultOpen, onOpen }) {
  const [open, setOpen] = (0, import_react2.useState)(defaultOpen);
  const summarizedAtStart = item.result !== "" || item.open.length > 0 || item.decisions.length > 0;
  const [detail, setDetail] = (0, import_react2.useState)(summarizedAtStart ? void 0 : "turns");
  const phases = (0, import_react2.useMemo)(() => item.phaseIds.map((id) => journal.phases[id]).filter(Boolean), [item.phaseIds, journal.phases]);
  const files = (0, import_react2.useMemo)(() => {
    const ids = new Set(item.phaseIds);
    return journal.files.filter((f) => f.phases.some((id) => ids.has(id)));
  }, [item.phaseIds, journal.files]);
  const turns = (0, import_react2.useMemo)(() => {
    const set = new Set(item.turns);
    return (journal.turnLog ?? []).filter((x) => set.has(x.turn));
  }, [item.turns, journal.turnLog]);
  const flow = flowOf(phases);
  const status = item.status === "done" && item.open.length > 0 ? { label: t("status.doneOpen"), tone: "warn-soft" } : statusOf(item.status);
  const title = item.title || journal.goal || t("item.untitled");
  const summarized = item.result !== "" || item.open.length > 0 || item.decisions.length > 0;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { className: "dsj-item", "data-status": item.status, "data-open": open ? "" : void 0, "data-unresolved": item.open.length > 0 ? "" : void 0, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { type: "button", className: "dsj-item-head", onClick: () => setOpen(!open), "aria-expanded": open, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsj-badge", "data-tone": status.tone, children: status.label }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsj-item-title", title, children: title }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsj-caret", "aria-hidden": "true", children: open ? "\u25BE" : "\u25B8" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsj-item-counts", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dsj-count", "data-tone": item.open.length > 0 ? "warn" : "none", children: [
        t("count.open"),
        " ",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: item.open.length })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dsj-count", "data-tone": item.decisions.length > 0 ? "info" : "none", children: [
        t("count.decided"),
        " ",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: item.decisions.length })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsj-item-sub", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(JumpLink, { turn: item.turns[0], className: "dsj-dim", children: turnRange(item.turns) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ItemFacts, { item }),
      flow.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsj-dim", children: flow.map((f) => `${f.label} ${f.n}`).join(" \xB7 ") })
    ] }),
    open && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsj-item-body", children: [
      item.goal !== "" && item.goal !== title && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dsj-item-goal", children: item.goal }),
      item.result !== "" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dsj-item-result", children: item.result }),
      !summarized && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dsj-dim", children: t("item.noSummary") }),
      item.open.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsj-block", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h4", { className: "dsj-h4", "data-tone": "warn", children: [
          t("section.open"),
          " ",
          item.open.length
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { className: "dsj-bullets", children: item.open.map((text, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: text }, i)) })
      ] }),
      item.decisions.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsj-block", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h4", { className: "dsj-h4", children: [
          t("section.decided"),
          " ",
          item.decisions.length
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { className: "dsj-bullets", children: item.decisions.map((text, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: text }, i)) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsj-tabs", role: "group", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", "data-on": detail === "turns" ? "" : void 0, onClick: () => setDetail(detail === "turns" ? void 0 : "turns"), children: t(detail === "turns" ? "tab.collapseTurns" : "tab.turns", { n: turns.length }) }),
        files.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", "data-on": detail === "files" ? "" : void 0, onClick: () => setDetail(detail === "files" ? void 0 : "files"), children: t(detail === "files" ? "tab.collapseFiles" : "tab.files", { n: files.length }) })
      ] }),
      detail === "turns" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TurnList, { turns, phases }),
      detail === "files" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileRows, { journal, files, onOpen })
    ] })
  ] });
}
var OUTCOMES = /* @__PURE__ */ new Set(["aborted", "interrupted", "error", "canceled"]);
function TurnList({ turns, phases }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", { className: "dsj-turns", children: [...turns].reverse().map((turn) => {
    const own = phases.filter((p) => turn.turn >= p.turns[0] && turn.turn <= p.turns[1]);
    const kinds = [...new Set(own.map((p) => p.kind))];
    const status = turn.end === void 0 ? t("turn.running") : OUTCOMES.has(turn.outcome) ? t(`outcome.${turn.outcome}`) : "";
    const ask = turn.user !== "" ? turn.user : turn.about ?? "";
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(JumpRow, { turn: turn.turn, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsj-turn-no", children: t("turn.one", { n: turn.turn }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsj-turn-ask", "data-derived": turn.user === "" ? "" : void 0, children: ask || "\u2014" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dsj-turn-meta", children: [
        kinds.map((kind) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsj-phase-name", "data-kind": kind, children: kindLabel(kind) }, kind)),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dsj-dim", children: [
          clock(turn.start),
          status !== "" ? ` \xB7 ${status}` : ""
        ] })
      ] })
    ] }) }, turn.turn);
  }) });
}
function JumpRow({ turn, children }) {
  const [note, setNote] = (0, import_react2.useState)("");
  (0, import_react2.useEffect)(() => {
    if (note === "") return void 0;
    const timer = setTimeout(() => setNote(""), 2500);
    return () => clearTimeout(timer);
  }, [note]);
  const onClick = async () => {
    const result = await jumpToTurn(turn);
    if (result === "no-rail") setNote(t("jump.noRail"));
    else if (result === "no-turn") setNote(t("jump.noTurn"));
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsj-jump-wrap dsj-turn-wrap", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "dsj-turn", onClick, title: t("jump.title", { n: turn }), children }),
    note !== "" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsj-jump-note", role: "status", children: note })
  ] });
}
function Todos({ journal }) {
  if (journal.open.length === 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "dsj-section", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { className: "dsj-h", children: t("todos.title") }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { className: "dsj-bullets", children: journal.open.map((item, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { "data-tone": item.source === "test" ? "bad" : void 0, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dsj-chip", children: [
        t(`todos.${item.source}`),
        item.status === "in_progress" ? t("todos.inProgress") : ""
      ] }),
      item.text
    ] }, i)) })
  ] });
}
function LangPicker() {
  const { pref } = useSummaryLang();
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "dsj-lang", title: t("footer.lang"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsj-lang-label", children: t("footer.lang") }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { value: pref, onChange: (e) => setSummaryLangPref(e.target.value), children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "auto", children: t("lang.auto") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "zh", children: t("lang.zh") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "en", children: t("lang.en") })
    ] })
  ] });
}
function Footer({ journal, loading }) {
  const { done, total } = journal.summarized;
  let text;
  if (journal.summarizer === "off") text = t("footer.off");
  else if (journal.pending > 0) text = t("footer.pending", { n: journal.pending, done, total });
  else if (journal.outlining) text = t("footer.outlining");
  else if (journal.failedTurns.length > 0) text = t("footer.failed", { turns: journal.failedTurns.join(", ") });
  else text = journal.outlineAt === void 0 ? t("footer.summarized", { done, total }) : t("footer.outlined", { time: clock(journal.outlineAt) });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", { className: "dsj-footer", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsj-footer-text", children: text }),
    journal.summarizer !== "off" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LangPicker, {}),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "dsj-refresh", onClick: () => refresh(journal.sessionId), disabled: loading, title: t("footer.refresh"), children: loading ? "\u2026" : "\u27F3" })
  ] });
}
function JournalBody(props) {
  useUiLocale();
  const { sessionId, useTabInfo } = props;
  const { tab } = useTabInfo();
  const { value, error, loading } = useJournal(sessionId);
  (0, import_react2.useEffect)(() => tab.actions.bindCommands({ refresh: () => {
    void refresh(sessionId);
  } }), [tab.actions, sessionId]);
  const openFile = (address) => tab.actions.openResource(address, { preferNewPane: true });
  if (value === void 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsj-root", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dsj-empty", children: error ?? t("empty.loading") }) });
  }
  if (value.stats.turns === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsj-root", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dsj-empty", children: t("empty.notStarted") }) });
  }
  const items = value.items ?? [];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsj-root", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Now, { journal: value }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "dsj-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", { className: "dsj-h", children: [
        t("items.title"),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsj-dim", children: t("items.count", { n: items.length }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", { className: "dsj-items", children: items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Item, { journal: value, item, defaultOpen: false, onOpen: openFile }, item.id)) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Todos, { journal: value }),
    error !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dsj-empty", "data-tone": "bad", children: error }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Footer, { journal: value, loading })
  ] });
}
function JournalTitle({ useTabInfo }) {
  const { tab } = useTabInfo();
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: tab.title });
}
function JournalIcon({ size = 16, className }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: size, height: size, viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", className, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "3", y: "2", width: "10", height: "12", rx: "1.6", stroke: "currentColor" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M5.5 5.5h5M5.5 8h5M5.5 10.5h3", stroke: "currentColor", strokeLinecap: "round" })
  ] });
}

// client/src/PhaseChip.jsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var openJournal;
function setJournalOpener(fn) {
  openJournal = fn;
}
function PhaseChip({ sessionId }) {
  useUiLocale();
  const { value } = useJournal(sessionId);
  const current = value?.current;
  if (current === void 0) return null;
  const phase = phaseName(current.kind, current.round);
  const item = value.items?.find((it) => it.status === "active") ?? value.items?.[0];
  const itemTitle = item?.title ?? "";
  const waiting = !value.running && value.waiting !== "";
  const label = waiting ? t("chip.waiting", { label: itemTitle || phase }) : itemTitle !== "" ? `${itemTitle} \xB7 ${phase}` : phase;
  const tip = [itemTitle || value.goal, value.now, waiting ? t("chip.tipWaiting", { text: value.waiting }) : "", t("chip.tipOpen")].filter(Boolean).join("\n");
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    "button",
    {
      type: "button",
      className: "dsj-chipbtn",
      "data-kind": current.kind,
      "data-waiting": waiting ? "" : void 0,
      title: tip,
      onClick: () => openJournal?.(),
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dsj-dot", "data-running": value.running ? "" : void 0 }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }, children: label })
      ]
    }
  );
}

// client/src/styles.js
var CSS = `
.dsj-root{height:100%;overflow-y:auto;scrollbar-gutter:stable;padding:12px 14px 8px;box-sizing:border-box;font-size:13px;line-height:20px;
  color:var(--dsw-alias-label-primary,#222)}
.dsj-root *{box-sizing:border-box}
.dsj-root button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer;text-align:left}
.dsj-root p{margin:0}
.dsj-empty{color:var(--dsw-alias-label-tertiary,#999);padding:24px 0;text-align:center}
.dsj-dim{color:var(--dsw-alias-label-tertiary,#999)}
.dsj-push{margin-left:auto}
.dsj-add{color:var(--dsw-alias-state-success-primary,#2a9d55)}
.dsj-del{color:var(--dsw-alias-state-error-primary,#d9363e)}
[data-tone=bad]{color:var(--dsw-alias-state-error-primary,#d9363e)}
[data-tone=good]{color:var(--dsw-alias-state-success-primary,#2a9d55)}
[data-tone=warn]{color:var(--dsw-alias-state-warning-primary,#d97706)}

.dsj-dot{width:7px;height:7px;border-radius:50%;flex:none;background:var(--dsw-alias-label-tertiary,#aaa)}
.dsj-dot[data-running]{background:var(--dsw-alias-state-success-primary,#2a9d55);animation:dsj-pulse 1.4s ease-in-out infinite}
@keyframes dsj-pulse{0%,100%{opacity:1}50%{opacity:.35}}

/* Now */
.dsj-now-card{padding:10px 12px;border-radius:10px;border:1px solid var(--dsw-alias-border-l2,#e5e5e5);display:flex;flex-direction:column;gap:6px}
.dsj-now-line{display:flex;align-items:center;gap:8px;font-weight:600}
.dsj-now-state{font-weight:600}
.dsj-now-phase{padding:0 7px;border-radius:9px;font-size:12px;line-height:18px;background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06))}
.dsj-now-line .dsj-dim{font-weight:400;font-size:12px;font-variant-numeric:tabular-nums}
.dsj-now-text{color:var(--dsw-alias-label-primary,#222)}
.dsj-waiting{padding:6px 8px;border-radius:8px;background:rgba(217,119,6,.10);color:var(--dsw-alias-label-primary,#222)}
.dsj-waiting-tag{display:inline-block;margin-right:6px;padding:0 6px;border-radius:4px;font-size:11px;line-height:18px;font-weight:600;
  color:#fff;background:var(--dsw-alias-state-warning-primary,#d97706)}
.dsj-stats{display:flex;flex-wrap:wrap;gap:2px 12px;font-size:12px;color:var(--dsw-alias-label-secondary,#555)}

.dsj-section{padding:14px 0 4px}
.dsj-h{margin:0 0 8px;font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary,#555);display:flex;align-items:center;gap:8px}
.dsj-h .dsj-dim{font-weight:400}
.dsj-h4{margin:0 0 2px;font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary,#555)}
.dsj-h4[data-tone=warn]{color:var(--dsw-alias-state-warning-primary,#d97706)}

/* Work items */
.dsj-items{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.dsj-item{border-radius:10px;border:1px solid var(--dsw-alias-border-l2,#e5e5e5);padding:8px 10px}
.dsj-item[data-status=active]{border-color:var(--dsw-alias-state-success-primary,#2a9d55)}
.dsj-item[data-status=blocked]{border-color:var(--dsw-alias-state-warning-primary,#d97706)}
.dsj-item[data-status=dropped]{opacity:.6}
.dsj-item-head{display:flex;align-items:center;gap:8px;width:100%}
.dsj-item-title{flex:1;min-width:0;font-weight:600;font-size:14px;overflow:hidden;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-word}
.dsj-item[data-open] .dsj-item-title{-webkit-line-clamp:4}
.dsj-caret{flex:none;color:var(--dsw-alias-label-tertiary,#999);font-size:11px}
.dsj-badge{flex:none;padding:0 6px;border-radius:4px;font-size:11px;line-height:18px;font-weight:600;
  background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06));color:var(--dsw-alias-label-secondary,#555)}
.dsj-badge[data-tone=active]{color:#fff;background:var(--dsw-alias-state-success-primary,#2a9d55)}
.dsj-badge[data-tone=warn]{color:#fff;background:var(--dsw-alias-state-warning-primary,#d97706)}
.dsj-badge[data-tone=good]{color:var(--dsw-alias-state-success-primary,#2a9d55)}
.dsj-badge[data-tone=warn-soft]{color:var(--dsw-alias-state-warning-primary,#d97706);background:rgba(217,119,6,.12)}
.dsj-item[data-status=done][data-unresolved]{border-color:rgba(217,119,6,.55)}
.dsj-item-counts{display:flex;gap:6px;margin-top:6px}
.dsj-count{padding:0 8px;border-radius:10px;font-size:12px;line-height:20px;
  background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05));color:var(--dsw-alias-label-tertiary,#999)}
.dsj-count b{font-weight:700;font-variant-numeric:tabular-nums}
.dsj-count[data-tone=warn]{color:var(--dsw-alias-state-warning-primary,#d97706);background:rgba(217,119,6,.12)}
.dsj-count[data-tone=info]{color:var(--dsw-alias-label-primary,#222)}
.dsj-item-sub{display:flex;flex-wrap:wrap;gap:2px 10px;margin-top:2px;font-size:12px;color:var(--dsw-alias-label-secondary,#555)}
.dsj-item-body{margin-top:8px;display:flex;flex-direction:column;gap:8px}
.dsj-item-goal{color:var(--dsw-alias-label-secondary,#555);font-size:12px}
.dsj-item-result{}
.dsj-bullets{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
.dsj-bullets li{position:relative;padding-left:12px}
.dsj-bullets li::before{content:'';position:absolute;left:2px;top:9px;width:4px;height:4px;border-radius:50%;background:currentColor;opacity:.45}
.dsj-chip{display:inline-block;padding:0 6px;margin-right:6px;border-radius:4px;font-size:11px;line-height:18px;
  background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06));color:var(--dsw-alias-label-secondary,#555)}

.dsj-tabs{display:flex;flex-wrap:wrap;gap:6px}
.dsj-root .dsj-tabs button{max-width:100%;padding:1px 8px;border-radius:6px;font-size:12px;line-height:20px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  color:var(--dsw-alias-label-secondary,#555);border:1px solid var(--dsw-alias-border-l2,#e0e0e0)}
.dsj-root .dsj-tabs button:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05))}
.dsj-root .dsj-tabs button[data-on]{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.07));color:var(--dsw-alias-label-primary,#222)}

/* Turn index inside an item: one clickable row per turn, jumps to the chat */
.dsj-turns{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
.dsj-turn-wrap{display:block}
.dsj-root .dsj-turn{display:flex;align-items:baseline;gap:8px;width:100%;padding:4px 8px;border-radius:6px;font-size:12px;line-height:18px;cursor:pointer}
.dsj-root .dsj-turn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05))}
.dsj-root .dsj-turn:hover .dsj-turn-no{text-decoration:underline}
.dsj-turn-no{flex:none;font-weight:600;color:var(--dsw-alias-state-info-primary,#2f6fed)}
.dsj-turn-ask{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary,#222)}
.dsj-turn-ask[data-derived]{color:var(--dsw-alias-label-tertiary,#999);font-style:italic}
.dsj-turn-meta{flex:none;display:inline-flex;align-items:baseline;gap:6px;font-variant-numeric:tabular-nums}
.dsj-turn-meta .dsj-phase-name{font-weight:400;color:var(--dsw-alias-label-secondary,#555)}
.dsj-turn-meta .dsj-phase-name[data-kind=review]{color:#8a5cf5}
.dsj-turn-meta .dsj-phase-name[data-kind=fix]{color:#d97706}
.dsj-turn-meta .dsj-phase-name[data-kind=test]{color:#0e9f8e}
.dsj-turn-meta .dsj-phase-name[data-kind=implement]{color:#2f6fed}
.dsj-turn-meta .dsj-phase-name[data-kind=debug]{color:#d9363e}

/* Phases inside an item */
.dsj-timeline{list-style:none;margin:0;padding:0}
.dsj-phase{position:relative;padding:0 0 6px 16px}
.dsj-phase::before{content:'';position:absolute;left:4px;top:16px;bottom:0;width:1px;background:var(--dsw-alias-border-l2,#e5e5e5)}
.dsj-phase:last-child::before{display:none}
.dsj-phase-head{display:flex;align-items:baseline;gap:6px;font-size:12px}
.dsj-marker{position:absolute;left:0;width:9px;text-align:center;font-size:11px;color:var(--dsw-alias-label-tertiary,#aaa)}
.dsj-phase[data-active] .dsj-marker{color:var(--dsw-alias-state-success-primary,#2a9d55)}
.dsj-phase-name{font-weight:600;white-space:nowrap}
.dsj-phase-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary,#555)}
.dsj-phase-time{margin-left:auto;flex:none;color:var(--dsw-alias-label-tertiary,#999);font-variant-numeric:tabular-nums}
.dsj-phase-text{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#555)}
.dsj-phase[data-kind=review] .dsj-phase-name,.dsj-chipbtn[data-kind=review]{color:#8a5cf5}
.dsj-phase[data-kind=fix] .dsj-phase-name,.dsj-chipbtn[data-kind=fix]{color:#d97706}
.dsj-phase[data-kind=test] .dsj-phase-name,.dsj-chipbtn[data-kind=test]{color:#0e9f8e}
.dsj-phase[data-kind=implement] .dsj-phase-name,.dsj-chipbtn[data-kind=implement]{color:#2f6fed}
.dsj-phase[data-kind=debug] .dsj-phase-name,.dsj-chipbtn[data-kind=debug]{color:#d9363e}

/* Files inside an item */
.dsj-files{list-style:none;margin:0;padding:0}
.dsj-file{display:flex;align-items:baseline;gap:8px;width:100%;padding:2px 6px;margin:0 -6px;border-radius:6px;font-size:12px}
.dsj-file:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05))}
.dsj-root .dsj-file:disabled{cursor:default;opacity:.65}
.dsj-file-path{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace)}
.dsj-file-dir{margin-left:6px;color:var(--dsw-alias-label-tertiary,#999)}
.dsj-new{flex:none;padding:0 4px;border-radius:4px;font-size:10px;line-height:16px;
  color:var(--dsw-alias-state-success-primary,#2a9d55);border:1px solid currentColor}
.dsj-file-delta{flex:none;font-variant-numeric:tabular-nums}
.dsj-file-phases{flex:none;color:var(--dsw-alias-label-tertiary,#999)}

.dsj-footer{display:flex;align-items:center;gap:8px;margin-top:10px;padding-top:8px;border-top:1px solid var(--dsw-alias-border-l2,#e5e5e5);
  font-size:12px;color:var(--dsw-alias-label-tertiary,#999)}
.dsj-footer-text{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsj-lang{flex:none;display:inline-flex;align-items:center;gap:4px}
.dsj-lang select{font:inherit;font-size:12px;color:var(--dsw-alias-label-secondary,#555);background:transparent;
  border:1px solid var(--dsw-alias-border-l2,#e0e0e0);border-radius:6px;padding:1px 4px;cursor:pointer}
.dsj-lang select option{color:var(--dsw-alias-label-primary,#222);background:var(--dsw-alias-bg-overlay,#fff)}
.dsj-refresh{flex:none;width:22px;height:22px;border-radius:6px;text-align:center!important}
.dsj-refresh:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06))}

.dsj-chipbtn{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 9px;border-radius:12px;font-size:12px;font-weight:600;
  white-space:nowrap;border:1px solid var(--dsw-alias-border-l2,#e0e0e0);background:transparent;cursor:pointer;
  color:var(--dsw-alias-label-secondary,#555)}
.dsj-chipbtn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05))}
.dsj-chipbtn[data-waiting]{color:var(--dsw-alias-state-warning-primary,#d97706);border-color:currentColor}
@media (prefers-reduced-motion:reduce){.dsj-dot{animation:none!important}}
`;
function injectStyles() {
  const id = "dsh-session-journal-styles";
  let tag = document.getElementById(id);
  if (tag === null) {
    tag = document.createElement("style");
    tag.id = id;
    document.head.appendChild(tag);
  }
  tag.textContent = CSS;
}

// client/src/index.js
var KIND = "session-journal";
var ID = "dsh-session-journal";
var inject = ["slots"];
function apply(ctx) {
  injectStyles();
  ctx.inject(["locale"], (localeCtx) => {
    localeCtx.effect(() => localeCtx.locale.register(NS, { zh, en }), "session-journal: dictionaries");
    setLocale(localeCtx.locale);
    localeCtx.effect(() => () => setLocale(void 0), "session-journal: locale");
  });
  ctx.inject(["sidebarRightTabs"], (tabsCtx) => {
    tabsCtx.effect(() => tabsCtx.sidebarRightTabs.register({
      id: ID,
      kind: KIND,
      priority: "extension",
      keepMounted: true,
      title: () => t("type.title"),
      guide: [{
        id: "journal",
        order: 30,
        title: () => t("type.title"),
        description: () => t("guide.description"),
        icon: JournalIcon
      }]
    }), "session-journal: tab type");
  });
  ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
    name: "sidebar.right.pane.tab",
    key: ID
  }, JournalBody));
  ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({
    name: "sidebar.right.pane.tab.title",
    key: ID
  }, JournalTitle));
  ctx.slots.inject("conversation.session.header.utilities", () => ctx.slots.register({
    name: "conversation.session.header.utilities",
    id: "session-journal",
    // Early in the row: the phase is about this session.
    order: 30,
    label: () => t("type.title")
  }, PhaseChip));
  ctx.inject(["sidebarRight"], (sideCtx) => {
    setJournalOpener(() => sideCtx.sidebarRight.openTab(KIND));
    sideCtx.effect(() => () => setJournalOpener(void 0), "session-journal: opener");
  });
}
return module.exports; } });
//# sourceMappingURL=client.js.map
