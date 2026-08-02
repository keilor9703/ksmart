package com.tstechstack.ksmart360;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Los plugins locales (no de npm) deben registrarse explícitamente antes
        // de super.onCreate para que el puente de Capacitor los exponga al JS.
        registerPlugin(SunmiPrinterPlugin.class);
        registerPlugin(SunmiScannerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
