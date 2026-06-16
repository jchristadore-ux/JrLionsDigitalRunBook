// =============================================================================
// ui.js — Small, dependency-free UI helpers shared across the app.
// =============================================================================

// Unique id
export function uid(prefix = "id") {
  return prefix + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

// Safe element builder. el("div.card#main", {onclick}, [children])
export function el(spec, attrs = {}, children = []) {
  const [tagAndId, ...classes] = spec.split(".");
  const [tag, id] = tagAndId.split("#");
  const node = document.createElement(tag || "div");
  if (id) node.id = id;
  if (classes.length) node.className = classes.join(" ");
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k === "text") node.textContent = v;
    else if (k === "dataset") Object.assign(node.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, "");
    else if (v === false) {/* skip */}
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }

// ---- Validation helpers -----------------------------------------------------
export function isEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim()); }
export function isUrl(s) {
  const v = String(s || "").trim();
  if (!v) return true;
  return /^https?:\/\//i.test(v) || v === "LINK" || v === "N/A";
}
export function parseMoney(s) {
  if (s === "" || s == null) return null;
  const n = Number(String(s).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? null : n;
}
export function fmtMoney(n) {
  const v = parseMoney(n);
  if (v == null) return "";
  return "$" + v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// ---- Dates ------------------------------------------------------------------
export function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + (String(iso).length === 10 ? "T00:00:00" : ""));
  if (isNaN(d)) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
export function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
export function fmtRelative(iso) {
  if (!iso) return "";
  const d = new Date(iso + (String(iso).length === 10 ? "T00:00:00" : ""));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Math.round((d - today) / 86400000);
  if (isNaN(days)) return "";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days < 0) return `${Math.abs(days)} days ago`;
  return `in ${days} days`;
}
export function daysUntil(iso) {
  if (!iso) return Infinity;
  const d = new Date(iso + (String(iso).length === 10 ? "T00:00:00" : ""));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}
export function todayISO() {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}
const MONTHS = ["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"];
// Convert a month name + day into the next upcoming ISO date.
export function monthDayToISO(monthName, day) {
  if (!monthName) return "";
  const m = MONTHS.indexOf(String(monthName).trim().toUpperCase());
  if (m < 0) return "";
  const d = Number(day) || 1;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const year = now.getFullYear();
  let candidate = new Date(year, m, d);
  if (candidate < now) candidate = new Date(year + 1, m, d);
  return candidate.toISOString().slice(0, 10);
}
// Advance an ISO date by one recurrence period, landing on the next future date.
export function nextRecurrence(iso, recurrence) {
  if (!iso || !recurrence || recurrence === "none") return "";
  const base = new Date(iso + "T00:00:00");
  if (isNaN(base)) return "";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const step = (d) => {
    if (recurrence === "weekly") d.setDate(d.getDate() + 7);
    else if (recurrence === "monthly") d.setMonth(d.getMonth() + 1);
    else d.setFullYear(d.getFullYear() + 1);
    return d;
  };
  let next = step(new Date(base));
  // Roll forward until it lands in the future (handles long-stale tasks).
  let guard = 0;
  while (next <= today && guard++ < 520) next = step(next);
  return next.toISOString().slice(0, 10);
}

// ---- Toasts -----------------------------------------------------------------
let toastHost;
export function toast(message, kind = "ok", actionLabel, onAction) {
  if (!toastHost) {
    toastHost = el("div.toast-host"); document.body.appendChild(toastHost);
  }
  const t = el("div.toast." + kind, {}, [
    el("span.toast-msg", { text: message }),
    actionLabel ? el("button.toast-action", { type: "button", text: actionLabel,
      onclick: () => { try { onAction && onAction(); } finally { dismiss(); } } }) : null,
    el("button.toast-close", { type: "button", "aria-label": "Dismiss", text: "✕", onclick: () => dismiss() }),
  ]);
  function dismiss() { t.classList.add("leaving"); setTimeout(() => t.remove(), 200); }
  toastHost.appendChild(t);
  setTimeout(dismiss, actionLabel ? 8000 : 3500);
}

// ---- Modal ------------------------------------------------------------------
let openOverlay = null;
export function isModalOpen() { return !!openOverlay; }
export function openModal({ title, body, footer, width = 720, onClose }) {
  closeModal();
  const overlay = el("div.modal-overlay", {
    onclick: (e) => { if (e.target === overlay) closeModal(); },
  });
  const modal = el("div.modal", { style: `max-width:${width}px`, role: "dialog", "aria-modal": "true", "aria-label": title || "Dialog" });
  const head = el("div.modal-head", {}, [
    el("h2.modal-title", { text: title || "" }),
    el("button.icon-btn", { type: "button", "aria-label": "Close", text: "✕", onclick: () => closeModal() }),
  ]);
  const content = el("div.modal-body");
  if (typeof body === "string") content.innerHTML = body; else if (body) content.appendChild(body);
  modal.appendChild(head); modal.appendChild(content);
  if (footer) { const f = el("div.modal-foot"); [].concat(footer).forEach((x) => x && f.appendChild(x)); modal.appendChild(f); }
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  document.body.classList.add("modal-open");
  openOverlay = { overlay, onClose };
  // Keyboard: Escape closes, Tab is trapped inside the dialog.
  const onKey = (e) => {
    if (e.key === "Escape") { closeModal(); return; }
    if (e.key === "Tab") trapTab(e, modal);
  };
  document.addEventListener("keydown", onKey);
  openOverlay.onKey = onKey;
  setTimeout(() => { const f = modal.querySelector("input,select,textarea,button"); f && f.focus(); }, 30);
  return { overlay, modal, content };
}
function trapTab(e, modal) {
  const focusable = modal.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])');
  if (!focusable.length) return;
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
export function closeModal() {
  if (!openOverlay) return;
  document.removeEventListener("keydown", openOverlay.onKey);
  const cb = openOverlay.onClose;
  openOverlay.overlay.remove();
  document.body.classList.remove("modal-open");
  openOverlay = null;
  cb && cb();
}

// ---- Confirm dialog ---------------------------------------------------------
export function confirmDialog({ title = "Are you sure?", message = "", confirmLabel = "Confirm", danger = true, onConfirm }) {
  const msg = el("p.confirm-msg", { text: message });
  const cancel = el("button.btn.ghost", { type: "button", text: "Cancel", onclick: () => closeModal() });
  const ok = el("button.btn." + (danger ? "danger" : "primary"), {
    type: "button", text: confirmLabel,
    onclick: () => { closeModal(); onConfirm && onConfirm(); },
  });
  openModal({ title, body: msg, footer: [cancel, ok], width: 460 });
}

// ---- Form field factory -----------------------------------------------------
export function field(label, control, hint) {
  return el("label.field", {}, [
    el("span.field-label", { text: label }),
    control,
    hint ? el("span.field-hint", { text: hint }) : null,
  ]);
}
export function input(attrs = {}) { return el("input.control", { type: "text", ...attrs }); }
export function textarea(attrs = {}) {
  // A <textarea>'s text comes from its content/`.value` property, not a `value`
  // attribute — so pull `value` out and assign it directly, otherwise existing
  // text (e.g. when editing a saved list) never shows up in the field.
  const { value, ...rest } = attrs;
  const node = el("textarea.control", { rows: 3, ...rest });
  if (value != null) node.value = value;
  return node;
}
export function select(options, value, attrs = {}) {
  const s = el("select.control", attrs);
  for (const o of options) {
    const opt = typeof o === "string" ? { value: o, label: o } : o;
    const node = el("option", { value: opt.value }, [opt.label]);
    if (String(opt.value) === String(value)) node.selected = true;
    s.appendChild(node);
  }
  return s;
}
