package com.tstechstack.ksmart360;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.HashMap;

/**
 * Puente hacia el escáner de códigos de barras integrado del dispositivo Sunmi.
 * Dos formas de uso, ambas expuestas al JS de Ksmart360:
 *
 *  1) scan(): abre la pantalla de escaneo nativa de Sunmi (Intent al módulo
 *     com.sunmi.scanner) y devuelve el código leído. Reemplaza la cámara web
 *     del navegador, que no funciona dentro del WebView.
 *
 *  2) Botón físico del V3: cuando el escáner está en modo "broadcast", el
 *     sistema emite un broadcast con el código; aquí lo capturamos con un
 *     BroadcastReceiver y lo reenviamos al JS como evento "scan".
 */
@CapacitorPlugin(name = "SunmiScanner")
public class SunmiScannerPlugin extends Plugin {

    // Acción/clave por defecto del broadcast del escáner Sunmi (modo broadcast).
    private static final String ACTION_SCAN = "com.sunmi.scanner.ACTION_DATA_CODE_RECEIVED";
    private static final String EXTRA_DATA = "data";

    private BroadcastReceiver scanReceiver;

    @Override
    public void load() {
        scanReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String code = intent.getStringExtra(EXTRA_DATA);
                if (code != null && !code.trim().isEmpty()) {
                    JSObject data = new JSObject();
                    data.put("value", code.trim());
                    notifyListeners("scan", data);
                }
            }
        };
        IntentFilter filter = new IntentFilter(ACTION_SCAN);
        try {
            if (Build.VERSION.SDK_INT >= 33) {
                getContext().registerReceiver(scanReceiver, filter, Context.RECEIVER_EXPORTED);
            } else {
                getContext().registerReceiver(scanReceiver, filter);
            }
        } catch (Exception e) {
            // Dispositivo sin el broadcast del escáner: el botón físico no
            // notificará, pero el resto de la app sigue funcionando.
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (scanReceiver != null) {
            try { getContext().unregisterReceiver(scanReceiver); } catch (Exception ignored) {}
        }
    }

    /** True si el dispositivo tiene el módulo de escaneo de Sunmi instalado. */
    @PluginMethod
    public void isAvailable(PluginCall call) {
        boolean has = packageExists("com.sunmi.scanner")
                || packageExists("com.sunmi.sunmiqrcodescanner");
        JSObject ret = new JSObject();
        ret.put("available", has);
        call.resolve(ret);
    }

    private boolean packageExists(String pkg) {
        try {
            getContext().getPackageManager().getPackageInfo(pkg, 0);
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }

    /** Abre la pantalla de escaneo nativa de Sunmi y devuelve el código leído. */
    @PluginMethod
    public void scan(PluginCall call) {
        try {
            Intent intent = new Intent("com.sunmi.scanner.qrscanner");
            if (getContext().getPackageManager().resolveActivity(intent, 0) == null) {
                // Compatibilidad con versiones antiguas del escáner (SunmiScanner v1.x)
                intent = new Intent("com.summi.scan");
            }
            intent.putExtra("PLAY_SOUND", true);
            intent.putExtra("PLAY_VIBRATE", false);
            intent.putExtra("IS_SHOW_SETTING", false);
            intent.putExtra("IS_SHOW_ALBUM", false);
            startActivityForResult(call, intent, "scanResult");
        } catch (Exception e) {
            call.reject("No se pudo abrir el escáner Sunmi: " + e.getMessage());
        }
    }

    @ActivityCallback
    private void scanResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        String value = "";
        try {
            Intent data = result.getData();
            if (data != null && data.getExtras() != null) {
                Bundle bundle = data.getExtras();
                @SuppressWarnings("unchecked")
                ArrayList<HashMap<String, Object>> list =
                        (ArrayList<HashMap<String, Object>>) bundle.getSerializable("data");
                if (list != null && !list.isEmpty()) {
                    Object v = list.get(0).get("VALUE");
                    if (v != null) value = v.toString();
                }
            }
        } catch (Exception e) {
            // Si el formato del resultado cambió, devolvemos vacío en vez de reventar.
        }
        JSObject ret = new JSObject();
        ret.put("value", value);
        call.resolve(ret);
    }
}
