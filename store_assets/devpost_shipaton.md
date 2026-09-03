# RevenueCat Shipaton 2026 — Devpost 제출 초안 (PawPaw Arena)

**Project name:** PawPaw Arena — Cute Animal .io Shooter
**Tagline (≤~120):** Cats, dogs and pigs brawl in a tiny real‑time arena. Grow, win, and unlock premium animals — powered by RevenueCat.

**Categories to enter:** Best Game Award ($20k) · #BuildInPublic (if posting progress) · Design Award (pastel art) · Grand Prize (auto)
**Store URL:** https://play.google.com/store/apps/details?id=com.petaflo.pawpawarena
**Web demo:** https://kevin9327.github.io/pawpaw-arena/  ·  Source: https://github.com/kevin9327/pawpaw-arena
**First public release:** 2026‑09‑03 (Google Play, production) — inside the submission window.

## Inspiration
.io games are the purest "one more round" loop — but most are grim tanks and snakes. We wanted the same instant, skill‑based arena feel with characters you actually want to be: a squishy cat, a tanky pig, a glass‑cannon rabbit. Cute on the outside, real dodge‑and‑aim on the inside.

## What it does
- Instant real‑time multiplayer arena (WebSocket, 30 Hz simulation, 20 Hz snapshots) — no sign‑up, no tutorial, tap Fight!
- Eat snacks → level up → choose Damage / Fire rate / Speed / Max HP. Take down rivals, climb the top‑10 board, respawn in 3 s.
- Rooms of 12 filled with bots so the arena is always alive; up to 20 rooms.
- Works offline: if the server is unreachable you play smart bots immediately and get a one‑tap "Join online room" when it's back.
- Three free animals (🐱🐶🐷) and a one‑time **Premium Animals** unlock (🐰🦆🦊) — a permanent, non‑consumable purchase.
- Korean/English UI, mobile touch controls (left stick + right aim/fire), old‑WebView compatible.

## How we built it
- Shared ES‑module simulation (`shared/`) runs identically on the Node server and in the browser (deterministic bots, interpolation, fixed‑timestep).
- Android app is a thin WebView (WebViewAssetLoader) around the same game with a tiny JS↔Java bridge (`PawBridge`).
- **RevenueCat**: the Android `BillingManager` is built on the RevenueCat Purchases SDK (10.15.1). One product (`premium_animals`) maps to one entitlement (`premium`). Unlock state is *only* derived from `customerInfo.entitlements["premium"].isActive` — so restores, reinstalls and device changes just work, and the game never trusts local state.
- Server: Render free tier kept warm by a 10‑minute GitHub Actions ping; bandwidth trimmed by sending pellets at 5 Hz as deltas.

## Challenges
- Old Android WebViews (Chrome 53) choke on `?.`/`??` and CSS `inset`/`gap` — we ship a compatible build.
- ES modules can't load from `file://` in WebView → WebViewAssetLoader over `https://appassets.androidplatform.net`.
- A single malformed WebSocket message used to kill the whole server; inputs are now sanitized and dispatch is fenced.
- Free‑tier cold starts made first impressions "bot mode" — solved with a keep‑alive and a graceful offline→online handoff.

## Accomplishments
- Shipped to 177 countries within the window; live multiplayer on a $0/month server.
- 19 automated tests covering combat, growth, bots, room isolation, bandwidth and input hardening.

## What's next
- Seasonal skins as further RevenueCat products, weekly leaderboard, friend rooms.

## Monetization note for judges
Free to play; single non‑consumable IAP ($2.39 / ₩3,300). **Promo code for judges:** (to be attached) — or use the free animals; premium ones are cosmetic side‑grades, not pay‑to‑win.

## Assets checklist
- [x] 1024×1024 icon → `store_assets/icon_1024.png`
- [x] 1179×2556 screenshots (no device frame) → `store_assets/shipaton_*.png`
- [ ] Demo video < 2 min (YouTube, public)
- [ ] Promo code(s) for `premium_animals`
- [ ] Play listing in English live (pending account‑details gate)
