# Spec: Christmas pop-up "Giving Tree" (sandboxed, not live)

For: Claude Code, working in the Common Good website repo
From: Mike, drafted with Claude on 2026-11-20
Companion file: `giving-tree-demo-seed.json` (3 demo organizations, 78 demo opportunities)

## 0. Ground rules

1. **Read first, then plan.** Before writing code, read how the last two pop-ups are built (Home for the Holidays is the one live right now) and reply to Mike with a short plan: where this pop-up's code will live, how the pre-launch switch works, what the site already has for email sending, scheduled jobs, file uploads and admin login, and anything in this spec that conflicts with the existing pattern.
2. **Follow the existing pop-up pattern.** Where this spec and the existing pattern disagree on plumbing (routes, flags, admin layout, recipe downloads), the existing pattern wins. Tell Mike what you changed.
3. **Not live.** Build this into the main live website as a future pop-up that is **disabled, with no live date**, viewable only through the same preview/sandbox mechanism the other pop-ups used before launch. Mike enables it by hand later. Do not touch Home for the Holidays.
4. **Structure only.** Bare-bones visuals. Alicia will supply a mood board later and the look gets applied on top. See section 12 for what that requires of the build.
5. **Open a draft PR.** Claude (chat) reviews before Mike merges.
6. **Ask before adding any paid service** (email provider, CAPTCHA, storage).

## 1. What this is

A Christmas pop-up page with two parts:

- **Recipe downloads** for the Christmas menu, built the same way as the last two pop-ups. Recipes are not chosen yet; use placeholders through the existing mechanism.
- **The Giving Tree.** A tree showing ways to give back, supplied by partner charities. Guests pick one, promise to do it, and leave a name and a short note. Their ornament rises off the tree and becomes a star in the sky above it. The sky is the record of what the community has given.

Three kinds of opportunity:

| Type | What the guest promises | What we do |
|---|---|---|
| Volunteer | Time, for a set shift or a number of hours they choose | Pass their name, email and phone to the organization, which contacts them directly |
| Gift | To bring a specific item to the drop-off box at the bar | Check it in by code and deliver it to the organization |
| Cash | An amount toward a goal | Send them to the organization's own giving link. We never handle money |

Nothing is verified. Pledges are taken on trust. That is intended.

## 2. Data model

Three levels: **Organization → Opportunity → Pledge**. Name tables and fields to fit the repo's conventions; the fields below are the required content.

### Organization
- name, slug, description, logo (upload)
- **Public contact details**, shown on Our Partners, each one optional and shown only when filled in: website, public phone, public email, public address, social links
- hide address (yes/no). When yes, the address is never shown anywhere public even if one is stored. Some partners run confidential residential locations.
- public contact note (admin only; reminders such as "confirm phone before launch")
- admin contact name, admin contact email (our private contact at the organization; never public; this is who the volunteer CSV goes to)
- show on Our Partners (yes/no)
- is_demo

### Opportunity
Common to all types:
- organization, type (`volunteer` / `gift` / `cash`), title (front of ornament), description (back of ornament), policies/details text (optional, shown before confirming)
- status: `draft` / `live` / `closed`
- deadline (optional date set by the organization)
- spots (how many people can claim it; default 1; not used for cash)
- tree position (zone plus x/y, see section 12), sort order
- is_demo

Volunteer only:
- hours mode: `fixed` (hours_fixed) or `choose` (hours_min, hours_max; guest picks)
- event date, start time, end time (all optional), location text, requirements text (free text from the organization; we do no screening)

Gift only:
- drop-off instructions (falls back to the site-wide default in settings)

Cash only:
- goal amount, give URL (the organization's own donation page)
- confirmed raised and confirmed as-of date (optional admin override, see 5.3)

### Pledge
- opportunity, code (section 2.1), manage token (section 6)
- name, email (both always required), phone (required for volunteer only)
- display: named or anonymous; display name (defaults to their name)
- note (optional, max 200 characters)
- show what I gave on my star (default yes); for cash, show amount (default yes)
- hours (volunteer), amount (cash)
- status: `pledged` / `received` (gift checked in) / `delivered` (gift taken to the organization) / `released` / `not_received`
- hold: none / `held_moderation` / `held_amount` / `denied`
- due date, reminder sent at, guest response (`still_on_it` / `more_time`), extended once (yes/no)
- physical ornament: `to_write` / `hung`, hung at
- source: `web` / `manual`
- consent to share with organization (volunteer; required), consent timestamp
- IP hash and created at (for rate limiting; no raw IP stored)
- is_demo

### 2.1 Pledge codes
Six characters, unique, from an alphabet without look-alikes (no 0, O, 1, I, L). Example: `K7M2QX`. The code is what a guest writes on a gift tag and what Mike uses to look a pledge up. The code is on the pledge, not the opportunity.

## 3. Public experience

All times and dates are Central (America/Chicago).

### 3.1 The tree: "Ways to give"
- One tree with three zones: Volunteer, Gifts, Funds. Zone labels are visible when zoomed out.
- Each open opportunity is an ornament in its zone showing its title. An opportunity with more than one spot shows "3 of 8 left". A cash ornament shows its meter.
- Tap a zone: the view zooms into that zone and a scrollable list of that zone's opportunities opens alongside (bottom sheet on phones). The list and the ornaments are the same data; tapping either opens the ornament.
- Pinch to zoom and drag to pan anywhere on the tree.
- Tap an ornament: the view zooms to it and it flips. The back shows the organization (name and logo), full description, date and time or hours, spots left or the meter, and the deadline as a countdown when there is one ("2 days left to drop this off").
- Button on the back: **Hang my ornament**.
- When every spot is claimed the ornament leaves the tree. Cash ornaments stay for the whole season and keep taking pledges past 100%.
- When no opportunities are left: a "tree is full" state that thanks people and points to Our Partners.

### 3.2 The sky: "What we've given"
- Tapping the sky above the tree opens it full screen.
- Counters at the top: hours pledged, dollars pledged, gifts promised, gifts received, neighbors taking part. Released, held and denied pledges are not counted.
- Every public pledge is a star labelled with its display name or "Anonymous". Pinch to zoom, drag to pan.
- Tap a star: shows the note and, if the guest allowed it, what they gave (opportunity title, hours, or amount).
- The sky has to stay usable at several hundred stars. Lay stars out from data so the field can grow.

### 3.3 Claim flow, all types
1. Tap **Hang my ornament**.
2. Form: name, email, "Show my name" or "Stay anonymous", optional note, "Show what I gave on my star".
3. Type-specific fields and details (below).
4. Trust line and confirm.
5. Success: the ornament rises off the tree and becomes a star. Show the pledge code and what happens next. Send the confirmation email.

Beside the email field, always: "This isn't a marketing list. We only use your email to talk with you about your gift and to send one thank-you recap at the end of the season."

Beside the note field: "Like a name on a brick. A line or two that everyone will see on the tree and on the wall at the bar." (Optional, 200 characters.)

Do not add any mailing-list opt-in to these forms.

### 3.4 Volunteer
- Extra field: phone (required). Hours picker when the opportunity is in `choose` mode.
- Show the organization's requirements text if present.
- Required checkbox, cannot proceed without it: "I agree that Common Good can share my name, email and phone number with [Organization] so they can contact me about volunteering." This applies even when the guest stays anonymous on the tree, and the form says so.
- Success message: we will pass your details to [Organization] and they will reach out to you directly to coordinate.

### 3.5 Gift
- Before confirming, show the drop-off details: where the box is, the due date, and the organization's deadline if there is one.
- Success screen and confirmation email both put this first and make it prominent: **"Your code is K7M2QX. When you drop off your gift, write this code on one of the tags next to the box and attach it, so we can get it to the right person."**
- Due date rules are in section 4.

### 3.6 Cash
- Extra field: amount. Any amount from $0.01. "Show the amount on my star" defaults to yes.
- Explain before confirming: "We never handle the money. After you hang your ornament we'll send you to [Organization]'s own giving page to make your gift."
- Success screen: the star animation, then a primary button "Continue to [Organization]'s giving page" that opens the give URL in a new tab. The same link is in the confirmation email.
- The ornament's meter fills from pledged amounts (section 5.3).

### 3.7 Our Partners
A clearly visible **Our Partners** button on the pop-up (present on both the tree and the sky views) opens the partners section. It lists every organization marked to show, one card each:

- logo and name
- description
- contact details: website, phone, email, address and social links, whichever are filled in. Phone and email are tappable (call, email); the address opens in maps. An address is never shown when "hide address" is on.
- "See ways to give with [Organization]", which jumps to the tree filtered to that organization's open opportunities

Other rules:
- The organization name on the back of any ornament opens that organization's partner card.
- The partners section works when the tree is full and after an organization's opportunities are all claimed. The point is that a guest who never pledges can still connect with a partner directly.
- Only the public contact fields appear here. The admin contact never does.
- An organization with no opportunities yet can still be listed.

## 4. Gift timing

Settings (admin-editable): due window 7 days, reminder 2 days before due, grace 3 days, season end 2026-12-31.

- **Due date** = the earliest of: pledge date + 7 days, the opportunity's deadline, the season end.
- **Reminder email** goes out 2 days before the due date. If the due date is too close for that (pledged within 2 days of it), send the reminder at 9:00 the next morning, provided that is still before the due date. If even that is too late, send none; the confirmation email already states the short deadline.
- The reminder has three buttons that work without logging in:
  - **Still on it**: recorded. This pledge is never auto-released; if it goes past due it is flagged overdue in admin for Mike to decide.
  - **Need a few more days**: moves the due date out 3 days, once, never past the opportunity's deadline or the season end.
  - **Release it**: same as "I can't make it" (section 6).
- **Auto-release**: if a pledge is not checked in, and the guest has not answered the reminder, 3 days after the due date, it is released automatically and the guest gets the release email.
- If that release moment falls after the opportunity's deadline or the season end, nothing is released. The opportunity closes at its deadline and unreceived pledges are marked `not_received`.
- Opportunities stop accepting claims once their deadline has passed. Opportunities with no deadline stop at the season end.
- A gift that turns up after its pledge was released can still be checked in. Two gifts for one need is fine.

Volunteer and cash pledges have no reminders or auto-release. Volunteer opportunities close at their event date or deadline.

## 5. After a pledge

### 5.1 Releasing ("I can't make it")
- The spot goes back on the tree for someone else.
- The pledge's star, name and note **stay in the sky**, and its physical ornament stays on the wall. Mike wants the thought honoured.
- The pledge stops counting toward counters and meters.
- The guest sees and is emailed a warm thank-you: it's the thought that counts, and we're glad they wanted to be part of it.
- Mike is notified (admin flag; email if the site already sends admin emails).

### 5.2 Holds (guest never sees these)
A held pledge looks fully successful to the guest: same success screen, same email. It is not shown publicly and not counted until approved in admin.

- **Moderation hold**: display name or note trips the filter (section 7).
- **Amount hold**: cash pledge above the threshold (setting, default $200).

Approve makes it public. Deny keeps it hidden; no email is sent on deny.

### 5.3 Cash meter
- Meter value = `confirmed raised` when an admin has entered one; otherwise the sum of approved, unreleased pledges.
- Label the number "pledged" unless a confirmed figure is in use, then "raised, as of [date]".

## 6. Guest self-service

Every confirmation email carries a private link built on a long random token (not the pledge code). It opens a page showing the pledge with:
- **I can't make it** (all types)
- **Need a few more days** (gifts, once)
- "Questions? Email mike@cgcocktails.com and mention your code."

No account or login.

## 7. Abuse protection and moderation

- **Filter** display name and note: a maintained profanity/offensive-language list, plus block links, email addresses and phone numbers in notes. Matches go to moderation hold, they are not rejected in front of the guest.
- **Caps per email** (settings): 3 open gift pledges, 5 open volunteer pledges, 5 cash pledges per day. Over the cap, a friendly message pointing to mike@cgcocktails.com.
- **Rate limit** pledge submissions per IP (start at 10 per hour).
- **Bot checks**: hidden honeypot field, minimum time on form, server-side validation of every field.
- No CAPTCHA at launch. Leave a clean place to add one if abuse shows up.
- Admin can edit or hide any name or note at any time.

## 8. Emails

Sender name "Common Good", reply-to mike@cgcocktails.com. Plain, warm, short. While the pop-up is not live, prefix subjects with "[TEST]".

1. **Confirmation**, per type:
   - Gift: code and tagging instructions first, then where and by when, then the manage link.
   - Volunteer: what they signed up for, that [Organization] will contact them directly, manage link.
   - Cash: amount, the organization's giving link, manage link.
2. **Gift reminder** with the three buttons (section 4).
3. **Release thank-you** (section 5.1).

Every email repeats: "We're taking you at your word, because that's what neighbors do. If plans change, just tell us and we'll put it back on the tree for someone else."

The end-of-season recap email is not part of this build. Provide the export for it (section 9.8).

## 9. Admin

Put this wherever the other pop-ups' admin lives, behind the existing admin login. It must work well on a phone.

1. **Organizations**: create, edit, upload logo, public contact details, hide address, admin contact, toggle Our Partners. Show a preview of the partner card as guests will see it.
2. **Opportunities**: create, edit, duplicate, close, reorder, place on tree. Filter by organization and type.
3. **Bulk import**: paste or upload JSON in the format of `giving-tree-demo-seed.json`. Validate, show a preview of what will be created, then commit. This is how Claude (chat) will load real opportunities once partners are confirmed, so errors should name the row and the field.
4. **Pledges**: searchable by code, email or name. Filter by type, organization, status, hold. Actions: edit name/note, hide, release, mark received, mark delivered, restore.
5. **Needs review**: one queue for moderation holds, amount holds and overdue "still on it" gifts. Approve or deny.
6. **Check in a gift** (phone-first): type a code, see the pledge, tap "Received". If a gift has no code, search by name or email, or create a manual pledge on the spot.
7. **Add a pledge manually**: for someone who gives in person. Same fields as the web form, source `manual`. It gets a code, a star and a place in the "to write" queue. Email optional here.
8. **Ornaments to write**: every pledge not yet hung on the physical wall, showing display name (or Anonymous), note, and what they gave. Check off as hung. Print view for a batch. Released pledges stay in this list.
9. **Cash check**: per cash opportunity, pledged total, confirmed raised, as-of date.
10. **Exports (CSV)**:
    - Volunteers for one organization: organization, opportunity title, description, event date, start, end, location, hours, volunteer name, email, phone, code, pledged at, status.
    - All pledges.
    - Recap list: name and email of everyone with a pledge, de-duplicated, with what they gave.
11. **Settings**: season end, due window, reminder lead, grace days, amount threshold, caps, default drop-off instructions, contact email.
12. **Demo tools**: "Load demo data" and "Wipe demo data" (section 10).
13. **Close out season**: after exports are taken, permanently delete all phone numbers. Guests are told at sign-up that phone numbers are deleted when the season ends.

## 10. Demo data

`giving-tree-demo-seed.json` holds three organizations and 78 invented opportunities so Mike can demo the flow to Chad and Alicia:

- Naomi's House: 25 cash opportunities
- Serenity House: 28 gift opportunities
- Eternal Buzz Community (Eternal Buzz Café): 25 volunteer opportunities

**These are real organizations and none of this has been agreed with them.** Every record is `is_demo: true`. Required safeguards:

- Demo records are only ever visible in the sandbox/preview.
- The pop-up **cannot be enabled while any demo record exists**. Enabling shows "Wipe demo data first."
- "Wipe demo data" deletes demo organizations, their opportunities and all pledges made against them.
- The preview shows a visible "Sample data" banner while demo records exist.
- Demo gift opportunities name no individual recipients. Keep it that way. Real listings for recipients will follow whatever each organization specifies.

The three demo organizations carry real public contact details found on the web on 2026-11-20 (website for all three, plus phone and address for Serenity House and email for Eternal Buzz). Gaps are left blank on purpose and noted in each record's `public_contact_note`; do not fill them with guesses. Naomi's House has `hide_address` on. Descriptions are draft copy pending each organization's approval.

Load the seed in the sandbox as part of this build, and auto-place ornaments within their zones.

## 11. Privacy

- Collect only what is listed. No mailing-list capture.
- Public surfaces show only: display name or "Anonymous", note, and what they gave if they allowed it. Never email, phone or real name of an anonymous guest.
- Phone numbers are used only for the volunteer export and deleted at season close.
- Manage links use unguessable tokens.

## 12. Built to be re-skinned

- Tree, zones, ornaments, stars, cards and counters are separate components styled through shared variables (colors, type, spacing), so a new look is a styling change.
- Ornament and star positions come from data, not hard-coded layout.
- All guest-facing wording lives in one copy file. "Hang my ornament", "Ways to give" and "What we've given" are approved; other wording in this spec is a draft.
- Animations (zoom, flip, rise-to-star) are isolated so they can be swapped. Honor reduced-motion settings with simple fades.
- The zone list is the accessible path: everything a guest can do on the tree must also work from the list with a keyboard and a screen reader.
- Phone first. Most guests will arrive from a QR code at the bar.

## 13. Done when

In the sandbox, with demo data loaded:

- [ ] The pop-up is invisible on the public site and Home for the Holidays is unchanged.
- [ ] Recipe downloads work as in the last two pop-ups (placeholder recipes).
- [ ] A test pledge of each type goes through, sends its email, and appears as a star.
- [ ] A gift pledge against a deadline 2 days away shows the countdown, gets a due date on the deadline, and gets a next-morning reminder.
- [ ] "I can't make it" returns the spot to the tree and leaves the star in the sky.
- [ ] An unanswered overdue gift auto-releases; one answered "Still on it" does not and shows up in Needs review.
- [ ] A cash pledge over $200 looks successful to the guest, is hidden publicly, and is not in the meter until approved.
- [ ] A note with profanity is held; approving it publishes it.
- [ ] The fourth open gift pledge from one email is refused politely.
- [ ] Gift check-in by code works on a phone.
- [ ] Manual pledge appears in the sky and in "Ornaments to write".
- [ ] Our Partners opens from both the tree and the sky and shows all three organizations with logo placeholder, description and the contact details that are filled in; blank fields and Naomi's House's address do not appear.
- [ ] A partner card's "See ways to give" jumps to that organization's opportunities, and the organization name on an ornament opens its partner card.
- [ ] Volunteer CSV for one organization has every column in 9.10.
- [ ] Bulk import of the seed file creates 3 organizations and 78 opportunities.
- [ ] Enabling the pop-up is blocked while demo data exists; wiping demo data clears it.
- [ ] Automated tests cover the due-date, reminder and release rules in section 4.
