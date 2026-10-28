# Almanac

A private, offline-first notebook PWA. No build step, no server, no account — everything lives in your browser's IndexedDB.

## What's inside

- **Notes**: rich editor with checklists, bullets, numbered lists (nest any of them under a checkbox or item with Tab or the → toolbar button; ticking a task ticks its sub-tasks), quotes, headings, code, dividers, links, highlight, bold/italic/underline/strike. Markdown shortcuts work too (`[ ]`, `-`, `1.`, `>`, `#`, ```` ``` ````, `---`, each followed by a space). Tags (nested like `#work/meetings`), pinning, archive, trash. Search by text, `#tag`, `from:2026-01-01`, `to:`, `on:`, `is:pinned`, `is:todo`, or the date-range filter. Group by date or tag. Export to Markdown.
- **Daily note & templates**: one note per day (from Today, the ☀︎ button in Notes, or the `D` key), with links to the day before and after. Research-backed templates, each with a "Why it works" section and sources: Daily note (if–then plan, a feeling, three good things, a free write, tomorrow's list), Weekly review, Decision journal (with a pre-mortem), CBT thought record, Best possible self, Learning note, Conversation debrief. Save any note as your own template, and choose which template the daily note uses. An untouched note made from a template is discarded.
- **One Thing**: one must-finish task per day. Checking it records the time. You get a streak, completion rate, a 6‑month heatmap and a full log. If yesterday's wasn't finished, you can carry it over.
- **Habits**: anchor habits, each with an optional cue ("After I pour coffee…"). Checking all of them marks a perfect day and checks that day's streak box. Shows per-habit streaks and lets you backfill a day you forgot.
- **Calendar**: trackers for things that happen regularly (sunsets, runs, calls home…). One-tap logging, a month view with overlays (one thing, perfect habit days, notes), per-tracker stats and an optional "nudge me after N days" reminder.
- **People**: a short profile (identity, contact, how you met, likes & care), trust, closeness and energy ratings, an encounter log with mood, birthday countdowns and "reconnect" reminders. Fields from older versions stay under "Earlier details".
- **Personality reading**: six lenses, each explained as you fill it in and each with a do / don't guide on how to relate to the person. Big Five rated 1–5 with the 30 NEO PI-R facets (Costa & McCrae); Keirsey temperament from *Please Understand Me II* (4 guided questions); Enneagram core desire, fear and passion, with a 2-question test (Riso & Hudson's QUEST method) and a full type profile (centre, wing, motivations, levels, stress and growth, virtue, fixation, typical defence); Erotic Blueprints (Jaiya) with a 5-question quiz and a note on the science; defence mechanisms by DSM-IV level, with a note on how each one shows up; zodiac sign from their birthday, with a disclaimer.
- **People in notes**: type `@` in a note to mention someone; the link stores that exact person, so two people with the same name never mix. Each person has a Notes tab with the notes about them, plus notes that contain their name but aren't linked yet (Link / Not them). `@New name` adds someone to People on the spot.
- **Feelings** (off by default; turn it on in Settings → Features, and past check-ins are kept): check in through the day using the Mood Meter (pleasant/unpleasant × high/low energy), then pick up to 3 precise words from a 137-word vocabulary with definitions, to practise affect labelling and emotional granularity. Optional intensity, energy, drive and desire levels, a "because…" note and what you need. After each check-in you get one small next step for that zone. The overview shows a mood map, five weeks of mood dots, 30-day trends, your vocabulary with new words to try, and what tends to go with your better days.
- **Today**: dashboard with the one thing, habits, quick logs, people nudges, quick capture, "on this day" memories.
- Global search (`/` or `⌘K`), keyboard shortcuts, light/dark theme, accent colors, passcode lock (a privacy screen; data isn't encrypted), JSON backup and restore, installable and works offline.

## Run locally

```sh
npx http-server -c-1 .   # or any static server
```

Open http://localhost:8080. To deploy, host the folder on any static host (GitHub Pages, Netlify…). The service worker needs HTTPS (or localhost). Bump `VERSION` in `sw.js` when you ship changes.
