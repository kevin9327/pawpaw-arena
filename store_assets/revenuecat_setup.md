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

---
## 진행 결과 (2026-09-04 새벽, 에이전트가 대시보드에서 직접 설정)
- 프로젝트 **PawPaw Arena** (`b1ba66f8`, Games / Native Android) — Pawgram 프로젝트와 분리(엔타이틀먼트 ID 충돌 방지)
- Play 앱 `app53125da79b` (`com.petaflo.pawpawarena`) — 공개 키는 `android/keystore.properties`의 `rcApiKey=` (gitignore)
- 상품 `premium_animals` (`prodfa14ea944a`, Non-consumable) → 엔타이틀먼트 **premium** (`entlfe66702c7a`) 연결 완료
- 오퍼링 **default** (`ofrng7dbfe339dc`) — 패키지 `$rc_lifetime` → Premium Animals
- AAB v1.1.0(versionCode 2, targetSdk **36**) 빌드 완료; Play API 드라이런에서 아티팩트 검사 통과

## 대표님이 마무리할 것 (RevenueCat 대시보드)
1. **이메일 확인** — 상단 배너 "Your email address is not yet confirmed" → 메일의 링크 클릭
2. **서비스 계정 JSON 업로드** — Apps → PawPaw Arena → "Service Account Credentials JSON"에
   C:/Users/swsz9/Downloads/dev-fusion-493007-v1-bd41ccc10833.json 업로드 (자격증명이라 에이전트가 대신 못 함).
   업로드 후 Products의 "Store Status: Could not check"가 정상으로 바뀜. 서비스계정에 Play Console '재무 데이터 보기' 권한 필요.

## 2026-09-05 점검 결과 (Play 한국 3칸과 무관한 항목 전부 처리)
- **Play Console 서비스계정 권한 = 이미 충족**: `play-publisher@dev-fusion-493007-v1`에 계정 권한 「앱 정보 보기(읽기 전용)」·「재무 데이터, 주문, 취소 설문조사 응답 보기」·「주문 및 구독 관리」 전부 체크돼 있음 → RevenueCat 요구사항 충족. **대표님은 JSON 업로드만 하면 됨**(Google 쪽 전파 최대 36시간이라 빨리 올릴수록 좋음).
- **Offering `default` = current 확정**: SDK와 같은 엔드포인트 `GET /v1/subscribers/<id>/offerings`(공개 키, X-Platform: android) 실측 → `current_offering_id=default`, 패키지 `$rc_lifetime → premium_animals`. 대시보드의 "Make Default"가 비활성인 이유는 이미 기본이기 때문(배지는 안 보임).
- RC 대시보드에 남은 것: ① 이메일 확인 ② 서비스계정 JSON 업로드 ③ (선택) Google developer notifications 연결 — JSON 저장 후 "Connect to Google"이 뜨는데, Pub/Sub 권한 문제로 실패하면 무시해도 됨(실시간 환불 반영용, 비소모성 1개엔 영향 미미).
- **Play 내부 테스트 트랙도 한국 게이트에 막힘**(`--track internal --dry-run` → validate 403 동일 메시지) → 3칸 입력 후 `python tools/play_upload.py --track production` 직행.
- Render keep-alive: GitHub 스케줄이 실측 ~3시간 간격으로만 실행돼(잠들어 있었음, 첫 응답 12.5초) **자체 재dispatch 루프**로 교체(commit f53025f). 이후엔 10분 간격 핑이 끊기지 않음.
- 스토어 미국 노출 확인(hl=en&gl=US: Install·In-app purchases 표시; 제목은 en-US 등록정보 게시 전까지 한국어).
