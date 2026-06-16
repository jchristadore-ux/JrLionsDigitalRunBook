// =============================================================================
// email.js — Distribution lists, templates, variables, preview, Outbox
// -----------------------------------------------------------------------------
// A static GitHub Pages site can't run a mail server, so a message is "queued"
// to the Outbox with everything filled in, and a volunteer clicks "Open draft"
// to hand it to their own email app (mailto). Every message is auditable:
//   queued  → created by an automation or test, not yet handed off
//   opened  → a draft was opened in the email app, ready to send
//   failed  → something went wrong building the message (see the error)
// To send fully automatically, connect a service (see README → "Real email").
// =============================================================================

import { Store } from "./firestore.js";
import {
  el, clear, field, input, textarea, select, toast, openModal, closeModal,
  confirmDialog, fmtDateTime, isEmail, uid,
} from "./ui.js";

const TEMPLATE_VARS = ["{{TaskName}}", "{{DueDate}}", "{{Owner}}", "{{Notes}}", "{{Category}}", "{{Program}}"];

export const Email = {
  lists() { return Store.list("distributionLists"); },
  templates() { return Store.list("emailTemplates"); },

  listByName(name) { return this.lists().find((l) => l.name === name); },
  templateByName(name) { return this.templates().find((t) => t.name === name); },

  // Lists + ad-hoc individual recipients, de-duplicated.
  resolveRecipients(listNames = [], extra = "") {
    const set = new Set();
    for (const n of listNames) {
      const l = this.listByName(n);
      (l?.recipients || []).forEach((r) => r && set.add(r.trim()));
    }
    String(extra || "").split(/[\n,;]/).map((s) => s.trim()).filter(Boolean).forEach((r) => set.add(r));
    return [...set];
  },

  fillTemplate(templateName, task = {}) {
    const tpl = this.templateByName(templateName) || { subject: "", body: "" };
    const vars = {
      "{{TaskName}}": task.title || "",
      "{{DueDate}}": task.dueDate || "",
      "{{Owner}}": task.owner || "",
      "{{Notes}}": task.notes || "",
      "{{Category}}": task.category || "",
      "{{Program}}": task.program || "",
    };
    const fill = (s) => Object.entries(vars).reduce((acc, [k, v]) => acc.split(k).join(v), s || "");
    return { subject: fill(tpl.subject), body: fill(tpl.body) };
  },

  mailto(to, subject, body) {
    return `mailto:${encodeURIComponent((to || []).join(","))}` +
      `?subject=${encodeURIComponent(subject || "")}&body=${encodeURIComponent(body || "")}`;
  },

  async record({ to, subject, body, source = "Manual", status = "queued", error = "" }) {
    return Store.upsert("events", {
      id: uid("eml"), type: "email", to, subject, body, source, status, error,
      sentAt: new Date().toISOString(),
    });
  },

  // Queue (and optionally open) a message. Returns { ok, status, message }.
  async send({ to, subject, body, source, open = false }) {
    const invalid = (to || []).filter((r) => !isEmail(r));
    if (!to || !to.length) {
      await this.record({ to: to || [], subject, body, source, status: "failed", error: "No recipients" });
      return { ok: false, status: "failed", message: "No recipients on the selected list(s)" };
    }
    if (invalid.length) {
      await this.record({ to, subject, body, source, status: "failed", error: "Invalid address: " + invalid.join(", ") });
      return { ok: false, status: "failed", message: "Invalid address: " + invalid.join(", ") };
    }
    const status = open ? "opened" : "queued";
    await this.record({ to, subject, body, source, status });
    if (open) window.open(this.mailto(to, subject, body), "_blank");
    return { ok: true, status, message: open ? "Draft opened" : "Queued to Outbox" };
  },

  outbox() {
    return Store.list("events").filter((e) => e.type === "email")
      .sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt)));
  },

  async openDraft(rec) {
    window.open(this.mailto(rec.to, rec.subject, rec.body), "_blank");
    await Store.upsert("events", { ...rec, status: "opened" });
  },
};

// =============================================================================
// RENDER — Email tab (Lists · Templates · Outbox)
// =============================================================================
export function renderEmail(root) {
  clear(root);
  root.appendChild(el("div.section-head", {}, [
    el("div", {}, [
      el("h1.page-title", { text: "Email" }),
      el("p.page-sub", { text: "Distribution lists, message templates, and a record of every message." }),
    ]),
    el("button.btn.primary", { type: "button", html: "✉ Compose message", onclick: () => openCompose(root) }),
  ]));

  // ---- Distribution lists ---------------------------------------------------
  const listsCard = el("section.card.block");
  listsCard.appendChild(el("div.card-head", {}, [
    el("h2", { text: "Distribution lists" }),
    el("button.btn.sm.primary", { type: "button", text: "＋ New list", onclick: () => openListEditor(null, root) }),
  ]));
  const listGrid = el("div.list-grid");
  for (const l of Email.lists()) {
    listGrid.appendChild(el("div.mini-card", {}, [
      el("div.mini-head", {}, [
        el("strong", { text: l.name }),
        el("span.count-pill", { text: String((l.recipients || []).length) }),
      ]),
      el("p.muted.small", { text: (l.recipients || []).length ? (l.recipients.slice(0, 3).join(", ") + ((l.recipients.length > 3) ? "…" : "")) : "No recipients yet" }),
      el("div.mini-actions", {}, [
        el("button.btn.ghost.sm", { type: "button", text: "Edit", onclick: () => openListEditor(l, root) }),
        el("button.btn.ghost.sm", { type: "button", text: "Test", onclick: () => openCompose(root, { lists: [l.name] }) }),
        el("button.btn.ghost.sm.danger", { type: "button", text: "Delete", onclick: () => confirmDialog({
          title: "Delete list?", message: `"${l.name}" will be removed.`, confirmLabel: "Delete",
          onConfirm: async () => { await Store.remove("distributionLists", l.id); toast("List deleted"); renderEmail(root); } }) }),
      ]),
    ]));
  }
  if (!Email.lists().length) listGrid.appendChild(el("p.muted.small", { text: "No lists yet — create one to email a group at once." }));
  listsCard.appendChild(listGrid);
  root.appendChild(listsCard);

  // ---- Templates ------------------------------------------------------------
  const tplCard = el("section.card.block");
  tplCard.appendChild(el("div.card-head", {}, [
    el("h2", { text: "Templates" }),
    el("button.btn.sm.primary", { type: "button", text: "＋ New template", onclick: () => openTemplateEditor(null, root) }),
  ]));
  tplCard.appendChild(el("p.muted.small", { text: "Variables: " + TEMPLATE_VARS.join(" · ") }));
  const tplGrid = el("div.list-grid");
  for (const t of Email.templates()) {
    tplGrid.appendChild(el("div.mini-card", {}, [
      el("div.mini-head", {}, [el("strong", { text: t.name })]),
      el("p.muted.small", { text: t.subject || "(no subject)" }),
      el("div.mini-actions", {}, [
        el("button.btn.ghost.sm", { type: "button", text: "Edit", onclick: () => openTemplateEditor(t, root) }),
        el("button.btn.ghost.sm", { type: "button", text: "Preview", onclick: () => previewTemplate(t) }),
        el("button.btn.ghost.sm.danger", { type: "button", text: "Delete", onclick: () => confirmDialog({
          title: "Delete template?", message: `"${t.name}" will be removed.`, confirmLabel: "Delete",
          onConfirm: async () => { await Store.remove("emailTemplates", t.id); toast("Template deleted"); renderEmail(root); } }) }),
      ]),
    ]));
  }
  tplCard.appendChild(tplGrid);
  root.appendChild(tplCard);

  // ---- Outbox ---------------------------------------------------------------
  const outCard = el("section.card.block");
  outCard.appendChild(el("div.card-head", {}, [el("h2", { text: "Outbox" }), el("span.muted.small", { text: "Most recent first" })]));
  const out = Email.outbox();
  if (!out.length) {
    outCard.appendChild(el("p.muted", { text: "Nothing here yet. Compose a message or run an automation to see it." }));
  } else {
    const tbl = el("div.outbox");
    for (const e of out.slice(0, 40)) {
      tbl.appendChild(el("div.outbox-row", {}, [
        el("div.outbox-main", {}, [
          el("div.outbox-subj", {}, [statusPill(e.status), el("strong", { text: e.subject || "(no subject)" })]),
          el("div.muted.small", { text: "To: " + (e.to || []).join(", ") + (e.error ? " · " + e.error : "") }),
        ]),
        el("div.outbox-side", {}, [
          el("span.tag", { text: e.source }),
          el("span.muted.small", { text: fmtDateTime(e.sentAt) }),
          (e.to || []).length ? el("button.btn.ghost.sm", { type: "button", text: e.status === "opened" ? "Re-open" : "Open draft",
            onclick: async () => { await Email.openDraft(e); toast("Draft opened in your email app"); renderEmail(root); } }) : null,
        ]),
      ]));
    }
    outCard.appendChild(tbl);
  }
  root.appendChild(outCard);
}

function statusPill(status) {
  const map = { queued: ["Queued", "warn"], opened: ["Opened", "ok"], failed: ["Failed", "danger"] };
  const [label, kind] = map[status] || ["Queued", "warn"];
  return el("span.count-pill." + kind, { text: label });
}

// ---- Compose (preview before sending) --------------------------------------
function openCompose(root, preset = {}) {
  const lists = Email.lists();
  const templates = Email.templates();
  let chosen = new Set(preset.lists || []);
  const extra = textarea({ rows: 2, placeholder: "extra emails, comma or line separated (optional)" });
  const tplSel = select([{ value: "", label: "— write my own —" }, ...templates.map((t) => ({ value: t.name, label: t.name }))], preset.template || "");
  const subject = input({ placeholder: "Subject" });
  const bodyTa = textarea({ rows: 8, placeholder: "Message body" });

  const listBox = el("div.checkbox-grid");
  lists.forEach((l) => {
    const cb = el("input", { type: "checkbox", checked: chosen.has(l.name),
      onchange: (e) => { e.target.checked ? chosen.add(l.name) : chosen.delete(l.name); } });
    listBox.appendChild(el("label.cbx", {}, [cb, el("span", { text: `${l.name} (${(l.recipients || []).length})` })]));
  });

  function applyTemplate() {
    const t = Email.templateByName(tplSel.value);
    if (t) { subject.value = t.subject; bodyTa.value = t.body; }
  }
  tplSel.addEventListener("change", applyTemplate);
  if (preset.template) applyTemplate();

  const body = el("div.form-grid", {}, [
    field("Send to lists", listBox),
    field("Individual recipients", extra),
    field("Start from template", tplSel),
    field("Subject", subject),
    field("Body", bodyTa),
    el("p.muted.small", { text: "“Queue” logs it to the Outbox. “Open draft” also hands it to your email app to send." }),
  ]);

  const queueBtn = el("button.btn", { type: "button", text: "Queue", onclick: () => doSend(false) });
  const openBtn = el("button.btn.primary", { type: "button", text: "Open draft & log", onclick: () => doSend(true) });
  async function doSend(open) {
    const to = Email.resolveRecipients([...chosen], extra.value);
    if (!to.length) { toast("Add at least one recipient or list", "warn"); return; }
    const r = await Email.send({ to, subject: subject.value, body: bodyTa.value, source: "Compose", open });
    closeModal();
    toast(r.message, r.ok ? "ok" : "warn");
    renderEmail(root);
  }
  openModal({ title: "Compose message", body,
    footer: [el("button.btn.ghost", { type: "button", text: "Cancel", onclick: () => closeModal() }), queueBtn, openBtn], width: 620 });
}

function previewTemplate(t) {
  const sample = { title: "Submit season equipment order", dueDate: "2026-02-15", owner: "TOM", category: "PROGRAM ORDER", program: "ALL", notes: "Confirm sizes first." };
  const filled = Email.fillTemplate(t.name, sample);
  const body = el("div.form-grid", {}, [
    el("p.muted.small", { text: "Filled in with a sample task so you can see the result." }),
    el("p", {}, [el("strong", { text: "Subject: " }), filled.subject]),
    el("pre.preview", { text: filled.body }),
  ]);
  openModal({ title: `Preview "${t.name}"`, body, footer: [el("button.btn.primary", { type: "button", text: "Close", onclick: () => closeModal() })], width: 560 });
}

function openListEditor(existing, root) {
  const l = existing ? { ...existing } : { name: "", recipients: [] };
  const fName = input({ value: l.name, placeholder: "e.g. Coaches" });
  const fRec = textarea({ value: (l.recipients || []).join("\n"), rows: 6, placeholder: "one email per line" });
  const body = el("div.form-grid", {}, [field("List name", fName), field("Recipients", fRec, "One email address per line")]);
  const save = el("button.btn.primary", { type: "button", text: existing ? "Save list" : "Create list", onclick: async () => {
    if (!fName.value.trim()) { toast("Name the list first", "warn"); return; }
    const recipients = fRec.value.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    const bad = recipients.filter((r) => !isEmail(r));
    if (bad.length) { toast("Check these addresses: " + bad.slice(0, 2).join(", "), "warn"); return; }
    await Store.upsert("distributionLists", { ...l, name: fName.value.trim(), recipients });
    closeModal(); toast("List saved"); renderEmail(root);
  } });
  openModal({ title: existing ? "Edit list" : "New list", body, footer: [el("button.btn.ghost", { type: "button", text: "Cancel", onclick: () => closeModal() }), save], width: 520 });
}

function openTemplateEditor(existing, root) {
  const t = existing ? { ...existing } : { name: "", subject: "", body: "" };
  const fName = input({ value: t.name, placeholder: "e.g. Task Reminder" });
  const fSubject = input({ value: t.subject, placeholder: "Reminder: {{TaskName}} is due {{DueDate}}" });
  const fBody = textarea({ value: t.body, rows: 8, placeholder: "Message body. Use variables like {{TaskName}}." });
  const body = el("div.form-grid", {}, [
    field("Template name", fName), field("Subject", fSubject), field("Body", fBody),
    el("p.muted.small", { text: "Variables: " + TEMPLATE_VARS.join(" · ") }),
  ]);
  const save = el("button.btn.primary", { type: "button", text: existing ? "Save template" : "Create template", onclick: async () => {
    if (!fName.value.trim()) { toast("Name the template first", "warn"); return; }
    await Store.upsert("emailTemplates", { ...t, name: fName.value.trim(), subject: fSubject.value, body: fBody.value });
    closeModal(); toast("Template saved"); renderEmail(root);
  } });
  openModal({ title: existing ? "Edit template" : "New template", body, footer: [el("button.btn.ghost", { type: "button", text: "Cancel", onclick: () => closeModal() }), save], width: 640 });
}
