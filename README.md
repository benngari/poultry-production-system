# Poultry Production System

A web app for a small layers + roosters poultry farm to mix and cost their
own feed, track egg collection/sales, deduct feed stock automatically from
live flock size, and track bird sales — modeled on a sibling Dairy
Production System's architecture, auth, and UI patterns.

## Stack

- **Frontend:** React 18 + Vite, Tailwind CSS, React Router v6, Axios,
  react-hot-toast, Recharts — in `client/`
- **Backend:** Node.js + Express, MongoDB via Mongoose, JWT + bcryptjs,
  node-cron — in `server/`

## Local setup

```bash
# server
cd server
cp .env.example .env   # fill in MONGO_URI and JWT_SECRET
npm install
npm run seed            # seeds the 10 reference feed ingredients
npm run dev              # http://localhost:5000

# client (new terminal)
cd client
cp .env.example .env    # VITE_API_URL=http://localhost:5000/api
npm install
npm run dev              # http://localhost:5173
```

The **first account you register becomes Administrator automatically and
is auto-approved.** Every account after that starts `isActive: false` and
needs approval from User Management before it can log in.

## Deployment (same pattern as the sibling dairy project)

- **Frontend → Vercel.** Root Directory: `client`. `client/vercel.json`
  already has the SPA rewrite rule. Set `VITE_API_URL` to
  `<your-render-url>/api` in Vercel's env vars.
- **Backend → Render (free tier).** Root Directory: `server`. Set
  `MONGO_URI`, `JWT_SECRET`, `NODE_ENV=production` in Render's env vars.
  **The free tier spins down after ~15 min idle — the first request after
  that can take 50s+ to respond. This is expected, not a bug.**
- **Database → MongoDB Atlas.** Create a free cluster, add a database
  user, whitelist `0.0.0.0/0` (or Render's IPs), and use that connection
  string as `MONGO_URI`.

If a deploy seems to silently not include your latest changes, check
Render's **Events tab** first — the free tier keeps serving the last
*successful* deploy if a new one fails to boot, which looks identical to
"my feature doesn't exist" but is actually a crashed boot on an unrelated
file.

## What's implemented

- Approval-gated registration, JWT auth, 4 roles (Administrator, Manager,
  Flock Operator, Store Keeper) enforced via `authorize(...roles)` per
  route — see the permission matrix in the project brief, §2.
- Rate limiting on `/auth/login` (6/15min) and `/auth/register` (5/hr),
  actually wired into the route file, with Audit Log entries on block.
- `FeedIngredient` CRUD + stock adjustments + soft-delete/Trash.
- `FeedBatch` recording with a live-computed cost-per-kg (never hardcoded
  to the reference 49.84 figure), a full stock-sufficiency pre-check
  across every ingredient before any deduction commits, and
  Administrator-only hard delete that restores ingredient stock.
- `Flock` singleton with live layer/rooster/chick counts, manual
  adjustments (hatched/purchased/died/culled), and automatic count
  deduction on bird sales.
- Automatic daily feed deduction via `node-cron` (00:05 daily), guarded
  against double-running on restart via `FeedStock.lastAutoDeductionDate`,
  plus a manual feeding-log form. Both block on insufficient stock rather
  than allowing it to go negative.
- `EggLog` (collection) and `DailyEggStock` (opening/added/closing/sold
  reconciliation, auto-created per date, carry-forward opening stock,
  today's row re-syncs to the current egg price on every load).
- `BirdSale` recording that decrements the matching `Flock` count.
- Dashboard mirroring the sibling dairy project's exact layout: 5 today
  cards, 6 all-time cards, a Weekly/2-Weeks/Last-30-Days toggle chart
  (Feed Consumed vs Eggs Collected), and a Low Stock Alerts panel.
- `Settings` singleton with a `currency` field that's actually wired into
  every price display, not left cosmetic.
- Append-only `AuditLog`, written via a shared `logAction()` helper that's
  always awaited **before** any `return` — the exact bug class the sibling
  project shipped with once already.
- `Reports` page with CSV export across egg collection / feed batches /
  bird sales.
- `Users`, `AuditLog`, and `Trash` pages, Administrator-only.

## Known traps this build deliberately avoids (see brief §8)

1. Stock-sufficiency checked before deducting, for every ingredient,
   before saving anything.
2. Feed batch creation pre-checks every deduction before committing any
   of them, so a bad line can't leave partial stock deducted with no
   saved record.
3. Nothing is hardcoded that could reasonably change — flock size, feed
   ingredients, egg price, labour cost, and hours-per-shift all live in
   `Settings` / `Flock` / `FeedIngredient`.
4. The rate limiter is imported and applied in `authRoutes.js`, not just
   written and forgotten.
5. `logAction()` is called and awaited before every `res.json()`/`return`
   in the batch-creation route — test this manually once by creating a
   batch and checking the Audit Log page shows it.
6. `Settings.currency` is read on the frontend everywhere a price
   displays, not hardcoded `"KSh"` as literal text.

## Suggested build order

Auth end-to-end first → `FeedIngredient` + `FeedBatch` (the cost model is
the core of the app) → `Flock` + `BirdSale` → `EggLog` + `DailyEggStock` →
the cron job → the Dashboard last, once every number it displays actually
exists somewhere to query.
