# Common Good Cocktail House — Website Task Plan

**For:** Claude Code
**Target repo:** this directory (Next.js app, Railway-hosted)
**Live URL:** https://cgwebsite-production.up.railway.app
**Admin URL:** https://cgwebsite-production.up.railway.app/admin
**Review date:** 2026-04-08

This plan is ordered by priority. Each task is scoped to be executable end-to-end. Where a task requires a product decision, it's flagged **[DECIDE]** — surface the choice to Mike before implementing.

---

## P0 — Broken / blocking bugs

### 1. Fix missing home hero background image
- **Symptom:** `GET /images/backgrounds/home-bg.jpg` returns **404**. The home page hero is a blank dark rectangle; the carousel text ("Your Bepis Is Your Bepis") is almost unreadable against near-black.
- **Fix:**
  - Audit `/public/images/backgrounds/` and the home-page component for the referenced path.
  - Either (a) restore/upload the intended image at that path, or (b) wire the hero to use the "Background Image" field already present in `/admin/home` and fall back to a shipped default in `/public`.
  - Ensure admin-uploaded background renders on the live site after save (verify the save→fetch→render path).
- **Acceptance:** no 404s in network panel on `/`; hero shows an image; uploading a new background in admin updates the site.

### 2. Fix broken logo in `next/image`
- **Symptom:** `GET /_next/image?url=%2Fimages%2Flogo%2Flogo.png&w=3840&q=75` returns **400**. Admin login screen shows a broken-image icon where the logo should be.
- **Fix:** verify `/public/images/logo/logo.png` exists and is a valid PNG; confirm `next.config.mjs` `images` config allows the path/size; consider capping `sizes`/`w` on the `<Image>` component (3840 is almost certainly larger than the source).
- **Acceptance:** logo renders on admin login and anywhere else it's used; no 400s.

### 3. Mobile navigation doesn't collapse
- **Symptom:** At mobile widths the full horizontal nav (MENU / COFFEE / EVENTS / logo / CLUB / SHOP / ABOUT) is still rendered — there is no hamburger and items overlap / crowd the logo. This is the single biggest UX issue for a bar whose customers are overwhelmingly on phones.
- **Fix:** implement a proper responsive header: hamburger < 768px (or wherever the nav starts to wrap), full-screen or slide-in mobile drawer, tap targets ≥ 44px, logo centered or left-aligned on mobile. Lock body scroll when the drawer is open.
- **Acceptance:** at 390×844 (iPhone 14), nav collapses to a hamburger; drawer opens/closes; all destinations reachable; no horizontal scroll.

### 4. Homepage has a large empty white band below the hero
- **Symptom:** scrolling the home page reveals a tall white rectangle, then the nav reappears at the bottom (the nav component is being rendered twice / or the footer is missing and the hero height math leaves a gap).
- **Fix:** inspect the home-page layout. Likely one of: (a) the hero uses `100vh` but the main container has extra padding, (b) the nav is being injected both by the layout and the page, or (c) the footer is missing so the page ends on a blank section. Remove the duplicate / add the footer / fix the height.
- **Acceptance:** homepage scrolls cleanly from hero → content sections → footer, with no unstyled white space.

---

## P1 — Feature gaps vs. Mike's goals

### 5. Wire the menu carousel to real cocktail images + click-for-details flip
- **Current:** `/menu` shows placeholder "CG" cards. Mike wants: each cocktail card shows a photo; clicking the card reveals more information *in place* (flip/swap the card content — do **not** open a lightbox or expand to a larger image, that doesn't render well).
- **Fix:**
  - In `/admin/menu`, extend each cocktail with these fields (in addition to name):
    - `image` (hero photo, shown on the front of the card)
    - `ingredients` (free text)
    - `tastingNotes` (free text)
    - `tagLine` (short free text)
    - `notableNotes` (free text)
    - `alt` (for the image)
  - On `/menu`, the card front shows the photo + cocktail name. Clicking/tapping the card flips or cross-fades it to a back side that displays **only the values** the admin entered for Ingredients, Tasting Notes, Tag Line, and Notable Notes — **do not render the field labels/headers**. Only show a field's value if it's non-empty (skip empty fields entirely so the back side never has blank rows).
  - Clicking again flips the card back to the photo. Cards that are not flipped should still be swipeable as part of the carousel; the active/flipped card should stay flipped while the user reads it.
  - Keep carousel swipe on touch and arrow buttons on desktop. No modal, no lightbox, no pinch-zoom.
  - Support a "no photo" state that still looks intentional (styled text-only card front), since Mike wants text-only entries mixed in with photo entries.
- **Acceptance:** admin can fill in image + Ingredients + Tasting Notes + Tag Line + Notable Notes per cocktail; front of card shows photo + name; clicking reveals those four values on the same card (values only, no labels, empty fields hidden); clicking again flips back; carousel still swipes.

### 6. Home page carousel: mixed text / image / form / Instagram slides
- **Current:** admin already supports Text / Image / Form slides — good. Two gaps:
  - The carousel is text-only right now (and the text is almost invisible — see #1).
  - Mike wants Instagram-latest-posts as carousel slides.
- **Fix:**
  - Populate the carousel with real content (requires #1).
  - Add a new **Instagram Slide** type. Options:
    - **[DECIDE]** Pull live via the Instagram Basic Display / Graph API (requires a long-lived token stored in env + a refresh job), OR
    - Scrape-via-oembed / use a service like Instafeed / Curator.io, OR
    - Manual: admin pastes post URLs and we render oEmbed cards.
  - Recommend the **Graph API route with a daily refresh** cached to the DB — most reliable, no third-party fees, survives Meta's oEmbed deprecation. Store `IG_USER_ID` + `IG_LONG_LIVED_TOKEN` in Railway env vars; add a `/api/cron/refresh-instagram` endpoint + Railway cron.
  - Ensure Instagram slides link out to the post in a new tab.
- **Acceptance:** admin can add an Instagram slide; home carousel cycles through text + image + Instagram slides; IG slides auto-refresh daily.

### 7. Events calendar — make it informative and easy to read
- **Current:** `/events` shows an empty April 2026 grid; admin has an Events section but nothing is populated.
- **Fix:**
  - Verify admin can create recurring and one-off events with: title, description, start/end datetime, image, optional ticket/RSVP URL, category (weekly / special / private).
  - On `/events`, keep the month grid **but also** render a prominent "Upcoming" list view above/beside it for scanability — calendar grids alone are hostile on mobile.
  - Day cells should show event title + a dot indicator for busy days; clicking a day or event opens a detail view.
  - Add .ics download per event and "Add to Google Calendar" link.
- **Acceptance:** admin creates an event → shows on both grid and list → customer can click through to details and add to calendar.

### 8. Integrate Toast (ordering / delivery) and OZNR (memberships / merch)
- **Current:** `/shop` has four tabs (Bottles & Merch, Cocktails To Go, Memberships, Gift Cards) but all point at a single "Shop Now" button that doesn't do anything meaningful yet.
- **Fix:**
  - In `/admin/settings`, add fields for:
    - `toastOrderUrl` (Cocktails To Go)
    - `toastGiftCardUrl` (Gift Cards)
    - `oznrMembershipUrl` (Memberships)
    - `oznrMerchUrl` (Bottles & Merch)
    - Optional per-platform embed IDs if Toast/OZNR provide iframes.
  - On `/shop`, each tab's CTA should deep-link to the correct external URL in a new tab **and** show a branded "Powered by Toast / OZNR" microcopy so customers aren't surprised by the domain change.
  - **[DECIDE]** Whether to iframe-embed Toast checkout (if their TOS allows) vs. link out. Linking out is lower-risk; iframing is smoother UX.
  - Also add Toast + OZNR links to the global footer and the Club page ("Find Out More & Join" should go straight to the OZNR membership URL).
  - Mike: please share your Toast and OZNR URLs so we can configure these defaults.
- **Acceptance:** every shop tab has a working CTA; admin can change URLs without a code change; links open in new tabs and are tracked (see #14).

### 9. Contact / custom forms system
- **Current:** admin has "Form Data" (submissions view) and the home carousel supports a "Form Slide" type — the plumbing exists. What's missing is staff-friendly form *creation*.
- **Fix:**
  - Build a `/admin/forms` section where staff can: create a form, name it, add fields (text / email / phone / textarea / select / date), set a destination email, and get an embeddable ID.
  - Any Page (see #10) or home carousel Form Slide should be able to reference a form by ID.
  - Submissions go to the existing Form Data table **and** trigger an email to the destination address. Use Resend or Postmark (cheap, reliable) via an API key in env.
  - Add a honeypot + rate limit — bar sites get hit hard by form spam.
- **Acceptance:** staff creates a "Private Event Inquiry" form in the admin without touching code; embeds it on a page; submissions show in Form Data and arrive in inbox.

### 10. Wire the Pages CMS to actually render pages
- **Current:** `/admin/pages` says "No pages yet. Create First Page." meanwhile `/about`, `/club`, `/coffee`, `/shop`, `/events`, `/menu` are all hardcoded. The "Pages" CMS is decorative right now.
- **Fix:** **[DECIDE]** two paths:
  - **A. Keep core pages hardcoded**, and use `/admin/pages` only for ad-hoc pages (e.g., "/private-events", "/press"). Simpler, less risk.
  - **B. Migrate core pages into the CMS** so staff can edit About / Club / Coffee copy without a deploy. More work but matches Mike's goal of "coworkers easily log in to make changes."
  - Recommend **B for About + Club + Coffee + Shop hero copy** (edit-heavy) and **keep Menu + Events + Home as dedicated sections** since they already have purpose-built editors.
- **Acceptance:** staff can edit the About page copy in admin and see it live on `/about` without a deploy.

---

## P2 — Polish, performance, SEO, safety

### 11. Replace the placeholder hero line
- "Your Bepis Is Your Bepis" is obviously a test string. Even if it's kept as an inside joke, the default deployment should ship something customer-safe. Swap to a real tagline or make it admin-editable (it already is — just populate it).

### 12. Typography + contrast pass
- The hero carousel text currently uses a default color that disappears on the dark bg. Enforce WCAG AA contrast (4.5:1) on all text over backgrounds. Add a subtle dark gradient overlay on top of the hero image so any text color reads.
- Verify the `Type & Fonts` admin section loads fonts correctly — `/api/admin/fonts` was returning 401 on the public page (fine if gated, but make sure the public font resolver is a separate endpoint).

### 13. SEO + meta
- Page title is "Common Good Cocktail House | Glen Ellyn, IL" — good. Extend:
  - Per-page `<title>` and `<meta description>` (Menu, Events, Coffee, About, Club, Shop).
  - `og:image`, `og:title`, `og:description`, `twitter:card` for link previews (critical for Instagram/FB shares).
  - `robots.txt` + `sitemap.xml` generated from the pages + events.
  - JSON-LD `LocalBusiness` / `BarOrPub` with address, hours, phone, geo — huge for local search.
- Submit sitemap to Google Search Console once deployed.

### 14. Analytics + click tracking
- Add Plausible or GA4 (Plausible is cleaner and cookie-free → no banner needed). Track:
  - Outbound clicks to Toast, OZNR, Instagram, Google Maps.
  - Form submissions.
  - Carousel slide views.
- Gives Mike data on which shop integrations actually drive revenue.

### 15. Performance
- Home hero should ship a small, well-compressed WebP/AVIF, not a giant JPG. Use `next/image` with `priority` for above-the-fold.
- Audit bundle: multiple 100–400kb JS chunks on first load (seen in network panel) — split the admin bundle out of the public bundle (it shouldn't ship to guests).
- Run `next build` locally and eyeball the route output; target <200kb JS for `/`.

### 16. Admin hardening **[IMPORTANT]**
- The admin currently appears to gate on a single shared password (`commongood2024`). For a small team this is fine short-term, but:
  - Move the password out of code into an env var (if not already).
  - Rate-limit the login endpoint (5 attempts / 15 min / IP).
  - Add per-user accounts with emailed magic links (Resend/Postmark again) so departures don't require a password rotation.
  - Put the admin behind HTTPS-only cookies with `SameSite=Lax` and a short-ish session timeout.
  - **[DECIDE]** whether to add a second factor for destructive actions (delete event, delete page).
- Rotate the current password now, as it's been shared in this review.

### 17. Global footer
- Every page should have a footer with: address, phone, hours (from Settings), social icons, Toast/OZNR quick links, newsletter signup (tie to the forms system in #9), and copyright. Also fixes the "blank white band" on home (#4) in the short term.

### 18. Accessibility baseline
- Keyboard-navigate the whole site: tab order, visible focus rings, skip-to-content link, alt text on every image, semantic headings (one `h1` per page).
- `aria-label`s on icon-only buttons (carousel next/prev, hamburger).
- Target WCAG 2.1 AA.

### 19. Link social media (Instagram, etc.) in the header/footer
- Admin Settings already has a "Social Links" section — render those icons in the header and footer and have the Instagram link match the handle that feeds the home carousel (#6).

### 20. Add a "Find Us" block with a Google Map embed on home and about
- Customers searching for a local bar want hours + map. This is a 30-minute win.

---

## Housekeeping

- Delete the stray `package-lock 2.json` in repo root (looks like a Finder duplicate).
- Add a section to `README.md` documenting: how to run locally, env vars (admin password, Toast URLs, OZNR URLs, IG tokens, email API key), and how to deploy to Railway.
- Set up a Railway preview environment for the `main` branch so staff changes can be reviewed before they hit prod.

---

## Suggested execution order

1. P0 items 1–4 (one PR) — unblocks everything else.
2. Item 16 (admin hardening) — do this before adding more staff users.
3. Items 5–8 in parallel if possible: menu images, home IG feed, events, Toast/OZNR wiring.
4. Item 9 (forms) — depends on email provider decision.
5. Item 10 (Pages CMS) — depends on the A/B decision above.
6. P2 polish pass.

## Open questions for Mike (please answer before Claude Code starts)

1. Can you share the exact **Toast** and **OZNR** URLs for: online ordering, gift cards, memberships, and merch? (needed for #8)
2. For Instagram integration (#6), are you OK creating a Meta developer app + long-lived token, or do you prefer a manual "paste post URL" flow?
3. Pages CMS (#10): do you want About / Club / Coffee editable in admin, or only brand-new pages?
4. Email provider for form submissions (#9): Resend, Postmark, or your existing (Google Workspace?) SMTP?
5. Should we rotate the admin password now and switch to per-user magic-link logins (#16)?
