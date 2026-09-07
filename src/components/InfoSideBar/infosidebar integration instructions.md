# Agent instructions: wire in InfoSidebar + dock/modal filter sidebar

## Goal
Three-region desktop layout: `InfoSidebar` docked left (always visible),
match list in the middle (unchanged behavior), `MatchFilterSidebar` docked
right (always visible, no toggle/modal). On narrow screens, collapse to a
single column and `MatchFilterSidebar` reverts to its current toggle-button
+ slide-in-modal behavior (already built — do not change its JS).

**Both responsive breakpoints below MUST use the same pixel value.** They
live in two different CSS files with no shared variable between them, so if
one is changed the other needs the identical change or the layout breaks at
the mismatched range (filter sidebar docks inline while the grid hasn't yet
given it a column, or vice versa). Recommended value: `1024px`. Every rule
below that depends on this is marked **[BREAKPOINT]**.

## Blocking data gaps — do not try to "fix" these as part of this task
`InfoSidebar` is built to degrade gracefully and already handles these
correctly (shows an explicit "not available yet" message per section) — do
not stub in fake data to make sections look populated:
- `teamA.players` / `teamB.players` are hardcoded to `[]` in the backend's
  `toRecord` (see `matches.ts`) — "most games played" and "most awarded
  players" sections will show their empty state until that's populated.
- `GET /matches` list responses don't include a `medals` field — "best
  medaled units" will show its empty state until that's added.
- "Most awarded players" currently attributes every match-level milestone
  flag to every player in that match (see the comment above
  `summarizePlayerAwards` in `InfoSidebar.jsx`) — this is a known
  placeholder, not a bug to fix here.

If any of these need fixing, that's separate backend work, not part of this
frontend wiring task.

---

## 1. Files already provided — copy in as-is
- `InfoSidebar.jsx`
- `InfoSidebar.css`

## 2. Modify `MatchFilterSidebar.css`

Add this block **[BREAKPOINT: 1024px]**. It overrides the sidebar's fixed/
overlay positioning to render inline instead, and hides the toggle/scrim/
close-button that only make sense in modal mode:

```css
@media (min-width: 1024px) {
  .filter-sidebar-toggle,
  .filter-sidebar-scrim,
  .filter-sidebar-close {
    display: none;
  }

  .filter-sidebar {
    position: static;
    width: 100%;
    max-width: none;
    height: auto;
    transform: none;
    transition: none;
    box-shadow: none;
    border-left: none;
  }

  .filter-sidebar-body {
    /* was flex:1 + overflow-y:auto to fill a fixed-height overlay — not
       needed once the sidebar is sized by normal document flow instead */
    overflow-y: visible;
  }
}
```

Verify the exact property names above against the current file before
pasting — this was written against the version from earlier in the project
and the file may have since picked up unrelated changes (e.g. the
`datetime-local` to ISO string fix). The class names (`filter-sidebar`,
`filter-sidebar-toggle`, `filter-sidebar-scrim`, `filter-sidebar-close`,
`filter-sidebar-body`) should still be current.

## 3. `MatchFilterSidebar.jsx` — no changes needed

The component's `open` state and toggle button remain exactly as-is. The
CSS above makes `.filter-sidebar` always visible on desktop regardless of
`open`'s value, entirely through the media query — no JS logic changes
required. (Optional cleanup, not required: the toggle button and scrim
still exist in the DOM on desktop, just hidden via CSS — if this matters for
tab-order/accessibility, gate their rendering with a `useMediaQuery`-style
check instead. Skip this unless it's actually causing a problem.)

## 4. Modify `App.jsx`

### 4a. Import InfoSidebar
```javascript
import { InfoSidebar } from "./components/InfoSidebar/InfoSidebar.jsx";
```
Adjust the path to wherever the file actually lands.

### 4b. Add scroll-to-match state + handler

Add near the other `useState` declarations:
```javascript
const [pendingScrollId, setPendingScrollId] = useState(null);
```

Add a handler (anywhere the other handlers are defined):
```javascript
const handleSelectMatch = useCallback((matchId) => {
  if (!matchId) return;
  setExpandedId(matchId);
  setPendingScrollId(matchId);
}, []);
```

Add an effect that performs the actual scroll **after** the expanded
content has rendered (doing this inline in the click handler would scroll
before the card's height changes from expanding, landing in the wrong
spot):
```javascript
useEffect(() => {
  if (!pendingScrollId) return;
  document
    .getElementById(`match-${pendingScrollId}`)
    ?.scrollIntoView({ behavior: "smooth", block: "center" });
  setPendingScrollId(null);
}, [pendingScrollId, expandedId]);
```

**Invariant that makes this safe without extra mode-switching logic**:
`InfoSidebar` is always given exactly the currently-rendered list (see 4d
below) as its `matches` prop, so any `exampleMatchId` it produces is
guaranteed to already be in the list currently on screen — no need to
change `mode` or re-fetch anything when a row is clicked.

### 4c. Give each rendered match card a DOM id

Find wherever `MatchCard` is mapped over (there may be two spots — one for
`filtered`, one for the `mode === "find"` single-match case). Wrap each one
in a div carrying the id `scrollIntoView` targets, and move the `key` up
onto that wrapper:

```jsx
{(mode === "find" ? matches : filtered).map((m) => (
  <div id={`match-${m.id}`} key={m.id}>
    <MatchCard
      match={m}
      analysis={m.analysis}
      expanded={expandedId === m.id}
      onToggle={() => setExpandedId(expandedId === m.id ? null : m.id)}
      isSaved={isMatchSaved(m.id)}
      onSave={() => handleSave(m)}
      onDelete={() => handleDelete(m.id)}
      spoiled={spoiled}
    />
  </div>
))}
```
This avoids needing to touch `MatchCard.jsx` at all — the id lives on a
wrapper div, not inside the component.

### 4d. Restructure the layout into three regions

Currently the filter sidebar is rendered as an `<aside>` above the mode
switch, and the results `<section>` is separate below it. Replace that
structure with a single grid container holding all three regions:

```jsx
<div className="layout-grid">
  <InfoSidebar matches={filtered} onSelectMatch={handleSelectMatch} />

  <div className="main-column">
    <div className="mode-switch">{/* ...unchanged... */}</div>

    {mode === "find" && (
      <div className="option-container">{/* ...unchanged lookup input... */}</div>
    )}

    <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* ...unchanged error/empty-state/match-list rendering, with the
           id-wrapper change from 4c applied... */}
    </section>
  </div>

  <aside className="filter-sidebar-slot">
    <MatchFilterSidebar
      filters={filters}
      onFiltersChange={setFilters}
      onSearch={runLiveSearch}
      loading={loading}
      resultTotal={resultTotal}
      spoiled={spoiled}
      onSpoiledChange={setSpoiled}
    />
  </aside>
</div>
```

`InfoSidebar` is intentionally given `filtered`, not the raw `matches`
state — the requirement was aggregates over the *filtered* list.

## 5. Add layout grid CSS (wherever `.mode-switch` etc. currently live —
   likely `App.css`)

```css
.layout-grid {
  display: grid;
  grid-template-columns: 260px 1fr 360px; /* info | main | filter — 360px matches MatchFilterSidebar's own width */
  align-items: start;
  gap: 20px;
}

.main-column {
  min-width: 0; /* prevents long content from blowing out the grid track */
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* [BREAKPOINT: 1024px] — must match the value in MatchFilterSidebar.css */
@media (max-width: 1024px) {
  .layout-grid {
    grid-template-columns: 1fr;
  }

  /* Recommended ordering on mobile: filter toggle first (so it's reachable
     immediately), then results, then the info sidebar reflowed to the
     bottom — on a small screen, always-visible aggregate stats pushed
     above the match list would bury the thing people actually came for.
     Adjust if you want different mobile priorities. */
  .filter-sidebar-slot {
    order: 1;
  }
  .main-column {
    order: 2;
  }
  .info-sidebar {
    order: 3;
  }
}
```

## 6. Testing checklist
- [ ] At width >= 1024px: filter sidebar renders inline in its own column,
      no floating "Filters" button, no scrim, Search/Reset footer still
      works.
- [ ] At width < 1024px: filter sidebar is invisible until the "Filters"
      button is tapped, then slides in as before; scrim closes it on
      outside-tap.
- [ ] Resizing the window across 1024px live (dev tools responsive mode)
      doesn't leave the sidebar stuck half-transformed or duplicated.
- [ ] Clicking an `InfoSidebar` row: expands the corresponding match card
      AND scrolls it into view, even if it's currently off-screen below the
      fold.
- [ ] `InfoSidebar` sections with no backing data show their explicit
      "not available yet" message, not an empty/broken-looking list.
- [ ] Switching `mode` (saved/scan/find) updates `InfoSidebar`'s counts to
      match whatever list is currently showing (since it's fed `filtered`,
      this should happen automatically — just confirm it does).