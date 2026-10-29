# Time Tracker

Local Electron app for logging time against Linear issues and importing Everhour history.

## Setup

```bash
npm install
npm run dev
```

1. In Linear: **Settings → Security & access → Personal API keys** → create a key.
2. Open the app → **Settings** → paste the key, set team key (default `SESAM`) → **Save settings**.
3. Click **Refresh issues**.
4. Optionally **Import Everhour…** and select your `everhour-account-data` folder (or its `data/` subfolder).

## Time format

Enter durations like `1h`, `30m`, or `1h 30m`. There is no built-in timer.

## Data

Everything is stored in Electron `userData` as `data.json` on this machine only. Issues re-sync from Linear on startup and every 5 minutes. The only thing written back to Linear is issue status, when you change it in the issue panel. Nothing is written to Everhour.

## Salary periods

On **Totals**, pick the last day of a salary period and click **End salary period**. The **Salary period** preset (the default view) then counts time from the next day on.

The Everhour export folder is gitignored (personal data / rates).
