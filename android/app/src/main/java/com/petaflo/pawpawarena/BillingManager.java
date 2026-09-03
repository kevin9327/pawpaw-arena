package com.petaflo.pawpawarena;

import android.app.Activity;
import android.util.Log;
import android.widget.Toast;

import com.revenuecat.purchases.CustomerInfo;
import com.revenuecat.purchases.EntitlementInfo;
import com.revenuecat.purchases.LogLevel;
import com.revenuecat.purchases.ProductType;
import com.revenuecat.purchases.PurchaseParams;
import com.revenuecat.purchases.Purchases;
import com.revenuecat.purchases.PurchasesConfiguration;
import com.revenuecat.purchases.PurchasesError;
import com.revenuecat.purchases.interfaces.GetStoreProductsCallback;
import com.revenuecat.purchases.interfaces.PurchaseCallback;
import com.revenuecat.purchases.interfaces.ReceiveCustomerInfoCallback;
import com.revenuecat.purchases.interfaces.UpdatedCustomerInfoListener;
import com.revenuecat.purchases.models.StoreProduct;
import com.revenuecat.purchases.models.StoreTransaction;

import java.util.Collections;
import java.util.List;
import java.util.Locale;

/**
 * RevenueCat 기반 결제 관리자 (Shipaton 요건: RevenueCat SDK로 인앱결제 1개 이상).
 *
 * 공개 표면은 이전 Play Billing 구현과 동일하게 유지해 MainActivity/PawBridge는 손대지 않는다:
 *   BillingManager(Activity, Listener) / startConnection() / isPremium() / buyPremium() / endConnection()
 *   Listener.onPremiumUnlocked()
 *
 * 매핑: Play 일회성(비소모성) 상품 premium_animals  →  RevenueCat 엔타이틀먼트 "premium".
 * 잠금 해제 판정은 항상 엔타이틀먼트 활성 여부로만 한다(복원·재설치·기기변경 자동 처리).
 * RevenueCat 콜백은 메인 스레드로 오지만, buyPremium()은 WebView 브리지 스레드에서 오므로 runOnUiThread로 넘긴다.
 */
class BillingManager {

    private static final String TAG = "BillingManager";
    static final String PRODUCT_ID = "premium_animals";
    static final String ENTITLEMENT_ID = "premium";

    interface Listener {
        void onPremiumUnlocked();
    }

    private final Activity activity;
    private final Listener listener;

    private volatile boolean configured = false;
    private volatile boolean premiumUnlocked = false;
    private volatile StoreProduct cachedProduct = null;

    BillingManager(Activity activity, Listener listener) {
        this.activity = activity;
        this.listener = listener;
    }

    /** SDK 구성 + 고객정보 동기화(복원) + 상품 선조회. 키가 없으면 결제만 조용히 비활성. */
    void startConnection() {
        if (configured) return;
        String key = BuildConfig.RC_API_KEY;
        if (key == null || key.isEmpty() || key.startsWith("goog_REPLACE")) {
            Log.w(TAG, "RevenueCat API 키 미설정 — 결제 비활성 (RC_API_KEY gradle 속성 확인)");
            return;
        }
        if (BuildConfig.DEBUG) Purchases.setLogLevel(LogLevel.DEBUG);
        Purchases.configure(new PurchasesConfiguration.Builder(activity.getApplicationContext(), key).build());
        configured = true;

        Purchases.getSharedInstance().setUpdatedCustomerInfoListener(new UpdatedCustomerInfoListener() {
            @Override
            public void onReceived(CustomerInfo customerInfo) {
                applyCustomerInfo(customerInfo);
            }
        });
        Purchases.getSharedInstance().getCustomerInfo(new ReceiveCustomerInfoCallback() {
            @Override
            public void onReceived(CustomerInfo customerInfo) {
                applyCustomerInfo(customerInfo);
            }

            @Override
            public void onError(PurchasesError error) {
                Log.w(TAG, "getCustomerInfo 실패: " + error.getMessage());
            }
        });
        fetchProduct(null);
    }

    private void fetchProduct(final Runnable then) {
        Purchases.getSharedInstance().getProducts(
                Collections.singletonList(PRODUCT_ID), ProductType.INAPP,
                new GetStoreProductsCallback() {
                    @Override
                    public void onReceived(List<StoreProduct> storeProducts) {
                        if (!storeProducts.isEmpty()) {
                            cachedProduct = storeProducts.get(0);
                        } else {
                            Log.w(TAG, PRODUCT_ID + " 상품 조회 결과 없음 (RevenueCat 대시보드/Play 등록 확인)");
                        }
                        if (then != null) then.run();
                    }

                    @Override
                    public void onError(PurchasesError error) {
                        Log.w(TAG, "getProducts 실패: " + error.getMessage());
                        if (then != null) then.run();
                    }
                });
    }

    boolean isPremium() {
        return premiumUnlocked;
    }

    /** 브리지 스레드에서 호출됨 → UI 스레드로 이전 후 구매 플로우 시작. */
    void buyPremium() {
        activity.runOnUiThread(() -> {
            if (premiumUnlocked) {
                listener.onPremiumUnlocked();
                return;
            }
            if (!configured) {
                toast(ko() ? "지금은 결제를 사용할 수 없습니다" : "Purchases are unavailable right now");
                return;
            }
            if (cachedProduct == null) {
                fetchProduct(this::launchPurchase);
                return;
            }
            launchPurchase();
        });
    }

    private void launchPurchase() {
        StoreProduct product = cachedProduct;
        if (product == null) {
            toast(ko() ? "상품을 불러오지 못했습니다. 잠시 후 다시 시도하세요." : "Couldn't load the product. Please try again.");
            return;
        }
        Purchases.getSharedInstance().purchase(
                new PurchaseParams.Builder(activity, product).build(),
                new PurchaseCallback() {
                    @Override
                    public void onCompleted(StoreTransaction storeTransaction, CustomerInfo customerInfo) {
                        applyCustomerInfo(customerInfo);
                    }

                    @Override
                    public void onError(PurchasesError error, boolean userCancelled) {
                        if (userCancelled) return;
                        Log.w(TAG, "구매 실패: " + error.getMessage());
                        toast(ko() ? "결제에 실패했습니다" : "Purchase failed");
                    }
                });
    }

    /** 엔타이틀먼트가 활성이면 잠금 해제(최초 1회만 콜백). */
    private void applyCustomerInfo(CustomerInfo info) {
        EntitlementInfo e = info.getEntitlements().get(ENTITLEMENT_ID);
        boolean active = e != null && e.isActive();
        if (!active) return;
        boolean first = !premiumUnlocked;
        premiumUnlocked = true;
        if (first) listener.onPremiumUnlocked();
    }

    private static boolean ko() {
        return "ko".equals(Locale.getDefault().getLanguage());
    }

    private void toast(final String msg) {
        activity.runOnUiThread(() -> Toast.makeText(activity, msg, Toast.LENGTH_SHORT).show());
    }

    /** RevenueCat은 명시적 연결 종료가 없다. 호출 호환용. */
    void endConnection() {
        // no-op
    }
}
