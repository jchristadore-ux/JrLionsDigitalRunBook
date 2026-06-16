// =============================================================================
// firestore.js — Reactive data store (the app's single source of truth)
// -----------------------------------------------------------------------------
// CLOUD mode  : Firestore is the backend; real-time listeners keep every device
//               in sync. A localStorage copy is kept only as an offline cache.
// LOCAL mode  : When Firebase isn't configured, data lives in localStorage so a
//               first-time volunteer can use everything immediately.
//
// Collections: tasks, automations, distributionLists, emailTemplates, events
//   events holds three event kinds, distinguished by `type`:
//     • "event"          — calendar entries shown on the dashboard
//     • "email"          — Outbox records (queued / opened / failed)
//     • "automation_run" — execution history + failure logs for automations
//     • "activity"       — recent-changes audit feed
// Meta        : a single config doc holding categories/owners/priorities/etc.
// =============================================================================

import { db, isConfigured } from "./firebase.js";
import {
  collection, doc, setDoc, deleteDoc, onSnapshot, getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  DEFAULTS, WORKSPACE_ID, SEED_TASKS, SEED_DISTRIBUTION_LISTS,
  SEED_EMAIL_TEMPLATES, SEED_AUTOMATIONS, EXPORT_CREDENTIALS_DEFAULT,
} from "./config.js";
import { uid, monthDayToISO, nextRecurrence, todayISO } from "./ui.js";

const COLLECTIONS = ["tasks", "automations", "distributionLists", "emailTemplates", "events"];
const CACHE_KEY = "jrlions_runbook_cache_v2";
const ACTIVITY_CAP = 250;
const RUNLOG_CAP = 300;

// Canonical task shape — every task is normalized to these fields so the UI can
// rely on them existing. (Phase 2: normalization.)
const TASK_FIELDS = {
  title: "", category: "", program: "ALL", owner: "ALL", description: "",
  status: "Not Started", priority: "Medium", dueDate: "", recurrence: "none",
  dependsOn: [], website: "", username: "", password: "", credentialLocation: "",
  vendor: "", cost: "", costCadence: "one-time", poc: "", email: "", links: [], relatedSystems: "",
  files: "", automationEligible: true, notes: "", tags: [], archived: false, order: 0,
};

function pathFor(coll) { return `workspaces/${WORKSPACE_ID}/${coll}`; }
function metaDoc() { return doc(db, `workspaces/${WORKSPACE_ID}/meta`, "config"); }

function normalizeTask(t) {
  const out = { ...TASK_FIELDS, ...t };
  out.dependsOn = Array.isArray(out.dependsOn) ? out.dependsOn : [];
  out.tags = Array.isArray(out.tags) ? out.tags : [];
  out.links = Array.isArray(out.links) ? out.links : (out.links ? String(out.links).split("\n").filter(Boolean) : []);
  if (typeof out.automationEligible !== "boolean") out.automationEligible = true;
  if (!out.recurrence) out.recurrence = "none";
  return out;
}

export const Store = {
  mode: isConfigured ? "cloud" : "local",
  ready: false,
  state: { tasks: {}, automations: {}, distributionLists: {}, emailTemplates: {}, events: {}, meta: {} },
  _subs: new Set(),
  _unsubs: [],

  subscribe(fn) { this._subs.add(fn); return () => this._subs.delete(fn); },
  _emit() { for (const fn of this._subs) { try { fn(); } catch (e) { console.error(e); } } },

  list(coll) {
    return Object.values(this.state[coll] || {})
      .sort((a, b) => (a.order ?? 9e9) - (b.order ?? 9e9) || String(a.createdAt).localeCompare(String(b.createdAt)));
  },
  get(coll, id) { return this.state[coll] ? this.state[coll][id] : null; },
  meta() { return this.state.meta || {}; },

  // ---- init -----------------------------------------------------------------
  async init() {
    this._loadCache();
    if (this.mode === "cloud") await this._attachCloud();
    await this._seedIfEmpty();
    this._ensureMetaDefaults();
    await this._migrate();
    this.ready = true;
    this._emit();
  },

  _loadCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) this.state = { ...this.state, ...JSON.parse(raw) };
    } catch {}
  },
  _saveCache() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(this.state)); } catch {}
  },

  async _attachCloud() {
    for (const coll of COLLECTIONS) {
      const unsub = onSnapshot(collection(db, pathFor(coll)), (snap) => {
        const map = {};
        snap.forEach((d) => { map[d.id] = { id: d.id, ...d.data() }; });
        this.state[coll] = map;
        this._saveCache();
        this._emit();
      }, (err) => console.error(`Listener error (${coll})`, err));
      this._unsubs.push(unsub);
    }
    const unsubMeta = onSnapshot(metaDoc(), (d) => {
      this.state.meta = d.exists() ? d.data() : {};
      this._ensureMetaDefaults();
      this._saveCache();
      this._emit();
    }, (err) => console.error("Meta listener error", err));
    this._unsubs.push(unsubMeta);
    await new Promise((r) => setTimeout(r, 600));
  },

  // ---- writes ---------------------------------------------------------------
  async upsert(coll, record) {
    const now = new Date().toISOString();
    if (!record.id) record.id = uid(coll.slice(0, 3));
    if (!record.createdAt) record.createdAt = now;
    record.updatedAt = now;
    this.state[coll] = { ...(this.state[coll] || {}), [record.id]: record };
    this._saveCache(); this._emit();
    if (this.mode === "cloud") {
      try { await setDoc(doc(db, pathFor(coll), record.id), record, { merge: true }); }
      catch (e) { console.error("Cloud save failed", e); }
    }
    return record;
  },

  async remove(coll, id) {
    const copy = { ...(this.state[coll] || {}) };
    delete copy[id];
    this.state[coll] = copy;
    this._saveCache(); this._emit();
    if (this.mode === "cloud") {
      try { await deleteDoc(doc(db, pathFor(coll), id)); }
      catch (e) { console.error("Cloud delete failed", e); }
    }
  },

  async setMeta(partial) {
    this.state.meta = { ...(this.state.meta || {}), ...partial };
    this._saveCache(); this._emit();
    if (this.mode === "cloud") {
      try { await setDoc(metaDoc(), this.state.meta, { merge: true }); }
      catch (e) { console.error("Cloud meta save failed", e); }
    }
  },

  _ensureMetaDefaults() {
    const m = this.state.meta || {};
    this.state.meta = {
      categories: m.categories || [...DEFAULTS.categories],
      programs: m.programs || [...DEFAULTS.programs],
      owners: m.owners || [...DEFAULTS.owners],
      statuses: m.statuses || [...DEFAULTS.statuses],
      priorities: m.priorities || [...DEFAULTS.priorities],
      dashboardWidgets: { ...DEFAULTS.dashboardWidgets, ...(m.dashboardWidgets || {}) },
      triggers: m.triggers || ["Registration Opens", "Season Kickoff", "Tryouts Open"],
    };
  },

  // ---- activity + run logs --------------------------------------------------
  async logActivity(action, task, detail = "") {
    await this.upsert("events", {
      id: uid("act"), type: "activity", action,
      taskId: task?.id || "", taskTitle: task?.title || "", detail,
      at: new Date().toISOString(),
    });
    this._prune("activity", ACTIVITY_CAP);
  },
  async logRun({ automationId, automationName, ok, ran = 0, message = "", error = "" }) {
    await this.upsert("events", {
      id: uid("run"), type: "automation_run",
      automationId, automationName, ok, ran, message, error,
      at: new Date().toISOString(),
    });
    this._prune("automation_run", RUNLOG_CAP);
  },
  async _prune(type, cap) {
    const rows = Object.values(this.state.events || {})
      .filter((e) => e.type === type)
      .sort((a, b) => String(b.at).localeCompare(String(a.at)));
    for (const old of rows.slice(cap)) await this.remove("events", old.id);
  },
  activity() {
    return Object.values(this.state.events || {})
      .filter((e) => e.type === "activity")
      .sort((a, b) => String(b.at).localeCompare(String(a.at)));
  },
  runLog(automationId) {
    return Object.values(this.state.events || {})
      .filter((e) => e.type === "automation_run" && (!automationId || e.automationId === automationId))
      .sort((a, b) => String(b.at).localeCompare(String(a.at)));
  },

  // ---- seeding --------------------------------------------------------------
  async _seedIfEmpty() {
    if (Object.keys(this.state.tasks || {}).length === 0) {
      let order = 0;
      for (const t of SEED_TASKS) {
        const due = monthDayToISO(t.month, t.date);
        await this.upsert("tasks", normalizeTask({
          id: uid("tsk"), title: t.task, category: t.category || "",
          program: t.program || "ALL", owner: t.owner || "ALL",
          status: "Not Started", priority: "Medium", dueDate: due,
          recurrence: due ? "yearly" : "none",
          website: t.website && t.website !== "N/A" ? t.website : "",
          email: t.email && t.email !== "N/A" ? t.email : "",
          cost: t.cost ?? "", poc: t.poc || "", notes: t.notes || "",
          order: order++, createdAt: new Date().toISOString(),
        }));
      }
    }
    // Reseed support collections independently so a wiped list can recover.
    if (Object.keys(this.state.distributionLists || {}).length === 0)
      for (const l of SEED_DISTRIBUTION_LISTS) await this.upsert("distributionLists", { id: uid("lst"), ...l });
    if (Object.keys(this.state.emailTemplates || {}).length === 0)
      for (const tpl of SEED_EMAIL_TEMPLATES) await this.upsert("emailTemplates", { id: uid("tpl"), ...tpl });
    if (Object.keys(this.state.automations || {}).length === 0)
      for (const a of SEED_AUTOMATIONS) await this.upsert("automations", { id: uid("aut"), lastRun: "", ...a });
  },

  // ---- migration ------------------------------------------------------------
  // Backfills new fields on older records and rolls stale recurring tasks
  // forward so the run book advances season to season on its own.
  async _migrate() {
    const today = todayISO();
    for (const raw of Object.values(this.state.tasks || {})) {
      const t = normalizeTask(raw);
      let changed = JSON.stringify(t) !== JSON.stringify(raw);
      if (t.recurrence && t.recurrence !== "none" && t.dueDate &&
          t.dueDate < today && t.status !== "Completed") {
        const next = nextRecurrence(t.dueDate, t.recurrence);
        if (next) { t.dueDate = next; changed = true; }
      }
      if (changed) {
        this.state.tasks[t.id] = t;
        if (this.mode === "cloud") {
          try { await setDoc(doc(db, pathFor("tasks"), t.id), t, { merge: true }); } catch {}
        }
      }
    }
    this._saveCache();
  },

  // ---- maintenance helpers --------------------------------------------------
  async resetToSeed() {
    if (this.mode === "cloud") {
      for (const coll of COLLECTIONS) {
        const snap = await getDocs(collection(db, pathFor(coll)));
        for (const d of snap.docs) await deleteDoc(doc(db, pathFor(coll), d.id));
      }
    }
    for (const coll of COLLECTIONS) this.state[coll] = {};
    this.state.meta = {};
    this._ensureMetaDefaults();
    await this._seedIfEmpty();
    this._saveCache(); this._emit();
  },

  exportJSON({ includeCredentials = EXPORT_CREDENTIALS_DEFAULT } = {}) {
    const snapshot = JSON.parse(JSON.stringify(this.state));
    if (!includeCredentials) {
      for (const t of Object.values(snapshot.tasks || {})) {
        if (t.password) t.password = "";
      }
    }
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      version: 2, workspace: WORKSPACE_ID,
      credentialsIncluded: includeCredentials,
      data: snapshot,
    }, null, 2);
  },

  async importJSON(text) {
    const parsed = JSON.parse(text);
    const data = parsed.data || parsed;
    for (const coll of COLLECTIONS) {
      const map = data[coll] || {};
      for (const rec of Object.values(map)) {
        await this.upsert(coll, coll === "tasks" ? normalizeTask(rec) : rec);
      }
    }
    if (data.meta) await this.setMeta(data.meta);
  },
};

export { normalizeTask };
