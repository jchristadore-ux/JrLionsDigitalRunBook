// =============================================================================
// tasks.js — Task list, editor, filters, bulk actions, drag-and-drop ordering
// -----------------------------------------------------------------------------
// Effective status is DERIVED so the board always tells the truth:
//   Completed  → stored status is Completed
//   Overdue    → has a past due date and isn't complete
//   Blocked    → waiting on another task that isn't complete yet
//   otherwise  → the stored status (Not Started / In Progress / Waiting)
// Recurring tasks spawn their next occurrence automatically when completed.
// Every change is written to the activity feed (never including secrets).
// =============================================================================

import { Store } from "./firestore.js";
import {
  el, clear, field, input, textarea, select, toast, openModal, closeModal,
  confirmDialog, fmtDate, fmtRelative, fmtMoney, parseMoney, todayISO,
  nextRecurrence, isEmail, isUrl, uid,
} from "./ui.js";
import { STATUS_COLORS, PRIORITY_COLORS, RECURRENCE_OPTIONS } from "./config.js";
import { Automation } from "./automation.js";

// Filter state shared with the global search box in app.js.
export const filters = { q: "", category: "", owner: "", priority: "", program: "", status: "", showArchived: false };
const selection = new Set();

export const COST_CADENCES = [
  { value: "one-time", label: "One-time" },
  { value: "monthly", label: "Per month" },
  { value: "yearly", label: "Per year" },
];

// ---- status helpers ---------------------------------------------------------
export function isBlocked(task) {
  if (task.status === "Completed") return false;
  const deps = Array.isArray(task.dependsOn) ? task.dependsOn : [];
  return deps.some((id) => { const d = Store.get("tasks", id); return d && !d.archived && d.status !== "Completed"; });
}
export function blockers(task) {
  return (task.dependsOn || []).map((id) => Store.get("tasks", id))
    .filter((d) => d && !d.archived && d.status !== "Completed");
}
export function statusOf(task) {
  if (task.status === "Completed") return "Completed";
  if (task.dueDate && task.dueDate < todayISO()) return "Overdue";
  if (isBlocked(task)) return "Blocked";
  return task.status || "Not Started";
}
export function isOverdue(task) { return statusOf(task) === "Overdue"; }

export function statusDot(status) {
  return el("span.dot", { style: `background:${STATUS_COLORS[status] || "#888"}` });
}
export function statusChip(status) {
  return el("span.chip.status", { style: `--c:${STATUS_COLORS[status] || "#888"}` }, [statusDot(status), status]);
}
export function priorityChip(p) {
  return el("span.chip.prio", { style: `--c:${PRIORITY_COLORS[p] || "#888"}`, text: p });
}

// ---- recurrence -------------------------------------------------------------
// When a recurring task is completed, create the next occurrence (unless one
// already exists) so the run book rolls forward season to season on its own.
async function maybeSpawnRecurrence(task) {
  if (!task || task.recurrence === "none" || !task.recurrence || !task.dueDate) return;
  const next = nextRecurrence(task.dueDate, task.recurrence);
  if (!next) return;
  const dup = Store.list("tasks").some((t) => !t.archived && t.title === task.title && t.dueDate === next && t.status !== "Completed");
  if (dup) return;
  const copy = { ...task };
  delete copy.id; delete copy.createdAt;
  copy.status = "Not Started"; copy.dueDate = next; copy.order = (task.order ?? 0);
  const spawned = await Store.upsert("tasks", copy);
  Store.logActivity("recurred", spawned, `Next occurrence scheduled for ${fmtDate(next)}`);
  toast(`Recurring task scheduled again for ${fmtDate(next)}`);
}

// Centralized status change so recurrence + automations + logging all fire.
async function setStatus(task, status) {
  const saved = await Store.upsert("tasks", { ...task, status });
  Store.logActivity("status", saved, `Status → ${status}`);
  Automation.onTaskEvent("status_changed", saved);
  if (status === "Completed") await maybeSpawnRecurrence(saved);
  return saved;
}

// ---- matching / filtering ---------------------------------------------------
export function taskMatches(task) {
  if (!filters.showArchived && task.archived) return false;
  const q = filters.q.trim().toLowerCase();
  if (q) {
    const hay = [task.title, task.category, task.owner, task.program, task.notes,
      task.poc, task.vendor, task.relatedSystems, (task.tags || []).join(" ")]
      .join(" ").toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (filters.category && task.category !== filters.category) return false;
  if (filters.owner && task.owner !== filters.owner) return false;
  if (filters.priority && task.priority !== filters.priority) return false;
  if (filters.program && task.program !== filters.program) return false;
  if (filters.status) {
    if (statusOf(task) !== filters.status) return false;
  }
  return true;
}

function filteredTasks() { return Store.list("tasks").filter(taskMatches); }

// =============================================================================
// MAIN RENDER
// =============================================================================
export function renderTasks(root) {
  clear(root);
  const meta = Store.meta();

  const filterBar = el("div.filterbar", {}, [
    select([{ value: "", label: "All categories" }, ...meta.categories.map((c) => ({ value: c, label: c }))],
      filters.category, { title: "Filter by category", onchange: (e) => { filters.category = e.target.value; renderTasks(root); } }),
    select([{ value: "", label: "All owners" }, ...meta.owners.map((c) => ({ value: c, label: c }))],
      filters.owner, { title: "Filter by owner", onchange: (e) => { filters.owner = e.target.value; renderTasks(root); } }),
    select([{ value: "", label: "All programs" }, ...meta.programs.map((c) => ({ value: c, label: c }))],
      filters.program, { title: "Filter by program", onchange: (e) => { filters.program = e.target.value; renderTasks(root); } }),
    select([{ value: "", label: "All priorities" }, ...meta.priorities.map((c) => ({ value: c, label: c }))],
      filters.priority, { title: "Filter by priority", onchange: (e) => { filters.priority = e.target.value; renderTasks(root); } }),
    select([{ value: "", label: "Any status" }, ...["Not Started", "In Progress", "Waiting", "Blocked", "Overdue", "Completed"].map((c) => ({ value: c, label: c }))],
      filters.status, { title: "Filter by status", onchange: (e) => { filters.status = e.target.value; renderTasks(root); } }),
    el("label.toggle", { title: "Include archived tasks" }, [
      el("input", { type: "checkbox", checked: filters.showArchived,
        onchange: (e) => { filters.showArchived = e.target.checked; renderTasks(root); } }),
      el("span", { text: "Show archived" }),
    ]),
    (filters.category || filters.owner || filters.program || filters.priority || filters.status)
      ? el("button.btn.ghost.sm", { type: "button", text: "Clear filters",
          onclick: () => { Object.assign(filters, { category: "", owner: "", priority: "", program: "", status: "" }); renderTasks(root); } })
      : null,
  ]);

  const head = el("div.section-head", {}, [
    el("div", {}, [
      el("h1.page-title", { text: "Tasks" }),
      el("p.page-sub", { text: `${filteredTasks().length} of ${Store.list("tasks").length} shown` }),
    ]),
    el("button.btn.primary", { type: "button", title: "Add a new task (n)", onclick: () => openTaskEditor(null), html: "＋ Add task" }),
  ]);

  root.appendChild(head);
  root.appendChild(filterBar);

  const bulkBar = el("div.bulkbar", { id: "bulkbar" });
  root.appendChild(bulkBar);
  renderBulkBar(bulkBar, root);

  const items = filteredTasks();
  if (!items.length) {
    root.appendChild(el("div.empty", {}, [
      el("div.empty-icon", { text: "🥍" }),
      el("h3", { text: Store.list("tasks").length ? "No tasks match your filters" : "No tasks yet" }),
      el("p", { text: Store.list("tasks").length ? "Try clearing the filters above, or add a new task." : "Add the first task to get your run book started." }),
      el("button.btn.primary", { type: "button", text: "Add task", onclick: () => openTaskEditor(null) }),
    ]));
    return;
  }

  const list = el("div.task-list", { id: "task-list" });
  for (const task of items) list.appendChild(taskRow(task, root));
  enableDragOrder(list, root);
  root.appendChild(list);
}

function renderBulkBar(bar, root) {
  clear(bar);
  if (!selection.size) { bar.style.display = "none"; return; }
  bar.style.display = "flex";
  bar.appendChild(el("span.bulk-count", { text: `${selection.size} selected` }));
  bar.appendChild(el("button.btn.sm", { type: "button", text: "Mark complete",
    onclick: async () => { for (const id of [...selection]) { const t = Store.get("tasks", id); if (t) await setStatus(t, "Completed"); } toast("Marked complete"); renderTasks(root); } }));
  bar.appendChild(el("button.btn.sm", { type: "button", text: "Bulk edit…", onclick: () => openBulkEdit(root) }));
  bar.appendChild(el("button.btn.sm", { type: "button", text: "Archive",
    onclick: async () => { for (const id of [...selection]) { const t = Store.get("tasks", id); if (t) { await Store.upsert("tasks", { ...t, archived: true }); Store.logActivity("archived", t); } } selection.clear(); toast("Archived"); renderTasks(root); } }));
  bar.appendChild(el("button.btn.sm.danger", { type: "button", text: "Delete",
    onclick: () => confirmDialog({
      title: `Delete ${selection.size} task(s)?`, message: "This can't be undone.", confirmLabel: "Delete",
      onConfirm: async () => { for (const id of [...selection]) { const t = Store.get("tasks", id); Store.logActivity("deleted", t); await Store.remove("tasks", id); } selection.clear(); toast("Tasks deleted"); renderTasks(root); },
    }) }));
  bar.appendChild(el("button.btn.ghost.sm", { type: "button", text: "Clear", onclick: () => { selection.clear(); renderTasks(root); } }));
}

// ---- a single task row ------------------------------------------------------
function taskRow(task, root) {
  const eff = statusOf(task);
  const row = el("div.task-row" + (eff === "Overdue" ? ".overdue" : "") + (eff === "Blocked" ? ".blocked" : "") + (task.archived ? ".archived" : ""), {
    draggable: true, dataset: { id: task.id },
  });

  const check = el("input.row-check", {
    type: "checkbox", checked: selection.has(task.id), "aria-label": "Select task",
    onclick: (e) => { e.stopPropagation();
      e.target.checked ? selection.add(task.id) : selection.delete(task.id);
      renderBulkBar(document.getElementById("bulkbar"), root); },
  });

  const main = el("div.row-main", { onclick: () => openTaskEditor(task) }, [
    el("div.row-title-line", {}, [
      el("span.grip", { title: "Drag to reorder", text: "⠿" }),
      el("span.row-title", { text: task.title || "(untitled)" }),
      task.recurrence && task.recurrence !== "none" ? el("span.row-ico", { title: "Repeats", text: "🔁" }) : null,
      task.priority && task.priority !== "Medium" ? priorityChip(task.priority) : null,
    ]),
    el("div.row-meta", {}, [
      task.category ? el("span.tag.cat", { text: task.category }) : null,
      task.program ? el("span.tag", { text: task.program }) : null,
      task.owner ? el("span.tag.owner", { text: "👤 " + task.owner }) : null,
      task.dueDate ? el("span.tag.due" + (eff === "Overdue" ? ".due-over" : ""), { text: "📅 " + fmtDate(task.dueDate) + " · " + fmtRelative(task.dueDate) }) : null,
      eff === "Blocked" ? el("span.tag.blocked-tag", { title: blockers(task).map((b) => b.title).join(", "), text: "⛔ Blocked" }) : null,
      parseMoney(task.cost) != null ? el("span.tag.cost", { text: "💲 " + fmtMoney(task.cost) + (task.costCadence && task.costCadence !== "one-time" ? "/" + (task.costCadence === "monthly" ? "mo" : "yr") : "") }) : null,
      ...(task.tags || []).map((t) => el("span.tag.user", { text: "#" + t })),
    ]),
  ]);

  const right = el("div.row-right", {}, [
    quickStatus(task, root),
    el("button.icon-btn", { type: "button", title: "More actions", text: "⋯",
      onclick: (e) => { e.stopPropagation(); openRowMenu(e.currentTarget, task, root); } }),
  ]);

  row.appendChild(check); row.appendChild(main); row.appendChild(right);
  return row;
}

function quickStatus(task, root) {
  const eff = statusOf(task);
  const s = select(["Not Started", "In Progress", "Waiting", "Completed"],
    task.status, { class: "control status-pick", title: "Change status", onclick: (e) => e.stopPropagation(),
      onchange: async (e) => { await setStatus(task, e.target.value); toast("Status updated"); renderTasks(root); } });
  s.style.setProperty("--c", STATUS_COLORS[eff] || "#888");
  return s;
}

function openRowMenu(anchor, task, root) {
  closeRowMenu();
  const menu = el("div.popmenu", { id: "rowmenu" });
  const item = (label, fn, danger) => el("button.popitem" + (danger ? ".danger" : ""), {
    type: "button", text: label, onclick: () => { closeRowMenu(); fn(); } });
  menu.appendChild(item("Edit", () => openTaskEditor(task)));
  menu.appendChild(item("Duplicate", async () => {
    const copy = { ...task }; delete copy.id; copy.title = task.title + " (copy)"; copy.createdAt = null;
    const saved = await Store.upsert("tasks", copy); Store.logActivity("created", saved, "Duplicated"); toast("Task duplicated"); renderTasks(root);
  }));
  menu.appendChild(item(task.archived ? "Unarchive" : "Archive", async () => {
    await Store.upsert("tasks", { ...task, archived: !task.archived });
    Store.logActivity(task.archived ? "unarchived" : "archived", task);
    toast(task.archived ? "Task unarchived" : "Task archived"); renderTasks(root);
  }));
  menu.appendChild(item("Delete", () => confirmDialog({
    title: "Delete task?", message: `"${task.title}" will be removed.`, confirmLabel: "Delete",
    onConfirm: async () => { Store.logActivity("deleted", task); await Store.remove("tasks", task.id); toast("Task deleted"); renderTasks(root); },
  }), true));
  document.body.appendChild(menu);
  const r = anchor.getBoundingClientRect();
  menu.style.top = `${r.bottom + window.scrollY + 4}px`;
  menu.style.left = `${Math.min(r.left, window.innerWidth - 200)}px`;
  setTimeout(() => document.addEventListener("click", closeRowMenu, { once: true }), 0);
}
function closeRowMenu() { const m = document.getElementById("rowmenu"); if (m) m.remove(); }

// ---- drag to reorder --------------------------------------------------------
function enableDragOrder(list, root) {
  let dragId = null;
  list.addEventListener("dragstart", (e) => {
    const row = e.target.closest(".task-row"); if (!row) return;
    dragId = row.dataset.id; row.classList.add("dragging");
  });
  list.addEventListener("dragend", (e) => {
    const row = e.target.closest(".task-row"); row && row.classList.remove("dragging");
  });
  list.addEventListener("dragover", (e) => {
    e.preventDefault();
    const after = [...list.querySelectorAll(".task-row:not(.dragging)")].find((r) => {
      const box = r.getBoundingClientRect();
      return e.clientY < box.top + box.height / 2;
    });
    const dragging = list.querySelector(".dragging");
    if (!dragging) return;
    if (after) list.insertBefore(dragging, after); else list.appendChild(dragging);
  });
  list.addEventListener("drop", async (e) => {
    e.preventDefault();
    const ids = [...list.querySelectorAll(".task-row")].map((r) => r.dataset.id);
    let i = 0;
    for (const id of ids) {
      const t = Store.get("tasks", id);
      if (t && t.order !== i) await Store.upsert("tasks", { ...t, order: i });
      i++;
    }
    toast("Order saved");
  });
}

// =============================================================================
// TASK EDITOR
// =============================================================================
export function openTaskEditor(existing) {
  const meta = Store.meta();
  const t = existing ? { ...existing } : {
    title: "", category: meta.categories[0] || "", program: "ALL", owner: "ALL",
    description: "", status: "Not Started", priority: "Medium", dueDate: "", recurrence: "none",
    dependsOn: [], website: "", username: "", password: "", credentialLocation: "",
    vendor: "", cost: "", costCadence: "one-time", poc: "", email: "", links: [],
    relatedSystems: "", files: "", automationEligible: true, notes: "", tags: [],
  };

  const fTitle = input({ value: t.title, placeholder: "e.g. Submit season equipment order" });
  const fCategory = select(meta.categories, t.category);
  const fProgram = select(meta.programs, t.program);
  const fOwner = select(meta.owners, t.owner);
  const fStatus = select(meta.statuses, t.status);
  const fPriority = select(meta.priorities, t.priority);
  const fDue = input({ type: "date", value: t.dueDate || "" });
  const fRecur = select(RECURRENCE_OPTIONS, t.recurrence || "none");
  const fDesc = textarea({ value: t.description, placeholder: "What needs to happen, and how", rows: 3 });

  // Dependencies — checkbox list of other tasks; effective status becomes
  // "Blocked" until each chosen task is complete.
  let deps = new Set(t.dependsOn || []);
  const depBox = el("div.dep-box");
  const depCandidates = Store.list("tasks").filter((x) => x.id !== t.id && !x.archived);
  if (!depCandidates.length) depBox.appendChild(el("p.muted.small", { text: "No other tasks to depend on yet." }));
  depCandidates.forEach((x) => {
    const cb = el("input", { type: "checkbox", checked: deps.has(x.id),
      onchange: (e) => { e.target.checked ? deps.add(x.id) : deps.delete(x.id); } });
    depBox.appendChild(el("label.cbx", {}, [cb, el("span", { text: x.title })]));
  });

  const fWebsite = input({ value: t.website, placeholder: "https://…" });
  const fVendor = input({ value: t.vendor, placeholder: "e.g. SquadLocker, Arbiter" });
  const fCost = input({ value: t.cost, placeholder: "$ amount", inputmode: "decimal" });
  const fCadence = select(COST_CADENCES, t.costCadence || "one-time");
  const fUser = input({ value: t.username, placeholder: "login username" });
  const fCredLoc = input({ value: t.credentialLocation, placeholder: "e.g. 1Password → Team Store vault" });
  const fPass = input({ type: "password", value: t.password, placeholder: "(optional — prefer a location above)", autocomplete: "off" });
  const togglePass = el("button.icon-btn.inline", { type: "button", title: "Show / hide", text: "👁",
    onclick: () => { fPass.type = fPass.type === "password" ? "text" : "password"; } });
  const fPoc = input({ value: t.poc, placeholder: "name" });
  const fEmail = input({ type: "email", value: t.email, placeholder: "name@example.com" });
  const fRelated = input({ value: t.relatedSystems, placeholder: "e.g. Website, Arbiter, Bank account" });
  const fLinks = textarea({ value: (t.links || []).join("\n"), rows: 2, placeholder: "one link per line" });
  const fFiles = input({ value: t.files, placeholder: "link or filename" });
  const fAuto = el("input", { type: "checkbox", checked: t.automationEligible !== false });
  const fNotes = textarea({ value: t.notes, placeholder: "Anything else worth remembering", rows: 3 });
  const fTags = input({ value: (t.tags || []).join(", "), placeholder: "comma, separated, tags" });

  const grid = el("div.form-grid", {}, [
    field("Title", fTitle),
    el("div.form-row3", {}, [field("Category", fCategory), field("Program", fProgram), field("Owner", fOwner)]),
    el("div.form-row3", {}, [field("Status", fStatus), field("Priority", fPriority), field("Due date", fDue)]),
    field("Repeats", fRecur, "Recurring tasks reschedule themselves when completed"),
    field("Depends on (blocks until these are done)", depBox),
    field("Description", fDesc),
    el("div.form-section-label", { text: "Cost & vendor" }),
    el("div.form-row3", {}, [field("Vendor", fVendor), field("Cost", fCost), field("Cost cadence", fCadence)]),
    el("div.form-section-label", { text: "Login & access" }),
    el("p.muted.small.sec-note", { text: "🔒 Store WHERE the login lives, not the password itself. Anything typed below is hidden in the app and left out of backups by default." }),
    el("div.form-row2", {}, [field("Website", fWebsite), field("Username", fUser)]),
    field("Where the login is kept", fCredLoc),
    field("Password (optional, discouraged)", el("div.with-action", {}, [fPass, togglePass])),
    el("div.form-section-label", { text: "Contacts & references" }),
    el("div.form-row2", {}, [field("Point of contact", fPoc), field("Email", fEmail)]),
    field("Related systems", fRelated),
    field("Documentation links", fLinks, "One link per line"),
    field("Associated files", fFiles),
    el("label.toggle.auto-toggle", {}, [fAuto, el("span", { text: "Eligible for automations (reminders, owner notices)" })]),
    field("Notes", fNotes),
    field("Tags", fTags, "Separate with commas"),
  ]);

  const save = el("button.btn.primary", { type: "button", text: existing ? "Save changes" : "Create task",
    onclick: async () => {
      if (!fTitle.value.trim()) { toast("Add a title first", "warn"); fTitle.focus(); return; }
      if (fEmail.value && !isEmail(fEmail.value)) { toast("That email doesn't look right", "warn"); fEmail.focus(); return; }
      if (fWebsite.value && !isUrl(fWebsite.value)) { toast("Website should start with http(s)://", "warn"); fWebsite.focus(); return; }
      const isNew = !existing;
      const prevStatus = existing ? existing.status : null;
      const rec = {
        ...t,
        title: fTitle.value.trim(), category: fCategory.value, program: fProgram.value,
        owner: fOwner.value, status: fStatus.value, priority: fPriority.value,
        dueDate: fDue.value, recurrence: fRecur.value, dependsOn: [...deps],
        description: fDesc.value, website: fWebsite.value, vendor: fVendor.value,
        cost: fCost.value, costCadence: fCadence.value, username: fUser.value,
        credentialLocation: fCredLoc.value, password: fPass.value, poc: fPoc.value,
        email: fEmail.value, relatedSystems: fRelated.value,
        links: fLinks.value.split("\n").map((s) => s.trim()).filter(Boolean),
        files: fFiles.value, automationEligible: fAuto.checked, notes: fNotes.value,
        tags: fTags.value.split(",").map((s) => s.trim()).filter(Boolean),
      };
      const saved = await Store.upsert("tasks", rec);
      Store.logActivity(isNew ? "created" : "updated", saved);
      Automation.onTaskEvent(isNew ? "task_created" : "task_updated", saved);
      if (saved.status === "Completed" && prevStatus !== "Completed") await maybeSpawnRecurrence(saved);
      closeModal();
      toast(existing ? "Task saved" : "Task created", "ok", isNew ? "Undo" : undefined, isNew ? () => Store.remove("tasks", saved.id) : undefined);
      rerenderTasks();
    } });

  const cancel = el("button.btn.ghost", { type: "button", text: "Cancel", onclick: () => closeModal() });
  openModal({ title: existing ? "Edit task" : "Add task", body: grid, footer: [cancel, save], width: 780 });
}

// ---- bulk helpers -----------------------------------------------------------
function openBulkEdit(root) {
  const meta = Store.meta();
  const fStatus = select([{ value: "", label: "— keep —" }, ...meta.statuses.map((s) => ({ value: s, label: s }))], "");
  const fOwner = select([{ value: "", label: "— keep —" }, ...meta.owners.map((s) => ({ value: s, label: s }))], "");
  const fPriority = select([{ value: "", label: "— keep —" }, ...meta.priorities.map((s) => ({ value: s, label: s }))], "");
  const fCategory = select([{ value: "", label: "— keep —" }, ...meta.categories.map((s) => ({ value: s, label: s }))], "");
  const body = el("div.form-grid", {}, [
    el("p.muted", { text: `Apply to ${selection.size} selected task(s). Leave a field on "keep" to not change it.` }),
    el("div.form-row2", {}, [field("Status", fStatus), field("Owner", fOwner)]),
    el("div.form-row2", {}, [field("Priority", fPriority), field("Category", fCategory)]),
  ]);
  const apply = el("button.btn.primary", { type: "button", text: "Apply", onclick: async () => {
    for (const id of [...selection]) {
      const tk = Store.get("tasks", id); if (!tk) continue;
      if (fStatus.value) { await setStatus(tk, fStatus.value); continue; }
      const patch = {};
      if (fOwner.value) patch.owner = fOwner.value;
      if (fPriority.value) patch.priority = fPriority.value;
      if (fCategory.value) patch.category = fCategory.value;
      if (Object.keys(patch).length) { await Store.upsert("tasks", { ...tk, ...patch }); Store.logActivity("updated", tk, "Bulk edit"); }
    }
    closeModal(); toast("Bulk changes applied"); renderTasks(root);
  } });
  openModal({ title: "Bulk edit", body, footer: [el("button.btn.ghost", { type: "button", text: "Cancel", onclick: () => closeModal() }), apply], width: 520 });
}

// Lets app.js trigger a re-render of the tasks page if it's the active tab.
let _rerender = () => {};
export function bindTasksRerender(fn) { _rerender = fn; }
function rerenderTasks() { _rerender(); }
