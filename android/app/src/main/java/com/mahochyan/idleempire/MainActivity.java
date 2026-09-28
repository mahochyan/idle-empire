package com.mahochyan.idleempire;

import android.app.Activity;
import android.content.pm.ApplicationInfo;
import android.graphics.Insets;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;

import androidx.webkit.WebViewAssetLoader;

import java.io.ByteArrayInputStream;

public final class MainActivity extends Activity {
    private static final String LOCAL_HOST = "appassets.androidplatform.net";
    private static final String GAME_URL = "https://" + LOCAL_HOST + "/assets/index.html";

    private WebView webView;
    private TextView loadError;
    private FrameLayout root;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        applySystemBarTheme(false);

        root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(246, 236, 213));
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            root.setOnApplyWindowInsetsListener((view, windowInsets) -> {
                Insets bars = windowInsets.getInsets(WindowInsets.Type.systemBars());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return windowInsets;
            });
        }

        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true);
        }
        webView = new WebView(this);
        // The only bridge action changes local system-bar colors. Remote pages are blocked below.
        webView.addJavascriptInterface(new ThemeBridge(), "IdleEmpireTheme");
        root.addView(webView, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT));

        loadError = new TextView(this);
        loadError.setText("游戏资源加载失败。请重新安装完整的离线包。");
        loadError.setTextColor(Color.rgb(63, 52, 42));
        loadError.setTextSize(16);
        loadError.setGravity(android.view.Gravity.CENTER);
        loadError.setPadding(24, 24, 24, 24);
        loadError.setBackgroundColor(Color.rgb(246, 236, 213));
        loadError.setVisibility(View.GONE);
        root.addView(loadError, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        if (Build.VERSION.SDK_INT >= 26) {
            settings.setSafeBrowsingEnabled(true);
        }

        WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
            .build();
        webView.setWebViewClient(new LocalContentClient(loader));
        webView.setWebChromeClient(new WebChromeClient());

        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) {
            webView.loadUrl(GAME_URL);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        ((FrameLayout) webView.getParent()).removeView(webView);
        webView.destroy();
        webView = null;
        super.onDestroy();
    }

    private void showLoadError() {
        runOnUiThread(() -> loadError.setVisibility(View.VISIBLE));
    }

    private void applySystemBarTheme(boolean dark) {
        int color = dark ? Color.rgb(23, 35, 43) : Color.rgb(246, 236, 213);
        // Android 15 draws edge-to-edge bars over the decor. Paint their inset
        // space as well as setting legacy bar colors, so white theme chrome
        // never remains behind white status icons in night mode.
        getWindow().getDecorView().setBackgroundColor(color);
        if (root != null) root.setBackgroundColor(color);
        getWindow().setStatusBarColor(color);
        getWindow().setNavigationBarColor(color);
        int flags = dark ? 0 : View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
        if (!dark && Build.VERSION.SDK_INT >= 26) {
            flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        }
        getWindow().getDecorView().setSystemUiVisibility(flags);
        if (Build.VERSION.SDK_INT >= 29) {
            getWindow().setStatusBarContrastEnforced(false);
            getWindow().setNavigationBarContrastEnforced(false);
        }
    }

    private final class ThemeBridge {
        @JavascriptInterface
        public void setDarkMode(boolean dark) {
            runOnUiThread(() -> {
                if (webView != null && GAME_URL.equals(webView.getUrl())) {
                    applySystemBarTheme(dark);
                }
            });
        }
    }

    private static boolean isLocalAsset(Uri uri) {
        return "https".equals(uri.getScheme())
            && LOCAL_HOST.equals(uri.getHost())
            && uri.getPath() != null
            && uri.getPath().startsWith("/assets/");
    }

    private static WebResourceResponse blockedResponse(int status) {
        WebResourceResponse response = new WebResourceResponse(
            "text/plain", "UTF-8", new ByteArrayInputStream(new byte[0]));
        response.setStatusCodeAndReasonPhrase(status, status == 404 ? "Not Found" : "Forbidden");
        return response;
    }

    private final class LocalContentClient extends WebViewClient {
        private final WebViewAssetLoader loader;

        LocalContentClient(WebViewAssetLoader loader) {
            this.loader = loader;
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (!isLocalAsset(uri)) {
                return blockedResponse(403);
            }
            WebResourceResponse response = loader.shouldInterceptRequest(uri);
            return response != null ? response : blockedResponse(404);
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return !isLocalAsset(request.getUrl());
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request.isForMainFrame()) {
                showLoadError();
            }
        }

        @Override
        public void onReceivedHttpError(WebView view, WebResourceRequest request,
                                        WebResourceResponse errorResponse) {
            if (request.isForMainFrame()) {
                showLoadError();
            }
        }
    }
}
