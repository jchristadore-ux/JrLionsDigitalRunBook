// =============================================================================
// automation.js — No-code workflow builder + execution engine
// -----------------------------------------------------------------------------
// An automation = WHEN (trigger) + IF (match filters) + THEN (one or more
// actions). Volunteers build these with dropdowns; no code required.
//
// Every run is recorded to the activity/run log (firestore.js → logRun) with a
// plain-language result, so the dashboard can surface failures and each
// automation can show its own history. Tasks marked "not eligible for
// automations" are skipped by every trigger.
// =============================================================================

import { Store } from "./firestore.js";
import { Email } from "./email.js";
import {
  el, clear, field, input, select, toast, openModal, closeModal,
  confirmDialog, fmtDate, fmtDateTime, todayISO, uid,
} from "./ui.js";

const TRIGGER_LABELS = {
  manual: "Manual — only when I press Run",
  due_soon: "A task is due soon",
  task_created: "A task is created",
  task_updated: "A task is changed",
  status_changed: "A task's status changes",
  overdue: "A task becomes overdue",
  custom: "A named event happens",
};
const ACTION_LABELS = {
  send_email: "Send an email",
  notify_owner: "Notify the task owner",
  set_status: "Set task status",
  set_due_date: "Set due date",
  add_tag: "Add a tag",
  create_task: "Create a new task",
};

const FIRED_KEY = "jrlions_auto_fired_v1";
function firedSet() { try { return new Set(JSON.parse(localStorage.getItem(FIRED_KEY) || "[]")); } catch { return new Set(); } }
function markFired(key) { const s = firedSet(); s.add(key); localStorage.setItem(FIRED_KEY, JSON.stringify([...s].slice(-2000))); }

function overdue(task) { return task.status !== "Completed" && task.dueDate && task.dueDate < todayISO(); }
function eligible(task) { return !task.id || task.automationEligible !== false; }
function matchesFilter(auto, task) {
  const m = auto.match || {};
  if (m.category && task.category !== m.category) return false;
  if (m.program && task.program !== m.program) return false;
  if (m.owner && task.owner !== m.owner) return false;
  return true;
}

export const Automation = {
  all() { return Store.list("automations"); },
  enabled() { return this.all().filter((a) => a.enabled); },

  // Runs every action; returns a structured result with readable messages.
  async runActions(auto, task = {}) {
    let ran = 0;
    const errors = [];
    const notes = [];
    for (const a of auto.actions || []) {
      try {
        if (a.type === "send_email") {
          const to = Email.resolveRecipients(a.lists || [], a.extra || "");
          const { subject, body } = Email.fillTemplate(a.template, task);
          const r = await Email.send({ to, subject, body, source: "Automation: " + auto.name });
          if (r.ok) { ran++; notes.push(`Emailed ${to.length} recipient(s)`); }
          else errors.push(r.message);
        } else if (a.type === "notify_owner") {
          const to = task.email ? [task.email] : [];
          if (!to.length) { errors.push(`No email on owner of "${task.title || "task"}"`); }
          else {
            const { subject, body } = Email.fillTemplate(a.template, task);
            const r = await Email.send({ to, subject, body, source: "Notify owner: " + auto.name });
            if (r.ok) { ran++; notes.push(`Notified ${task.owner || "owner"}`); } else errors.push(r.message);
          }
        } else if (a.type === "set_status" && task.id) {
          await Store.upsert("tasks", { ...task, status: a.status }); ran++; notes.push(`Status → ${a.status}`);
        } else if (a.type === "set_due_date" && task.id) {
          await Store.upsert("tasks", { ...task, dueDate: a.date }); ran++; notes.push(`Due date set`);
        } else if (a.type === "add_tag" && task.id) {
          const tags = new Set(task.tags || []); tags.add(a.tag);
          await Store.upsert("tasks", { ...task, tags: [...tags] }); ran++; notes.push(`Tagged #${a.tag}`);
        } else if (a.type === "create_task") {
          await Store.upsert("tasks", {
            id: uid("tsk"), title: a.title || "New task", category: a.category || "",
            program: a.program || "ALL", owner: a.owner || "ALL", status: "Not Started",
            priority: "Medium", dueDate: a.date || "", description: "",
            notes: "Created by automation: " + auto.name, tags: ["automation"],
          });
          ran++; notes.push(`Created task "${a.title || "New task"}"`);
        } else if (a.type === "set_status" || a.type === "set_due_date" || a.type === "add_tag") {
          // These need a task in context; skipped quietly when fired without one.
        }
      } catch (e) {
        console.error("Action failed", a, e);
        errors.push(`${ACTION_LABELS[a.type] || a.type}: ${e.message || "failed"}`);
      }
    }
    return { ran, errors, message: notes.join(" · ") };
  },

  // Logs a run and bumps lastRun. Returns ran count.
  async _record(auto, res, contextLabel = "") {
    const ok = res.errors.length === 0;
    await Store.logRun({
      automationId: auto.id, automationName: auto.name, ok, ran: res.ran,
      message: (contextLabel ? contextLabel + " — " : "") + (res.message || (ok ? "Ran" : "No actions ran")),
      error: res.errors.join("; "),
    });
    if (res.ran || !ok) await Store.upsert("automations", { ...auto, lastRun: new Date().toISOString(), lastOk: ok });
    return res.ran;
  },

  // Called by tasks.js after task events.
  async onTaskEvent(eventType, task) {
    if (!eligible(task)) return;
    for (const auto of this.enabled()) {
      const tt = auto.trigger?.type;
      const match =
        (eventType === "task_created" && tt === "task_created") ||
        (eventType === "task_updated" && tt === "task_updated") ||
        (eventType === "status_changed" && tt === "status_changed" &&
          (!auto.trigger.status || auto.trigger.status === task.status));
      if (match && matchesFilter(auto, task)) {
        const res = await this.runActions(auto, task);
        await this._record(auto, res, task.title);
      }
    }
  },

  // Runs on app load: due-soon + overdue automations, once per task per day.
  async runScheduled() {
    const today = todayISO();
    for (const auto of this.enabled()) {
      const tt = auto.trigger?.type;
      if (tt !== "due_soon" && tt !== "overdue") continue;
      const tasks = Store.list("tasks").filter((t) => !t.archived && t.status !== "Completed" && eligible(t));
      for (const t of tasks) {
        let hit = false;
        if (tt === "overdue") hit = overdue(t);
        if (tt === "due_soon" && t.dueDate) {
          const days = Number(auto.trigger.days || 7);
          const diff = (new Date(t.dueDate) - new Date(today)) / 86400000;
          hit = diff >= 0 && diff <= days;
        }
        if (!hit || !matchesFilter(auto, t)) continue;
        const key = `${auto.id}:${t.id}:${today}`;
        if (firedSet().has(key)) continue;
        const res = await this.runActions(auto, t);
        if (res.ran || res.errors.length) { markFired(key); await this._record(auto, res, t.title); }
      }
    }
  },

  // Manual named-event fire (e.g. "Registration Opens").
  async fireTrigger(name) {
    let count = 0;
    for (const auto of this.enabled()) {
      if (auto.trigger?.type === "custom" && auto.trigger.name === name) {
        const res = await this.runActions(auto, {});
        count += await this._record(auto, res, `Event: ${name}`);
      }
    }
    return count;
  },

  async runNow(auto) {
    const needsTask = (auto.actions || []).some((a) => ["set_status", "set_due_date", "add_tag", "notify_owner"].includes(a.type));
    let total = { ran: 0, errors: [], message: "" };
    if (needsTask) {
      const tasks = Store.list("tasks").filter((t) => matchesFilter(auto, t) && !t.archived && eligible(t));
      for (const t of tasks) {
        const res = await this.runActions(auto, t);
        total.ran += res.ran; total.errors.push(...res.errors);
      }
      total.message = `Ran across ${tasks.length} matching task(s)`;
    } else {
      total = await this.runActions(auto, {});
    }
    await this._record(auto, total, "Run now");
    return total.ran;
  },
};

// =============================================================================
// RENDER — Automations tab
// =============================================================================
export function renderAutomations(root) {
  clear(root);
  const meta = Store.meta();

  root.appendChild(el("div.section-head", {}, [
    el("div", {}, [
      el("h1.page-title", { text: "Automations" }),
      el("p.page-sub", { text: "When something happens, do something automatically. No code." }),
    ]),
    el("button.btn.primary", { type: "button", html: "＋ New automation", onclick: () => openAutomationEditor(null, root) }),
  ]));

  // Named-event firing panel
  const triggers = meta.triggers || [];
  if (triggers.length) {
    const panel = el("section.card.block");
    panel.appendChild(el("div.card-head", {}, [el("h2", { text: "Fire an event" }), el("span.muted.small", { text: "Runs every automation listening for it" })]));
    const row = el("div.trigger-row");
    for (const name of triggers) {
      row.appendChild(el("button.btn.ghost.sm", { type: "button", text: "▶ " + name, onclick: async () => {
        const n = await Automation.fireTrigger(name);
        toast(n ? `Ran ${n} action(s) for "${name}"` : `No automations listen for "${name}" yet`, n ? "ok" : "warn");
        renderAutomations(root);
      } }));
    }
    panel.appendChild(row);
    root.appendChild(panel);
  }

  const list = Automation.all();
  if (!list.length) {
    root.appendChild(el("div.empty", {}, [
      el("div.empty-icon", { text: "⚙️" }),
      el("h3", { text: "No automations yet" }),
      el("p", { text: "Create one to send reminders, update tasks, or kick off work automatically." }),
      el("button.btn.primary", { type: "button", text: "New automation", onclick: () => openAutomationEditor(null, root) }),
    ]));
    return;
  }

  const grid = el("div.auto-grid");
  for (const a of list) grid.appendChild(automationCard(a, root));
  root.appendChild(grid);
}

function describeTrigger(tr) {
  if (!tr) return "—";
  if (tr.type === "due_soon") return `A task is due within ${tr.days || 7} days`;
  if (tr.type === "custom") return `Event: ${tr.name}`;
  if (tr.type === "status_changed" && tr.status) return `Status changes to ${tr.status}`;
  return TRIGGER_LABELS[tr.type] || tr.type;
}
function describeAction(a) {
  if (a.type === "send_email") return `Email ${(a.lists || []).join(", ") || "—"} using "${a.template || "?"}"`;
  if (a.type === "notify_owner") return `Notify owner using "${a.template || "?"}"`;
  if (a.type === "set_status") return `Set status → ${a.status}`;
  if (a.type === "set_due_date") return `Set due date → ${fmtDate(a.date)}`;
  if (a.type === "add_tag") return `Add tag #${a.tag}`;
  if (a.type === "create_task") return `Create task "${a.title}"`;
  return a.type;
}

function automationCard(a, root) {
  const log = Store.runLog(a.id);
  const last = log[0];
  const card = el("section.card.auto-card" + (a.enabled ? "" : ".off"));
  card.appendChild(el("div.auto-top", {}, [
    el("div", {}, [
      el("h3.auto-name", { text: a.name }),
      el("p.muted.small", {}, [
        last ? el("span.run-pill." + (last.ok ? "ok" : "danger"), { text: last.ok ? "✓ ok" : "✕ failed" }) : null,
        el("span", { text: a.lastRun ? " Last run " + fmtDate(a.lastRun) : " Never run" }),
      ]),
    ]),
    el("label.switch", { title: a.enabled ? "Enabled" : "Disabled" }, [
      el("input", { type: "checkbox", checked: a.enabled, onchange: async (e) => {
        await Store.upsert("automations", { ...a, enabled: e.target.checked });
        toast(e.target.checked ? "Automation enabled" : "Automation disabled"); renderAutomations(root);
      } }),
      el("span.slider"),
    ]),
  ]));
  card.appendChild(el("div.auto-flow", {}, [
    el("div.flow-step", {}, [el("span.flow-label", { text: "WHEN" }), el("span", { text: describeTrigger(a.trigger) })]),
    (a.match && (a.match.category || a.match.program || a.match.owner))
      ? el("div.flow-step", {}, [el("span.flow-label", { text: "IF" }),
          el("span", { text: [a.match.category, a.match.program, a.match.owner].filter(Boolean).join(" · ") })])
      : null,
    el("div.flow-step", {}, [el("span.flow-label", { text: "THEN" }),
      el("span", { html: (a.actions || []).map((x) => esc(describeAction(x))).join("<br>") || "—" })]),
  ]));
  if (last && !last.ok && last.error) {
    card.appendChild(el("div.auto-error", { text: "Last error: " + last.error }));
  }
  card.appendChild(el("div.auto-actions", {}, [
    el("button.btn.ghost.sm", { type: "button", title: "Run safely now (emails go to the Outbox as drafts)", text: "▶ Run now", onclick: async () => {
      const n = await Automation.runNow(a); toast(n ? `Ran ${n} action(s)` : "Nothing matched", n ? "ok" : "warn"); renderAutomations(root);
    } }),
    el("button.btn.ghost.sm", { type: "button", text: "History", onclick: () => openHistory(a) }),
    el("button.btn.ghost.sm", { type: "button", text: "Edit", onclick: () => openAutomationEditor(a, root) }),
    el("button.btn.ghost.sm", { type: "button", text: "Clone", onclick: async () => {
      const copy = { ...a }; delete copy.id; copy.name = a.name + " (copy)"; copy.enabled = false; copy.lastRun = "";
      await Store.upsert("automations", copy); toast("Automation cloned"); renderAutomations(root);
    } }),
    el("button.btn.ghost.sm.danger", { type: "button", text: "Delete", onclick: () => confirmDialog({
      title: "Delete automation?", message: `"${a.name}" will be removed.`, confirmLabel: "Delete",
      onConfirm: async () => { await Store.remove("automations", a.id); toast("Automation deleted"); renderAutomations(root); } }) }),
  ]));
  return card;
}

function openHistory(a) {
  const log = Store.runLog(a.id);
  const body = el("div.history-wrap");
  if (!log.length) body.appendChild(el("p.muted", { text: "This automation hasn't run yet." }));
  else log.slice(0, 50).forEach((r) => body.appendChild(el("div.history-row" + (r.ok ? "" : ".bad"), {}, [
    el("span.run-pill." + (r.ok ? "ok" : "danger"), { text: r.ok ? "✓" : "✕" }),
    el("div.history-main", {}, [
      el("div", { text: r.message || (r.ok ? "Ran" : "Failed") }),
      r.error ? el("div.muted.small", { text: r.error }) : null,
    ]),
    el("span.muted.small", { text: fmtDateTime(r.at) }),
  ])));
  openModal({ title: `History — ${a.name}`, body, footer: [el("button.btn.primary", { type: "button", text: "Close", onclick: () => closeModal() })], width: 620 });
}

function esc(s) { return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }

// ---- Automation editor ------------------------------------------------------
function openAutomationEditor(existing, root) {
  const meta = Store.meta();
  const a = existing ? JSON.parse(JSON.stringify(existing)) : {
    name: "", enabled: true, trigger: { type: "due_soon", days: 7 },
    match: { category: "", program: "", owner: "" }, actions: [{ type: "send_email", lists: [], template: (Email.templates()[0]?.name) || "" }],
  };

  const fName = input({ value: a.name, placeholder: "e.g. Remind board 1 week before due dates" });

  // Trigger
  const fTrigType = select(Object.entries(TRIGGER_LABELS).map(([v, l]) => ({ value: v, label: l })), a.trigger.type);
  const trigExtra = el("div.trig-extra");
  function renderTrigExtra() {
    clear(trigExtra);
    const t = fTrigType.value;
    if (t === "due_soon") {
      const days = input({ type: "number", min: 0, value: a.trigger.days ?? 7, style: "max-width:120px" });
      days.dataset.role = "days";
      trigExtra.appendChild(field("Days before due", days));
    } else if (t === "status_changed") {
      const st = select([{ value: "", label: "Any status" }, ...meta.statuses.map((s) => ({ value: s, label: s }))], a.trigger.status || "");
      st.dataset.role = "status";
      trigExtra.appendChild(field("When status becomes", st));
    } else if (t === "custom") {
      const nm = select(meta.triggers.map((n) => ({ value: n, label: n })), a.trigger.name || meta.triggers[0]);
      nm.dataset.role = "name";
      trigExtra.appendChild(field("Event name", nm));
    }
  }
  fTrigType.addEventListener("change", renderTrigExtra);
  renderTrigExtra();

  // Match filters
  const fmCat = select([{ value: "", label: "Any" }, ...meta.categories.map((c) => ({ value: c, label: c }))], a.match.category);
  const fmProg = select([{ value: "", label: "Any" }, ...meta.programs.map((c) => ({ value: c, label: c }))], a.match.program);
  const fmOwner = select([{ value: "", label: "Any" }, ...meta.owners.map((c) => ({ value: c, label: c }))], a.match.owner);

  // Actions
  let actions = a.actions && a.actions.length ? a.actions.map((x) => ({ ...x })) : [{ type: "send_email", lists: [], template: "" }];
  const actionsHost = el("div.actions-host");
  function renderActions() {
    clear(actionsHost);
    actions.forEach((act, idx) => actionsHost.appendChild(actionRow(act, idx)));
    actionsHost.appendChild(el("button.btn.ghost.sm.add-action", { type: "button", text: "＋ Add action",
      onclick: () => { actions.push({ type: "set_status", status: meta.statuses[0] }); renderActions(); } }));
  }
  function actionRow(act, idx) {
    const typeSel = select(Object.entries(ACTION_LABELS).map(([v, l]) => ({ value: v, label: l })), act.type, {
      onchange: (e) => { actions[idx] = { type: e.target.value }; renderActions(); } });
    const detail = el("div.action-detail");
    if (act.type === "send_email") {
      const lists = Email.lists();
      const box = el("div.checkbox-grid");
      lists.forEach((l) => {
        const cb = el("input", { type: "checkbox", checked: (act.lists || []).includes(l.name),
          onchange: (e) => { act.lists = e.target.checked ? [...(act.lists || []), l.name] : (act.lists || []).filter((n) => n !== l.name); } });
        box.appendChild(el("label.cbx", {}, [cb, el("span", { text: l.name })]));
      });
      const tpl = select(Email.templates().map((t) => t.name), act.template, { onchange: (e) => (act.template = e.target.value) });
      if (!act.template && Email.templates()[0]) act.template = Email.templates()[0].name;
      detail.appendChild(field("Send to lists", box));
      detail.appendChild(field("Template", tpl));
    } else if (act.type === "notify_owner") {
      const tpl = select(Email.templates().map((t) => t.name), act.template, { onchange: (e) => (act.template = e.target.value) });
      if (!act.template && Email.templates()[0]) act.template = Email.templates()[0].name;
      detail.appendChild(field("Template", tpl));
    } else if (act.type === "set_status") {
      const st = select(meta.statuses, act.status || meta.statuses[0], { onchange: (e) => (act.status = e.target.value) });
      if (!act.status) act.status = meta.statuses[0];
      detail.appendChild(field("New status", st));
    } else if (act.type === "set_due_date") {
      const d = input({ type: "date", value: act.date || "", onchange: (e) => (act.date = e.target.value) });
      detail.appendChild(field("Due date", d));
    } else if (act.type === "add_tag") {
      const tg = input({ value: act.tag || "", placeholder: "tag", onchange: (e) => (act.tag = e.target.value.trim()) });
      detail.appendChild(field("Tag", tg));
    } else if (act.type === "create_task") {
      const ti = input({ value: act.title || "", placeholder: "task title", onchange: (e) => (act.title = e.target.value) });
      const ca = select(meta.categories, act.category || meta.categories[0], { onchange: (e) => (act.category = e.target.value) });
      const ow = select(meta.owners, act.owner || "ALL", { onchange: (e) => (act.owner = e.target.value) });
      detail.appendChild(field("Title", ti));
      detail.appendChild(el("div.form-row2", {}, [field("Category", ca), field("Owner", ow)]));
    }
    return el("div.action-card", {}, [
      el("div.action-top", {}, [typeSel,
        el("button.icon-btn.danger", { type: "button", title: "Remove", text: "✕",
          onclick: () => { actions.splice(idx, 1); if (!actions.length) actions.push({ type: "set_status", status: meta.statuses[0] }); renderActions(); } })]),
      detail,
    ]);
  }
  renderActions();

  const body = el("div.form-grid", {}, [
    field("Name", fName),
    el("div.builder-block", {}, [el("div.builder-label", { text: "WHEN" }), fTrigType, trigExtra]),
    el("div.builder-block", {}, [el("div.builder-label", { text: "IF (optional filters)" }),
      el("div.form-row3", {}, [field("Category", fmCat), field("Program", fmProg), field("Owner", fmOwner)])]),
    el("div.builder-block", {}, [el("div.builder-label", { text: "THEN" }), actionsHost]),
  ]);

  const save = el("button.btn.primary", { type: "button", text: existing ? "Save automation" : "Create automation", onclick: async () => {
    if (!fName.value.trim()) { toast("Name the automation first", "warn"); return; }
    const trigger = { type: fTrigType.value };
    const daysEl = trigExtra.querySelector('[data-role="days"]');
    const statusEl = trigExtra.querySelector('[data-role="status"]');
    const nameEl = trigExtra.querySelector('[data-role="name"]');
    if (daysEl) trigger.days = Number(daysEl.value) || 0;
    if (statusEl) trigger.status = statusEl.value;
    if (nameEl) trigger.name = nameEl.value;
    const rec = {
      ...a, name: fName.value.trim(), trigger,
      match: { category: fmCat.value, program: fmProg.value, owner: fmOwner.value },
      actions: actions.map((x) => ({ ...x })),
    };
    await Store.upsert("automations", rec);
    closeModal(); toast(existing ? "Automation saved" : "Automation created"); renderAutomations(root);
  } });

  openModal({ title: existing ? "Edit automation" : "New automation", body,
    footer: [el("button.btn.ghost", { type: "button", text: "Cancel", onclick: () => closeModal() }), save], width: 720 });
}
