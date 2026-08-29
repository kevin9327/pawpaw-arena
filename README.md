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
