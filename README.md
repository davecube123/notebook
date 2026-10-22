# Almanac

A private, offline-first notebook PWA. No build step, no server, no account — everything lives in your browser's IndexedDB.

## What's inside

- **Notes**: rich editor with checklists, bullets, numbered lists, quotes, headings, code, dividers, links, highlight, bold/italic/underline/strike. Markdown shortcuts work too (`[ ]`, `-`, `1.`, `>`, `#`, ```` ``` ````, `---`, each followed by a space). Tags (nested like `#work/meetings`), pinning, archive, trash. Search by text, `#tag`, `from:2026-01-01`, `to:`, `on:`, `is:pinned`, `is:todo`, or the date-range filter. Group by date or tag. Export to Markdown.
- **One Thing**: one must-finish task per day. Checking it records the time. You get a streak, completion rate, a 6‑month heatmap and a full log. If yesterday's wasn't finished, you can carry it over.
- **Habits**: anchor habits, each with an optional cue ("After I pour coffee…"). Checking all of them marks a perfect day and checks that day's streak box. Shows per-habit streaks and lets you backfill a day you forgot.
- **Calendar**: trackers for things that happen regularly (sunsets, runs, calls home…). One-tap logging, a month view with overlays (one thing, perfect habit days, notes), per-tracker stats and an optional "nudge me after N days" reminder.
- **People**: profiles with Identity, Contact, How we met, Observation, Pattern of life, Network, Intel, Personality (Big Five, MBTI, Enneagram), Inner world, How they relate, Likes & care. You choose which fields to show, and you can add your own. Also trust, closeness and energy ratings, an encounter log with mood, birthday countdowns and "reconnect" reminders.
- **Feelings**: check in through the day using the Mood Meter (pleasant/unpleasant × high/low energy), then pick up to 3 precise words from a 137-word vocabulary with definitions, to practise affect labelling and emotional granularity. Optional intensity, energy, drive and desire levels, a "because…" note and what you need. After each check-in you get one small next step for that zone. The overview shows a mood map, five weeks of mood dots, 30-day trends, your vocabulary with new words to try, and what tends to go with your better days.
- **Today**: dashboard with the one thing, habits, quick logs, people nudges, quick capture, "on this day" memories.
- Global search (`/` or `⌘K`), keyboard shortcuts, light/dark theme, accent colors, passcode lock (a privacy screen; data isn't encrypted), JSON backup and restore, installable and works offline.

## Run locally

```sh
npx http-server -c-1 .   # or any static server
```

Open http://localhost:8080. To deploy, host the folder on any static host (GitHub Pages, Netlify…). The service worker needs HTTPS (or localhost). Bump `VERSION` in `sw.js` when you ship changes.
