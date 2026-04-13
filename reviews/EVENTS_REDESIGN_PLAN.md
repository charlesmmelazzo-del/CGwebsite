# Events Page Redesign — List View, Smart Tab Visibility, Scheduling

**For:** Claude Code
**Scope:** Replace the FullCalendar grid on `/events` with a styled list view, add per-event scheduling (visible-from / visible-until), auto-hide the "Upcoming Events" tab when there are no future events, and default to "Host Your Event" when that happens.

---

## Current state (what we're changing)

**Public page** (`src/app/events/EventsPageClient.tsx`):
- Two hardcoded tabs: "Upcoming Events" and "Host Your Event".
- "Upcoming Events" always defaults as active (`useState<TabId>("upcoming")`).
- Renders a FullCalendar month grid (`EventsCalendar` component using `@fullcalendar/daygrid`).
- Shows ALL events — past and future — on the calendar grid.
- No concept of "no events means hide the tab."

**Admin** (`src/app/admin/events/page.tsx`):
- "Calendar Events" tab where admin creates events with: title, start date, end date, description, location, image URL.
- No scheduling fields (visible-from / visible-until).
- Events stored in Supabase `events` table.

**Types** (`src/types/index.ts`):
```typescript
interface CalendarEvent {
  id: string;
  title: string;
  start: string;       // ISO date
  end?: string;
  allDay?: boolean;
  description?: string;
  imageUrl?: string;
  location?: string;
}
```

---

## Task 0 — Add ticket / action link to events

**Goal:** Let the admin attach an optional link to any event (ticket purchase, RSVP, external page, etc.) that renders as a prominent CTA button on the public event listing.

### Type changes (`src/types/index.ts`)

Add three optional fields to `CalendarEvent`:

```typescript
interface CalendarEvent {
  // ... existing fields ...
  // NEW — optional action link
  linkUrl?: string;        // e.g. "https://tickets.example.com/event-123"
  linkLabel?: string;      // e.g. "Buy Tickets", "RSVP", "Learn More" — defaults to "More Info" if linkUrl is set but label is empty
  linkNewTab?: boolean;    // default true — external ticket sites should open in a new tab
}
```

All three are optional. If `linkUrl` is empty, no button renders — the event listing looks clean without it.

### Database

Add three nullable columns to the `events` table:
```sql
ALTER TABLE events ADD COLUMN link_url TEXT;
ALTER TABLE events ADD COLUMN link_label TEXT;
ALTER TABLE events ADD COLUMN link_new_tab BOOLEAN DEFAULT true;
```

### API changes (`src/app/api/admin/events/route.ts`)

- Accept `linkUrl`, `linkLabel`, `linkNewTab` in the POST body.
- Map to Supabase columns `link_url`, `link_label`, `link_new_tab`.
- Return them on GET.

### Admin changes (`src/app/admin/events/page.tsx`)

In the event creation/edit modal, add an **Event Link** section below the existing description/location/image fields:

- **Link URL** — text input, placeholder: `https://tickets.example.com/...`
- **Button Label** — text input, placeholder: `Buy Tickets` — show helper text: "Leave blank to default to 'More Info'"
- **Open in new tab** — checkbox, default checked.

Keep it simple — just three inputs in a row or a small group. No special styling needed in the admin.

### Front-end changes (public event list — built in Task 2 below)

When rendering each event card in the upcoming events list:

- If `linkUrl` is set, render a CTA button at the bottom-right of the event card (or below the description on mobile).
- **Button styling:** match the existing site CTA pattern — `bg-[#C97D5A] text-white text-xs tracking-widest uppercase hover:bg-[#b86d4a] px-5 py-2.5 transition-colors`. This is the same style used for "Send Inquiry", "Shop Now", and other CTAs across the site.
- **Button text:** use `linkLabel` if set, otherwise default to `"More Info"`.
- **Link behavior:** `target="_blank" rel="noopener noreferrer"` if `linkNewTab` is true (default), otherwise same-tab navigation.
- If `linkUrl` is empty, render nothing — no empty button, no placeholder, no "No link" text. The event card just doesn't have a CTA.
- **On the expanded/detail view** (when user clicks the event card to see full description): show the button more prominently — full-width on mobile, right-aligned on desktop, with slightly larger padding.

### Acceptance
- Admin can add a URL + label + new-tab toggle to any event and save.
- Public event list shows a styled CTA button on events that have a link.
- Button opens the URL (new tab by default).
- Events without a link show no button — no visual artifact.
- Label defaults to "More Info" when URL is set but label is blank.

---

## Task 1 — Add scheduling fields to events

### Type changes (`src/types/index.ts`)

Add two optional fields to `CalendarEvent`:

```typescript
interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay?: boolean;
  description?: string;
  imageUrl?: string;
  location?: string;
  // NEW — scheduling: controls when the event appears on the public site
  visibleFrom?: string;   // ISO datetime — event won't show before this
  visibleUntil?: string;  // ISO datetime — event won't show after this
}
```

Both are optional. If neither is set, the event is visible immediately and until its event date passes (see Task 2 for auto-hide-past logic).

### Admin changes (`src/app/admin/events/page.tsx`)

In the event creation/edit modal, add a **Visibility Schedule** section below the existing fields:

- Two `<input type="datetime-local">` fields:
  - **Visible from** — when this event should start appearing on the public site. Useful for announcing events ahead of time on a specific date.
  - **Visible until** — when to stop showing it, even if the event date hasn't passed yet. Useful for removing an event early if it's cancelled or sold out.
- Both are optional. Show helper text:
  - If neither set: "Visible immediately until the event date passes"
  - If only visibleFrom is in the future: "Will appear on {date}"
  - If visibleUntil is in the past: "Hidden — visibility ended {date}"

### API changes (`src/app/api/admin/events/route.ts`)

- Accept `visibleFrom` and `visibleUntil` in the POST body.
- Map to Supabase columns `visible_from` and `visible_until` (add these as nullable timestamp columns to the `events` table — or store them as text if the table uses text dates).
- Return them on GET.

### Database

Add two nullable columns to the `events` table:
```sql
ALTER TABLE events ADD COLUMN visible_from TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN visible_until TIMESTAMPTZ;
```

---

## Task 2 — Replace calendar grid with a styled event list + auto-hide past events

### Remove FullCalendar dependency

- Delete or stop importing `src/components/ui/EventsCalendar.tsx`.
- Remove the `@fullcalendar/core`, `@fullcalendar/daygrid`, and `@fullcalendar/react` packages from `package.json` if they are no longer used anywhere else. Run `npm uninstall` for them.

### Server-side filtering (`src/app/events/page.tsx`)

In the server component that fetches events (via `getEventsData()` in `src/lib/eventsdata.ts`), apply two filters before passing to the client component:

```typescript
const now = new Date();
const visibleEvents = allEvents.filter(event => {
  // 1. Hide events whose event date is in the past
  const eventDate = new Date(event.end || event.start);
  if (eventDate < now) return false;

  // 2. Respect visibility schedule
  if (event.visibleFrom && new Date(event.visibleFrom) > now) return false;
  if (event.visibleUntil && new Date(event.visibleUntil) < now) return false;

  return true;
});
```

This means the client component **only ever receives future, currently-visible events**. No past events leak through.

Also: **pass a boolean or the count** to the client so it knows whether there are any upcoming events: `hasFutureEvents: visibleEvents.length > 0`.

### New list component

Replace the `EventsCalendar` usage in `EventsPageClient.tsx` with a new inline list (or a new `EventsList` component). Design:

**Each event card in the list:**
- Left side: **date block** — large day number + abbreviated month + day-of-week (e.g. "15 / APR / WED"), styled in the brand display font, accent color.
- Right side: event title (display font, larger), description (body text, muted, 2-3 lines max with line-clamp), location if set (small, muted, with a pin icon or similar).
- Optional event image: if `imageUrl` is set, show it as a tasteful thumbnail or background accent on the card. Don't let it dominate — the text should be primary.
- If the event has an `end` date different from `start`, show the date range (e.g. "Apr 15 – Apr 17").

**Overall list styling:**
- Centered on page, max-width ~700px, consistent with the rest of the site's content width.
- Cards separated by subtle dividers or spacing (not heavy borders).
- Use the green theme colors from `THEMES.green` (same as current events page).
- Typography should match the rest of the site: display font for headings, body font for descriptions, nav-style letter spacing on labels.
- On mobile: stack the date block above the event details instead of side-by-side.
- Sort events by `start` date ascending (soonest first).

**Ticket / action link button (from Task 0):**
- If the event has a `linkUrl`, render the CTA button on the card — right-aligned on desktop, full-width on mobile.
- Styled as the standard site CTA: `bg-[#C97D5A] text-white text-xs tracking-widest uppercase`.
- Label from `linkLabel`, defaulting to "More Info".
- Opens in new tab by default (`linkNewTab`).
- If no `linkUrl`, no button — the card just shows date + title + description.

**Clicking an event:**
- Expand the card in-place to show the full description and image (if any) — similar pattern to the menu flip card but as a simple expand/collapse.
- Or show a small modal. Keep it light — don't navigate away from the page.
- Include an "Add to Calendar" link that generates an `.ics` file download (title + start + end + description + location).

---

## Task 3 — Smart tab visibility: hide "Upcoming Events" when empty

This is the key UX change. The events page should **never show an empty "Upcoming Events" tab** to customers.

### Logic in `EventsPageClient.tsx`

Replace the hardcoded tabs array and default active tab:

```typescript
// Receive from server component:
// initialEvents: CalendarEvent[] (already filtered to future + visible only)

const hasFutureEvents = initialEvents.length > 0;

// Build tabs dynamically
const tabs: { id: TabId; label: string }[] = [];
if (hasFutureEvents) {
  tabs.push({
    id: "upcoming",
    label: header.tabs?.find(t => t.id === "upcoming")?.label ?? "Upcoming Events",
  });
}
tabs.push({
  id: "host",
  label: header.tabs?.find(t => t.id === "host")?.label ?? "Host Your Event",
});

// Default to "upcoming" if there are events, otherwise "host"
const [activeTab, setActiveTab] = useState<TabId>(hasFutureEvents ? "upcoming" : "host");
```

**Behavior:**
- **No future events exist:** only the "Host Your Event" tab renders. No tab bar needed at all (since there's only one tab) — just show the host content directly. The page title still says "EVENTS" from the header.
- **Future events exist:** both tabs render, "Upcoming Events" is the default active tab, exactly as users expect.
- If there's only one tab, **hide the tab bar entirely** — don't show a single tab button with nothing to switch to. Just render the host content.

### Edge case: tab bar with one tab

```typescript
{tabs.length > 1 && (
  <div className="flex justify-center gap-1 mb-10 px-4">
    {tabs.map(tab => (
      <button key={tab.id} ...>{tab.label}</button>
    ))}
  </div>
)}
```

---

## Files to modify

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `visibleFrom?` and `visibleUntil?` to `CalendarEvent` |
| `src/app/admin/events/page.tsx` | Add visibility schedule fields to event editor modal |
| `src/app/api/admin/events/route.ts` | Accept + persist + return `visibleFrom` / `visibleUntil` |
| `src/lib/eventsdata.ts` | Filter out past events and not-yet-visible / expired events |
| `src/app/events/page.tsx` | Pass filtered events + `hasFutureEvents` flag to client |
| `src/app/events/EventsPageClient.tsx` | Replace calendar with list, implement smart tab logic, hide tab bar when single tab |
| `src/components/ui/EventsCalendar.tsx` | Delete this file (FullCalendar grid is being removed) |
| `package.json` | Remove FullCalendar packages if unused elsewhere |

---

## Acceptance criteria

1. **Admin** can create events with optional "Visible from" and "Visible until" datetime fields.
2. **Public site** shows a styled list of upcoming events (not a calendar grid), sorted soonest-first, matching the site's green theme and brand typography.
3. **Past events** never appear on the public site — they're filtered server-side.
4. **Scheduled events** respect their visibility window: a "Visible from" in the future hides the event until then; a "Visible until" in the past hides it even if the event date is future.
5. **When no future events exist**, the "Upcoming Events" tab disappears entirely. The page defaults to showing only the "Host Your Event" content. No tab bar is shown (since there's only one section). Customers never see "No Upcoming Events."
6. **When future events are added**, the "Upcoming Events" tab reappears and becomes the default tab again.
7. Each event in the list can be expanded/clicked to see full details + an "Add to Calendar" .ics download.
8. The list is responsive: date block beside event info on desktop, stacked on mobile.
9. FullCalendar library is removed from the project.

## Out of scope

- Everything else in the other plan files — don't touch the home carousel, menu, shop, or admin panel beyond the events-specific changes above.
