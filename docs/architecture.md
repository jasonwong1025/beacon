# Architecture

Beacon is a Manifest V3 Chrome extension. Logic is split into framework-agnostic
**modules** (`src/modules/*`), a **service worker** (`src/background/*`), and three React
surfaces (popup, dashboard, intervention pages).

## Data model

All durable state lives in `chrome.storage.local` behind the typed wrapper in
`src/modules/storage`:

| Key                      | Shape                | Purpose                              |
| ------------------------ | -------------------- | ------------------------------------ |
| `beacon.settings`        | `Settings`           | Pomodoro, smart modes, intervention prefs |
| `beacon.rules`           | `WebsiteRule[]`      | Per-host block / warning / allowed rules |
| `beacon.currentSession`  | `FocusSession\|null` | The in-flight focus session          |
| `beacon.events`          | `BeaconEvent[]`      | Raw event log (visits, blocks, warns, switches…) |
| `beacon.history`         | `SessionRecord[]`    | Completed/cancelled sessions for reports |

Transient state lives in `chrome.storage.session` (`src/background/transient.ts`): the
active tab/clock, per-tab "continue" grants, and the last-nudge timestamp. It survives
service-worker suspension but resets when the browser restarts.

## Service worker (`src/background`)

- **`index.ts`** — wires all Chrome event listeners and the message router.
- **`guard.ts`** — classifies main-frame navigations during a session and redirects the
  tab to the blocked or warn page when needed.
- **`tracker.ts`** — banks time-on-domain into `visit` events, records tab switches, and
  fires throttled drift nudges.
- **`sessionController.ts`** — session lifecycle (start/pause/resume/end/skip-break),
  Pomodoro phase transitions, the toolbar badge, and end-of-session reports.
- **`transient.ts`, `notify.ts`, `pages.ts`** — helpers.

Timers use `chrome.alarms`:

- `beacon-phase` — a one-shot alarm at the current phase's end time.
- `beacon-track` — a 1-minute periodic alarm that banks time and refreshes the badge.

## Navigation interception flow

```
onBeforeNavigate / onHistoryStateUpdated (main frame)
        │
        ▼
 session active? ──no──▶ allow
        │yes
        ▼
 classify(url, rules, smart)
   ├─ allow ─────────────────▶ allow
   ├─ block ─▶ record 'blocked' ─▶ redirect to blocked.html
   └─ warn  ─▶ has grant? ─yes─▶ allow
                  └─no─▶ record 'warned' ─▶ redirect to warn.html
                                              ├─ Continue ▶ grant + navigate to target
                                              └─ Return   ▶ history.back()
```

Redirects target extension pages (`chrome-extension://…`), which are exempt from the guard
(`isWebUrl` is false), so there are no redirect loops.

## Analytics (`src/modules/analytics`)

Raw `events` + `history` are aggregated on demand:

- `buildDayOverview` — one day's focus/distraction/neutral seconds, focus ratio, domain
  breakdown, and counts.
- `buildRangeReport` — rolls up N days (weekly = 7, monthly = 30) with a per-day series,
  top productive/distracting sites, average session length, and the most productive day.
- `detectTabThrash` / `detectRepeatDistraction` — live signals that power drift nudges.
- `exportJSON` / `exportCSV` — user-initiated data export.

Domains are categorized as **productive** (matches an `allowed` rule), **distracting**
(matches a `blocked`/`warning` rule), or **neutral**.
