package com.petaflo.pawpawarena;

import android.app.Activity;
import android.util.Log;
import android.widget.Toast;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;

import java.util.Collections;
import java.util.List;

/**
 * Play Billing 7.x 래퍼.
 * premium_animals(INAPP, 비소모성) 상품의 구매/복원/확인(acknowledge)을 관리한다.
 *
 * 상품 미등록이거나 빌링이 unavailable(에뮬레이터, 결제 프로필 미생성 등)한 상황에서도
 * 절대 크래시하지 않고 isPremium()=false 상태를 유지한다 — 로그만 남긴다.
 */
class BillingManager implements PurchasesUpdatedListener {

    private static final String TAG = "BillingManager";
    static final String PRODUCT_ID = "premium_animals";

    interface Listener {
        void onPremiumUnlocked();
    }

    private final Activity activity;
    private final BillingClient billingClient;
    private final Listener listener;

    private volatile boolean billingReady = false;
    private volatile boolean premiumUnlocked = false;
    private volatile ProductDetails cachedProductDetails = null;

    BillingManager(Activity activity, Listener listener) {
        this.activity = activity;
        this.listener = listener;
        this.billingClient = BillingClient.newBuilder(activity)
                .setListener(this)
                .enablePendingPurchases(
                        PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .build();
    }

    void startConnection() {
        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult billingResult) {
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    billingReady = true;
                    queryProductDetails();
                    restorePurchases();
                } else {
                    Log.w(TAG, "빌링 설정 실패: " + billingResult.getResponseCode()
                            + " " + billingResult.getDebugMessage());
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                billingReady = false;
                Log.w(TAG, "빌링 서비스 연결이 끊어짐");
            }
        });
    }

    private void queryProductDetails() {
        QueryProductDetailsParams.Product product = QueryProductDetailsParams.Product.newBuilder()
                .setProductId(PRODUCT_ID)
                .setProductType(BillingClient.ProductType.INAPP)
                .build();
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(Collections.singletonList(product))
                .build();

        billingClient.queryProductDetailsAsync(params, (billingResult, productDetailsList) -> {
            if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                Log.w(TAG, "상품 조회 실패: " + billingResult.getResponseCode()
                        + " " + billingResult.getDebugMessage());
                return;
            }
            if (productDetailsList == null || productDetailsList.isEmpty()) {
                Log.w(TAG, PRODUCT_ID + " 상품이 조회되지 않음 (Play Console 미등록일 수 있음)");
                return;
            }
            cachedProductDetails = productDetailsList.get(0);
        });
    }

    private void restorePurchases() {
        QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.INAPP)
                .build();
        billingClient.queryPurchasesAsync(params, (billingResult, purchases) -> {
            if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                Log.w(TAG, "구매 내역 복원 실패: " + billingResult.getResponseCode());
                return;
            }
            handlePurchases(purchases);
        });
    }

    boolean isPremium() {
        return premiumUnlocked;
    }

    void buyPremium() {
        if (!billingReady || cachedProductDetails == null) {
            activity.runOnUiThread(() ->
                    Toast.makeText(activity, "잠시 후 다시 시도해주세요", Toast.LENGTH_SHORT).show());
            return;
        }

        BillingFlowParams.ProductDetailsParams productDetailsParams =
                BillingFlowParams.ProductDetailsParams.newBuilder()
                        .setProductDetails(cachedProductDetails)
                        .build();
        BillingFlowParams flowParams = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(Collections.singletonList(productDetailsParams))
                .build();

        activity.runOnUiThread(() -> billingClient.launchBillingFlow(activity, flowParams));
    }

    @Override
    public void onPurchasesUpdated(BillingResult billingResult, List<Purchase> purchases) {
        int code = billingResult.getResponseCode();
        if (code == BillingClient.BillingResponseCode.OK && purchases != null) {
            handlePurchases(purchases);
        } else if (code == BillingClient.BillingResponseCode.USER_CANCELED) {
            Log.i(TAG, "사용자가 구매를 취소함");
        } else {
            Log.w(TAG, "구매 갱신 실패: " + code + " " + billingResult.getDebugMessage());
        }
    }

    private void handlePurchases(List<Purchase> purchases) {
        if (purchases == null) return;
        for (Purchase purchase : purchases) {
            if (!purchase.getProducts().contains(PRODUCT_ID)) continue;
            if (purchase.getPurchaseState() != Purchase.PurchaseState.PURCHASED) continue;

            premiumUnlocked = true;
            if (listener != null) {
                listener.onPremiumUnlocked();
            }

            if (!purchase.isAcknowledged()) {
                AcknowledgePurchaseParams ackParams = AcknowledgePurchaseParams.newBuilder()
                        .setPurchaseToken(purchase.getPurchaseToken())
                        .build();
                billingClient.acknowledgePurchase(ackParams, ackResult -> {
                    if (ackResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                        Log.w(TAG, "구매 확인(acknowledge) 실패: " + ackResult.getResponseCode());
                    }
                });
            }
        }
    }

    void endConnection() {
        if (billingClient.isReady()) {
            billingClient.endConnection();
        }
    }
}
