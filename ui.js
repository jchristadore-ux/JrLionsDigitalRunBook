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
    // `html` is the explicit opt-in. It is sanitized; everything else is text.
    else if (k === "html") node.innerHTML = sanitizeHtml(v);
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

// Inline icons. Callers pass a single path so the UI stays consistent and
// does not depend on emoji fonts.
export function svgIcon(d, className = "ico") {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", className);
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

const NAMED_ICONS = {
  close: "M6 6l12 12M18 6 6 18",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  repeat: "M17 2l4 4-4 4M3 12V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 12v3a4 4 0 0 1-4 4H3",
  calendar: "M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
  grip: "M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01",
};

export function iconNamed(name, className) {
  return svgIcon(NAMED_ICONS[name] || NAMED_ICONS.close, className);
}

export function initials(name) {
  const parts = String(name || "").trim().split(/[\s/]+/).filter(Boolean);
  if (!parts.length) return "?";
  const second = parts.length > 1 ? parts[1][0] : "";
  return (parts[0][0] + second).toUpperCase();
}

export function personMark(name) {
  return el("span.mini-avatar", { "aria-hidden": "true", title: name || "", text: initials(name) });
}

// Four-color mark used on the sign-in button. Decorative; the button name is text.
export function googleMark() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 18 18");
  svg.setAttribute("class", "google-mark");
  svg.setAttribute("aria-hidden", "true");
  const parts = [
    ["M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z", "#4285F4"],
    ["M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z", "#34A853"],
    ["M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z", "#FBBC05"],
    ["M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z", "#EA4335"],
  ];
  for (const [d, fill] of parts) {
    const p = document.createElementNS(ns, "path");
    p.setAttribute("d", d);
    p.setAttribute("fill", fill);
    svg.appendChild(p);
  }
  return svg;
}

// Official mark. The plate stays light in dark mode so the green and gold read.
// Resized WebP/PNG are preferred. The original PNG is the src fallback.
export function brandLogo({ large = false, alt = "", plateClass = "" } = {}) {
  // Source has to be in the picture before src is set. Otherwise the browser
  // starts the original PNG and then also fetches the resized asset.
  const img = el("img.brand-logo", {
    alt,
    width: "480",
    height: "272",
    decoding: "async",
  });
  const source = el("source", {
    type: "image/webp",
    srcset: "brand/jrlions-logo-240.webp 240w, brand/jrlions-logo-480.webp 480w",
    sizes: "240px",
  });
  const picture = el("picture", {}, [source, img]);
  img.setAttribute("sizes", "240px");
  img.setAttribute("srcset", "brand/jrlions-logo-240.png 240w, brand/jrlions-logo-480.png 480w");
  img.setAttribute("src", "brand/jrlions-logo.png");
  if (large) img.setAttribute("fetchpriority", "high");
  const plate = "span.logo-plate" + (large ? ".lg" : "") + (plateClass ? "." + plateClass : "");
  return el(plate, {}, [picture]);
}

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Tags a volunteer-authored string is allowed to contain. Every attribute is
// stripped, so event handlers and URLs cannot ride along. Anything else is
// turned back into plain text.
const SAFE_HTML_TAGS = new Set(["strong", "em", "b", "i", "code", "br", "p", "span"]);

export function sanitizeHtml(value) {
  const tpl = document.createElement("template");
  tpl.innerHTML = String(value ?? "");
  const clean = (parent) => {
    for (const node of [...parent.childNodes]) {
      if (node.nodeType === Node.TEXT_NODE) continue;
      if (node.nodeType !== Node.ELEMENT_NODE) { node.remove(); continue; }
      const tag = node.tagName.toLowerCase();
      if (!SAFE_HTML_TAGS.has(tag)) {
        node.replaceWith(document.createTextNode(node.textContent || ""));
        continue;
      }
      while (node.attributes.length) node.removeAttribute(node.attributes[0].name);
      clean(node);
    }
  };
  clean(tpl.content);
  return tpl.innerHTML;
}

// Gold / status hues that fail WCAG AA as text on a light surface, and the
// brighter partners that fail on a dark surface. Same hue, readable either way.
const TEXT_ON_LIGHT = {
  "#8a93a6": "#5c657c",
  "#2f80ed": "#1558b0",
  "#b8860b": "#7c5310",
  "#1f9d55": "#0b7a45",
  "#e0413a": "#c4312b",
  "#9b51e0": "#7530b8",
  "#e08a1e": "#9a5400",
  "#1f9d8a": "#0d7464",
};
const TEXT_ON_DARK = {
  "#8a93a6": "#b7c0d4",
  "#2f80ed": "#7eb6ff",
  "#b8860b": "#ffce6b",
  "#1f9d55": "#5fd0a0",
  "#e0413a": "#ff9a94",
  "#9b51e0": "#d2b0ff",
  "#e08a1e": "#ffc46b",
  "#1f9d8a": "#5fd0c0",
};
export function readableColor(hex) {
  const raw = String(hex || "").trim().toLowerCase();
  const dark = document.documentElement.getAttribute("data-theme") === "dark";
  return (dark ? TEXT_ON_DARK : TEXT_ON_LIGHT)[raw] || hex;
}

export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }

// ---- Validation helpers -----------------------------------------------------
export function isEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim()); }
export function isUrl(s) {
  const v = String(s || "").trim();
  if (!v) return true;
  return /^https?:\/\//i.test(v);
}
// A website is openable only when it is a real http(s) URL. Placeholders such
// as "LINK" or "N/A", and blank values, are not.
export function usableWebsite(s) {
  const v = String(s || "").trim();
  return /^https?:\/\//i.test(v) ? v : "";
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
    el("button.toast-close", { type: "button", "aria-label": "Dismiss", onclick: () => dismiss() }, [
      iconNamed("close", "ico"),
    ]),
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
  const titleId = "modal-title";
  const modal = el("div.modal", {
    style: `max-width:${width}px`, role: "dialog", "aria-modal": "true", "aria-labelledby": titleId,
  });
  const head = el("div.modal-head", {}, [
    el("h2.modal-title", { id: titleId, text: title || "Dialog" }),
    el("button.icon-btn", { type: "button", "aria-label": "Close", onclick: () => closeModal() }, [
      iconNamed("close", "ico"),
    ]),
  ]);
  modal.appendChild(el("div.sheet-grabber", { "aria-hidden": "true" }));
  const content = el("div.modal-body");
  // A string body is plain text. Callers that need markup pass an element, or
  // build one with el(..., { html }) which sanitizes.
  if (typeof body === "string") content.textContent = body; else if (body) content.appendChild(body);
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
  setTimeout(() => {
    const f = content.querySelector("input, select, textarea")
      || modal.querySelector(".modal-foot button, button");
    f && f.focus();
  }, 30);
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
