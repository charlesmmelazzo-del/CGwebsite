This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Reservations (Reserve page and guest links)

The website stores no reservation data. Every `/api/reserve/*` route calls the
Cocktail Bible's public reservations API server to server (`src/lib/reserve/bible.ts`).

**Settings (Railway variables)**

| Variable | What it does |
| --- | --- |
| `BIBLE_API_URL` | The Bible's address. Defaults to `https://cgbible.com`. The Bible is a separate Railway project, so Railway private networking can't be used. |
| `RESERVATIONS_SYNC_KEY` | Shared secret; must match the Bible's. |
| `RESERVE_ENABLED=1` | Forces Reserve on for that copy of the site (staging sets it). Otherwise the admin Reserve switch decides. |

**What the Reserve switch hides.** Off: the `/reserve` page, the nav link,
and the new-booking endpoints `/api/reserve/calendar`, `/slots`, `/lookup`,
`/request`, `/not-me` (and `/config`, `/events/*`) answer 404. A guest's own
link keeps working either way: `/reserve/r/<token>` and everything under
`/api/reserve/r/<token>/…` (view, confirm, cancel, messages, party size, time
change, and the time-change calendar at `/api/reserve/r/<token>/calendar`).

**Which host guest emails link to.** The Bible builds every guest email link as
`<site_origin>/reserve/r/<token>`, where `site_origin` is stored on the
reservation when it is made:

- A request from the website stores the origin of the copy the guest used
  (this site sends it with each call; the Bible only accepts origins listed in
  its `RESERVATIONS_ALLOWED_ORIGINS`). Staging requests link to staging.
- A reservation made by staff in the Bible has no origin, so its links use the
  live site, `https://commongoodcocktailhouse.com` (`LIVE_SITE` in the Bible's
  `server/reservations/emails.js`). This is why the guest page must stay open
  on the live site even while the Reserve switch is off.

**Reliability.** Each Bible call has its own timeout (4 s for reads, 8 s for
writes). Reads retry once on a connect failure or timeout; writes retry only
when nothing could have been sent. A new request carries an `Idempotency-Key`,
so it is retried too and the Bible never books it twice. Every failure is
logged as `[reserve] Bible <METHOD> <path> failed: phase=… error=… elapsed=…ms`,
and calls slower than 1 s are logged as `slow`. A call that never got an
answer from the Bible doesn't count toward the guest's rate limit.

Tests: `npm run test:reserve`.
