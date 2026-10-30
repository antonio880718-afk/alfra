package com.clinica.alfra;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onResume() {
        super.onResume();
        try {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                this.bridge.getWebView().clearCache(true);
                this.bridge.getWebView().clearFormData();
                this.bridge.getWebView().clearHistory();
            }
        } catch (Exception e) {
            // Ignorar errores silentes si el puente aún no está listo
        }
    }
}
