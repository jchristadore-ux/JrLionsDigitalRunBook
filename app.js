// =============================================================================
// app.js — Boot, navigation, dashboard, settings, theme, search, auth
// -----------------------------------------------------------------------------
// The dashboard is the executive view. It answers, at a glance:
//   • What needs attention today?      • What's overdue / due this week?
//   • What's blocked?                  • What's assigned to me?
//   • Which automations failed?        • What costs money / renews soon?
//   • Which logins need documenting?   • What changed recently?
// Every widget can be turned off in Settings → Dashboard.
// =============================================================================

import { Store } from "./firestore.js";
import { isConfigured, onAuth, signIn, signOutUser } from "./firebase.js";
import { REQUIRE_SIGN_IN } from "./config.js";
import {
  el, clear, field, input, select, toast, openModal, closeModal, confirmDialog,
  fmtDate, fmtDateTime, fmtRelative, fmtMoney, parseMoney, daysUntil, todayISO,
  isModalOpen, uid, readableColor, brandLogo,
} from "./ui.js";
import {
  renderTasks, openTaskEditor, statusOf, isOverdue, isBlocked, blockers,
  statusChip, filters, bindTasksRerender,
} from "./tasks.js";
import { renderAutomations, Automation } from "./automation.js";
import { renderEmail, Email } from "./email.js";

const TABS = [
  { id: "dashboard", label: "Home", icon: "M4 10.8 12 4l8 6.8V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" },
  { id: "tasks", label: "Tasks", icon: "M9 7h11M9 12h11M9 17h11M4.5 7h.01M4.5 12h.01M4.5 17h.01" },
  { id: "automations", label: "Automations", icon: "M21 12a9 9 0 0 1-15.5 6.2M3 12a9 9 0 0 1 15.5-6.2M19 3v5h5M5 21v-5H0" },
  { id: "email", label: "Email", icon: "M4 7.5h16v10H4zM4 8.5l8 5.2 8-5.2" },
  { id: "settings", label: "Settings", icon: "M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM12 3.2v2M12 18.8v2M4.6 6.2l1.4 1.4M18 16.4l1.4 1.4M3.2 12h2M18.8 12h2M4.6 17.8 6 16.4M18 7.6l1.4-1.4" },
];
let active = "dashboard";
let currentUser = null;

// ---- "who am I" (per device) so the dashboard can show my tasks -------------
const ME_KEY = "jrlions_me";
function getMe() { return localStorage.getItem(ME_KEY) || ""; }
function setMe(v) { v ? localStorage.setItem(ME_KEY, v) : localStorage.removeItem(ME_KEY); }
function ownerIsMe(owner, me) {
  if (!me || !owner) return false;
  if (owner === me) return true;
  return String(owner).split("/").map((s) => s.trim()).includes(me);
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------
function icon(d) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "ico");
  const p = document.createElementNS(ns, "path");
  p.setAttribute("d", d);
  p.setAttribute("fill", "none");
  p.setAttribute("stroke", "currentColor");
  p.setAttribute("stroke-width", "1.75");
  p.setAttribute("stroke-linecap", "round");
  p.setAttribute("stroke-linejoin", "round");
  svg.appendChild(p);
  return svg;
}

function buildShell() {
  const app = document.getElementById("app");
  clear(app);
  const synced = Store.mode === "cloud";

  const sidebar = el("aside.sidebar", {}, [
    el("div.brand", {}, [
      brandLogo({ alt: "Jr Lions Lacrosse" }),
    ]),
    el("nav.nav", { id: "nav", "aria-label": "Sections" }),
    el("div.side-foot", {}, [
      el("p.sync-note", {
        text: synced ? "Synced for everyone signed in" : "Saved on this device",
      }),
    ]),
  ]);

  const topbar = el("header.topbar", {}, [
    el("span.logo-plate.header-logo", {}, [
      el("img.brand-logo", { src: "brand/jrlions-logo.png", alt: "Jr Lions Lacrosse", width: "1500", height: "851" }),
    ]),
    el("div.search-wrap", {}, [
      el("span.search-ico", { text: "🔍", "aria-hidden": "true" }),
      el("input.search", {
        id: "global-search", type: "search", placeholder: "Search tasks",
        "aria-label": "Search tasks",
        title: "Search tasks. Press / to jump here.",
        value: filters.q,
        oninput: (e) => { filters.q = e.target.value; if (active !== "tasks") setActive("tasks"); else renderActive(); },
      }),
    ]),
    el("div.top-actions", {}, [
      el("span.sync-note.mobile-only", { text: synced ? "Synced" : "On this device" }),
      authButton(),
    ]),
  ]);

  const main = el("main.main", { id: "main" });
  const tabbar = el("nav.tabbar", { id: "tabbar", "aria-label": "Sections" });
  app.appendChild(sidebar);
  app.appendChild(el("div.content", {}, [topbar, main]));
  app.appendChild(tabbar);
  renderNav();
}

function authButton() {
  if (!isConfigured) return el("span.muted.small.signin-hint", { text: "Local mode" });
  if (currentUser) {
    const who = currentUser.displayName || currentUser.email || "signed-in user";
    return el("button.user-btn", {
      type: "button",
      title: currentUser.email || who,
      "aria-label": `Account for ${who}. Sign out.`,
      onclick: () => confirmDialog({ title: "Sign out?", message: currentUser.email, confirmLabel: "Sign out", danger: false,
        onConfirm: () => signOutUser() }) }, [
      el("span.avatar", { text: who[0].toUpperCase(), "aria-hidden": "true" }),
    ]);
  }
  return el("button.btn.sm.primary", { type: "button", text: "Sign in",
    onclick: async () => { try { await signIn(); toast("Signed in"); } catch (e) { toast(e.message, "warn"); } } });
}

function navButton(tab, className) {
  const on = active === tab.id;
  return el("button." + className + (on ? ".active" : ""), {
    type: "button",
    "aria-current": on ? "page" : null,
    onclick: () => setActive(tab.id),
  }, [icon(tab.icon), el("span", { text: tab.label })]);
}

function renderNav() {
  const nav = document.getElementById("nav");
  const tabs = document.getElementById("tabbar");
  if (nav) clear(nav);
  if (tabs) clear(tabs);
  for (const t of TABS) {
    nav?.appendChild(navButton(t, "nav-item"));
    tabs?.appendChild(navButton(t, "tab-item"));
  }
}

function setActive(id) {
  active = id;
  renderNav();
  renderActive();
  const main = document.getElementById("main");
  if (main) {
    main.scrollTo(0, 0);
    main.classList.remove("entering");
    void main.offsetWidth;
    main.classList.add("entering");
  }
}

function renderActive() {
  const main = document.getElementById("main");
  if (!main) return;
  if (active === "dashboard") renderDashboard(main);
  else if (active === "tasks") renderTasks(main);
  else if (active === "automations") renderAutomations(main);
  else if (active === "email") renderEmail(main);
  else if (active === "settings") renderSettings(main);
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
function renderDashboard(root) {
  clear(root);
  const tasks = Store.list("tasks").filter((t) => !t.archived);
  const w = Store.meta().dashboardWidgets || {};
  const on = (k) => w[k] !== false;
  const today = todayISO();
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const me = getMe();

  const overdue = tasks.filter(isOverdue);
  const dueToday = tasks.filter((t) => t.status !== "Completed" && t.dueDate === today);
  const dueThisWeek = tasks.filter((t) => t.status !== "Completed" && t.dueDate && t.dueDate >= today && t.dueDate <= weekEnd);
  const upcoming = tasks.filter((t) => t.status !== "Completed" && t.dueDate && t.dueDate > weekEnd).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const blocked = tasks.filter(isBlocked);
  const mine = tasks.filter((t) => t.status !== "Completed" && ownerIsMe(t.owner, me));
  const costTasks = tasks.filter((t) => parseMoney(t.cost) != null && parseMoney(t.cost) > 0);
  const credTasks = tasks.filter((t) => (t.username || t.password) && (!t.credentialLocation || t.password));
  const failures = Store.runLog().filter((r) => !r.ok);
  const activeAutos = Automation.enabled();
  const activity = Store.activity();
  const events = Store.list("events").filter((e) => e.type === "event" && e.date >= today).sort((a, b) => a.date.localeCompare(b.date));

  const needs = overdue.length + dueToday.length + blocked.length;
  const summary = !tasks.length
    ? "Nothing here yet. Add a task when you know the next step."
    : !needs
      ? `${tasks.length} open tasks. Nothing is late or blocked.`
      : `${needs} thing${needs === 1 ? "" : "s"} to look at · ${tasks.length} open tasks`;

  root.appendChild(el("div.section-head", {}, [
    el("div", {}, [
      el("h1.page-title", { text: "Today" }),
      el("p.page-sub", { text: summary }),
    ]),
    el("button.btn.primary", { type: "button", text: "Add a task", title: "Add a task (n)", onclick: () => openTaskEditor(null) }),
  ]));

  // "Needs attention today" banner
  if (on("needsAttention")) {
    const attn = overdue.length + dueToday.length + blocked.length + failures.length;
    const banner = el("section.attention" + (attn ? ".live" : ".calm"));
    if (!attn) {
      banner.appendChild(el("div.attn-main", {}, [el("strong", { text: "You're all caught up." }), el("span.muted", { text: " Nothing is late, due today, or waiting on another task." })]));
    } else {
      banner.appendChild(el("div.attn-main", {}, [el("strong", { text: "Needs a look" })]));
      const pills = el("div.attn-pills");
      if (overdue.length) pills.appendChild(attnPill(`${overdue.length} late`, "danger", () => { Object.assign(filters, { status: "Overdue", q: "" }); setActive("tasks"); }));
      if (dueToday.length) pills.appendChild(attnPill(`${dueToday.length} due today`, "warn", () => { Object.assign(filters, { status: "", q: "" }); setActive("tasks"); }));
      if (blocked.length) pills.appendChild(attnPill(`${blocked.length} blocked`, "violet", () => { Object.assign(filters, { status: "Blocked", q: "" }); setActive("tasks"); }));
      if (failures.length) pills.appendChild(attnPill(`${failures.length} automation problem${failures.length === 1 ? "" : "s"}`, "danger", () => setActive("automations")));
      banner.appendChild(pills);
    }
    root.appendChild(banner);
  }

  // Stat cards
  root.appendChild(el("div.stat-grid", {}, [
    statCard("Late", overdue.length, readableColor("#e0413a"), () => { Object.assign(filters, { status: "Overdue", q: "" }); setActive("tasks"); }),
    statCard("This week", dueThisWeek.length, readableColor("#e08a1e"), () => { Object.assign(filters, { status: "", q: "" }); setActive("tasks"); }),
    statCard("Blocked", blocked.length, readableColor("#9b51e0"), () => { Object.assign(filters, { status: "Blocked", q: "" }); setActive("tasks"); }),
    statCard("Mine", mine.length, readableColor("#1f9d8a"), () => { Object.assign(filters, { owner: me, status: "", q: "" }); setActive("tasks"); }),
  ]));

  const cols = el("div.dash-cols");

  if (on("overdue")) cols.appendChild(taskListCard("Late", overdue, "danger", "You're caught up. Nothing is late."));
  if (on("dueThisWeek")) cols.appendChild(taskListCard("Due this week", dueThisWeek, "warn", "Nothing is due in the next 7 days."));

  if (on("blocked")) {
    const c = card("Blocked", blocked.length, "violet");
    if (!blocked.length) c.appendChild(emptyMini("Nothing is waiting on another task."));
    else blocked.slice(0, 8).forEach((t) => c.appendChild(el("button.dash-line.clickable", { type: "button", onclick: () => openTaskEditor(t) }, [
      el("span.dot", { style: "background:#9b51e0" }),
      el("span.dash-line-main", { text: t.title }),
      el("span.muted.small", { title: "Waiting on", text: "waits on " + blockers(t).map((b) => b.title).join(", ").slice(0, 40) }),
    ])));
    cols.appendChild(c);
  }

  if (on("assignedToMe")) {
    const c = el("section.card.dash-card");
    const picker = select([{ value: "", label: "— pick your name —" }, ...(Store.meta().owners || []).map((o) => ({ value: o, label: o }))], me, {
      class: "me-pick", title: "Set who you are on this device", "aria-label": "Who are you?",
      onchange: (e) => { setMe(e.target.value); renderDashboard(root); } });
    c.appendChild(el("div.card-head", {}, [el("h2", { text: "Assigned to me" }), picker]));
    if (!me) c.appendChild(emptyMini("Choose your name to see your tasks."));
    else if (!mine.length) c.appendChild(emptyMini(`Nothing open for ${me}.`));
    else mine.slice(0, 8).forEach((t) => c.appendChild(el("button.dash-line.clickable", { type: "button", onclick: () => openTaskEditor(t) }, [
      statusChip(statusOf(t)), el("span.dash-line-main", { text: t.title }),
      t.dueDate ? el("span.muted.small", { text: fmtRelative(t.dueDate) }) : null,
    ])));
    cols.appendChild(c);
  }

  if (on("automationFailures")) {
    const c = el("section.card.dash-card");
    c.appendChild(el("div.card-head", {}, [el("h2", { text: "Automation problems" })]));
    if (!failures.length) c.appendChild(emptyMini("Every automation ran without a problem."));
    else failures.slice(0, 6).forEach((r) => c.appendChild(el("div.dash-line", {}, [
      el("span.run-pill.danger", { text: "✕" }),
      el("span.dash-line-main", { title: r.error || "", text: r.automationName }),
      el("span.muted.small", { text: fmtRelative(String(r.at).slice(0, 10)) }),
    ])));
    cols.appendChild(c);
  }

  if (on("costs")) {
    const recurring = costTasks.filter((t) => t.costCadence && t.costCadence !== "one-time");
    const annual = recurring.reduce((sum, t) => sum + parseMoney(t.cost) * (t.costCadence === "monthly" ? 12 : 1), 0);
    const oneTime = costTasks.filter((t) => !t.costCadence || t.costCadence === "one-time").reduce((s, t) => s + parseMoney(t.cost), 0);
    const c = el("section.card.dash-card");
    c.appendChild(el("div.card-head", {}, [el("h2", { text: "Costs" }),
      el("span.muted.small", { text: (annual ? `~${fmtMoney(annual)}/yr` : "") + (annual && oneTime ? " · " : "") + (oneTime ? `${fmtMoney(oneTime)} one-time` : "") })]));
    if (!costTasks.length) c.appendChild(emptyMini("No tasks have a cost recorded."));
    else costTasks.sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate))).slice(0, 8).forEach((t) => {
      const cad = t.costCadence === "monthly" ? "/mo" : t.costCadence === "yearly" ? "/yr" : "";
      const renew = t.dueDate ? daysUntil(t.dueDate) : Infinity;
      c.appendChild(el("button.dash-line.clickable", { type: "button", onclick: () => openTaskEditor(t) }, [
        el("span.dash-line-main", { text: (t.vendor ? t.vendor + " — " : "") + t.title }),
        renew <= 30 && renew >= 0 ? el("span.tag.due-over", { text: "renews " + fmtRelative(t.dueDate) }) : null,
        el("span.cost-amt", { text: fmtMoney(t.cost) + cad }),
      ]));
    });
    cols.appendChild(c);
  }

  if (on("credentials")) {
    const c = el("section.card.dash-card");
    c.appendChild(el("div.card-head", {}, [el("h2", { text: "Logins to tidy up" }), el("span.muted.small", { text: "Security" })]));
    if (!credTasks.length) c.appendChild(emptyMini("Every login says where it is kept."));
    else credTasks.slice(0, 8).forEach((t) => c.appendChild(el("button.dash-line.clickable", { type: "button", onclick: () => openTaskEditor(t) }, [
      el("span.dot", { style: "background:#e08a1e" }),
      el("span.dash-line-main", { text: t.title }),
      el("span.muted.small", { text: t.password ? "move password to a vault" : "add where login is kept" }),
    ])));
    cols.appendChild(c);
  }

  if (on("upcoming")) cols.appendChild(taskListCard("Coming up later", upcoming.slice(0, 8), "", "No tasks are scheduled after this week."));

  if (on("recentActivity")) {
    const c = el("section.card.dash-card");
    c.appendChild(el("div.card-head", {}, [el("h2", { text: "Recent changes" })]));
    if (!activity.length) c.appendChild(emptyMini("Changes show up here after someone edits a task."));
    else activity.slice(0, 10).forEach((a) => c.appendChild(el("div.dash-line", {}, [
      el("span.act-verb", { text: actVerb(a.action) }),
      el("span.dash-line-main", { text: a.taskTitle || "(task)" }),
      el("span.muted.small", { text: fmtRelative(String(a.at).slice(0, 10)) }),
    ])));
    cols.appendChild(c);
  }

  if (on("automations")) {
    const c = el("section.card.dash-card");
    c.appendChild(el("div.card-head", {}, [el("h2", { text: "Automations that are on" })]));
    if (!activeAutos.length) c.appendChild(emptyMini("No automations are turned on. Add one from the Automations tab."));
    else activeAutos.slice(0, 6).forEach((a) => c.appendChild(el("div.dash-line", {}, [
      el("span.dot", { style: "background:#1f9d55" }),
      el("span.dash-line-main", { text: a.name }),
      el("span.muted.small", { text: a.lastRun ? fmtRelative(a.lastRun.slice(0, 10)) : "ready" }),
    ])));
    cols.appendChild(c);
  }

  if (on("events")) {
    const c = el("section.card.dash-card");
    c.appendChild(el("div.card-head", {}, [el("h2", { text: "Events" }), el("button.btn.primary.sm", { type: "button", text: "Add event", onclick: () => openEventEditor(root) })]));
    if (!events.length) c.appendChild(emptyMini("No events yet. Add a picnic, tournament, or meeting."));
    else events.slice(0, 6).forEach((ev) => c.appendChild(el("div.dash-line", {}, [
      el("span.date-badge", { text: fmtDate(ev.date) }),
      el("span.dash-line-main", { text: ev.title }),
      el("button.icon-btn.sm", { type: "button", text: "✕", title: `Remove ${ev.title}`,
        "aria-label": `Remove ${ev.title}`, onclick: () => confirmDialog({
        title: "Remove event?", message: ev.title, confirmLabel: "Remove",
        onConfirm: async () => { await Store.remove("events", ev.id); renderDashboard(root); } }) }),
    ])));
    cols.appendChild(c);
  }

  root.appendChild(cols);
}

const ACT_VERBS = { created: "＋ added", updated: "✎ edited", status: "↻ status", archived: "📦 archived", unarchived: "↩ restored", deleted: "🗑 deleted", recurred: "🔁 repeated" };
function actVerb(a) { return ACT_VERBS[a] || a; }

function attnPill(text, kind, onclick) { return el("button.attn-pill." + kind, { type: "button", text, onclick }); }
function statCard(label, value, color, onclick) {
  return el("button.stat-card", { type: "button", style: `--c:${color}`, onclick }, [
    el("div.stat-value", { text: String(value) }),
    el("div.stat-label", { text: label }),
  ]);
}
function emptyMini(text) { return el("p.muted.small.empty-mini", { text }); }
function card(title, count, kind) {
  const c = el("section.card.dash-card");
  c.appendChild(el("div.card-head", {}, [el("h2", { text: title }), el("span.count-pill" + (kind ? "." + kind : ""), { text: String(count) })]));
  return c;
}
function taskListCard(title, items, kind, emptyText) {
  const c = card(title, items.length, kind);
  if (!items.length) { c.appendChild(emptyMini(emptyText)); return c; }
  for (const t of items.slice(0, 8)) {
    c.appendChild(el("button.dash-line.clickable", { type: "button", onclick: () => openTaskEditor(t) }, [
      statusChip(statusOf(t)),
      el("span.dash-line-main", { text: t.title }),
      t.dueDate ? el("span.muted.small", { text: fmtRelative(t.dueDate) }) : el("span.muted.small", { text: t.owner || "" }),
    ]));
  }
  return c;
}

function openEventEditor(root) {
  const fTitle = input({ placeholder: "e.g. EOY Picnic" });
  const fDate = input({ type: "date", value: todayISO() });
  const body = el("div.form-grid", {}, [field("Event", fTitle), field("Date", fDate)]);
  const save = el("button.btn.primary", { type: "button", text: "Add event", onclick: async () => {
    if (!fTitle.value.trim()) { toast("Name the event first", "warn"); return; }
    await Store.upsert("events", { id: uid("evt"), type: "event", title: fTitle.value.trim(), date: fDate.value });
    closeModal(); toast("Event added"); renderDashboard(root);
  } });
  openModal({ title: "Add event", body, footer: [el("button.btn.ghost", { type: "button", text: "Cancel", onclick: () => closeModal() }), save], width: 460 });
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
function renderSettings(root) {
  clear(root);
  const meta = Store.meta();
  root.appendChild(el("div.section-head", {}, [
    el("div", {}, [
      el("h1.page-title", { text: "Settings" }),
      el("p.page-sub", { text: "Changes save right away for everyone who is signed in." }),
    ]),
  ]));

  const lookCard = el("section.card.block");
  lookCard.appendChild(el("h2", { text: "Appearance" }));
  lookCard.appendChild(el("p.muted.small", { text: "Match device follows the light or dark setting on this phone or computer." }));
  lookCard.appendChild(appearanceControl());
  root.appendChild(lookCard);

  // Who am I
  const meCard = el("section.card.block");
  meCard.appendChild(el("h2", { text: "Your name" }));
  meCard.appendChild(el("p.muted.small", { text: "Home uses this to show tasks assigned to you. It stays on this device." }));
  meCard.appendChild(select([{ value: "", label: "— not set —" }, ...(meta.owners || []).map((o) => ({ value: o, label: o }))], getMe(), {
    class: "me-pick wide", "aria-label": "Who are you?",
    onchange: (e) => { setMe(e.target.value); toast(e.target.value ? `You are ${e.target.value}` : "Cleared"); } }));
  root.appendChild(meCard);

  // Editable lists
  const listsCard = el("section.card.block");
  listsCard.appendChild(el("h2", { text: "Choices" }));
  listsCard.appendChild(el("p.muted.small", { text: "These are the names you can pick when you add a task. Type a name and press Enter." }));
  listsCard.appendChild(chipEditor("Categories", "categories"));
  listsCard.appendChild(chipEditor("Owners / volunteers", "owners"));
  listsCard.appendChild(chipEditor("Programs", "programs"));
  listsCard.appendChild(chipEditor("Statuses", "statuses"));
  listsCard.appendChild(chipEditor("Priorities", "priorities"));
  listsCard.appendChild(chipEditor("Automation events", "triggers"));
  root.appendChild(listsCard);

  // Dashboard widgets
  const wCard = el("section.card.block");
  wCard.appendChild(el("h2", { text: "What Home shows" }));
  wCard.appendChild(el("p.muted.small", { text: "Turn a section off if your board does not use it." }));
  const widgets = meta.dashboardWidgets || {};
  const wMap = {
    needsAttention: "Needs a look", overdue: "Late tasks", dueThisWeek: "Due this week",
    blocked: "Blocked", assignedToMe: "Assigned to me", automationFailures: "Automation problems",
    costs: "Costs", credentials: "Logins to tidy up", upcoming: "Coming up later",
    recentActivity: "Recent changes", automations: "Automations that are on", events: "Events",
  };
  const wGrid = el("div.setting-list");
  for (const [key, label] of Object.entries(wMap)) {
    wGrid.appendChild(el("label.setting-row", {}, [
      el("span.setting-label", { text: label }),
      el("span.switch", {}, [
        el("input", { type: "checkbox", checked: widgets[key] !== false,
          onchange: async (e) => { await Store.setMeta({ dashboardWidgets: { ...widgets, [key]: e.target.checked } }); toast("Home updated"); } }),
        el("span.slider"),
      ]),
    ]));
  }
  wCard.appendChild(wGrid);
  root.appendChild(wCard);

  // Data & backup
  const dCard = el("section.card.block");
  dCard.appendChild(el("h2", { text: "Backup" }));
  dCard.appendChild(el("p.muted.small", { text: "Download a copy, restore one, combine duplicate tasks, or start over with the original list. Passwords are never included." }));
  dCard.appendChild(el("div.btn-row", {}, [
    el("button.btn", { type: "button", text: "Download a backup", onclick: () => exportBackup() }),
    el("button.btn", { type: "button", text: "Restore a backup", onclick: importBackup }),
    el("button.btn", { type: "button", text: "Combine duplicate tasks", onclick: async () => {
      const merged = await Store.dedupeTasks();
      toast(merged ? `Merged ${merged} duplicate row${merged === 1 ? "" : "s"}` : "No duplicates found", "ok");
      renderActive();
    } }),
    el("button.btn.danger", { type: "button", text: "Start over with the original tasks", onclick: () => confirmDialog({
      title: "Reset everything?", message: "All current tasks, automations, lists and templates will be replaced with the original run book. This can't be undone.",
      confirmLabel: "Reset", onConfirm: async () => { await Store.resetToSeed(); toast("Reset to original run book"); renderActive(); } }) }),
  ]));
  root.appendChild(dCard);

  // Automatic email sending (EmailJS)
  root.appendChild(emailDeliveryCard());

  // Connection
  const cCard = el("section.card.block");
  cCard.appendChild(el("h2", { text: "Connection" }));
  cCard.appendChild(el("div.conn-row", {}, [
    el("span.mode-badge" + (Store.mode === "cloud" ? ".cloud" : ".local"), { text: Store.mode === "cloud" ? "Synced to cloud (Firebase)" : "Saved on this device only" }),
  ]));
  cCard.appendChild(el("p.muted.small", { html: Store.mode === "cloud"
    ? "Everyone signed in to this workspace sees the same data in real time."
    : "To sync across phones and computers, add your Firebase keys in <code>config.js</code>. See the README for step-by-step setup." }));
  root.appendChild(cCard);
}

// Settings card for turning on automatic email delivery via EmailJS (free).
// Stored in the shared workspace meta, so once an admin sets it everyone's
// run book — including automations — can send on its own.
function emailDeliveryCard() {
  const card = el("section.card.block");
  const cfg = Store.meta().emailDelivery || { provider: "none", emailjs: {} };
  const e = cfg.emailjs || {};
  const live = Email.deliveryEnabled();

  card.appendChild(el("h2", { text: "Automatic email sending" }));
  card.appendChild(el("div.conn-row", {}, [
    el("span.mode-badge" + (live ? ".cloud" : ".local"), { text: live ? "ON — the app sends email by itself" : "OFF — emails open as drafts you send" }),
  ]));
  card.appendChild(el("p.muted.small", { html:
    "Connect <strong>EmailJS</strong> (free, 200 emails/month) so the run book — and its automations — send email on their own, with no draft step. " +
    "Create a free account, add an email service and one template, then paste the three IDs below. Full walkthrough is in the README → “Automatic email”." }));

  const onParam = input({ value: e.publicKey || "", placeholder: "Public Key (Account → General)" });
  const onSvc = input({ value: e.serviceId || "", placeholder: "Service ID (Email Services)" });
  const onTpl = input({ value: e.templateId || "", placeholder: "Template ID (Email Templates)" });
  const onFrom = input({ value: e.fromName || "Jr Lions Lacrosse Run Book", placeholder: "From name shown to recipients" });

  card.appendChild(el("div.form-grid", {}, [
    field("Public Key", onParam),
    field("Service ID", onSvc),
    field("Template ID", onTpl),
    field("From name", onFrom),
    el("p.muted.small", { text: "Your EmailJS template must use the variables to_email, subject, and message. The README shows exactly what to paste." }),
  ]));

  card.appendChild(el("div.btn-row", {}, [
    el("button.btn.primary", { type: "button", text: "Save & turn on", onclick: async () => {
      const pub = onParam.value.trim(), svc = onSvc.value.trim(), tpl = onTpl.value.trim();
      if (!pub || !svc || !tpl) { toast("Fill in all three IDs to turn on sending", "warn"); return; }
      await Store.setMeta({ emailDelivery: {
        provider: "emailjs",
        emailjs: { publicKey: pub, serviceId: svc, templateId: tpl, fromName: onFrom.value.trim() || "Jr Lions Lacrosse Run Book",
          toParam: "to_email", subjectParam: "subject", bodyParam: "message" },
      } });
      toast("Automatic sending is on"); renderActive();
    } }),
    el("button.btn", { type: "button", text: "Send test email", onclick: async () => {
      if (!Email.deliveryEnabled()) { toast("Save your EmailJS settings first", "warn"); return; }
      const to = prompt("Send a test email to which address?", "");
      if (!to) return;
      const r = await Email.send({ to: [to.trim()], subject: "Jr Lions Run Book — test email",
        body: "This is a test from the Jr Lions Lacrosse Run Book. If you received it, automatic sending works! 🦁", source: "Settings test" });
      toast(r.message, r.ok ? "ok" : "warn");
    } }),
    el("button.btn.danger", { type: "button", text: "Turn off", onclick: async () => {
      await Store.setMeta({ emailDelivery: { provider: "none", emailjs: {} } });
      toast("Automatic sending turned off — emails will open as drafts"); renderActive();
    } }),
  ]));
  return card;
}

function chipEditor(label, key) {
  const wrap = el("div.chip-editor");
  const meta = Store.meta();
  const values = meta[key] || [];
  const chips = el("div.chips");
  values.forEach((v) => {
    chips.appendChild(el("span.edit-chip", {}, [
      el("span", { text: v }),
      el("button.chip-x", { type: "button", title: `Remove ${v}`, "aria-label": `Remove ${v}`, text: "✕", onclick: async () => {
        await Store.setMeta({ [key]: values.filter((x) => x !== v) });
        toast(`Removed "${v}"`); renderActive();
      } }),
    ]));
  });
  const adder = input({ placeholder: "Add…", onkeydown: async (e) => {
    if (e.key === "Enter" && e.target.value.trim()) {
      const val = e.target.value.trim();
      if (values.includes(val)) { toast("Already exists", "warn"); return; }
      await Store.setMeta({ [key]: [...values, val] });
      toast(`Added "${val}"`); renderActive();
    }
  } });
  adder.classList.add("chip-add");
  wrap.appendChild(el("div.chip-editor-head", {}, [el("strong", { text: label }), adder]));
  wrap.appendChild(chips);
  return wrap;
}

function exportBackup() {
  const blob = new Blob([Store.exportJSON()], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `jr-lions-runbook-backup-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("Backup downloaded");
}
function importBackup() {
  const inp = document.createElement("input");
  inp.type = "file"; inp.accept = "application/json,.json";
  inp.onchange = async () => {
    const file = inp.files[0]; if (!file) return;
    const text = await file.text();
    confirmDialog({ title: "Restore from backup?", message: "This adds/updates records from the file. Existing data isn't deleted.", confirmLabel: "Restore", danger: false,
      onConfirm: async () => { try { await Store.importJSON(text); toast("Backup restored"); renderActive(); } catch (e) { toast("Couldn't read that file", "warn"); } } });
  };
  inp.click();
}

// ---------------------------------------------------------------------------
// Theme — follows the device unless someone picks Light or Dark in Settings.
// ---------------------------------------------------------------------------
const THEME_KEY = "jrlions_theme";
function themePref() {
  const v = localStorage.getItem(THEME_KEY);
  return v === "light" || v === "dark" || v === "auto" ? v : "auto";
}
function systemIsDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}
function resolvedTheme() {
  return themePref() === "auto" ? (systemIsDark() ? "dark" : "light") : themePref();
}
function applyTheme() {
  const theme = resolvedTheme();
  document.documentElement.setAttribute("data-theme", theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#000000" : "#f2f2f7");
}
function setThemePref(pref) {
  localStorage.setItem(THEME_KEY, pref);
  applyTheme();
  // Status colors are chosen for the current appearance at render time.
  if (document.getElementById("main")) renderActive();
}
function appearanceControl() {
  const pref = themePref();
  const options = [["auto", "Match device"], ["light", "Light"], ["dark", "Dark"]];
  return el("div.segmented", { role: "radiogroup", "aria-label": "Appearance" }, options.map(([value, label]) =>
    el("button.seg" + (pref === value ? ".on" : ""), {
      type: "button", role: "radio", "aria-checked": pref === value ? "true" : "false",
      text: label, onclick: () => setThemePref(value),
    })));
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
function showGate(message) {
  const app = document.getElementById("app");
  clear(app);
  app.appendChild(el("main.gate", {}, [
    el("div.gate-card", {}, [
      brandLogo({ large: true, alt: "Jr Lions Lacrosse" }),
      el("h1", { text: "Jr Lions Lacrosse Run Book" }),
      el("p.muted", { text: message }),
      el("button.btn.primary", { type: "button", text: "Sign in with Google",
        onclick: async () => { try { await signIn(); } catch (e) { toast(e.message, "warn"); } } }),
    ]),
  ]));
}

async function boot() {
  applyTheme();
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onScheme = () => {
    if (themePref() !== "auto") return;
    applyTheme();
    if (document.getElementById("main") && !isModalOpen()) renderActive();
  };
  if (mq.addEventListener) mq.addEventListener("change", onScheme);
  else if (mq.addListener) mq.addListener(onScheme);
  if (isConfigured) {
    onAuth(async (user) => {
      currentUser = user;
      if (REQUIRE_SIGN_IN && !user) { showGate("Please sign in to open the run book."); return; }
      await start();
    });
  } else {
    await start();
  }
}

let started = false;
async function start() {
  if (started) { buildShell(); renderActive(); return; }
  started = true;
  bindTasksRerender(() => { if (active === "tasks") renderTasks(document.getElementById("main")); else renderActive(); });

  await Store.init();

  // Best-effort: match the signed-in person to an owner the first time.
  if (currentUser && !getMe()) {
    const name = (currentUser.displayName || currentUser.email || "").split("@")[0].toLowerCase();
    const match = (Store.meta().owners || []).find((o) => o.toLowerCase() === name);
    if (match) setMe(match);
  }

  buildShell();
  renderActive();

  // Re-render the active tab on data changes — but never yank the page out
  // from under an open editor/dialog.
  Store.subscribe(() => { if (!isModalOpen()) renderActive(); });

  try { await Automation.runScheduled(); } catch (e) { console.error(e); }

  document.addEventListener("keydown", (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.isComposing) return;
    if (isTypingTarget(e.target) || isTypingTarget(document.activeElement)) return;
    if (e.key === "/") { e.preventDefault(); document.getElementById("global-search")?.focus(); }
    else if (e.key === "n") { e.preventDefault(); openTaskEditor(null); }
  });
}

function isTypingTarget(node) {
  if (!node || node.nodeType !== 1) return false;
  const tag = node.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (node.isContentEditable) return true;
  const role = node.getAttribute("role");
  return role === "textbox" || role === "searchbox" || role === "combobox";
}

boot();
