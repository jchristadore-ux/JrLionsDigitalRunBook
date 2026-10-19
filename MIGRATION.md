# Migration Notes

## 2.1.0 — read this first

**Passwords are cleared automatically.** The first time 2.1.0 opens a workspace
it wipes any password still stored on a task and remembers that it did so
(`passwordsClearedAt`). The editor no longer has a password field. Put the
secret in the password manager and keep only "where the login is kept."
Backups never include passwords. You do not need to reset the run book for this.

**Starter-task wording is not migrated.** Title case, owner capitalization
(`Mike`, `Tom/John`, …), "End of Year" instead of "EOY", and empty `LINK` /
`N/A` websites live in `config.js` only. Seeding runs once (`seededAt` in
`firestore.js`). A reload will not rename tasks the board is already using.

To apply those wording changes to live data, either edit the tasks and the
**Settings → Owners / volunteers** list by hand, or export a backup and use
**Settings → Reset to original run book** (that replaces current tasks with the
starter list). Real websites and due dates were not invented; fill those in
yourself. The **Open website** button stays hidden until a task's website is
an `http://` or `https://` URL.

**Firestore rules are a manual publish.** Copy `firestore.rules` into the
Firebase console (or deploy it) and add the board's emails to the allow-list.
`REQUIRE_SIGN_IN` only hides the page.

The sections below describe the 1.0.0 → 2.0.0 upgrade. Section 5's password
notes are **outdated as of 2.1.0** — passwords are cleared, not kept.

---

# 1.0.0 → 2.0.0

**Short version for that upgrade: there was nothing you needed to do.** Opening
the app on 2.0.0 upgraded it. The rest of this document explains what happened.

---

## Do I have to do anything?

No. There are no manual migration steps, no scripts to run, and no database
changes to apply by hand.

- **Cloud workspaces** upgrade the first time anyone loads 2.0.0. New fields are
  filled in with safe defaults as each task is read.
- **Local (browser) workspaces** upgrade the same way the first time the app
  opens on that device.
- **1.0.0 backup files** import cleanly into 2.0.0 without editing.

---

## What actually changes

### 1. New task fields are back-filled automatically

Every task is run through `normalizeTask()` whenever it loads. Any field missing
from a 1.0.0 record is added with a default, so older tasks gain the new fields
without you touching them:

| Field                | Default        | Purpose                                          |
|----------------------|----------------|--------------------------------------------------|
| `recurrence`         | `"none"`       | Recurring schedule; drives auto-spawn on done.   |
| `dependsOn`          | `[]`           | Task IDs that must finish first.                 |
| `costCadence`        | `"one-time"`   | Lets the dashboard annualize recurring costs.    |
| `credentialLocation` | `""`           | Plain-language pointer to where a login lives.   |
| `vendor`             | `""`           | Vendor / provider name.                          |
| `relatedSystems`     | `""`           | Other tools or systems a task touches.           |
| `links`              | `[]`           | Documentation links.                             |
| `automationEligible` | `true`         | Whether automations may act on this task.        |

Existing values are always preserved. Defaults only fill in what was absent.

### 2. Status may now show "Blocked" or "Overdue" on its own

Status is now derived at display time. A task with an unfinished dependency shows
**Blocked**; a task past its due date shows **Overdue**. Your stored status value
is not overwritten — these are computed for display, with precedence
Completed > Overdue > Blocked > stored.

### 3. Recurring tasks start spawning

Once on 2.0.0, completing a task whose `recurrence` is not `none` creates the
next occurrence automatically. 1.0.0 stored the recurrence value but never acted
on it, so the first completion after upgrading is when this begins.

### 4. Dashboard widget settings are reset to the new set

1.0.0 stored toggle preferences against widget keys that no longer exist. On
upgrade, `ensureMetaDefaults()` installs the 12 current widget keys (all on by
default). If you had hidden widgets in 1.0.0, re-hide them in Settings — it is a
one-time, few-second adjustment.

### 5. Credentials handling changed (read this if you stored passwords)

> **Outdated — see 2.1.0 above.** The notes in this section describe 2.0.0.
> As of 2.1.0, stored passwords are cleared on load, the password field is
> gone, and backups cannot include them. Keep "where the login is kept."

2.0.0 treated stored passwords as optional and sensitive:

- Existing passwords in your data were **kept** and continued to work.
- The editor masked the password field and labeled it as a reference, and
  encouraged using `credentialLocation` ("where the real login lives") instead.
- **Exports excluded passwords by default.** A checkbox could put them back in.

---

## Backups: forward and backward compatibility

- **1.0.0 backup → 2.0.0:** imports cleanly. Missing fields are back-filled on
  load exactly as live data is.
- **2.0.0 backup → 1.0.0:** not supported. 2.0.0 introduces fields and an export
  envelope (`version: 2`, `credentialsIncluded`) that 1.0.0 does not understand.
  Once you upgrade, stay on 2.0.0.

Always take a fresh export before and after upgrading. Settings → Export saves a
JSON file you can re-import via Settings → Import.

---

## Rollback

If you must return to 1.0.0, re-import a **1.0.0-era backup** into a 1.0.0
deployment. A backup created by 2.0.0 will not load on 1.0.0. There is no
automated downgrade path, which is why a pre-upgrade backup matters.

---

## Verification checklist after upgrading

1. Open the **Dashboard** — confirm all expected widgets appear.
2. Open any older task in the **editor** — confirm the new sections (recurrence,
   dependencies, vendor & cost, credentials) are present and empty/defaulted.
3. Open **Settings → Who are you?** and set your name so "Assigned to Me" works.
4. Open an **automation → History** — it will be empty until the next run, which
   is expected.
5. Take a fresh **export** and store it somewhere safe.
