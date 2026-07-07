# BAR Spectator Finder WIP
 
Scans recent Beyond All Reason matches and scores them on how worth watching they are — comebacks, big fights, close finishes, upsets — using data pulled live from [gex](https://github.com/Varunda/gex)'s public API.
 
## What it does
 
1. Pulls recent ranked matches from `gex.honu.pw`'s `/api/match/search`, filtered by your gamemode, duration, and player-count settings.
2. For each match, fetches per-frame team stats (`/api/game-event/{id}?includeTeamStats=true`) and analyzes the economy and combat over the course of the game.
3. Scores each match 0–100 and tags it with badges:
   - **COMEBACK** — winner was down 20%+ in economy after minute 3, won anyway
   - **BIG BATTLE** — a sharp damage-per-second spike somewhere in the game
   - **NAIL-BITER** — final kill counts within 25% of each other, 12+ minute game
   - **UPSET** — the winning side had a meaningfully lower average skill rating
4. Sorts results by score, highest first.
## Data & caching
 
- No backend — it's a single client-side React component that talks directly to `gex.honu.pw` (CORS is open there).
- Per-match scores are cached permanently and shared across everyone using the tool, since a match's replay data never changes once played.
- Search results are cached for 3 minutes (shared) so repeated scans with the same filters don't re-hit the API. Use "force refresh" to bypass.
## Known limits
 
- Only scores clean 2-side matches (1v1s, team vs. team). FFA/3+ team games show up but aren't analyzed — the frame data doesn't map cleanly to "who's ahead" with more than two sides yet.
- "Economy" is approximated from cumulative metal production; BAR's replay data doesn't expose a true army-value metric.
- Assumes 30 frames/sec (confirmed from gex's own `ApmCalculatorUtil` source).
- Matches need to be fully parsed by gex (`processingParsed=true`) before scoring works — very fresh uploads may not qualify yet.
## Usage
 
Drop `bar-spectator-finder.jsx` into a React environment with `useState`/`useCallback` and a `window.storage` key-value API available (get/set/delete, with a `shared` flag). Set your filters, hit **Run scan**.