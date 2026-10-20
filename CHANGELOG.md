# Changelog

All notable changes to the Jr Lions Lacrosse Run Book are documented here.
This project follows [Semantic Versioning](https://semver.org/).

---

## [2.4.0] — 2026-10-20

### Changed

- The sign-in screen is a full-bleed green field with a soft net texture, a
  frosted card, a gold accent, and a Google sign-in button. Motion is a short
  rise and is skipped when the device asks for reduced motion. The first
  paint already includes the welcome heading, so it does not wait on a script.
- Home opens with a greeting, a completion ring, and thin stat bars. Task rows
  use due-date chips and owner initials. Tabs, sheets, and presses are quieter.
  Interface icons are inline SVG.

## [2.3.1] — 2026-10-20

### Fixed

- Home dashboard cards stay inside the phone viewport at 375, 390, and 430
  CSS pixels. The stat grid and dashboard columns use `minmax(0, 1fr)`, so a
  long task line cannot widen the page.
- The sign-in screen paints as soon as the page's script runs when no Google
  redirect is pending. `getRedirectResult` still runs, and a return from
  Google still waits on the loading screen. A missing result, an error, or
  the 8 second timeout still replaces that screen with the error and
  **Try again**. A normal signed-out visit still says **Sign in with Google**.
- The logo is served as resized WebP and PNG at 240 and 480 pixels wide, with
  `srcset`. `brand/jrlions-logo.png` stays the `img` `src` fallback.

### Added

- `/` and `/index.html` send a Content-Security-Policy that includes
  `frame-ancestors 'self'`. The policy allows this site's scripts, Firebase
  (`www.gstatic.com`, Google APIs, `firebaseapp.com`), Google sign-in, and
  EmailJS (`api.emailjs.com`). `/__/auth/*` does not receive that policy, so
  the sign-in helper stays frameable. `X-Frame-Options` and
  `Cross-Origin-Opener-Policy` stay unset.

## [2.3.0] — 2026-10-20

The run book is hosted at <https://jrlionsrunbook.vercel.app/>. Google sign-in
uses that host so the handler is first-party.

### Changed

- `vercel.json` proxies `/__/auth/:path*` to
  `https://jrlionsrunbook.firebaseapp.com/__/auth/:path*` and sets short cache
  headers on the page and scripts, a one-day cache on `/brand/*`, and
  `no-store` on the auth proxy. Frame-blocking and opener-policy headers are
  left unset so the sign-in helper can run.
- On any host other than localhost, `authDomain` is the page's own host.
  Loopback still uses `jrlionsrunbook.firebaseapp.com`.
- Sign-in waits until `getRedirectResult` and the first auth state finish,
  tries a popup once, and falls back to a single redirect when the browser
  blocks the popup. A second tap while that is in progress does not start
  another redirect. If the redirect result is missing, errors, or takes
  longer than 8 seconds, the loading screen is replaced by the error and
  **Try again**. A normal signed-out visit still shows **Sign in with Google**.
- Open Graph, Twitter, and the web manifest point at
  `https://jrlionsrunbook.vercel.app/`. The README deploy steps are Vercel,
  including the Firebase authorized domain, the OAuth redirect URI
  `https://jrlionsrunbook.vercel.app/__/auth/handler`, and the API key
  referrer.

## [2.2.0] — 2026-10-19

A simpler interface for parents, coaches, and board members. Every feature from
2.1.0 is still there.

### Changed

- The app uses the system font, the official Jr Lions green (`#115f30`) and
  gold (`#f3c811`), soft cards, and large tap targets. Green is for actions,
  headings, and the selected tab. Gold is a fill or border. Home has one
  primary action, **Add a task**. Filters and sorting sit behind **Filter and sort**.
- The official logo is on the sign-in screen, the sidebar, the phone header,
  and empty states. Favicon, Apple touch icon, manifest icons, and Open Graph
  / Twitter preview images are generated from it. In dark mode the logo sits
  on a light plate.
- On a phone, sections live in a bottom tab bar. Editing opens a sheet that
  slides up. Motion is skipped when the device asks for reduced motion.
- Light and dark follow the phone or computer. Settings → Appearance can lock
  it to Light or Dark.
- Labels and empty states use plain language (“Write a message”, “You’re all
  caught up”, “Run an event”).

## [2.1.0] — 2026-10-19

Security, accessibility, and starter-text fixes. Starter-task wording is **not**
copied into a workspace that has already been seeded; see README → "Starter
tasks on a live workspace". Stored passwords are cleared on load.

### Security

- **Firestore rules file.** Added `firestore.rules`. A read or write requires
  Google sign-in **and** an email on the board allow-list. `jrlionslax44@gmail.com`
  is the starting entry; the board fills in the rest before publishing. The
  file does nothing until it is published in the Firebase console.
- **`REQUIRE_SIGN_IN` only hides the page.** It already defaults to `true`. The
  README now says so, and no longer tells admins to publish `allow read, write:
  if true`.
- **Passwords are not collected.** The task editor no longer has a password
  field. It keeps the "where the login is kept" note. On load, any password
  still stored on a task is cleared (the same wipe backups already used), and
  backups always omit passwords. There is no "include passwords" checkbox.
- **HTML is text unless it is explicitly sanitized.** `el(..., { html })` keeps
  only `strong`, `em`, `code`, `br`, and a few other formatting tags, and strips
  every attribute. A string passed to a dialog is plain text.
- **API key.** The README tells admins to restrict the Firebase web API key to
  `https://jchristadore-ux.github.io/*` in Google Cloud.

### Accessibility

- Dialogs are named with `aria-labelledby` pointing at the dialog heading.
- Emoji-only buttons (menu, theme, more actions, remove) have accessible names.
- Gold text on white and cream uses a darker gold that meets WCAG AA. Muted
  text, status chips, and the local-mode badge were darkened the same way on
  the light theme. Dark theme keeps brighter hues so they stay readable on navy.
- `/` and `n` do not run while typing in a field, including contenteditable and
  textbox roles, or while Ctrl/Alt/Command is held.

### Changed

- **Starter tasks** (`config.js` only): owner names use consistent
  capitalization (`Mike`, `Tom/John`, `Lisa`, …), titles use title case, and
  "EOY" is spelled out as "End of Year". Placeholder `LINK` and `N/A` websites
  and emails are empty. No URLs or due dates were invented. The Turkey
  Tournament URL is unchanged.
- **Open website** is shown only when the website is an `http://` or `https://`
  URL, in the task row and in the editor.
- App version is **2.1.0**.

### Fixed

- Chrome logged a warning on the task editor because the password field was not
  inside a form. Removing the field removes the warning.
- README example URLs now point at
  `https://jchristadore-ux.github.io/JrLionsDigitalRunBook/`.
- The "Who are you?" dropdowns have an accessible name.

Work below was already in the app and is versioned here for the first time.

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
- **Settings → "Merge duplicate tasks"** button, so duplicate rows can be cleaned
  up on demand without waiting for a reload.
- **Sortable task list.** The Tasks page now sorts by **due date, soonest first**
  by default — previously the only order was the stored drag-and-drop `order`
  field, which meant the next deadline could sit anywhere on the page. A
  **Sort by** button row above the list switches between Due date, Priority,
  Status, Owner, Category, Name, and Manual; clicking the active button reverses
  it, and **Reset** returns to the default. The choice persists per device, and
  the count under the page title now names the active sort.
  - Rows with nothing to sort on (no due date, no owner) always sink to the
    bottom in both directions, so reversing never buries real tasks under blanks.
  - Status sorts by urgency — overdue, blocked, in progress, waiting, not
    started, completed — rather than alphabetically.
  - Manual order remains the tie-break under every sort, so equal rows keep the
    arrangement they were dragged into.
  - Drag handles now appear only under **Manual**; dragging under an automatic
    sort would have snapped straight back.

### Fixed

- **Every task duplicated (or triplicated) in the run book.** Seeding keyed off
  `state.tasks` being empty, but in cloud mode the app only waited a fixed 600ms
  for Firestore's first snapshot. On a slow connection that snapshot hadn't
  landed, the workspace looked brand new, and all 39 starter tasks were planted
  again with fresh random IDs — once per unlucky boot. The store now waits for
  the real first snapshot (up to 8s) and refuses to seed a collection it hasn't
  actually confirmed is empty.
- **Seeding is now idempotent.** Seeded tasks, lists, templates, and automations
  get deterministic IDs derived from their name, so a second seeding pass
  overwrites the same documents instead of creating a parallel set. A `seededAt`
  marker also keeps a deliberately emptied run book empty.
- **Existing duplicates are repaired automatically.** On load (and via the new
  Settings button) rows describing the same job — same title and program,
  ignoring case and spacing — are merged into one. Nothing is lost: the survivor
  inherits every field the copies had filled in, counts as Completed if any copy
  was, keeps the soonest due date, and dependencies pointing at a discarded row
  are re-pointed at the survivor.
- **Recurring tasks no longer spawn a second row.** Completing an annual task
  used to create a new task document for next season, so each job gained a row
  per year. A repeating job is now a single row that stays Completed for the rest
  of the season, then rolls to the next date in place.
- **Duplicate titles are blocked at the source.** The task editor now refuses to
  save a second live task with the same title and program, pointing at the
  existing one instead.
- **Settings no longer drop unknown workspace metadata** when applying defaults.

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
