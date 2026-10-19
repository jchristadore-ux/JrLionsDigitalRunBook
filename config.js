// =============================================================================
// config.js — App configuration, defaults, and seed data
// Jr Lions Lacrosse Run Book
// -----------------------------------------------------------------------------
// This is the ONE file a non-technical admin edits to connect Firebase.
// Everything else (categories, owners, tasks, lists, templates, automations)
// is editable from inside the app — no code changes required.
// =============================================================================

export const APP_VERSION = "2.1.0";

// ---- 1) FIREBASE CONNECTION -------------------------------------------------
// Paste the values from your Firebase project here. Until you do, the app runs
// in "On this device" mode (saved to this browser only). See README.md.
export const firebaseConfig = {
  apiKey: "AIzaSyB6shU_52JreyqeknmtZWj_asYhW4vc5w4",
  authDomain: "jrlionsrunbook.firebaseapp.com",
  projectId: "jrlionsrunbook",
  storageBucket: "jrlionsrunbook.firebasestorage.app",
  messagingSenderId: "1033685068417",
  appId: "1:1033685068417:web:a6eafd0e310596651ebb80",
};

// All board members share ONE workspace so everyone sees the same run book.
// Leave as "default" unless you run more than one organization.
export const WORKSPACE_ID = "default";

// Hides the run book until someone signs in with Google. This only hides the
// page — Firestore access is enforced by firestore.rules (sign-in plus the
// email allow-list). See README → Configuration.
export const REQUIRE_SIGN_IN = true;

// ---- 1b) AUTOMATIC EMAIL SENDING (EmailJS) ----------------------------------
// A static website has no mail server, so by default the app prepares a draft in
// your own mail app (mailto) and you press send. To let the run book SEND email
// on its own — including from automations and reminders — connect EmailJS, a
// free service (200 emails/month) that delivers straight from the browser.
//
// Fill these three values in (or set them in the app under Settings →
// "Automatic email sending", which overrides what's here). Leave provider as
// "none" to keep the manual draft behavior. Full step-by-step setup, including
// the one EmailJS template you must create, is in README → "Automatic email".
export const EMAIL_DELIVERY = {
  provider: "none", // "none" = manual drafts · "emailjs" = send automatically
  emailjs: {
    publicKey:  "", // EmailJS → Account → General → Public Key
    serviceId:  "", // EmailJS → Email Services → your service's ID
    templateId: "", // EmailJS → Email Templates → your template's ID
    fromName:   "Jr Lions Lacrosse Run Book",
    // These must match the variable names used in your EmailJS template.
    // The defaults below match the template shown in the README — only change
    // them if you named your template variables differently.
    toParam:      "to_email",
    subjectParam: "subject",
    bodyParam:    "message",
  },
};

// The run book does not store passwords. Each task keeps a credential location
// ("where the login is kept") instead. Backups always omit passwords; any
// leftover secret is cleared the first time 2.1.0 loads that workspace.
export const EXPORT_CREDENTIALS_DEFAULT = false;

// ---- 2) DEFAULT LISTS (editable in Settings) --------------------------------
export const DEFAULTS = {
  categories: ["SCHEDULING", "MARKETING", "TEAM STORE", "PROGRAM ORDER", "COMMS", "FUNDRAISING", "REGISTRATION", "FACILITIES"],
  programs: ["ALL", "BOYS", "GIRLS"],
  owners: ["ALL", "Tom", "John", "Tom/John", "Mike", "AJ", "Lisa", "Britt/Brooke"],
  statuses: ["Not Started", "In Progress", "Waiting", "Completed"],
  priorities: ["Low", "Medium", "High", "Urgent"],
  dashboardWidgets: {
    needsAttention: true, overdue: true, dueThisWeek: true, blocked: true,
    assignedToMe: true, automationFailures: true, costs: true, credentials: true,
    upcoming: true, recentActivity: true, automations: true, events: true,
  },
};

// Status colors used for chips/dots across the app.
export const STATUS_COLORS = {
  "Not Started": "#8a93a6",
  "In Progress": "#2f80ed",
  "Waiting":     "#b8860b",
  "Completed":   "#1f9d55",
  "Overdue":     "#e0413a",
  "Blocked":     "#9b51e0",
};
export const PRIORITY_COLORS = {
  "Low": "#8a93a6", "Medium": "#2f80ed", "High": "#e08a1e", "Urgent": "#e0413a",
};

export const RECURRENCE_OPTIONS = [
  { value: "none", label: "Does not repeat" },
  { value: "weekly", label: "Every week" },
  { value: "monthly", label: "Every month" },
  { value: "yearly", label: "Every year (season to season)" },
];

// ---- 3) DISTRIBUTION LISTS (editable in Email tab) --------------------------
export const SEED_DISTRIBUTION_LISTS = [
  { name: "Board Members",      recipients: ["jrlionslax44@gmail.com"] },
  { name: "Coaches",            recipients: [] },
  { name: "Parents",            recipients: [] },
  { name: "Equipment Committee",recipients: [] },
  { name: "Fundraising",        recipients: [] },
  { name: "Officials",          recipients: [] },
  { name: "Girls Program",      recipients: [] },
  { name: "Boys Program",       recipients: [] },
];

// ---- 4) EMAIL TEMPLATES (editable in Email tab) -----------------------------
// Variables: {{TaskName}} {{DueDate}} {{Owner}} {{Notes}} {{Category}} {{Program}}
export const SEED_EMAIL_TEMPLATES = [
  {
    name: "Task Reminder",
    subject: "Reminder: {{TaskName}} is due {{DueDate}}",
    body: "Hi team,\n\nThis is a reminder that \"{{TaskName}}\" ({{Category}}) is due {{DueDate}}.\nOwner: {{Owner}}\nProgram: {{Program}}\n\nNotes: {{Notes}}\n\nThanks,\nJr Lions Lacrosse",
  },
  {
    name: "New Task Assigned",
    subject: "New task: {{TaskName}}",
    body: "Hi {{Owner}},\n\nYou've been assigned \"{{TaskName}}\" ({{Category}}), due {{DueDate}}.\n\n{{Notes}}\n\nThanks,\nJr Lions Lacrosse",
  },
  {
    name: "Registration Open Announcement",
    subject: "Jr Lions Lacrosse registration is open!",
    body: "Hi everyone,\n\nRegistration is now open. Please sign up and spread the word.\n\nGo Lions!",
  },
];

// ---- 5) SEED AUTOMATIONS (editable in Automations tab) ----------------------
export const SEED_AUTOMATIONS = [
  {
    name: "Email reminder when a task is due soon",
    enabled: true,
    description: "One week before any task's due date, email the board a reminder.",
    trigger: { type: "due_soon", days: 7 },
    match: { category: "", program: "", owner: "" },
    actions: [{ type: "send_email", lists: ["Board Members"], extra: "", template: "Task Reminder" }],
  },
  {
    name: "Notify owner when a new task is created",
    enabled: false,
    description: "When a task is added, email its owner so nothing slips through.",
    trigger: { type: "task_created" },
    match: { category: "", program: "", owner: "" },
    actions: [{ type: "notify_owner", template: "New Task Assigned" }],
  },
];

// ---- 6) SEED TASKS (imported from JR LIONS RUN BOOK.xlsx) --------------------
// Editable, deletable, and added-to from inside the app. Month/Date become a
// real due date for the next upcoming occurrence on first load. Dated tasks
// repeat yearly by default because this is a season-to-season run book.
//
// These rows are copied in only once, the first time a workspace is empty
// (firestore.js records meta.seededAt and then leaves existing tasks alone).
// Editing a title, owner, or website here does not change a run book that has
// already been seeded. See README → "Starter tasks on a live workspace".
export const SEED_TASKS = [{"task":"Update Coaches Gear List","category":"TEAM STORE","program":"ALL","owner":"ALL","website":"","cost":null,"poc":"","email":"","month":"FEBRUARY","date":1,"notes":""},{"task":"Schedule End of Year Picnic","category":"SCHEDULING","program":"ALL","owner":"Tom/John","website":"","cost":null,"poc":"","email":"","month":"FEBRUARY","date":1,"notes":""},{"task":"Schedule Golf Outing","category":"SCHEDULING","program":"ALL","owner":"AJ","website":"","cost":null,"poc":"","email":"","month":"FEBRUARY","date":1,"notes":""},{"task":"Schedule Goalie Training","category":"SCHEDULING","program":"ALL","owner":"Tom/John","website":"","cost":null,"poc":"","email":"","month":"FEBRUARY","date":1,"notes":""},{"task":"Schedule North Turf Reservations","category":"SCHEDULING","program":"ALL","owner":"Tom/John","website":"","cost":null,"poc":"","email":"","month":"JANUARY","date":1,"notes":""},{"task":"Submit Coaches Gear Order","category":"TEAM STORE","program":"ALL","owner":"Tom","website":"","cost":null,"poc":"","email":"","month":"FEBRUARY","date":15,"notes":""},{"task":"Update Season Equipment Order","category":"PROGRAM ORDER","program":"ALL","owner":"ALL","website":"","cost":null,"poc":"","email":"","month":"FEBRUARY","date":1,"notes":""},{"task":"Submit Season Equipment Order","category":"PROGRAM ORDER","program":"ALL","owner":"Tom","website":"","cost":null,"poc":"","email":"","month":"FEBRUARY","date":15,"notes":""},{"task":"Coordinate Team Store","category":"MARKETING","program":"ALL","owner":"Britt/Brooke","website":"","cost":null,"poc":"","email":"","month":"JANUARY","date":15,"notes":""},{"task":"Broadcast Team Store","category":"MARKETING","program":"ALL","owner":"John","website":"","cost":null,"poc":"","email":"","month":"JANUARY","date":16,"notes":""},{"task":"Finalize Season Schedule","category":"SCHEDULING","program":"GIRLS","owner":"John","website":"","cost":null,"poc":"","email":"","month":"FEBRUARY","date":25,"notes":"CONFERENCE SCHEDULING MEETING IN JANUARY, FINALIZE IN ARBITER END OF FEB/EARLY MARCH"},{"task":"Coordinate Field Lining","category":"SCHEDULING","program":"ALL","owner":"Tom/John","website":"","cost":null,"poc":"","email":"","month":"MARCH","date":1,"notes":""},{"task":"Coordinate Field Paint","category":"SCHEDULING","program":"ALL","owner":"Tom/John","website":"","cost":null,"poc":"","email":"","month":"MARCH","date":15,"notes":""},{"task":"Update Season Registration","category":"MARKETING","program":"ALL","owner":"Tom/John","website":"","cost":null,"poc":"","email":"","month":"NOVEMBER","date":1,"notes":""},{"task":"Update Little Sticks Registration","category":"MARKETING","program":"ALL","owner":"John","website":"","cost":null,"poc":"","email":"","month":"NOVEMBER","date":1,"notes":""},{"task":"Update Website","category":"MARKETING","program":"ALL","owner":"John","website":"","cost":null,"poc":"","email":"jrlionslax44@gmail.com","month":"NOVEMBER","date":1,"notes":""},{"task":"Broadcast Season","category":"MARKETING","program":"ALL","owner":"John","website":"","cost":null,"poc":"","email":"","month":"NOVEMBER","date":15,"notes":""},{"task":"Schedule Preseason Coaches Meeting","category":"SCHEDULING","program":"ALL","owner":"Mike","website":"","cost":null,"poc":"","email":"","month":"NOVEMBER","date":null,"notes":""},{"task":"Social Posts for Season","category":"MARKETING","program":"ALL","owner":"Lisa","website":"","cost":null,"poc":"","email":"","month":"NOVEMBER","date":15,"notes":""},{"task":"Publish Turf Schedule","category":"COMMS","program":"ALL","owner":"Tom","website":"","cost":null,"poc":"","email":"","month":"","date":null,"notes":""},{"task":"Shoot a Thon Social Blast","category":"MARKETING","program":"ALL","owner":"Lisa","website":"","cost":null,"poc":"","email":"","month":"","date":null,"notes":""},{"task":"Schedule Boys Rutgers Game","category":"SCHEDULING","program":"BOYS","owner":"Tom","website":"","cost":null,"poc":"","email":"","month":"FEBRUARY","date":15,"notes":""},{"task":"Schedule Face Off Training","category":"SCHEDULING","program":"BOYS","owner":"Mike","website":"","cost":null,"poc":"","email":"","month":"JANUARY","date":31,"notes":""},{"task":"Broadcast Boys Rutgers Game","category":"MARKETING","program":"BOYS","owner":"Tom","website":"","cost":null,"poc":"","email":"","month":"MARCH","date":1,"notes":""},{"task":"Register for Turkey Tournament","category":"SCHEDULING","program":"BOYS","owner":"Mike","website":"https://nextwavelacrosse.wixsite.com/nextwave/tt25","cost":null,"poc":"","email":"","month":"SEPTEMBER","date":30,"notes":""},{"task":"Coordinate North Girls for 1st BSC Practice","category":"SCHEDULING","program":"GIRLS","owner":"Tom/John","website":"","cost":null,"poc":"","email":"","month":"FEBRUARY","date":1,"notes":""},{"task":"Schedule 3/4 and 5/6 Scrimmages","category":"SCHEDULING","program":"GIRLS","owner":"John","website":"","cost":null,"poc":"","email":"","month":"FEBRUARY","date":15,"notes":""},{"task":"Schedule Girls Rutgers Game","category":"SCHEDULING","program":"GIRLS","owner":"John","website":"","cost":null,"poc":"","email":"","month":"FEBRUARY","date":15,"notes":""},{"task":"Update Fall Ball Registration","category":"REGISTRATION","program":"GIRLS","owner":"John","website":"","cost":null,"poc":"","email":"","month":"JULY","date":1,"notes":""},{"task":"Broadcast Fall Ball","category":"MARKETING","program":"GIRLS","owner":"John","website":"","cost":null,"poc":"","email":"","month":"JULY","date":15,"notes":""},{"task":"Reserve Fall Ball Fields","category":"FACILITIES","program":"GIRLS","owner":"John","website":"","cost":null,"poc":"","email":"","month":"JUNE","date":1,"notes":""},{"task":"Coordinate North Girls to Referee Scrimmages","category":"SCHEDULING","program":"GIRLS","owner":"John","website":"","cost":null,"poc":"","email":"","month":"MARCH","date":15,"notes":""},{"task":"Broadcast Girls Rutgers Game","category":"MARKETING","program":"GIRLS","owner":"John","website":"","cost":null,"poc":"","email":"","month":"MARCH","date":1,"notes":""},{"task":"Schedule Girls Summer Camp","category":"SCHEDULING","program":"GIRLS","owner":"John","website":"","cost":null,"poc":"","email":"","month":"MAY","date":1,"notes":""},{"task":"Broadcast Girls Summer Camp","category":"MARKETING","program":"GIRLS","owner":"John","website":"","cost":null,"poc":"","email":"","month":"MAY","date":15,"notes":""},{"task":"Referee Money","category":"FUNDRAISING","program":"GIRLS","owner":"John","website":"","cost":null,"poc":"","email":"","month":"","date":null,"notes":""},{"task":"Drop Curtain at BSC for 3/4 Girls","category":"FACILITIES","program":"GIRLS","owner":"John","website":"","cost":null,"poc":"","email":"","month":"","date":null,"notes":""},{"task":"Coordinate Draw Training Camp/In-Season Training","category":"SCHEDULING","program":"GIRLS","owner":"John","website":"","cost":null,"poc":"","email":"","month":"","date":null,"notes":""},{"task":"Register with JGLA","category":"REGISTRATION","program":"GIRLS","owner":"John","website":"","cost":125,"poc":"","email":"","month":"JANUARY","date":2,"notes":"3/4, 5/6, 7/8, CONFERENCE F"}];
