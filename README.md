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

Everything is stored in Electron `userData` as `data.json` on this machine only. Nothing is written back to Linear or Everhour.

The Everhour export folder is gitignored (personal data / rates).
