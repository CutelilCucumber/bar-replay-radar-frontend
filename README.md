# BAR Replay Radar

Live site can be found here: https://gex-game-finder.vercel.app/

Scans recent Beyond All Reason matches and scores them on how worth watching they are with awards like comebacks, big fights, close finishes, etc — using data pulled live from [gex](https://github.com/Varunda/gex)'s public API.

## What it does

1. Pulls recent ranked matches from `gex.honu.pw`.
2. For each match, fetches per-frame team stats and analyzes the course of the game.
3. Scores each match 0–100 and tags it with various milestones found in /`src/utils/awards.js`, each with different weights
4. Filters by awards and sorts them by user choice.
5. the user has the option to spoil awards and winners globally or per match.

## Data & caching

- No backend — it's a single client-side React component that saves data to Storage.
- Per-match event data is cached in session storage to avoid repetative api calls.

## Known limits

- Only scores clean 2-side matches (1v1s, team vs. team). FFA/3+ team games show up with a warning — the frame data doesn't map cleanly to "who's ahead" with more than two sides yet.
- Eco is approximated from cumulative metal production and energy/60 (free converters!)
- Matches need to be fully parsed by gex (`processingParsed=true`) before scoring works — very fresh uploads may not qualify yet.

## Usage

Clone the repo
npm install
npm run dev

## WIP

-tweak award threshholds and weights by watching real games
-add scan my match ID for specific matches
-Filtering by queries to gex api with user settings.
-add backend for consistent gex scanning so its not handled by clients.
-db support with complete analyzed data, to significantly reduce api calls.
