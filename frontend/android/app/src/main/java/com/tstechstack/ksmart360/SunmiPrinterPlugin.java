package com.tstechstack.ksmart360;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.sunmi.printerx.PrinterSdk;
import com.sunmi.printerx.api.LineApi;
import com.sunmi.printerx.enums.Align;
import com.sunmi.printerx.style.BaseStyle;
import com.sunmi.printerx.style.BitmapStyle;
import com.sunmi.printerx.style.TextStyle;

import org.json.JSONObject;

import java.util.List;

/**
 * Puente entre el JavaScript de Ksmart360 (web dentro de la app Capacitor) y la
 * impresora térmica integrada del dispositivo Sunmi, vía el SDK oficial PrinterX
 * (com.sunmi:printerx). Expone al JS: isAvailable(), printTest() y
 * printReceipt({ lines, cut }).
 *
 * La impresora se obtiene de forma asíncrona (getPrinter) al cargar el plugin;
 * usamos la "impresora por defecto" que en un Sunmi con impresora integrada es
 * justamente la del dispositivo.
 */
@CapacitorPlugin(name = "SunmiPrinter")
public class SunmiPrinterPlugin extends Plugin {

    private PrinterSdk.Printer printer = null;

    @Override
    public void load() {
        try {
            PrinterSdk.getInstance().getPrinter(getContext(), new PrinterSdk.PrinterListen() {
                @Override
                public void onDefPrinter(PrinterSdk.Printer defaultPrinter) {
                    printer = defaultPrinter;
                }

                @Override
                public void onPrinters(List<PrinterSdk.Printer> printers) {
                    // No usamos impresoras externas por ahora — solo la integrada
                    // (impresora por defecto). Si en el futuro se conectan varias,
                    // aquí se podría elegir por id.
                }
            });
        } catch (Exception e) {
            // Dispositivo sin servicio de impresión Sunmi: printer queda null y
            // isAvailable() devolverá false. Nunca reventamos la app por esto.
        }
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", printer != null);
        call.resolve(ret);
    }

    /** Imprime un recibo de prueba fijo, para validar el hardware sin datos reales. */
    @PluginMethod
    public void printTest(PluginCall call) {
        if (printer == null) {
            call.reject("Impresora no disponible (¿es un dispositivo Sunmi con impresora integrada?).");
            return;
        }
        try {
            LineApi line = printer.lineApi();
            line.initLine(BaseStyle.getStyle().setAlign(Align.CENTER));
            line.printText("KSMART360", TextStyle.getStyle().setTextSize(40));
            line.printText("Prueba de impresion", TextStyle.getStyle().setTextSize(24));
            line.initLine(BaseStyle.getStyle().setAlign(Align.LEFT));
            line.printText("--------------------------------", TextStyle.getStyle().setTextSize(24));
            line.printText("Si ves este recibo, la impresora", TextStyle.getStyle().setTextSize(24));
            line.printText("quedo integrada correctamente.", TextStyle.getStyle().setTextSize(24));
            line.printText(" ", TextStyle.getStyle().setTextSize(24));
            line.autoOut();
            call.resolve();
        } catch (Exception e) {
            call.reject("Error al imprimir: " + e.getMessage());
        }
    }

    /**
     * Imprime un recibo estructurado. Espera:
     *   lines: [ { type, text, align, size, bold }, ... ]
     *     type = "text" (por defecto) | "divider" | "feed"
     *     align = "left" | "center" | "right"
     *   cut: boolean (por defecto true) → avanza el papel y corta si hay cortador.
     */
    @PluginMethod
    public void printReceipt(PluginCall call) {
        if (printer == null) {
            call.reject("Impresora no disponible.");
            return;
        }
        JSArray lines = call.getArray("lines");
        boolean cut = call.getBoolean("cut", true);
        try {
            LineApi line = printer.lineApi();
            if (lines != null) {
                for (int i = 0; i < lines.length(); i++) {
                    JSONObject o = lines.getJSONObject(i);
                    String type = o.optString("type", "text");

                    if ("divider".equals(type)) {
                        line.initLine(BaseStyle.getStyle().setAlign(Align.LEFT));
                        line.printText("--------------------------------", TextStyle.getStyle().setTextSize(24));
                        continue;
                    }
                    if ("feed".equals(type)) {
                        line.printText(" ", TextStyle.getStyle().setTextSize(24));
                        continue;
                    }
                    if ("image".equals(type)) {
                        // Logo de la empresa (base64). Aislado en su propio
                        // try: si algo falla con la imagen, no debe tumbar el
                        // resto del recibo.
                        try {
                            String b64 = o.optString("bitmap", "");
                            int comma = b64.indexOf(',');
                            if (comma >= 0) b64 = b64.substring(comma + 1); // quitar "data:image/...;base64,"
                            if (!b64.isEmpty()) {
                                byte[] bytes = Base64.decode(b64, Base64.DEFAULT);
                                Bitmap bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
                                if (bmp != null) {
                                    int maxW = o.optInt("maxWidth", 240); // ~ancho útil 58mm
                                    if (bmp.getWidth() > maxW) {
                                        int h = Math.round(bmp.getHeight() * (maxW / (float) bmp.getWidth()));
                                        bmp = Bitmap.createScaledBitmap(bmp, maxW, Math.max(1, h), true);
                                    }
                                    line.initLine(BaseStyle.getStyle().setAlign(Align.CENTER));
                                    line.printBitmap(bmp, BitmapStyle.getStyle());
                                }
                            }
                        } catch (Exception imgEx) {
                            // Logo opcional: se ignora si no se puede imprimir.
                        }
                        continue;
                    }

                    String text = o.optString("text", "");
                    String align = o.optString("align", "left");
                    int size = o.optInt("size", 24);

                    line.initLine(BaseStyle.getStyle().setAlign(alignOf(align)));
                    line.printText(text.isEmpty() ? " " : text,
                            TextStyle.getStyle().setTextSize(size));
                }
            }
            if (cut) {
                line.autoOut();
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Error al imprimir el recibo: " + e.getMessage());
        }
    }

    private Align alignOf(String a) {
        if ("center".equalsIgnoreCase(a)) return Align.CENTER;
        if ("right".equalsIgnoreCase(a)) return Align.RIGHT;
        return Align.LEFT;
    }
}
