# 멍냥아레나 v1.1 — 모바일·IAP·Play 출시 스펙

날짜: 2026-08-30 · 사용자 지시: "APK에 결제(캐릭터 잠금해제) 넣어서 출시까지"

## 범위

1. **터치 조작**: 왼쪽 가상 조이스틱(이동) + 오른쪽 터치 드래그(조준, 누르는 동안 발사).
   포인터 이벤트 기반, 터치 기기에서 자동 활성화. 데스크톱 WASD+마우스는 그대로.
2. **프리미엄 동물 3종** (비소모성 IAP `premium_animals` 하나로 일괄 해제):
   | | 속도 | HP | 탄 | 데미지 | 연사 | 탄속 |
   |---|---|---|---|---|---|---|
   | 🐰 토끼 rabbit | 240 | 70 | 당근(주황 캡슐) | 7 | 6 | 520 |
   | 🦆 오리 duck | 200 | 95 | 빵조각(노랑 사각) | 12 | 3.5 | 450 |
   | 🦊 여우 fox | 205 | 90 | 불꽃(빨강 물방울) | 16 | 2.5 | 480 |
   사이드그레이드 밸런스(페이투윈 아님). 봇도 프리미엄 동물을 랜덤 사용(노출→구매욕).
3. **해제 아키텍처**:
   - `client/js/shop.js`: `isPremiumUnlocked()` = localStorage `pawpaw_premium`==='1' 또는
     `window.PawBridge?.isPremium?.()===true`. `requestPurchase()` = Android면
     `PawBridge.buyPremium()` 호출, 웹이면 "모바일 앱에서 해제 가능" 안내 모달.
   - Android→JS 콜백: 구매/복원 성공 시 `window.onPremiumUnlocked()` → localStorage 기록+메뉴 갱신.
   - 메뉴: 잠긴 카드에 🔒 오버레이, 탭하면 구매 플로우. 서버는 동물 키만 검증(해제 강제는
     클라 측 — v1 한계로 명시).
4. **Android 앱** (`android/` 디렉토리, 저장소 내):
   - WebView 앱, **게임 자산을 APK assets로 번들**(오프라인 봇 모드 완전 동작; TWA/씬래퍼 아님).
     빌드 시 index.html·client/·shared/를 assets로 복사(gradle task).
   - Play Billing Library 7.x: `premium_animals` 비소모성, JS 브리지(`PawBridge`), 앱 시작 시
     구매 복원. 상품 미등록/빌링 불가 시 우아한 실패(안내 토스트) — 결제 프로필 생성 전에도
     앱은 정상 동작.
   - applicationId `com.petaflo.pawpawarena`, minSdk 24, targetSdk 35, versionName 1.0.0.
   - 서명: 신규 keystore 생성(`android/keystore/` + 기존 백업 규약대로 보관).
5. **스토어 자산**: 아이콘 512, 피처그래픽 1024×500, 폰 스크린샷 2~8장(모바일 에뮬레이션 캡처).
6. **Play Console**: petaflo 계정에 앱 생성 → 앱 콘텐츠 선언(데이터 수집 없음 — 닉네임은
   비저장 휘발) → AAB 업로드 → 출시. 인앱 상품 등록은 결제 프로필 생성 후(사용자 액션) 활성화.

## 제외

리워드 광고(AdMob 사망), 서버측 구매 검증 백엔드, 계정/클라우드 저장, iOS.
