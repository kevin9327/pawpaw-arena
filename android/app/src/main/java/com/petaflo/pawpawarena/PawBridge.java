package com.petaflo.pawpawarena;

import android.webkit.JavascriptInterface;

/**
 * client/js/shop.js가 기대하는 JS ↔ Android 브리지.
 *
 * window.PawBridge.isPremium() -> boolean
 * window.PawBridge.buyPremium() -> void (구매 플로우 시작)
 *
 * @JavascriptInterface 메서드는 WebView의 별도 바이너리 스레드에서 호출되므로
 * UI 작업(Toast, launchBillingFlow, evaluateJavascript)은 BillingManager /
 * MainActivity에서 항상 runOnUiThread로 넘긴다.
 */
class PawBridge {

    private final BillingManager billingManager;

    PawBridge(BillingManager billingManager) {
        this.billingManager = billingManager;
    }

    @JavascriptInterface
    public boolean isPremium() {
        return billingManager.isPremium();
    }

    @JavascriptInterface
    public void buyPremium() {
        billingManager.buyPremium();
    }
}
