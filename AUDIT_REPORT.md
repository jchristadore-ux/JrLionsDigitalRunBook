# Pre-Production Audit Report — Jr Lions Lacrosse Run Book

**Reviewers (roles played):** Principal PM · Senior UX · Enterprise Architect · QA Lead
**Build reviewed:** v1.0.0 → rebuilt to **v2.0.0**
**Verdict (v2.0.0 review):** Ship-ready for board/volunteer rollout after the changes below. No blocking defects remain.

> **Outdated as a current sign-off (v2.1.0, 2026-10-19).** This file is the record of the v2.0.0 review. It is not a sign-off for the current app. Rows marked **Outdated — see 2.1.0** were superseded: the password field was removed and stored passwords are cleared, HTML is inserted as text unless it is explicitly sanitized, and Firestore access is the allow-list in `firestore.rules`. `REQUIRE_SIGN_IN` only hides the page. See `CHANGELOG.md`.

This report lists what was found, how serious it was, why it mattered, and what was done. Severity scale: **S1** (broken/blocking), **S2** (significant gap vs. spec), **S3** (polish/maintainability).

---

## Summary of outcome

The v1 app worked but was, in several places, a convincing shell over an incomplete core: the data layer advertised capabilities (activity log, automation run history, a dozen dashboard widgets, a richer task schema) that the UI never actually used. The rebuild closed those gaps, hardened credential handling, removed dead code, and produced the documentation set. Net result: the dashboard now answers every executive question the brief asked for, automations are observable and safe to test, and the task record covers the full field list.

---

## Phase 1 — User Experience

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1.1 | S2 | Global search only matched title/category/owner/notes/poc — vendor and related-systems were invisible to search. | Search now also scans vendor and related systems. |
| 1.2 | S2 | Status filter offered "Overdue" but not "Blocked", despite Blocked being a real state. | Added Blocked to the status filter and to the derived status logic. |
| 1.3 | S3 | Several controls had no tooltips; intent relied on guessing. | Added `title` tooltips to filters, status pickers, quick actions, and the "Run now"/history controls. |
| 1.4 | S3 | Empty states were generic. | Empty states now distinguish "no tasks yet" from "no tasks match filters," each with the right call to action. |
| 1.5 | S2 | Undo was offered on edits to existing tasks, where it did nothing meaningful. | Undo is now offered only on **create** (where it can delete the new record); edits show a plain confirmation. |

## Phase 2 — Data Model

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 2.1 | S1 | The task editor saved only ~13 fields, but the brief and the data layer required ~25 (recurrence, dependencies, vendor, related systems, doc links, automation-eligibility, credential location, cost cadence). The extra fields existed in storage but could never be entered or seen. | Editor rebuilt to expose **every** field, grouped into labelled sections (Cost & vendor, Login & access, Contacts & references). |
| 2.2 | S2 | "Password" duplicated the idea of a secret with no safe home; there was no field for *where* a credential lives. | **Outdated — see 2.1.0.** 2.0.0 left the password field in place and called it optional. 2.1.0 removes the field and clears stored passwords. The "where the login is kept" note remains. |
| 2.3 | S3 | Cost was a single number with no period, so "subscriptions that cost money" couldn't be answered. | Added **cost cadence** (one-time / monthly / yearly); the dashboard annualizes recurring costs. |
| 2.4 | S3 | All fields are normalized on read so old records never crash the UI. | Kept and extended `normalizeTask`; added `costCadence` to the canonical shape. |

## Phase 3 — Dashboard

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 3.1 | **S1** | The dashboard rendered 6 widgets, but `config.js` defined 12 and the brief required answers to 9 specific questions (blocked, assigned-to-me, automation failures, costs/renewals, credentials, recent changes were all **missing**). Worse, the Settings toggles referenced widget keys (`recentlyCompleted`) that the renderer didn't use, so toggling them did nothing. | Dashboard fully rebuilt with all 12 widgets, each gated by a matching, correct Settings toggle. |
| 3.2 | S2 | No "what needs attention today" focal point. | Added a top **attention banner** summarizing overdue + due-today + blocked + automation issues, with one-tap drill-down. |
| 3.3 | S2 | "Assigned to me" was impossible — the app had no concept of the current person. | Added a per-device "Who are you?" selector (auto-matched from the signed-in Google name when possible) feeding an Assigned-to-me widget and stat card. |
| 3.4 | S2 | "Renewals approaching" / "subscriptions cost money" unanswerable. | Added a Subscriptions & costs widget: lists cost-bearing tasks, flags renewals within 30 days, and shows annualized + one-time totals. |
| 3.5 | S2 | "Credentials requiring updating" unanswerable. | **Outdated — see 2.1.0.** The widget remains, but it no longer looks for a stored password. It lists tasks that name a username and not where the login is kept. |

## Phase 4 — Task Management

Resolved via 2.1–2.3. Additionally:

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 4.1 | S2 | "Recurring schedules" existed as a stored field but nothing acted on it. | Completing a recurring task now auto-spawns its next occurrence (de-duplicated); stale recurring tasks roll forward on load. |
| 4.2 | S2 | "Dependencies" were unsupported. | Added a dependency picker; a task waiting on incomplete tasks is shown as **Blocked** everywhere. |
| 4.3 | S3 | Bulk edit wrote status directly, bypassing recurrence/automation side-effects. | Bulk status changes now route through the same status pipeline as single edits. |

## Phase 5 — Automation Engine

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 5.1 | **S1** | `logRun`/`runLog` existed in the data layer but **no code ever called them**, so "execution history" and "failure logs" — explicit requirements — did not exist. | Every trigger path (event, scheduled, named-event, run-now) now records a run with a plain-language result and any error. |
| 5.2 | S2 | Failures were swallowed to the console; volunteers had no visibility. | Each automation card shows its last result (✓/✕) and last error; a **History** view lists recent runs with readable messages. |
| 5.3 | S2 | The per-task "automation eligible" flag was ignored by the engine. | All triggers now skip tasks flagged ineligible. |
| 5.4 | S3 | "Test safely" was unclear. | "Run now" queues emails to the Outbox as drafts rather than sending; the button tooltip says so. |

## Phase 6 — Volunteer-Friendly Design

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 6.1 | S3 | Technical defaults ("password") nudged unsafe behavior. | **Outdated — see 2.1.0.** The note remains. The password box it used to sit above was removed in 2.1.0. |
| 6.2 | S3 | Field grouping was flat and long. | Editor grouped into clear sections with section headers. |

## Phase 7 — Enterprise Polish

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 7.1 | S3 | New components needed consistent styling. | Added a cohesive style block (attention banner, run pills, history rows, cost amounts, dependency box) using the existing design tokens — no new colors invented outside the palette. |
| 7.2 | S2 | Live cloud updates re-rendered the page even while a volunteer was mid-edit in a modal. | Re-render now skips while a dialog is open, so edits aren't disrupted. |

## Phase 8 — Performance & Code

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 8.1 | S3 | Dead code: `quickBtnHtml` (app) and a duplicate `escapeHtml` (automation) were unused. | Removed. |
| 8.2 | S3 | Run/activity logs could grow without bound. | Both are capped (activity 250, runs 300) and pruned automatically. |
| 8.3 | S3 | Repeated dashboard card markup. | Consolidated into shared `card()` / `taskListCard()` helpers. |

## Phase 9 — Security & Data Handling

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 9.1 | **S1 (design)** | The model stored raw passwords in Firestore/localStorage and the editor encouraged it. For a volunteer org this is the single biggest data-handling risk. | **Outdated — see 2.1.0.** 2.0.0 still stored an optional password and offered an "include passwords" backup checkbox. 2.1.0 removes the field, clears existing passwords on load, and never exports them. |
| 9.2 | S2 | No input validation on email/URL. | Added validation in the task editor and list editor; bad values are rejected with a clear message. |
| 9.3 | S2 | Output built via `innerHTML` in a couple of spots risked HTML injection from user text. | **Outdated — see 2.1.0.** 2.0.0 still assigned `innerHTML` from the `html` option and from string dialog bodies. 2.1.0 inserts text unless HTML is explicitly requested, and then sanitizes it. |
| 9.4 | S3 | No change history for accountability. | Added an activity feed (who-less but action+task+time) surfaced as "Recent changes." Secrets are never written to the feed. |
| 9.5 | — | Access control assumption. | **Outdated — see 2.1.0.** The 2.0.0 README told admins they could publish `allow read, write: if true`, and described `REQUIRE_SIGN_IN` as if it enforced access. 2.1.0 ships `firestore.rules` (sign-in plus an email allow-list) and states that the flag only hides the page. The rules still have to be published in the Firebase console. |

## Phase 10 — Documentation

Produced: this audit report, a full **CHANGELOG**, **MIGRATION** notes, and a rewritten **README** covering overview, install, config, structure, features, automation setup, task editing, managing volunteers, backup/recovery, and future enhancements.

---

## Known limitations (by design, documented)

- **Email is draft-based.** A static GitHub Pages site cannot send mail server-side, so "send" composes a pre-filled draft (mailto) and logs it to the Outbox. True scheduled/automatic sending and automatic retry would require a small server component (Firebase Cloud Functions) — noted as a future enhancement.
- **Time-based automations fire when the app is open**, not on a server clock. Adequate for a board that checks in regularly; the same Cloud Functions upgrade would make them server-driven.
- **"Assigned to me" is per-device** (stored locally) rather than per-account, which keeps it working in local mode and avoids forcing sign-in.

## QA performed

- Static syntax check (`node --check`) on all eight modules — pass.
- Runtime logic tests on date/recurrence/money/validation helpers — pass.
- Import/export graph verified acyclic; no dead references remain.
