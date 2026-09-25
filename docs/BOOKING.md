# Online booking: which times are offered, and why

The public booking page (`/book/<company>`, the `/embed/<company>/book` widget,
and the Booking block on a company website all render the same
`app/book/[companySlug]/BookingFlow.js`) asks
`/api/booking/<company>/availability` for open times. That route calls
`computeAvailableSlots` in `lib/booking/computeAvailability.js`, which is
also what the visit-reschedule page, the phone receptionist and the AI
employee use. The rule below is written out again as a header comment in
that file; if one changes, change the other.

## How distance to the day's other visits picks the times

1. **Candidate times.** Every 15 minutes inside the person's weekly hours, one
   appointment long (plus the event's own before/after buffers). A time that
   overlaps a confirmed booking, a scheduled appointment (counted as one hour),
   their Google busy time, or a day of approved leave is removed. Distance
   plays no part in this step.
2. **Distance only removes times. It never ranks or prefers them.** There is
   no "cluster my day" logic and no "closest first" ordering. The times left
   are listed in time order, earliest first. A time right next door to another
   visit and a time across town are offered the same way, as long as the
   estimator can get to both.
3. **Only the two neighbours count:** the visit just before the time and the
   visit just after it (either can be on the day before or after). Visits
   further away are not looked at, because the new visit only has to fit
   between those two.
4. **The test runs both ways:**
   - time since the previous visit ends ≥ drive from it + travel buffer
   - time until the next visit starts ≥ drive to it + travel buffer

   The travel buffer is Settings → Booking page → "Extra time between jobs"
   (0 by default). If either leg fails, the time is not offered. There is no
   fixed kilometre cut-off: a 10-minute drive needs a 10-minute gap, and a
   3-hour drive needs 3 hours.
5. **The drive.** Google's driving time (Distance Matrix) from the other
   visit's address to the new one. It is looked up once per distinct address
   per request and used for both directions. If Google can't answer, the
   straight-line distance × 1.35 at 32 km/h (`lib/booking/travel.js`) is used
   instead. That guess is deliberately slow, because offering a time nobody
   can make is worse than losing one.
6. **Nothing known means nothing removed.** No other visit that day, a
   neighbour visit with no coordinates, Google busy time (which has no
   place), an address Google can't find, a phone or video appointment: in all
   of these every free time is offered.
7. **When it runs:** only for an on-site visit, only once the visitor has
   given an address, and only while Settings → Booking page → "Don't offer
   times you can't drive to" is on (it's on by default). The server geocodes
   the typed text, so an address picked from Google's suggestions and one
   typed by hand are treated the same, and the browser's coordinates are
   never trusted. The reschedule page uses the booking's stored point. The
   phone receptionist and the AI employee ask without an address, so their
   times are never filtered by distance.

The **service area** (Settings → service radius / postal prefixes,
`lib/company/serviceArea.js`) is a separate question: does the company go
there at all? It never removes a time. It adds one line under the address
("outside the area we usually cover") and a badge on the booking the company
receives, and the company decides.

## What the visitor sees under the address

| State | Line |
|---|---|
| No address yet | "Needed for an on-site visit, and it lets us hide times we couldn't reach you on schedule." |
| Address sent, answer pending | "Checking which times we can reach this address…". The calendar stays on screen, dimmed, with "Finding times…", and no time can be picked until the new answer is in. |
| Filter applied | "Showing times we can reach <address Google found> on schedule." |
| Google couldn't find it | "We couldn't find that address on the map, so every time is shown. Check it before you book." |
| Check switched off / no server Maps key | "Needed for an on-site visit." The visitor did nothing wrong, so we don't ask them to check it. |
| Outside the service area | An extra line in the visitor's language. Booking still goes through. |

If the address is only given on the last step (after a time was picked from
the unfiltered list) and that address rules the time out, the page says
"That time doesn't work for this address, we couldn't get there on
schedule" with a "Pick another time" link, and Book stays disabled.

## The 2026-09-25 fixes (owner report: "glitches when we enter a new address")

Reproduced on a demo company's booking page in the browser:

- **Stale answers won.** Typing an address, pausing, then picking a
  suggestion sent two queries. If the first (half-typed) one came back
  last, the grid and the note showed times for the wrong house. Now only the
  newest query can write: `requestSeq` in `SlotCalendar`, `slotQuery` in
  `BookingFlow`.
- **The calendar collapsed** to a one-line spinner on every change. On a
  website, where the widget sits mid-page, that made the page jump. Now the
  grid stays in place and is marked busy while it reloads.
- **Step 3's address field vanished on its first keystroke.** It was shown
  only while the address was empty, so typing "1" unmounted it and "1"
  became the visit address. Now it is decided once, when the time is picked.
- **"We couldn't place that address"** was shown to every visitor of a
  company with the travel check switched off, and whenever the server had no
  Maps key. The route now returns a `reason` (`off` / `no_lookup` /
  `not_found`), and only `not_found` asks the visitor to check their address.
- **The last day of every range read no busy time.** The calendar asks
  `to=<last day of the month>`, which arrived as midnight at the start of
  that day, so existing visits on it were invisible. Booked hours were
  offered as free and no drive was checked against them. Busy time is now
  read a day wider on both sides.

Checks: `npm run check:booking-modes` section 8 runs the route and the engine
against these cases, and `npm run check:booking` covers the travel maths.

## Not covered yet

- The confirm route re-checks overlap with other *bookings* only. It does not
  re-run the travel test, and it does not check appointments created in the
  office. A visitor who forces a POST, or books in the few hundred
  milliseconds before a late address is checked, is not stopped by distance.
- Every pause of 700 ms while typing sends one query, which costs one paid
  geocode (and a Distance Matrix lookup per other visit that day). The same
  is true of the service-area check. A half-typed address can resolve to
  somewhere plausible ("350 5th Ave New" → the Empire State Building) until a
  suggestion is picked.
