// =============================================================================
// config.js — App configuration, defaults, and seed data
// Jr Lions Lacrosse Run Book
// -----------------------------------------------------------------------------
// This is the ONE file a non-technical admin edits to connect Firebase.
// Everything else (categories, owners, tasks, lists, templates, automations)
// is editable from inside the app — no code changes required.
// =============================================================================

export const APP_VERSION = "2.0.0";

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

// Require Google sign-in before the app loads (recommended once Firebase is on).
export const REQUIRE_SIGN_IN = false;

// Never include real passwords in downloaded backup files by default. Volunteers
// are encouraged to store a LOCATION ("1Password → Team Store") instead of the
// secret itself. See README → Security.
export const EXPORT_CREDENTIALS_DEFAULT = false;

// ---- 2) DEFAULT LISTS (editable in Settings) --------------------------------
export const DEFAULTS = {
  categories: ["SCHEDULING", "MARKETING", "TEAM STORE", "PROGRAM ORDER", "COMMS", "FUNDRAISING", "REGISTRATION", "FACILITIES"],
  programs: ["ALL", "BOYS", "GIRLS"],
  owners: ["ALL", "TOM", "JOHN", "TOM/JOHN", "Mike", "AJ", "LISA", "BRITT/BROOKE"],
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
export const SEED_TASKS = [{"task":"UPDATE COACHES GEAR LIST","category":"TEAM STORE","program":"ALL","owner":"ALL","website":"N/A","cost":null,"poc":"","email":"","month":"FEBRUARY","date":1,"notes":""},{"task":"SCHEDULE EOY PICNIC","category":"SCHEDULING","program":"ALL","owner":"TOM/JOHN","website":"","cost":null,"poc":"","email":"","month":"FEBRUARY","date":1,"notes":""},{"task":"SCHEDULE GOLF OUTING","category":"SCHEDULING","program":"ALL","owner":"AJ","website":"","cost":null,"poc":"","email":"","month":"FEBRUARY","date":1,"notes":""},{"task":"SCHEDULE GOALIE TRAINING","category":"SCHEDULING","program":"ALL","owner":"TOM/JOHN","website":"","cost":null,"poc":"","email":"","month":"FEBRUARY","date":1,"notes":""},{"task":"SCHEDULE NORTH TURF RESERVATIONS","category":"SCHEDULING","program":"ALL","owner":"TOM/JOHN","website":"","cost":null,"poc":"","email":"","month":"JANUARY","date":1,"notes":""},{"task":"SUBMIT COACHES GEAR ORDER","category":"TEAM STORE","program":"ALL","owner":"TOM","website":"","cost":null,"poc":"","email":"","month":"FEBRUARY","date":15,"notes":""},{"task":"UPDATE SEASON EQUIPMENT ORDER","category":"PROGRAM ORDER","program":"ALL","owner":"ALL","website":"N/A","cost":null,"poc":"","email":"","month":"FEBRUARY","date":1,"notes":""},{"task":"SUBMIT SEASON EQUIPMENT ORDER","category":"PROGRAM ORDER","program":"ALL","owner":"TOM","website":"","cost":null,"poc":"","email":"","month":"FEBRUARY","date":15,"notes":""},{"task":"COORDINATE TEAM STORE","category":"MARKETING","program":"ALL","owner":"BRITT/BROOKE","website":"","cost":null,"poc":"","email":"","month":"JANUARY","date":15,"notes":""},{"task":"BROADCAST TEAM STORE","category":"MARKETING","program":"ALL","owner":"JOHN","website":"","cost":null,"poc":"","email":"","month":"JANUARY","date":16,"notes":""},{"task":"FINALIZE SEASON SCHEDULE","category":"SCHEDULING","program":"GIRLS","owner":"JOHN","website":"LINK","cost":null,"poc":"","email":"","month":"FEBRUARY","date":25,"notes":"CONFERENCE SCHEDULING MEETING IN JANUARY, FINALIZE IN ARBITER END OF FEB/EARLY MARCH"},{"task":"COORDINATE FIELD LINING","category":"SCHEDULING","program":"ALL","owner":"TOM/JOHN","website":"","cost":null,"poc":"","email":"","month":"MARCH","date":1,"notes":""},{"task":"COORDINATE FIELD PAINT","category":"SCHEDULING","program":"ALL","owner":"TOM/JOHN","website":"","cost":null,"poc":"","email":"","month":"MARCH","date":15,"notes":""},{"task":"UPDATE SEASON REGISTRATION","category":"MARKETING","program":"ALL","owner":"TOM/JOHN","website":"LINK","cost":null,"poc":"","email":"N/A","month":"NOVEMBER","date":1,"notes":""},{"task":"UPDATE LITTLE STICKS REGISTRATION","category":"MARKETING","program":"ALL","owner":"JOHN","website":"LINK","cost":null,"poc":"","email":"N/A","month":"NOVEMBER","date":1,"notes":""},{"task":"UPDATE WEBSITE","category":"MARKETING","program":"ALL","owner":"JOHN","website":"LINK","cost":null,"poc":"","email":"JRLIONSLAX44@GMAIL.COM","month":"NOVEMBER","date":1,"notes":""},{"task":"BROADCAST SEASON","category":"MARKETING","program":"ALL","owner":"JOHN","website":"","cost":null,"poc":"","email":"","month":"NOVEMBER","date":15,"notes":""},{"task":"SCHEDULE PRESEASON COACHES MEETING","category":"SCHEDULING","program":"ALL","owner":"Mike","website":"","cost":null,"poc":"","email":"","month":"NOVEMBER","date":null,"notes":""},{"task":"SOCIAL POSTS FOR SEASON","category":"MARKETING","program":"ALL","owner":"LISA","website":"","cost":null,"poc":"","email":"","month":"NOVEMBER","date":15,"notes":""},{"task":"PUBLISH TURF SCHEDULE","category":"COMMS","program":"ALL","owner":"TOM","website":"","cost":null,"poc":"","email":"","month":"","date":null,"notes":""},{"task":"Shoot a Thon Social Blast","category":"MARKETING","program":"ALL","owner":"LISA","website":"","cost":null,"poc":"","email":"","month":"","date":null,"notes":""},{"task":"SCHEDULE BOYS RUTGERS GAME","category":"SCHEDULING","program":"BOYS","owner":"TOM","website":"","cost":null,"poc":"","email":"","month":"FEBRUARY","date":15,"notes":""},{"task":"SCHEDULE FACE OFF TRAINING","category":"SCHEDULING","program":"BOYS","owner":"Mike","website":"","cost":null,"poc":"","email":"","month":"JANUARY","date":31,"notes":""},{"task":"BROADCAST BOYS RUTGERS GAME","category":"MARKETING","program":"BOYS","owner":"TOM","website":"","cost":null,"poc":"","email":"","month":"MARCH","date":1,"notes":""},{"task":"REGISTER FOR TURKEY TOURNAMENT","category":"SCHEDULING","program":"BOYS","owner":"Mike","website":"https://nextwavelacrosse.wixsite.com/nextwave/tt25","cost":null,"poc":"","email":"","month":"SEPTEMBER","date":30,"notes":""},{"task":"COORDINATE NORTH GIRLS FOR 1ST BSC PRACTICE","category":"SCHEDULING","program":"GIRLS","owner":"TOM/JOHN","website":"","cost":null,"poc":"","email":"","month":"FEBRUARY","date":1,"notes":""},{"task":"SCHEDULE 3/4 AND 5/6 SCRIMMAGES","category":"SCHEDULING","program":"GIRLS","owner":"JOHN","website":"","cost":null,"poc":"","email":"","month":"FEBRUARY","date":15,"notes":""},{"task":"SCHEDULE GIRLS RUTGERS GAME","category":"SCHEDULING","program":"GIRLS","owner":"JOHN","website":"","cost":null,"poc":"","email":"","month":"FEBRUARY","date":15,"notes":""},{"task":"UPDATE FALL BALL REGISTRATION","category":"REGISTRATION","program":"GIRLS","owner":"JOHN","website":"LINK","cost":null,"poc":"","email":"","month":"JULY","date":1,"notes":""},{"task":"BROADCAST FALL BALL","category":"MARKETING","program":"GIRLS","owner":"JOHN","website":"","cost":null,"poc":"","email":"","month":"JULY","date":15,"notes":""},{"task":"RESERVE FALL BALL FIELDS","category":"FACILITIES","program":"GIRLS","owner":"JOHN","website":"","cost":null,"poc":"","email":"","month":"JUNE","date":1,"notes":""},{"task":"COORDINATE NORTH GIRLS TO REFEREE SCRIMMAGES","category":"SCHEDULING","program":"GIRLS","owner":"JOHN","website":"","cost":null,"poc":"","email":"","month":"MARCH","date":15,"notes":""},{"task":"BROADCAST GIRLS RUTGERS GAME","category":"MARKETING","program":"GIRLS","owner":"JOHN","website":"","cost":null,"poc":"","email":"","month":"MARCH","date":1,"notes":""},{"task":"SCHEDULE GIRLS SUMMER CAMP","category":"SCHEDULING","program":"GIRLS","owner":"JOHN","website":"","cost":null,"poc":"","email":"","month":"MAY","date":1,"notes":""},{"task":"BROADCAST GIRLS SUMMER CAMP","category":"MARKETING","program":"GIRLS","owner":"JOHN","website":"","cost":null,"poc":"","email":"","month":"MAY","date":15,"notes":""},{"task":"Referee Money","category":"FUNDRAISING","program":"GIRLS","owner":"JOHN","website":"","cost":null,"poc":"","email":"","month":"","date":null,"notes":""},{"task":"Drop curtain at BSC for 3/4 Girls","category":"FACILITIES","program":"GIRLS","owner":"JOHN","website":"","cost":null,"poc":"","email":"","month":"","date":null,"notes":""},{"task":"COORDINATE DRAW TRAINING CAMP/IN-SEASON TRAINING","category":"SCHEDULING","program":"GIRLS","owner":"JOHN","website":"","cost":null,"poc":"","email":"","month":"","date":null,"notes":""},{"task":"REGISTER WITH JGLA","category":"REGISTRATION","program":"GIRLS","owner":"JOHN","website":"LINK","cost":125.0,"poc":"","email":"","month":"JANUARY","date":2,"notes":"3/4, 5/6, 7/8, CONFERENCE F"}];
