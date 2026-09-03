# RevenueCat 대시보드 설정 가이드 — 멍냥아레나 (대표님이 계정 만든 뒤, 제가 안내하며 진행)

앱 코드 기준값 (변경 금지):
- 패키지: `com.petaflo.pawpawarena`
- Play 상품 ID: `premium_animals` (일회성·비소모성, ₩3,300)
- RevenueCat 엔타이틀먼트 ID: `premium`  ← BillingManager.ENTITLEMENT_ID
- 잠금 해제 판정 = `customerInfo.entitlements["premium"].isActive` 뿐 (로컬 상태 신뢰 안 함)

## 1. 프로젝트/앱
1. app.revenuecat.com → New Project (이름 자유, 예: petaflo)
2. Apps → **+ New app → Google Play Store**
   - App name: PawPaw Arena / Package: `com.petaflo.pawpawarena`
3. 생성된 앱의 **Public API key (`goog_…`)** → 저에게 전달 → 빌드에 주입

## 2. Play 서비스 계정 자격증명 (RevenueCat이 구매를 서버에서 검증하는 데 필요)
- RevenueCat 앱 설정의 "Service Account credentials JSON"에 업로드
- 이미 있는 서비스계정 `play-publisher@dev-fusion-493007-v1`(Play Publisher API용)을 재사용 가능.
  Play Console → 사용자 및 권한에서 이 서비스계정에 **"재무 데이터 보기"** + **"주문·구독 관리"** 권한이 있어야 함
  (없으면 RevenueCat 대시보드에 "Invalid credentials" 경고). JSON 키 파일은 [[play-publisher-api-setup]] 메모 위치.
- Google Cloud 프로젝트에서 **Google Play Android Developer API** 사용 설정 확인.

## 3. 상품 → 엔타이틀먼트
1. Product catalog → Products → **+ New** → Google Play → 상품 ID `premium_animals` 입력(Play Console과 동일해야 함) → 저장
2. Entitlements → **+ New** → ID `premium` → 이 엔타이틀먼트에 `premium_animals` 상품 연결(Attach)
3. Offerings → Default offering에 Package(예: Lifetime) 추가 → `premium_animals` 연결
   (앱은 getProducts 로 직접 조회하므로 Offering은 선택이지만, 대시보드 지표/실험용으로 만들어 두는 게 좋음)

## 4. 검증 순서
1. 제가 `-PRC_API_KEY=goog_…`로 v1.1.0 AAB 빌드 → Play 업로드 → 검토 제출
2. Play 라이선스 테스터에 대표님 계정 등록(설정 → 라이선스 테스트) → 무과금 테스트 구매
3. RevenueCat Customers 탭에서 해당 구매·`premium` 활성 확인 → 앱에서 🐰🦆🦊 해제 확인
4. 심사관용 프로모션 코드 발급(Play 프로모션 코드 약관 동의 후)
