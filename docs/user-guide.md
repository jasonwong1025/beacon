# User guide

## Install

1. Run `npm install && npm run build`.
2. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and pick
   the **`dist/`** folder.
3. Pin Beacon to your toolbar.

## Start a focus session

1. Click the Beacon icon.
2. Type what you're focusing on (e.g. *Build Flutter Portfolio App*).
3. Pick a session type and duration (or a custom one). Optionally turn on **Pomodoro**.
4. Click **Start focus session**. The toolbar badge shows minutes remaining.

While a session runs:

- Visiting a **blocked** site shows a calm "stay on course" page.
- Visiting a **warning** site shows a quick check-in. Choose your intent and **Continue
  anyway**, or **Return**. Continuing keeps that site open for the rest of the session.
- **Smart YouTube/Reddit** keep tutorials, search, and subreddits open while warning on
  feeds and Shorts.
- Pause, resume, or end the session from the popup.

## Manage website rules

Open the **Dashboard → Website Rules**. Add a host (e.g. `instagram.com`) to **Blocked**,
**Warning**, or **Allowed**. A host belongs to one list at a time. Toggle the **Smart
Modes** here too.

## See your data

- **Overview** — today's focus time, sessions, distraction events, focus ratio, website
  breakdown, and time allocation.
- **Reports** — daily / weekly / monthly summaries and a focus-by-day chart.
- **Settings → Your Data** — export to JSON or CSV, or clear everything.

## Privacy

All data stays on your device. No account, no tracking, no cloud sync.
