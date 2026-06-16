# Migration Notes — 1.0.0 → 2.0.0

**Short version: there is nothing you need to do.** Open the app once on 2.0.0
and it upgrades itself. This document explains what happens behind the scenes so
an administrator knows what to expect.

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

2.0.0 treats stored passwords as optional and sensitive:

- Existing passwords in your data are **kept** and continue to work.
- The editor now masks the password field and labels it as a reference, and
  encourages using `credentialLocation` ("where the real login lives") instead.
- **Exports now exclude passwords by default.** If you specifically need a backup
  that contains them, tick "include passwords" on the export control. Otherwise
  your backup file will have empty password fields by design.

Recommendation: after upgrading, move any real secrets into your password
manager and replace the task password with a `credentialLocation` note.

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
