# Smart Mail Scheduler — Google Workspace Add-on

Automates scheduled, templated, trackable email sending from Google Sheets,
built as a Google Workspace Add-on (Apps Script + HTML Service).

## Status

✅ Feature-complete against the original spec. All 16 backend modules and all 10
frontend pages exist and are wired together:

**Backend**
`Utils` · `ConfigService` · `SetupService` · `Logger` (`AppLogger`) · `TemplateService`
· `AttachmentService` · `MailService` · `Scheduler` · `TriggerService` · `Menu` ·
`Dashboard` · `ValidationService` · `QueueService` · `ReportService` · `Analytics` ·
`AuthService`

**Frontend (sidebar, single-page-app style via `index.html`)**
`index` (shell/nav) · `dashboard` · `scheduler` · `templates` · `logs` · `reports` ·
`settings` · `about` · `queue` · `style` · `script`

**What's genuinely production-real vs. intentionally minimal:**
- Real: scheduling, sending, retries, working hours/holidays, templates (CRUD +
  placeholder/conditional engine), attachments, logging, search, reports, role
  detection **and enforcement** (nav tabs now visually disable per-role, closing
  the earlier gap where `AuthService` computed permissions nothing used),
  stuck-row recovery, and the add-on lifecycle entry points (`onInstall`,
  `onHomepage`, `onFileScopeGranted` in `Code.gs`) that the manifest requires.
- The old modal-dialog Settings editor in `Menu.gs` has been removed in favor
  of the real `settings.html` sidebar page — clicking "Settings" in the menu
  now opens the sidebar directly to that tab via `menuOpenSidebar('settings')`.
- Known remaining scope-cut: role enforcement is UI-level only (disabled nav
  tabs) — the underlying `google.script.run` functions themselves (e.g.
  `saveConfigUpdates`) don't independently re-check permissions server-side.
  Fine for a single-owner or trusted-team deployment; a hardened multi-tenant
  version would add that check inside each function, not just in the UI.

**The app is fully functional**: install the trigger, add a row (via the sheet or
the Schedule tab), and it sends, retries, and logs itself — all reachable from
one sidebar.

## Local development with clasp (recommended)

[`clasp`](https://github.com/google/clasp) is Google's official CLI for pushing
local files to an Apps Script project, so you can write code in a real editor
and keep it in git instead of pasting into the browser IDE.

### One-time setup

```bash
npm install
npx clasp login          # opens a browser, authorizes your Google account
```

Then either:

**A. Create a brand-new bound project** (creates a new Sheet automatically):
```bash
npx clasp create --type sheets --title "Smart Mail Scheduler" --rootDir ./src
```

**B. Or bind to a Sheet you already made** (Extensions → Apps Script → Project
Settings → copy the Script ID):
```bash
cp .clasp.json.example .clasp.json
# paste your Script ID into .clasp.json
```

### Day-to-day workflow

```bash
npx clasp push       # uploads src/*.gs and src/appsscript.json to Apps Script
npx clasp open        # opens the project in the browser editor
npx clasp push --watch # auto-push on file save, while iterating
```

Run tests from the browser editor (clasp can't execute functions, only push/pull):
select `test_Utils` or `test_ConfigService` in the function dropdown → Run →
View → Logs.

### Why `src/`

`appsscript.json` must live at the rootDir clasp pushes from, so all Apps
Script files live under `src/`. Repo tooling (`package.json`, this README)
stays at the project root and is excluded from pushes via `.claspignore`.

## Without clasp (plain browser editor)

Still fully supported — see the in-chat walkthrough for creating a Sheet,
opening Extensions → Apps Script, and pasting files in by hand. Both
approaches point at the same Apps Script project underneath.

### Running the full automated test suite

In the Apps Script editor function dropdown, run each of these in order (each
prints PASS/FAIL counts to View > Logs): `test_Utils`, `test_ConfigService`,
`test_SetupService`, `test_AppLogger`, `test_TemplateService`,
`test_AttachmentService`, `test_MailService_failurePaths`, `test_Scheduler`,
`test_TriggerService`, `test_ValidationService`, `test_Scheduler_addScheduledEmail`,
`test_QueueService`, `test_ReportService`, `test_Analytics`, `test_AuthService`,
`test_TemplateService_crud`, `test_AppLogger_search`. None of these send a real
email. To confirm a real send works, edit and run `test_MailService_liveSend_MANUAL`
separately.

### Testing Menu.gs manually

`onOpen`, dialogs, and `SpreadsheetApp.getUi()` need a real Sheets tab, not the
script editor's Run button. After `clasp push`, reload the Sheet tab, then:
Smart Mail Scheduler → Initialize/Repair Sheets → Preview Sample Email →
Send Pending → Settings (edit a value, Save) → Scheduler trigger → Install →
Check status.

## Sheet structure required

Tabs: `MailScheduler`, `Templates`, `Logs`, `Configuration` (see project spec
for exact headers — `SetupService.gs`, coming next, will auto-generate these).
