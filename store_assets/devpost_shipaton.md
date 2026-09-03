# ⚡ Devpost 제출 폼에 그대로 붙여넣기 (2026-09-04 최종본)

> 상태: 해커톤 **참가 등록 완료**("Thanks for registering!"). 남은 것 = 프로젝트 생성 + 아래 값 입력.
> 제출 URL: https://devpost.com/submit-to/29969-revenuecat-shipaton-2026/manage/submissions
> 마감: **2026-10-01 오전 3:45 (한국시간)** — 27일 남음

## Project name
PawPaw Arena — Cute Animal .io Shooter

## Elevator pitch (≤200자)
Cats, dogs and pigs brawl in a tiny real-time arena. Grow, climb the board, and unlock premium animals — powered by RevenueCat.

## Built with (태그)
javascript, html5, canvas, node.js, websocket, android, java, webview, revenuecat, google-play, render, github-actions

## Try it out 링크
- https://play.google.com/store/apps/details?id=com.petaflo.pawpawarena
- https://kevin9327.github.io/pawpaw-arena/
- https://github.com/kevin9327/pawpaw-arena

## 업로드 파일
- 아이콘 1024×1024: `store_assets/icon_1024.png`
- 스크린샷 1179×2556: `store_assets/shipaton_1_menu.png`, `shipaton_2_game.png`, `shipaton_3_game.png`
- 데모 영상(73초): `store_assets/video/pawpaw_demo_final_1080x1920.mp4` → YouTube 공개 업로드 후 링크 입력

## 카테고리 선택
Best Game Award / Design Award / (자동) Grand Prize

## 심사관 테스트 안내 (프로모션 코드 대신 쓸 문구)
The game is free with no ads or sign-up — all core gameplay, online multiplayer and three animals
(cat, dog, pig) are fully playable without any purchase. The single in-app product unlocks three
extra animals that are side-grades, not power-ups, so judging does not require a purchase.
A promo code can be provided on request.

---

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
- [~] Demo video < 2 min — final cut built by `store_assets/video/make_demo.py` (YouTube upload: 대표님 계정)
- [ ] Promo code(s) for `premium_animals`
- [~] Play listing in English saved; publish blocked by Play 'Account details' (Korean law) gate — also blocks AAB v1.1.0 upload (API validate: 'To comply with Korean law…')
