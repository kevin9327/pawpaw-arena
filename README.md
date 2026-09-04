# 🐾 PawPaw Arena — Cute Animal .io Shooter

[![Google Play](https://img.shields.io/badge/Google%20Play-com.petaflo.pawpawarena-34A853?logo=googleplay&logoColor=white)](https://play.google.com/store/apps/details?id=com.petaflo.pawpawarena)
[![Play in browser](https://img.shields.io/badge/Web%20demo-kevin9327.github.io%2Fpawpaw--arena-4E5AE8)](https://kevin9327.github.io/pawpaw-arena/)
[![RevenueCat Shipaton 2026](https://img.shields.io/badge/RevenueCat-Shipaton%202026-F25A5A)](https://devpost.com/software/pawpaw-arena-cute-animal-io-shooter)

Cats, dogs and pigs brawl in a tiny real-time arena. Eat snacks, level up, pick
Damage / Fire rate / Speed / Max HP, climb the top-10 board, respawn in 3 seconds.
No sign-up, no ads, no tutorial — type a nickname and you are playing.

- **Always playable**: rooms are filled with bots; if the server is unreachable the same
  simulation runs locally and quietly switches back online with one tap.
- **Monetization (RevenueCat)**: free game + one non-consumable IAP `premium_animals`
  (rabbit 🐰 / duck 🦆 / fox 🦊 — side-grades, not power-ups). Unlock state comes only
  from the RevenueCat entitlement `premium`, so restores and reinstalls just work.
  See [`android/.../BillingManager.java`](android/app/src/main/java/com/petaflo/pawpawarena/BillingManager.java).
- **Stack**: shared ESM simulation (`shared/`) run by both the Node + ws server (`server/`)
  and the vanilla-JS Canvas client (`client/`); Android is a WebView shell with the
  RevenueCat Purchases SDK. Everything on screen is drawn procedurally — no sprites.
- Demo video: <https://www.youtube.com/watch?v=dxbmaQ9N3PM> · Store assets: [`store_assets/`](store_assets/)

---

# 🐾 멍냥아레나 (PawPaw Arena)

귀여운 동물들이 싸우는 2D .io 아레나 슈터. 접속자끼리 싸우고 빈 자리는 봇이 채웁니다.
서버가 없어도 봇 모드로 즉시 플레이됩니다.

## 조작

- 이동: WASD / 방향키 · 조준·발사: 마우스 · 업그레이드: 클릭 또는 1~3

## 로컬 실행

```
npm install
npm start        # http://localhost:8080
npm test         # 시뮬·봇·서버 테스트
```

## 구조

- `shared/` 시뮬 코어(물리·전투·성장·봇AI) — 서버와 브라우저가 공유
- `server/` Node + ws 권위 서버 (30Hz 틱 / 20Hz 스냅샷)
- `client/` 바닐라 JS + Canvas (빌드 도구 없음)

## 배포

- 클라이언트: GitHub Pages (repo root)
- 서버: Render 무료 웹서비스 (`render.yaml`) — 배포 후 `client/js/config.js`의
  `PROD_WS`를 실제 서비스 주소로 교체
