# Jr Lions Lacrosse — Run Book

A simple, shared workspace for the Jr Lions board. It keeps every recurring job,
deadline, login pointer, vendor, cost, and automated reminder in one place, so
nothing falls through the cracks when volunteers change from season to season.

It runs as a website (hosted free on GitHub Pages). There is **no app to
install**, no spreadsheet to email around, and no code to touch for everyday use.

---

## Table of contents

- [What it does](#what-it-does)
- [Two ways to run it](#two-ways-to-run-it)
- [Quick start (local, 60 seconds)](#quick-start-local-60-seconds)
- [Configuration — connecting Firebase (shared mode)](#configuration--connecting-firebase-shared-mode)
- [Deploying to GitHub Pages](#deploying-to-github-pages)
- [Key features](#key-features)
- [The dashboard](#the-dashboard)
- [Sorting and filtering the task list](#sorting-and-filtering-the-task-list)
- [Editing tasks](#editing-tasks)
- [Automations](#automations)
- [Email](#email)
- [Automatic email (free, no server)](#automatic-email-free-no-server)
- [Managing volunteers (owners)](#managing-volunteers-owners)
- [Backup and recovery](#backup-and-recovery)
- [Security and credentials](#security-and-credentials)
- [Starter tasks on a live workspace](#starter-tasks-on-a-live-workspace)
- [File structure](#file-structure)
- [Customizing lists](#customizing-lists)
- [Troubleshooting](#troubleshooting)
- [Future enhancements](#future-enhancements)

---

## What it does

- Tracks every board task with status, priority, owner, due date, recurring
  schedule, dependencies, vendor, cost, credential location, related systems,
  documentation links, and notes.
- Shows an **executive dashboard** that answers, at a glance: what needs
  attention today, what's overdue, what's blocked, what's assigned to me, which
  automations failed, what subscriptions cost money, which renewals are coming
  up, which logins need tidying, and what changed recently.
- Runs **no-code automations** (e.g. "when a task is completed, email the board")
  that any volunteer can build, test safely, enable/disable, duplicate, and
  review the history of.
- Keeps **distribution lists** and **email templates** for routine
  communication.
- Works **offline in a single browser** or **shared live across the whole board**
  — your choice, no code change required to start.

---

## Two ways to run it

| Mode | How it stores data | Who sees it | When to use |
|------|--------------------|-------------|-------------|
| **Local** | Your browser only (`localStorage`) | Just you, just this browser | Trying it out, or a one-person setup |
| **Cloud (shared)** | Firebase Firestore | The whole board, live, in real time | The real deployment for the board |

The app **auto-detects** which mode to use. If the Firebase settings in
`config.js` are still placeholders, it runs in Local mode. Fill them in and it
switches to shared Cloud mode automatically. A small connection indicator in
**Settings** tells you which mode you're in.

---

## Quick start (local, 60 seconds)

You don't need Firebase to try it.

1. Download/clone this folder.
2. Open `index.html` in a modern browser — **or**, better, serve it locally so
   modules load cleanly:
   ```bash
   cd jr-lions-runbook
   python3 -m http.server 8000
   # then visit http://localhost:8000
   ```
3. That's it. The app seeds itself with the board's real tasks and you can click
   around. Everything you change is saved in that browser.

> Opening `index.html` directly with `file://` works in most browsers, but a few
> block ES modules over `file://`. If the page is blank, use the
> `python3 -m http.server` method above.

---

## Configuration — connecting Firebase (shared mode)

To make the run book shared and live for the whole board, give it a free Firebase
project. This is a one-time setup.

1. Go to <https://console.firebase.google.com> and **Add project** (any name,
   e.g. `jr-lions-runbook`). You can skip Google Analytics.
2. In the project, open **Build → Firestore Database → Create database**. Start
   in **production mode**, pick a region close to you.
3. Open **Project settings** (gear icon) → **General** → scroll to **Your apps** →
   click the **web** icon (`</>`). Register the app (any nickname). Firebase shows
   you a `firebaseConfig` object.
4. Copy those six values into `config.js`, replacing the placeholders:
   ```js
   export const firebaseConfig = {
     apiKey:            "…",
     authDomain:        "your-project.firebaseapp.com",
     projectId:         "your-project-id",
     storageBucket:     "your-project.appspot.com",
     messagingSenderId: "…",
     appId:             "…",
   };
   ```
   As soon as these are real (not `YOUR_…`), the app runs in shared mode.
5. Publish the Firestore rules in **`firestore.rules`**. Those rules allow a
   read or write only when **both** of these are true:

   - the person is signed in with Google, and
   - their email is on the **board allow-list** at the top of that file.

   `jrlionslax44@gmail.com` is the starting entry, marked `BOARD ALLOW-LIST`.
   Add every board member's Google email there **before** you publish. The
   address has to match the Google account exactly. Someone who is not on the
   list cannot read or write the workspace, even if they can open the site.

   In Firebase, open **Firestore Database → Rules**, replace the editor
   contents with `firestore.rules`, and click **Publish**. The file in this
   repository does nothing until it is published there. If you use the
   Firebase CLI, `firebase deploy --only firestore:rules` publishes the same
   file.

   `REQUIRE_SIGN_IN` in `config.js` is already `true`. It **only hides the
   page** until someone clicks Sign in. It is not access control. Anyone who
   knows the project id can still talk to Firestore directly unless these
   rules are published.

   Also turn on **Google** as a sign-in provider under Firebase
   **Authentication → Sign-in method**.

6. Restrict the web API key to this site. The key in `config.js` is visible in
   the page source, so it must not be usable from other websites. In Google
   Cloud Console open **APIs & Services → Credentials**, edit the browser key,
   and under **Application restrictions** choose **HTTP referrers**. Allow:

   - `https://jchristadore-ux.github.io/*`
   - `http://localhost:8000/*` and `http://127.0.0.1:8000/*` if you test on
     your own computer

7. Reload the app. Settings should now show a Cloud connection. The first load
   seeds the shared workspace with the board's tasks.

All board data lives under a single workspace, `workspaces/default`. You don't
need to change `WORKSPACE_ID` unless you want to run more than one independent
board from the same Firebase project.

---

## Deploying to GitHub Pages

1. Put this folder in a GitHub repository (e.g. `jr-lions-runbook`).
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**,
   pick your branch (usually `main`) and the **/ (root)** folder. Save.
4. Wait a minute; GitHub gives you a URL like
   `https://jchristadore-ux.github.io/JrLionsDigitalRunBook/`. Share that with the board.

Because the app is plain HTML/CSS/JS with no build step, there is nothing to
compile — GitHub serves the files as-is.

---

## Key features

- **Executive dashboard** with 12 toggleable summary widgets.
- **Full task editor** covering ~25 fields, grouped into plain-language sections.
- **Sortable task list** — due date by default, or one click to sort by priority,
  status, owner, category, name, or your own drag-and-drop order.
- **Recurring tasks** that carry over on their own — each job stays one row and
  simply rolls to next season's date once its date has passed.
- **Dependencies** — a task waiting on another shows as **Blocked** until the
  other is done.
- **No-code automation builder** with safe testing and full run history.
- **Distribution lists + email templates** with preview before sending.
- **Activity feed** — every change is logged (never secrets).
- **Appearance follows the device** (light or dark). Change it under Settings → Appearance.
- **Simple layout** — one main action per screen, a bottom tab bar on a phone, and sheets that slide up for editing.
- **Keyboard shortcuts**: `/` to search, `n` for a new task.
- **One-click backup / restore** as a JSON file.

---

## The dashboard

Home is the first screen and is built to be read top to bottom. Each
section can be turned on or off in **Settings → What Home shows**:

- **Needs a look** — the few things that need action now.
- **Stat cards** — Late, This week, Blocked, and Mine.
- **Overdue** — past-due tasks, soonest first.
- **Due This Week** — what's coming up in the next seven days.
- **Blocked** — tasks waiting on an unfinished dependency, with the blocker named.
- **Assigned to Me** — driven by the "Your name" picker in Settings (saved on this device).
- **Automation Failures** — any automation runs that errored, with the message.
- **Costs & Subscriptions** — annualized recurring spend plus one-time costs,
  with renewal flags.
- **Credentials to tidy up** — tasks that name a username but not where the
  login is kept. The run book does not store passwords.
- **Upcoming** — calendar events ahead.
- **Recent Activity** — the latest changes anyone made.
- **Active Automations** — what's currently switched on.

---

## Sorting and filtering the task list

The **Tasks** tab opens sorted by **due date, soonest first** — the run book is
a calendar first, so what's next is always at the top.

The **Sort by** buttons above the list change that at any time: **Due date**,
**Priority**, **Status**, **Owner**, **Category**, **Name**, or **Manual**.
Click the button you're already on to reverse it (the arrow flips ↑/↓), and
**Reset** puts you back to due date. Your choice is remembered on that device.

- Tasks with nothing to sort on — no due date, no owner — always sit at the
  bottom, whichever direction you sort, so reversing never buries the real work
  under blanks.
- **Status** sorts by what needs attention: overdue, then blocked, in progress,
  waiting, not started, and completed last.
- **Manual** is the drag-and-drop order. Drag handles (⠿) only appear on this
  setting — under any other sort the list would just snap back.

The dropdowns above the buttons filter the list (category, owner, program,
priority, status, and whether to show archived tasks); sorting applies to
whatever is left. The count under the page title tells you both, e.g.
"12 of 39 shown · due date, soonest first".

---
## Editing tasks

Open the **Tasks** tab, then click any task to open the editor. Fields are
grouped so it's never overwhelming:

- **Basics** — title, category, program, owner, status, priority, due date,
  description.
- **Schedule & recurrence** — make a task repeat (monthly, quarterly, annually,
  etc.). A repeating job always stays a single row: mark it **Completed** and it
  stays completed for the rest of the season, then rolls forward to the next
  date on its own. You'll never end up with two copies of the same job.
- **Dependencies** — tick the tasks that must finish first. This task then shows
  as **Blocked** until they're done.
- **Vendor & cost** — vendor name, amount, and how often it recurs (`one-time`,
  `monthly`, `quarterly`, `annual`). The dashboard uses this to total spending.
- **Credentials** — the **"Where the login is kept"** field (for example
  "shared 1Password vault"). There is no password field. See
  [Security](#security-and-credentials).
- **Related systems & documentation** — note other tools a task touches and paste
  links to relevant docs.
- **Automation eligibility** — leave on for normal tasks; turn off to make sure no
  automation ever acts on a sensitive task.

**What happens when you save:** the task updates immediately for everyone (in
shared mode), the change is added to the Recent Activity feed, and a toast
confirms it — usually with an **Undo**. Bulk actions on multiple tasks work the
same way.

---

## Automations

Open the **Automations** tab. An automation is a plain sentence:
**WHEN** something happens, **IF** an optional condition is true, **THEN** do an
action. No code.

You can:

- **Build** one with dropdowns (no technical knowledge needed).
- **Name and describe** it so others understand its purpose.
- **Enable / disable** it with a switch.
- **Duplicate** it as a starting point for a similar workflow.
- **Run now** to test it — emails are queued as **drafts to the Outbox** instead
  of actually sending, so testing is always safe.
- **Review History** — every run is logged with ✓ or ✕, a readable message, and
  any error, so you can see exactly what happened and why.

Automations skip any task whose **Automation eligibility** is turned off.

---

## Email

Open the **Email** tab. It holds:

- **Distribution lists** — named groups of recipients (e.g. "All Coaches").
- **Templates** — reusable messages with `{{placeholders}}` that get filled in.
- **Outbox** — a record of every message the app has prepared, with a status pill
  (sent / queued / opened / failed).

The app can send email in **two modes**:

- **Automatic (recommended).** Once you connect **EmailJS** (free — see
  [Automatic email](#automatic-email-free-no-server) below), the run book delivers
  messages itself, straight from the browser. Compose shows a **Send now** button,
  and automations and due-soon reminders **truly send on their own** — no human
  draft step. Delivered messages show a green **Sent** pill in the Outbox.
- **Manual (default until you connect EmailJS).** Because a plain static website
  has no mail server, "sending" instead opens a **pre-filled draft in your normal
  mail program** (via `mailto:`) that you press send on, and logs it to the Outbox.

The Email tab shows a banner telling you which mode is active. Use **Preview**
before sending to check recipients and the filled-in template.

---

## Automatic email (free, no server)

The run book sends real email through **[EmailJS](https://www.emailjs.com/)** — a
free service that delivers mail directly from the browser, so no server, hosting,
or credit card is required. The **free plan includes 200 emails per month**, which
is plenty for a youth-sports board's reminders and announcements.

You set this up **once**. After that, every board member's run book — and every
automation — sends on its own.

### Step 1 — Create a free EmailJS account
1. Go to **https://www.emailjs.com/** and click **Sign Up** (free, no card).
2. Verify your email and sign in to the **EmailJS dashboard**.

### Step 2 — Connect an email service (who the mail is sent from)
1. In the dashboard, open **Email Services → Add New Service**.
2. Choose **Gmail** (recommended — use `jrlionslax44@gmail.com`) or any provider
   listed, and follow the prompts to connect/authorize the account. Gmail just
   asks you to sign in and click **Allow**.
3. When it's connected, copy its **Service ID** (looks like `service_xxxxxxx`).

### Step 3 — Create the message template
1. Open **Email Templates → Create New Template**.
2. Set the template fields to use these **exact variable names** (type the double
   braces yourself):
   - **To Email:** `{{to_email}}`
   - **From Name:** `{{from_name}}`
   - **Subject:** `{{subject}}`
   - **Content / Body:** `{{message}}`
3. Click **Save**, then copy the **Template ID** (looks like `template_xxxxxxx`).

   > The run book already fills in the recipients, subject, and body from your own
   > lists and templates — this single EmailJS template is just the "envelope" it
   > travels in, so you only ever need **one**.

### Step 4 — Copy your Public Key
1. Open **Account → General** (sometimes shown as **API Keys**).
2. Copy your **Public Key** (a short string like `A1bC2dE3...`).

### Step 5 — Allow your site to send (security)
1. In **Account → Security**, keep **"Use Private Key"** turned **off** (the run
   book sends from the browser with the Public Key only).
2. If an **Allowed Origins / domains** box is shown, add the address where the run
   book is hosted, e.g. `https://jchristadore-ux.github.io` (the full site is
   `https://jchristadore-ux.github.io/JrLionsDigitalRunBook/`; add
   `http://localhost:8000` if you test locally). Leaving it blank also works but is less secure.

### Step 6 — Turn it on in the run book
You have two equivalent options:

- **In the app (easiest, no redeploy):** open **Settings → "Automatic email
  sending"**, paste your **Public Key**, **Service ID**, and **Template ID**, then
  click **Save & turn on**. Click **Send test email** to confirm it works. These
  settings sync to everyone in the shared workspace.
- **In code (`config.js`):** set `EMAIL_DELIVERY.provider` to `"emailjs"` and fill
  in `publicKey`, `serviceId`, and `templateId` under `emailjs`. Commit and deploy.

That's it. The Email tab banner will switch to **"Automatic sending is ON,"**
Compose gains a **Send now** button, and your due-soon/overdue/created-task
automations now deliver email by themselves.

### Good to know
- **All third-party pieces are free.** EmailJS free tier = 200 emails/month; Gmail
  is free. No paid plan, server, or card needed.
- **The Public Key, Service ID, and Template ID are not secrets** — they're meant
  to live in front-end code, which is why this works on a static site. Do **not**
  enable EmailJS's *private* key here.
- **Volume:** if you ever exceed 200 emails/month, EmailJS has low-cost upgrades,
  or you can prefer one big distribution list over many individual sends.
- **Scheduling caveat:** "due soon" / "overdue" reminders run when someone opens
  the app (once per task per day). For sends that fire even with no browser open,
  you'd add a tiny scheduled function later — see
  [Future enhancements](#future-enhancements). Event- and change-based
  automations send immediately when they're triggered.

### Prefer Gmail's own tools instead?
If you'd rather not use EmailJS, the same free Gmail account can do recurring
sends with **Google Apps Script** (a free `MailApp.sendEmail` script on a time
trigger). That lives outside this app, so EmailJS is the recommended, in-app
route. Ask if you'd like a ready-made Apps Script.

---

## Managing volunteers (owners)

There are no user accounts to administer for everyday use. "Owners" are simply
names on tasks, and the list of owners is editable in **Settings**.

To make **"Assigned to Me"** work, each person sets **Settings → Who are you?**
once on their own device. This is stored per-browser. In shared/sign-in mode it
is auto-matched from your Google name the first time you sign in. It understands
shared labels too — if a task is owned by `TOM/JOHN`, both Tom and John see it as
theirs.

To add or rename a volunteer, edit the **Owners** list in Settings (see
[Customizing lists](#customizing-lists)). Existing tasks keep their owner text.

---

## Backup and recovery

Everything lives in **Settings → Data**.

- **Export** downloads a single JSON file containing all tasks, automations,
  lists, templates, and events. Do this regularly, and always before upgrading.
  Passwords are never included, because the run book does not store them.
- **Import** restores from a JSON file. It merges the file's data into the
  workspace. A 1.0.0 backup imports cleanly into this version.
- **Reset to seed** wipes the workspace back to the original shipped task list.
  Use with care — take an export first.

In shared mode, Firestore is itself a live copy of your data, but exports are
your portable, point-in-time safety net. Keep a couple of recent ones.

---

## Security and credentials

This tool is built for a small, trusted board, with sensible defaults:

- **Store where the login is kept, not the secret.** Each task has a
  **credential location** field — a pointer like "shared 1Password vault →
  Arbiter." There is no password field. The first time version 2.1.0 opens a
  workspace, any password still stored on a task is cleared.
- **Logs never contain secrets.** The activity feed and automation history record
  what changed, not credential values.
- **Text is text.** Free-form text is inserted as text. The few spots that need
  simple formatting (`code`, `strong`, line breaks) go through a sanitizer that
  drops every attribute and every other tag. Email and website fields are
  checked when you save. **Open website** appears only when the website is a
  real `http://` or `https://` address.
- **Access control is the Firestore rules, not the sign-in screen.**
  `REQUIRE_SIGN_IN` defaults to `true` and only hides the page until someone
  signs in. Publish `firestore.rules` so Firestore itself requires Google
  sign-in **and** an email on the board allow-list. Restrict the web API key
  to `https://jchristadore-ux.github.io/*` in Google Cloud. Steps are in
  [Configuration](#configuration--connecting-firebase-shared-mode).

The dashboard's **Credentials to tidy up** widget lists tasks that name a
username but not where that login is kept, so you can point them at the
password manager.

## Starter tasks on a live workspace

The starter list in `config.js` (`SEED_TASKS`) is copied into a workspace
**only once**, the first time that workspace is empty. `firestore.js` records
`seededAt` on the workspace and will not plant the list again.

Changing a title, an owner name, or a website in `config.js` therefore does
**not** rename or edit tasks the board is already using. Version 2.1.0 makes
three wording changes in that starter list only:

- owner names use the same capitalization (`Mike`, `Tom/John`, `Lisa`, …)
- task titles use title case, and "EOY" is spelled out as "End of Year"
- placeholder `LINK` and `N/A` websites and emails are empty, so no dead
  **Open website** button is created

No URLs or due dates were filled in. The one real website already in the list
(the Turkey Tournament page) is unchanged. Months and days are unchanged.

To apply those wording changes to the **live** run book, pick one:

1. **Edit in the app** (keeps everything else you've typed). Rename the tasks
   yourself. Owner names are edited under **Settings → Owners / volunteers**;
   existing tasks keep the owner text they already have until you change each
   one. Clear any website that still says `LINK` or `N/A`. The **Open website**
   button stays hidden until the field is a real `http://` or `https://` URL.
2. **Reset to the starter list** (discards edits). In **Settings → Data &
   backup**, export a backup first, then choose **Reset to original run book**.
   That wipes the workspace and seeds it again from the current `config.js`.
   Put back anything from the backup that you still need.

Passwords are the exception: they are cleared automatically the first time
2.1.0 loads the workspace. You do not reset the run book for that.

---

## File structure

```
jr-lions-runbook/
├── index.html        App shell; loads the ES modules.
├── firestore.rules   Firestore rules to publish (sign-in + email allow-list).
├── styles.css        Full design system (tokens, light/dark, components).
├── config.js         ⚙️ EDIT ME: Firebase keys, workspace, seed data, defaults.
├── firebase.js       Firebase init + Google sign-in helpers.
├── firestore.js      The data Store: state, sync, seeding, logging, export/import.
├── ui.js             Dependency-free UI helpers (modals, toasts, formatting).
├── tasks.js          Task list, the full task editor, status logic, recurrence.
├── automation.js     Automation engine, builder, run history.
├── email.js          Distribution lists, templates, compose/preview, Outbox.
├── app.js            Controller: shell, navigation, dashboard, settings.
├── README.md         This file.
├── CHANGELOG.md      Version history.
├── MIGRATION.md      1.0.0 → 2.0.0 upgrade notes.
└── AUDIT_REPORT.md   Pre-production audit findings and resolutions.
```

For everyday use you only ever touch **`config.js`**. Everything else is the
application.

---

## Customizing lists

The dropdown choices throughout the app — **categories, programs, owners,
statuses, priorities** — are all editable in **Settings**, using a simple
add/remove chip editor. Changes save immediately and apply everywhere. The
defaults are defined in `config.js` under `DEFAULTS` if you ever want to change
what a fresh workspace starts with.

---

## Troubleshooting

**The page is blank.**
You probably opened it via `file://` in a browser that blocks modules. Serve it
with `python3 -m http.server 8000` and visit `http://localhost:8000`, or deploy
to GitHub Pages.

**It says Local mode but I want shared mode.**
Your `config.js` Firebase values are still placeholders (`YOUR_…`). Fill in all
six real values and reload.

**Changes aren't showing up for other people.**
Confirm you're in Cloud mode (Settings shows the connection). Check that
`firestore.rules` is published and that this person's Google email is on the
board allow-list. Check the browser console for permission errors. A sign-in
screen with no data behind it usually means the published rules are rejecting
this account, or the email is not listed. `REQUIRE_SIGN_IN` only hides the
page; it does not grant access.

**"Assigned to Me" is empty.**
Set **Settings → Who are you?** on that device.

**An automation didn't send email.**
First check the Email tab banner. If it says **"Automatic sending is OFF,"** the
app is in manual mode and only prepares drafts — set up
[Automatic email](#automatic-email-free-no-server) to send for real. If it says
**ON** but a message shows a red **Failed** pill, open the Outbox row to read the
error (common causes: a wrong EmailJS ID, a template missing the `to_email` /
`subject` / `message` variables, your site's domain not in EmailJS **Allowed
Origins**, or the 200/month free limit reached). Fix it and use **Settings → Send
test email** to confirm.

**I made a mistake.**
Most actions show an **Undo** toast. For larger problems, **Import** your most
recent export, or **Reset to seed** to start clean.

---

## Future enhancements

**Real outbound email is already supported** — connect EmailJS for free; see
[Automatic email](#automatic-email-free-no-server). The items below still need a
small server component (e.g. Firebase Cloud Functions) and are out of scope for a
pure static site, but are natural next steps:

- **True scheduling and retries** — fire time-based reminders on a clock and retry
  on failure without anyone's browser being open. (Today, due-soon/overdue
  reminders run when the app is opened; event-based automations send instantly.)
- **Per-user accounts and roles** — finer access control than the single shared
  workspace.
- **File attachments** — store actual documents rather than links.
- **Notifications** — email or push reminders for due and overdue tasks.

---

*Questions about the org account: jrlionslax44@gmail.com*
