# Morning handoff — read this first

## ⛔ THE ONE BLOCKER: production is not deploying

Everything I built this session is **committed and pushed to `main`**, but **it is NOT on production** (`www.fieldquo.com`). Production is serving a 2-day-old build.

**Why:** a normal `git push` to `main` is not triggering a Vercel deploy (auto-deploy is off or the GitHub link is broken). I created a Deploy Hook and triggered it **twice** — both builds ran but **never reached `www`** (I verified: a route that only exists in the new code still 404s on production after 15–20 min each).

**What I ruled out (code is clean):**
- Local `npm run build` — the exact Vercel command (`check-imports && check-env-docs && prisma generate && next build`) — passes.
- Case-sensitive imports (the classic "works on Mac, fails on Linux"): audited all 1346 `@/` imports — 0 problems.
- `package-lock.json` in sync, no dependency changes, no missing deps.
- `prisma generate` works without a DB connection. The DB is already migrated (`prisma db push` ran clean).

**So the failure is Vercel-side and needs the dashboard (I have no Vercel token):**
1. Open **Vercel → fieldquo → Deployments**. Find the newest deployment (from the Deploy Hook, branch `main`).
   - **If it says Error/Failed** → open it, copy the red build log, send it to me — I'll fix it.
   - **If it says Ready but `www` is still old** → it built but wasn't promoted. Click **⋯ → Promote to Production** (or check the domain is assigned to it). Also check **Settings → Domains** that `www.fieldquo.com` isn't pinned to an old deployment.
2. **Fix auto-deploy for the future:** Settings → Git → confirm Production Branch = `main`, and there's no "Ignored Build Step" command silently skipping builds. Note: the `git-main-*.vercel.app` alias returns a 302 (Vercel **Deployment Protection** / auth wall is ON) — fine for previews, but make sure it isn't interfering with the production domain.

Once one deploy lands, **everything below goes live at once.**

## ✅ What's done this session (committed + pushed, waiting on the deploy)

- **Junk removal** — full volume-priced service + self-serve instant quote + item picker + rate card + starter FAQ/guide.
- **Trade calculators** — Countertop, Flooring, Painting, Stair, all as company-editable instant-quote trades.
- **Photo + video upload** on every quote/self-quote (stored, viewable, referenced).
- **App i18n** — ~71 of ~86 `/app` screens wired to `t()` in **6 languages** (en, fr, es, uk, pa, tl). 1600+ keys, full parity, build-verified. The final ~10 screens were in progress when this was written.
- **Glassy admin nav** — translucent/blurred mobile top bars, polished drawers, drawer width clamped so it never eats the screen; `settings/services` mobile overflow fixed.

## ⚠️ Needs YOUR review before it's "live" in those languages

- **es / uk / pa / tl are complete but held** behind `APP_REVIEW_PENDING` (in `app/i18n/appMessages.js`). They render but are labelled "needs review." **Only English and French are offered as finished.**
- **Punjabi (pa) and Tagalog (tl) especially need a native speaker** on the money screens (payroll, invoices, quotes) before you clear them from `APP_REVIEW_PENDING`. Spanish/Ukrainian need a lighter check.
- To enable a language once reviewed: delete its code from the `APP_REVIEW_PENDING` set.

## Language switch — it works

Setting French on `/app/settings/language` auto-saves (no button) and applies live. If a page doesn't change, it's one of the ~15 not-yet-wired screens (or the deploy hasn't landed) — not a broken switch.
