# Changelog

All notable changes to the Jr Lions Lacrosse Run Book are documented here.
This project follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added

- **Automatic email sending (free, no server).** The run book can now deliver
  email by itself via [EmailJS](https://www.emailjs.com/) (free tier:
  200 emails/month, sent straight from the browser — no backend). When connected,
  Compose gains a **Send now** button and automations/due-soon reminders truly
  send on their own; delivered messages show a green **Sent** pill in the Outbox.
  Without it, the app falls back to the previous manual `mailto:` draft behavior.
- **In-app setup.** New **Settings → "Automatic email sending"** panel to paste
  the EmailJS Public Key, Service ID, and Template ID, send a test email, and turn
  delivery on/off. Settings sync to the whole workspace. Can alternatively be set
  in `config.js` (`EMAIL_DELIVERY`).
- **Email delivery status banner** on the Email tab showing whether automatic
  sending is on or off.
- **README → "Automatic email (free, no server)"** with step-by-step EmailJS setup
  (account, Gmail service, the one template to create, security, and turning it on).

---

## [2.0.0] — 2026-06-16

Major release following a full pre-production teardown audit. The application
was functionally complete in 1.0.0, but the data layer advertised capabilities
the interface never surfaced. This release closes that gap: every field in the
data model is now editable, every dashboard widget is real, and every automation
run is logged and inspectable. No data migration steps are required — existing
workspaces and 1.0.0 backups upgrade automatically. See `MIGRATION.md` for
details and `AUDIT_REPORT.md` for the full findings.

### Added

- **Executive dashboard (complete rebuild).** All 12 widgets now render and are
  individually toggleable in Settings: Needs Attention banner, four stat cards
  (Open / Overdue / Blocked / My Open), Overdue list, Due This Week, Blocked
  (with named blockers), Assigned to Me, Automation Failures, Costs &
  Subscriptions (annualized + one-time totals with renewal flags), Credentials
  to tidy up, Upcoming events, Recent Activity, Active Automations, and Events.
  In 1.0.0 only 6 widgets rendered and the Settings toggles pointed at keys that
  did nothing.
- **Activity feed.** Every create, edit, status change, delete, and bulk action
  is recorded and shown in the dashboard's Recent Activity widget. Secrets are
  never written to the log. Capped at 250 entries with automatic pruning.
- **Automation run history.** Every automation execution is logged with an
  outcome (✓/✕), a human-readable message, and any error text. Each automation
  card shows its last result and a "History" button opening the full run log.
  Capped at 300 entries with automatic pruning.
- **"Who are you?" identity picker.** A per-device setting (Settings → Who are
  you?) drives the "Assigned to Me" / "My Open" views. On first cloud sign-in it
  is auto-matched from the Google display name, and it understands shared owner
  labels like `TOM/JOHN`.
- **Blocked status (derived).** Task status now derives `Blocked` automatically
  when an incomplete dependency exists. Precedence: Completed > Overdue >
  Blocked > stored status.
- **Recurring task spawning.** Completing a recurring task now auto-creates the
  next occurrence (de-duplicated), using the recurrence field that was inert in
  1.0.0.
- **Full task editor.** The editor now exposes every field in the model
  (~25 fields) organized into labelled sections: core, scheduling & recurrence,
  dependencies (checkbox picker), vendor & cost (with cadence), credentials
  (location + optional masked reference), related systems, documentation links,
  and automation eligibility.
- **`costCadence` field** (`one-time`, `monthly`, `quarterly`, `annual`) so the
  dashboard can annualize recurring costs correctly.
- **`automationEligible` toggle** per task. The engine skips any task marked
  ineligible.
- **`credentialLocation` field** — a plain-language pointer to where a
  credential actually lives (e.g. "shared 1Password vault").
- **Safe automation testing.** "Run now" queues emails as drafts to the Outbox
  instead of opening live mail windows, so volunteers can test a workflow
  without sending anything.
- **Optional credential export.** Backups exclude task passwords by default; an
  explicit "include passwords" checkbox on the export control overrides this.
- **Keyboard shortcuts.** `/` focuses search, `n` opens a new task.

### Changed

- **Status engine** centralized in `statusOf()`; bulk operations now route
  through `setStatus()` so logging and recurrence spawning fire consistently.
- **Search** now also matches `vendor` and `relatedSystems`.
- **Live re-render** from the cloud subscription is suppressed while a modal is
  open (`isModalOpen()` guard), so an open editor is no longer wiped out by an
  incoming sync.
- **Email "send"** path documented and hardened: a static site cannot send mail,
  so "send" composes a pre-filled `mailto:` draft and records it to the Outbox
  with a status pill (queued / opened / failed). Validation runs before
  composing.
- **Settings dashboard toggles** rewritten to the 12 real widget keys.

### Fixed

- Settings widget toggles referenced a stale key (`recentlyCompleted`) and had
  no effect — now wired to live keys.
- `logActivity` / `logRun` / `runLog` existed in the store but were never
  called — now wired at 9 activity sites and 6 run sites.
- Recurrence field was stored but never acted upon.
- Task editor could not reach roughly half the data model.

### Removed

- Dead code: `quickBtnHtml` (app.js) and a duplicate `escapeHtml` (automation.js).

### Security

- Task passwords are now optional, masked in the editor, and excluded from
  backups by default. The model encourages storing a `credentialLocation`
  pointer rather than the secret itself.
- Activity and run logs never record secret values.
- All free-text rendered through `escapeHtml`; email and URL fields validated on
  save.

---

## [1.0.0] — 2026-06-16

Initial release.

- Static GitHub Pages app: vanilla JS ES modules, no build step.
- Two operating modes, auto-detected: **Cloud** (Firebase Firestore, shared
  real-time workspace) and **Local** (browser `localStorage`, offline).
- Seeded from the source workbook: 39 tasks, 8 distribution lists, 3 email
  templates, 2 automations.
- Tabs: Dashboard, Tasks, Automations, Email, Calendar/Events, Settings.
- No-code automation builder (WHEN / IF / THEN).
- Light and dark themes.
- JSON export / import and reset-to-seed.
