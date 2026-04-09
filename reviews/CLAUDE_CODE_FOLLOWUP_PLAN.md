# Common Good — Follow-up Task Plan

**For:** Claude Code
**Scope:** two focused feature changes. Nothing else in this file — leave the rest of the site alone.

---

## Task 1 — Menu carousel: click-to-flip card (replaces prior lightbox idea)

**Goal:** On `/menu`, each cocktail card shows a photo + name on the front. Clicking/tapping the card flips (or cross-fades) it in place to reveal extra details. **No lightbox, no modal, no expanded larger image** — the card stays the same size, only its contents change.

### Admin changes (`/admin/menu`)
Add these fields to each cocktail item (alongside the existing name field):

- `image` — hero photo (upload)
- `alt` — alt text for the image
- `ingredients` — free text
- `tastingNotes` — free text
- `tagLine` — short free text
- `notableNotes` — free text

All new text fields are optional. Persist them in whatever store the existing menu items use.

### Front-end changes (`/menu`)
- **Card front:** cocktail photo + name. If no image is uploaded, fall back to a styled text-only front (name centered on brand background) — don't show a broken image.
- **Card back:** reveals the values the admin entered, in this order:
  1. `tagLine`
  2. `ingredients`
  3. `tastingNotes`
  4. `notableNotes`
- **Critical display rules:**
  - Render **only the values**, never the field labels/headers. The user should never see the word "Ingredients" or "Tasting Notes" on the card.
  - If a field is empty, skip it entirely — no blank rows, no empty headings, no placeholder dashes.
  - If all four are empty, clicking the card should do nothing (or not be clickable) rather than flipping to a blank back side.
- **Interaction:**
  - Click/tap to flip front → back. Click/tap again to flip back → front.
  - Use a CSS 3D flip or a smooth cross-fade — whichever renders more cleanly in the existing carousel.
  - While a card is flipped, it should stay flipped even if the carousel auto-advances — pause auto-advance on flip, resume on flip-back.
  - Keep existing swipe/arrow carousel navigation working. Swiping to a new card should auto-reset any flipped card back to its front.
  - Keyboard: Enter/Space flips the focused card. Add `aria-pressed` and a sensible `aria-label` ("Show details for {cocktail name}" / "Hide details").
- **Styling:** the back side should match the existing card dimensions and brand palette. Use comfortable line-height and a legible size — this is a reading surface, not a label. Leave enough padding so long ingredient lists don't touch the card edge.

### Acceptance
- Admin can fill in image + all four text fields per cocktail and save.
- Front of card shows photo + name (or text-only front if no photo).
- Click flips to back showing only the non-empty values, no labels, in the order above.
- Click again flips back. Swipe/arrow still work. No lightbox or size change on click.
- Empty fields never render. Empty-everything cards don't flip.

---

## Task 2 — Home carousel: Instagram slide type

**Goal:** In addition to the existing Text / Image / Form slide types in the home-page carousel, add an **Instagram slide** type. When the admin pastes an Instagram post URL, the slide displays that post's photo and caption.

### Admin changes (`/admin/home`)
- Add a fourth slide type: **Instagram Slide** (buttons currently read "Text Slide / Image Slide / Form Slide Add" — add "Instagram Slide" next to them).
- Instagram Slide fields:
  - `instagramUrl` — required, the full post URL (e.g. `https://www.instagram.com/p/XXXXXXXXX/`)
  - `active` — toggle (consistent with existing slide types)
  - Optional `captionOverride` — if the admin wants to shorten or replace the scraped caption for layout reasons.
- On save, the server should:
  1. Validate the URL matches an Instagram post/reel pattern.
  2. Fetch the post's photo URL and caption via the Instagram oEmbed endpoint (or, if oEmbed is unavailable / rate-limited, fall back to scraping the OpenGraph `og:image` and `og:description` from the public post page).
  3. Cache the fetched `imageUrl` + `caption` + `fetchedAt` alongside the slide in the DB, so the public site doesn't hit Instagram on every page load.
  4. Re-fetch on a schedule (once every 24 hours is plenty) or whenever the admin re-saves the slide. Add a "Refresh now" button on the slide in admin that forces a re-fetch.
  5. If the fetch fails (post deleted, private, rate-limited), keep the last successful cache and surface a small warning in admin ("Last refresh failed — showing cached content from {date}"). Do not break the public site.

### Front-end changes (home carousel)
- Render Instagram slides alongside the existing Text / Image / Form slides in the same carousel.
- Layout: show the cached photo as the slide's visual, with the caption overlaid or shown below (match the style of the existing Image Slide as closely as possible so the carousel feels consistent).
- Use `captionOverride` if set, otherwise the cached `caption`. Truncate gracefully (e.g. ~200 characters) with a subtle "…" if longer — full caption is not the point, the photo is.
- Make the slide clickable → opens the original Instagram post in a new tab (`target="_blank" rel="noopener"`).
- Add a small Instagram glyph in a corner of the slide so users understand it's social content, not a promotional image.
- Respect the existing carousel auto-advance timing and text-color field behavior (if caption is overlaid, allow the same text color field the other slide types use).

### Env / config
- No Meta developer app is required for the oEmbed fallback route, but Instagram's oEmbed endpoint is flaky for unauthenticated callers. If we find it's unreliable in testing, add a `META_OEMBED_TOKEN` env var and use the authenticated endpoint instead. Document whichever we end up using in the README.
- Do **not** store any user credentials or login to Instagram to fetch private posts — public posts only.

### Acceptance
- Admin clicks "Instagram Slide", pastes a public Instagram post URL, saves.
- The slide appears in the home carousel with the post's photo and caption.
- Clicking the slide opens the original post in a new tab.
- "Refresh now" in admin re-fetches the photo/caption on demand.
- If Instagram is unreachable, the last cached version keeps showing and the admin sees a warning.
- Existing Text / Image / Form slides continue to work unchanged.

---

## Out of scope for this PR
- Everything else in `CLAUDE_CODE_TASK_PLAN.md` (P0 bugs, mobile nav, Toast/OZNR wiring, events, forms builder, etc.) is tracked separately — do not touch it here unless a change is strictly required to make these two features work.
