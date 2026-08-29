package com.petaflo.pawpawarena;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * 게임 자산(assets/game/index.html)을 WebView로 로드하고 PawBridge를 등록한다.
 * 온라인 서버가 없거나 타임아웃되면 client/js/config.js + offline.js가 알아서
 * 봇 모드로 폴백하므로(브리프 참조) 별도 처리가 필요 없다.
 */
public class MainActivity extends Activity implements BillingManager.Listener {

    private static final String GAME_URL = "file:///android_asset/game/index.html";

    private WebView webView;
    private BillingManager billingManager;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);

        webView.setWebViewClient(new WebViewClient());

        billingManager = new BillingManager(this, this);
        webView.addJavascriptInterface(new PawBridge(billingManager), "PawBridge");

        webView.loadUrl(GAME_URL);

        billingManager.startConnection();
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    public void onPremiumUnlocked() {
        runOnUiThread(() -> {
            if (webView != null) {
                webView.evaluateJavascript(
                        "window.onPremiumUnlocked && window.onPremiumUnlocked()", null);
            }
        });
    }

    @Override
    protected void onDestroy() {
        if (billingManager != null) {
            billingManager.endConnection();
        }
        super.onDestroy();
    }
}
