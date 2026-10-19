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
  SEED_EMAIL_TEMPLATES, SEED_AUTOMATIONS,
} from "./config.js";
import { uid, monthDayToISO, nextRecurrence, todayISO } from "./ui.js";

const COLLECTIONS = ["tasks", "automations", "distributionLists", "emailTemplates", "events"];
const CACHE_KEY = "jrlions_runbook_cache_v2";
const ACTIVITY_CAP = 250;
const RUNLOG_CAP = 300;
// How long to wait for Firestore's first snapshot before giving up on it.
// Generous on purpose: seeding is skipped entirely if it never lands.
const FIRST_SNAPSHOT_TIMEOUT_MS = 8000;

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
  // The run book stores where a login is kept, never the password itself.
  out.password = "";
  return out;
}

// "LINK" and "N/A" were placeholders in the source spreadsheet. They are not
// websites or email addresses, and must not become buttons or saved values.
function withoutPlaceholder(value) {
  const s = String(value ?? "").trim();
  return /^(n\/a|link)$/i.test(s) ? "" : s;
}

// Clears plaintext passwords in a task map (mutates). Shared by backup export
// and the one-time load cleanup. Returns how many tasks were cleared.
function clearStoredPasswords(tasks) {
  let cleared = 0;
  for (const t of Object.values(tasks || {})) {
    if (t && t.password) {
      t.password = "";
      cleared++;
    }
  }
  return cleared;
}

// ---- stable identity --------------------------------------------------------
// A task is one job in the run book, and the same job must never occupy two
// rows. Title + program is that identity: it gives seeded records deterministic
// document IDs (so re-running the seed overwrites instead of copying) and lets
// us collapse duplicates that earlier builds left behind.
function taskKey(title, program) {
  const t = String(title || "").trim().toUpperCase().replace(/\s+/g, " ");
  const p = String(program || "ALL").trim().toUpperCase();
  return `${t}::${p}`;
}
function slugify(text, max = 80) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max);
}
function seedTaskId(title, program) { return `seed_${slugify(taskKey(title, program))}`; }
function seedId(prefix, name) { return `${prefix}_${slugify(name)}`; }

function isEmptyValue(v) {
  return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
}
function filledFields(t) {
  return Object.keys(TASK_FIELDS).filter((k) => !isEmptyValue(t[k])).length;
}
// Which of several duplicate rows survives: a live row over an archived one, a
// stable seeded ID over a random one, the most filled-in record, then the
// oldest. Fully deterministic, so two devices deduping at once agree.
function compareForKeep(a, b) {
  const archived = (x) => (x.archived ? 1 : 0);
  const seeded = (x) => (String(x.id).startsWith("seed_") ? 0 : 1);
  return archived(a) - archived(b)
    || seeded(a) - seeded(b)
    || filledFields(b) - filledFields(a)
    || String(a.createdAt || "").localeCompare(String(b.createdAt || ""))
    || String(a.id).localeCompare(String(b.id));
}
// Fold the copies into the survivor so no detail anyone typed is lost.
function mergeDuplicates(ranked) {
  const keeper = { ...ranked[0] };
  for (const other of ranked.slice(1)) {
    for (const [key, def] of Object.entries(TASK_FIELDS)) {
      if (Array.isArray(def)) {
        const union = [...new Set([...(keeper[key] || []), ...(other[key] || [])])];
        if (union.length) keeper[key] = union;
      } else if (isEmptyValue(keeper[key]) && !isEmptyValue(other[key])) {
        keeper[key] = other[key];
      }
    }
    // The job counts as done if any copy was ticked off, and the run book keeps
    // the soonest date any copy was carrying.
    if (other.status === "Completed") keeper.status = "Completed";
    if (other.dueDate && (!keeper.dueDate || other.dueDate < keeper.dueDate)) keeper.dueDate = other.dueDate;
  }
  return normalizeTask(keeper);
}

export const Store = {
  mode: isConfigured ? "cloud" : "local",
  ready: false,
  state: { tasks: {}, automations: {}, distributionLists: {}, emailTemplates: {}, events: {}, meta: {} },
  _subs: new Set(),
  _unsubs: [],
  // Collections whose first cloud snapshot has actually arrived. Until one is
  // in here, "empty" means "we haven't heard back yet" — never "seed me".
  _seen: new Set(),

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
    const settled = [];
    for (const coll of COLLECTIONS) {
      let done;
      settled.push(new Promise((r) => (done = r)));
      const unsub = onSnapshot(collection(db, pathFor(coll)), (snap) => {
        const map = {};
        snap.forEach((d) => { map[d.id] = { id: d.id, ...d.data() }; });
        this.state[coll] = map;
        this._seen.add(coll);
        this._saveCache();
        this._emit();
        done();
      }, (err) => { console.error(`Listener error (${coll})`, err); done(); });
      this._unsubs.push(unsub);
    }
    let metaDone;
    settled.push(new Promise((r) => (metaDone = r)));
    const unsubMeta = onSnapshot(metaDoc(), (d) => {
      this.state.meta = d.exists() ? d.data() : {};
      this._ensureMetaDefaults();
      this._saveCache();
      this._emit();
      metaDone();
    }, (err) => { console.error("Meta listener error", err); metaDone(); });
    this._unsubs.push(unsubMeta);
    // Wait for the real first snapshot, not a fixed guess. Booting on a slow
    // connection used to leave every collection looking empty, which seeded a
    // second (and third) copy of the whole run book.
    await Promise.race([
      Promise.all(settled),
      new Promise((r) => setTimeout(r, FIRST_SNAPSHOT_TIMEOUT_MS)),
    ]);
  },

  // ---- writes ---------------------------------------------------------------
  async upsert(coll, record) {
    const now = new Date().toISOString();
    if (coll === "tasks" && record.password) record.password = "";
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
      ...m, // keep anything not listed below (e.g. seededAt)
      categories: m.categories || [...DEFAULTS.categories],
      programs: m.programs || [...DEFAULTS.programs],
      owners: m.owners || [...DEFAULTS.owners],
      statuses: m.statuses || [...DEFAULTS.statuses],
      priorities: m.priorities || [...DEFAULTS.priorities],
      dashboardWidgets: { ...DEFAULTS.dashboardWidgets, ...(m.dashboardWidgets || {}) },
      triggers: m.triggers || ["Registration Opens", "Season Kickoff", "Tryouts Open"],
      // In-app override for automatic email sending (see config.js EMAIL_DELIVERY).
      emailDelivery: m.emailDelivery || null,
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
    // Only seed a collection we know is genuinely empty. In cloud mode that
    // means its first snapshot has landed; anything else is a guess, and a
    // wrong guess plants a duplicate copy of the run book.
    const empty = (coll) =>
      (this.mode !== "cloud" || this._seen.has(coll)) &&
      Object.keys(this.state[coll] || {}).length === 0;

    // seededAt records that this workspace has been through the seed once, so
    // a run book someone deliberately emptied stays empty.
    if (empty("tasks") && !(this.state.meta || {}).seededAt) {
      let order = 0;
      for (const t of SEED_TASKS) {
        const due = monthDayToISO(t.month, t.date);
        await this.upsert("tasks", normalizeTask({
          // Deterministic ID: a second seeding pass overwrites the same
          // document instead of creating a parallel row.
          id: seedTaskId(t.task, t.program), title: t.task, category: t.category || "",
          program: t.program || "ALL", owner: t.owner || "ALL",
          status: "Not Started", priority: "Medium", dueDate: due,
          recurrence: due ? "yearly" : "none",
          website: withoutPlaceholder(t.website),
          email: withoutPlaceholder(t.email),
          cost: t.cost ?? "", poc: t.poc || "", notes: t.notes || "",
          order: order++, createdAt: new Date().toISOString(),
        }));
      }
      await this.setMeta({ seededAt: new Date().toISOString() });
    }
    // Reseed support collections independently so a wiped list can recover.
    if (empty("distributionLists"))
      for (const l of SEED_DISTRIBUTION_LISTS) await this.upsert("distributionLists", { id: seedId("lst", l.name), ...l });
    if (empty("emailTemplates"))
      for (const tpl of SEED_EMAIL_TEMPLATES) await this.upsert("emailTemplates", { id: seedId("tpl", tpl.name), ...tpl });
    if (empty("automations"))
      for (const a of SEED_AUTOMATIONS) await this.upsert("automations", { id: seedId("aut", a.name), lastRun: "", ...a });
  },

  // ---- migration ------------------------------------------------------------
  // Backfills new fields on older records and rolls stale recurring tasks
  // forward so the run book advances season to season on its own.
  async _migrate() {
    await this.dedupeTasks();
    await this._clearStoredPasswords();
    const today = todayISO();
    for (const raw of Object.values(this.state.tasks || {})) {
      const t = normalizeTask(raw);
      let changed = JSON.stringify(t) !== JSON.stringify(raw);
      // A recurring task is one row that carries over. Once its date has
      // passed, move that same row to the next occurrence — a completed one
      // comes back around fresh — rather than leaving a copy behind.
      if (t.recurrence && t.recurrence !== "none" && t.dueDate && t.dueDate < today) {
        const next = nextRecurrence(t.dueDate, t.recurrence);
        if (next) {
          t.dueDate = next;
          if (t.status === "Completed") t.status = "Not Started";
          changed = true;
        }
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

  // ---- de-duplication -------------------------------------------------------
  // Collapse rows describing the same job (same title + program) into one.
  // Duplicates came from two places: seeding a workspace that only looked empty
  // on a slow connection, and older builds spawning a new row every time a
  // recurring task was completed. Both are fixed above; this repairs the data
  // they already left behind. Nothing is dropped — the survivor inherits every
  // field the copies had filled in, and dependencies are re-pointed at it.
  // Returns how many rows were merged away.
  async dedupeTasks() {
    // Never merge off a cache we haven't confirmed against the cloud.
    if (this.mode === "cloud" && !this._seen.has("tasks")) return 0;
    const groups = new Map();
    for (const t of Object.values(this.state.tasks || {})) {
      if (!t || !t.title) continue;
      const key = taskKey(t.title, t.program);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(t);
    }

    const remap = new Map(); // discarded id -> surviving id
    const survivors = [];
    for (const rows of groups.values()) {
      if (rows.length < 2) continue;
      const ranked = [...rows].sort(compareForKeep);
      const keeper = mergeDuplicates(ranked);
      survivors.push(keeper);
      for (const loser of ranked.slice(1)) remap.set(loser.id, keeper.id);
    }
    if (!remap.size) return 0;

    for (const keeper of survivors) {
      this.state.tasks[keeper.id] = keeper;
      if (this.mode === "cloud") {
        try { await setDoc(doc(db, pathFor("tasks"), keeper.id), keeper, { merge: true }); } catch {}
      }
    }
    // Re-point dependencies at the surviving row before anything is deleted.
    for (const t of Object.values(this.state.tasks || {})) {
      if (remap.has(t.id) || !Array.isArray(t.dependsOn) || !t.dependsOn.length) continue;
      const fixed = [...new Set(t.dependsOn.map((id) => remap.get(id) || id))].filter((id) => id !== t.id);
      if (fixed.join() !== t.dependsOn.join()) await this.upsert("tasks", { ...t, dependsOn: fixed });
    }
    for (const id of remap.keys()) await this.remove("tasks", id);

    const n = remap.size;
    await this.logActivity("deduped", null, `Merged ${n} duplicate task row${n === 1 ? "" : "s"} into their originals`);
    this._saveCache();
    this._emit();
    return n;
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
    // We just emptied these ourselves, so their state is known for certain.
    this._seen = new Set(COLLECTIONS);
    await this.setMeta({ seededAt: "" });
    await this._seedIfEmpty();
    this._saveCache(); this._emit();
  },

  // One-time (and retry-until-clean) wipe of passwords already stored on tasks.
  // Runs on load. After the field is empty, later loads do nothing. A password
  // that shows up again — for example from an old backup — is cleared too.
  async _clearStoredPasswords() {
    const pending = Object.values(this.state.tasks || {}).filter((t) => t && t.password);
    if (!pending.length) {
      if (!(this.state.meta || {}).passwordsClearedAt) {
        await this.setMeta({ passwordsClearedAt: new Date().toISOString() });
      }
      return 0;
    }
    const ids = pending.map((t) => t.id);
    clearStoredPasswords(this.state.tasks);
    if (this.mode === "cloud") {
      for (const id of ids) {
        try { await setDoc(doc(db, pathFor("tasks"), id), { password: "" }, { merge: true }); }
        catch (e) { console.error("Couldn't clear a stored password", e); }
      }
    }
    this._saveCache();
    await this.setMeta({ passwordsClearedAt: new Date().toISOString() });
    return ids.length;
  },

  exportJSON() {
    const snapshot = JSON.parse(JSON.stringify(this.state));
    // Always drop passwords. There is no longer a way to include them.
    clearStoredPasswords(snapshot.tasks);
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      version: 2, workspace: WORKSPACE_ID,
      credentialsIncluded: false,
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
    // A backup taken before this fix can carry duplicates of its own.
    await this.dedupeTasks();
  },
};

export { normalizeTask, taskKey };
