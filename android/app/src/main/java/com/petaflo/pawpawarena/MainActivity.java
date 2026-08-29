package com.petaflo.pawpawarena;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewAssetLoader.AssetsPathHandler;

/**
 * 게임 자산(assets/game/index.html)을 WebView로 로드하고 PawBridge를 등록한다.
 *
 * ES 모듈(<script type="module">)의 정적 import는 Chromium WebView에서 file://
 * 스킴으로는 CORS 제약 때문에 로드되지 않는다. 이를 우회하기 위해 WebViewAssetLoader로
 * assets/를 가상 https 오리진(appassets.androidplatform.net)에 매핑해서 서빙한다.
 *
 * 온라인 서버가 없거나 타임아웃되면 client/js/config.js + offline.js가 알아서
 * 봇 모드로 폴백하므로(브리프 참조) 별도 처리가 필요 없다.
 */
public class MainActivity extends Activity implements BillingManager.Listener {

    private static final String TAG = "PawWeb";
    private static final String ASSET_LOADER_DOMAIN = "appassets.androidplatform.net";
    private static final String GAME_URL = "https://" + ASSET_LOADER_DOMAIN + "/assets/game/index.html";

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

        WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new AssetsPathHandler(this))
                .build();

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(
                    WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (ASSET_LOADER_DOMAIN.equals(url.getHost())) {
                    // 가상 오리진 내부 탐색은 그대로 허용한다.
                    return false;
                }
                // 오늘 기준 외부 링크는 없다 — 오리진을 벗어나는 탐색은 브리지 노출을
                // 제한하기 위해 앱 내부에서 처리하지 않고 차단(외부로 위임)한다.
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, url));
                } catch (Exception e) {
                    Log.w(TAG, "외부 링크를 열 수 없음: " + url, e);
                }
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                Log.d(TAG, consoleMessage.message()
                        + " -- " + consoleMessage.sourceId()
                        + ":" + consoleMessage.lineNumber());
                return true;
            }
        });

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
