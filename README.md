# BAR Spectator Finder WIP

Scans recent Beyond All Reason matches and scores them on how worth watching they are — comebacks, big fights, close finishes, upsets — using data pulled live from [gex](https://github.com/Varunda/gex)'s public API.

## What it does

1. Pulls recent ranked matches from `gex.honu.pw`'s `/api/match/search`, filtered by your settings.
2. For each match, fetches per-frame team stats (`/api/game-event/{id}?includeTeamStats=true`) and analyzes the course of the game.
3. Scores each match 0–100 and tags it with badges:
   - **COMEBACK** — winner was down 20%+ in economy after minute 3, won anyway
   - **BIG BATTLE** — a sharp damage-per-second spike somewhere in the game
   - **NAIL-BITER** — final kill counts within 25% of each other, 12+ minute game
   - **UPSET** — the winning side had a meaningfully lower average skill rating
4. Sorts results by score.

## Data & caching

- No backend — it's a single client-side React component that talks directly to `gex.honu.pw` (CORS is open there).
- Per-match scores are cached locally to avoid abundant api calls.

## Known limits

- Only scores clean 2-side matches (1v1s, team vs. team). FFA/3+ team games show up but aren't analyzed — the frame data doesn't map cleanly to "who's ahead" with more than two sides yet.
- "Economy" is approximated from cumulative metal production; BAR's replay data doesn't expose a true army-value metric.
- Assumes 30 frames/sec (confirmed from gex's own `ApmCalculatorUtil` source).
- Matches need to be fully parsed by gex (`processingParsed=true`) before scoring works — very fresh uploads may not qualify yet.

## Usage

Clone the repo
npm install
npm run dev
