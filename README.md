# Beacon

### Stay on course. Work with intention.

Beacon is a productivity-focused Chrome extension that helps you stay aligned with
your goals while browsing. Instead of aggressively blocking sites, Beacon promotes
**intentional browsing** — it guides you back when you drift, surfaces where your
attention goes, and keeps useful pages open while taming the rabbit holes.

> The internet is not the enemy. Losing sight of your purpose is.

---

## Features (v1.0 + flagship v1.5)

- **Focus sessions** — set a goal, type (Work / Study / Coding / Research / Reading / Custom) and duration.
- **Session timer** — 25 / 50 / 60 / 90 / 120 presets, custom durations, and **Pomodoro** mode.
- **Website rules** — three lists per host:
  - **Blocked** — a hard stop during a session.
  - **Warning** — a gentle check-in before you continue.
  - **Allowed** — always open, no interruption.
- **Smart YouTube** — allow `/watch` & search, warn on Shorts / feed / trending.
- **Smart Reddit** — allow subreddits & search, warn on the popular feed.
- **Intent check** — "What are you here for?" before continuing to a warning site.
- **Gentle interventions** — drift nudges for excessive tab switching and repeat distractions.
- **Analytics dashboard** — today's focus time, sessions, distraction events, focus ratio,
  website breakdown, and time allocation.
- **Reports** — daily, weekly, and monthly summaries with a focus-by-day chart.
- **Privacy first** — everything is stored locally. No account, no tracking, no cloud.
  Export your data to JSON or CSV anytime.

---

## Tech stack

- React 18 + TypeScript + Tailwind CSS
- Vite + [`@crxjs/vite-plugin`](https://crxjs.dev/) (Manifest V3)
- Chrome APIs: `storage`, `tabs`, `webNavigation`, `alarms`, `notifications`
- Storage: `chrome.storage.local` (durable) + `chrome.storage.session` (transient)

---

## Getting started

```bash
npm install
npm run build      # produces the loadable extension in ./dist
```

### Load it in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select the **`dist/`** folder.
4. Pin Beacon to the toolbar and click the icon to start your first session.

### Develop with hot reload

```bash
npm run dev
```

Then load the generated `dist/` folder as an unpacked extension (CRXJS keeps it in sync).

### Other scripts

```bash
npm run typecheck     # tsc --noEmit
node scripts/gen-icons.mjs   # regenerate icon PNGs
```

---

## How it works

When a focus session is active, the service worker intercepts main-frame navigations
(`webNavigation.onBeforeNavigate` / `onHistoryStateUpdated`) and classifies the target
URL against your rules and smart modes:

- **allow** → nothing happens.
- **block** → the tab is redirected to a calm "stay on course" page.
- **warn** → the tab is redirected to an intent check; *Continue* grants access for that
  tab + domain for the rest of the session, *Return* takes you back.

Meanwhile, Beacon tracks time-on-domain per active tab and tab-switch frequency to power
the analytics and gentle drift nudges. Timers and phase transitions (focus ↔ break) run
on `chrome.alarms` so they survive the service worker being suspended.

See [`docs/architecture.md`](docs/architecture.md) for details.

---

## Project structure

```text
beacon/
├── manifest.config.ts        # MV3 manifest (typed)
├── vite.config.ts
├── scripts/gen-icons.mjs      # dependency-free PNG icon generator
├── public/icons/             # generated extension icons
├── src/
│   ├── background/           # service worker: guard, tracker, session controller
│   ├── popup/                # toolbar popup (start/stop a session)
│   ├── dashboard/            # full options page (overview, rules, reports, settings)
│   ├── pages/                # blocked + warn/intent-check pages
│   ├── modules/              # framework-agnostic logic
│   │   ├── session-engine/   #   session lifecycle, timers, pomodoro
│   │   ├── website-rules/    #   URL classification + smart modes
│   │   ├── analytics/        #   aggregation, reports, distraction detection, export
│   │   ├── storage/          #   typed chrome.storage wrapper
│   │   ├── types.ts          #   shared domain types + defaults
│   │   └── messaging.ts      #   UI ↔ service-worker message contract
│   ├── ui/                   # shared React hooks + components
│   └── styles/
└── docs/
```

> The original product spec proposes an `apps/`+`packages/` monorepo. This MVP ships as a
> single package with the same logical module boundaries under `src/modules/`, so it can be
> split into workspace packages later without rewrites.

---

## Privacy

Beacon is **local-first**. It never uploads your browsing history, never requires an
account, and never sells data. All session, event, and rule data lives in your browser's
local storage and can be exported or wiped from **Settings → Your Data**.

## License

MIT — see [LICENSE](LICENSE).
