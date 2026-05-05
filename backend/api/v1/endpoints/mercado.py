import re as _re
import logging
import requests
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from api.deps import get_current_active_user

router = APIRouter()
logger = logging.getLogger("mercado")

# --- Cache en memoria del precio del cacao ---
_cacao_cache: dict = {
    "data":           None,   # dict con los valores calculados
    "last_fetch_8":   None,   # date del último refresh de las 8:00
    "last_fetch_14":  None,   # date del último refresh de las 14:00
}

def _cacao_needs_refresh() -> bool:
    """True si el cache está vacío o si ya pasó la ventana de las 8:00/14:00 sin actualizar."""
    from zoneinfo import ZoneInfo
    bogota = ZoneInfo("America/Bogota")
    ahora  = datetime.now(bogota)
    hoy    = ahora.date()
    hora   = ahora.hour

    if _cacao_cache["data"] is None:
        return True
    if hora >= 8  and _cacao_cache["last_fetch_8"]  != hoy:
        return True
    if hora >= 14 and _cacao_cache["last_fetch_14"] != hoy:
        return True
    return False

def _fetch_precio_cacao_raw():
    _headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept": "application/json, text/html, */*",
        "Accept-Language": "es-CO,es;q=0.9,en;q=0.8",
    }

    cacao_usd_ton = None

    def _contrato_vigente_yahoo() -> list[str]:
        from zoneinfo import ZoneInfo
        ahora = datetime.now(ZoneInfo("America/New_York"))
        anio  = ahora.year
        mes   = ahora.month
        meses_ice = [(3, 'H'), (5, 'K'), (7, 'N'), (9, 'U'), (12, 'Z')]
        tickers = []
        for (m, cod) in meses_ice:
            if m >= mes:
                tickers.append(f"CC{cod}{str(anio)[2:]}=F")
            else:
                tickers.append(f"CC{cod}{str(anio + 1)[2:]}=F")
        return tickers[:2] + ["CC=F"]

    tickers = _contrato_vigente_yahoo()
    for ticker in tickers:
        if cacao_usd_ton:
            break
        encoded = ticker.replace("=", "%3D")
        for yf_host in ("query1", "query2"):
            try:
                url = f"https://{yf_host}.finance.yahoo.com/v8/finance/chart/{encoded}?interval=1d&range=2d"
                r = requests.get(url, headers=_headers, timeout=10)
                if r.status_code == 200:
                    meta = r.json()["chart"]["result"][0]["meta"]
                    raw = meta.get("previousClose") or meta.get("regularMarketPrice")
                    if raw:
                        val = float(raw)
                        if 500 < val < 20000:
                            cacao_usd_ton = val
                            break
            except Exception:
                pass

    if not cacao_usd_ton:
        try:
            r = requests.get("https://stooq.com/q/l/?s=cc.f&f=sd2t2ohlcv&h&e=csv", headers=_headers, timeout=10)
            if r.status_code == 200:
                lines = [l.strip() for l in r.text.strip().split('\n') if l.strip()]
                if len(lines) >= 2:
                    cols = lines[1].split(',')
                    if len(cols) > 6:
                        val = float(cols[6])
                        if 500 < val < 20000:
                            cacao_usd_ton = val
        except Exception:
            pass

    trm_cop = None
    try:
        from zoneinfo import ZoneInfo
        hoy_col = datetime.now(ZoneInfo("America/Bogota")).strftime("%Y-%m-%d")
        url_gov = f"https://www.datos.gov.co/resource/32sa-8pi3.json?vigenciadesde={hoy_col}"
        r = requests.get(url_gov, headers={**_headers, "Accept": "application/json"}, timeout=10)
        if r.status_code == 200:
            datos = r.json()
            if datos:
                val = float(datos[0].get("valor", 0))
                if 2000 < val < 8000:
                    trm_cop = val
    except Exception:
        pass

    if not trm_cop:
        try:
            url_gov2 = "https://www.datos.gov.co/resource/32sa-8pi3.json?$limit=1&$order=vigenciadesde+DESC"
            r = requests.get(url_gov2, headers={**_headers, "Accept": "application/json"}, timeout=10)
            if r.status_code == 200:
                datos = r.json()
                if datos:
                    val = float(datos[0].get("valor", 0))
                    if 2000 < val < 8000:
                        trm_cop = val
        except Exception:
            pass

    if not trm_cop:
        try:
            r = requests.get("https://dolar.wilkinsonpc.com.co/", headers=_headers, timeout=10)
            if r.status_code == 200:
                m = _re.search(r'TRM[^$\d]{0,60}\$([\d]{1,2}[,\.][\d]{3}[,\.][\d]{2})', r.text, _re.DOTALL | _re.IGNORECASE)
                if m:
                    clean = m.group(1)
                    if ',' in clean and '.' in clean:
                        if clean.index(',') < clean.index('.'): clean = clean.replace(',', '')
                        else: clean = clean.replace('.', '').replace(',', '.')
                    elif ',' in clean: clean = clean.replace(',', '.')
                    val = float(clean)
                    if 2000 < val < 8000:
                        trm_cop = val
        except Exception:
            pass

    if not trm_cop:
        try:
            hoy_str = datetime.now().strftime("%Y-%m-%d")
            r = requests.get(f"https://www.banrep.gov.co/es/estadisticas/trm?fecha={hoy_str}&format=json", headers=_headers, timeout=8)
            if r.status_code == 200:
                m = _re.search(r'"valor"\s*:\s*([\d\.]+)', r.text)
                if not m: m = _re.search(r'(3[\.,]\d{3}[\.,]\d{2})', r.text)
                if m:
                    val = float(m.group(1).replace(',', ''))
                    if 2000 < val < 8000:
                        trm_cop = val
        except Exception:
            pass

    return cacao_usd_ton, trm_cop

@router.get("/precio-cacao")
def precio_cacao_fedecacao(
    current_user: models.User = Depends(get_current_active_user),
):
    from zoneinfo import ZoneInfo
    bogota = ZoneInfo("America/Bogota")
    ahora  = datetime.now(bogota)
    hoy    = ahora.date()
    hora   = ahora.hour

    if _cacao_needs_refresh():
        try:
            cacao_usd_ton, trm_cop = _fetch_precio_cacao_raw()
            if cacao_usd_ton and trm_cop:
                precio_cop_kg = round((cacao_usd_ton * trm_cop) / 1000, 0)
                prev = (_cacao_cache["data"] or {}).get("precio_cop_kg")
                if prev:
                    variacion_pct = round(((precio_cop_kg - prev) / prev) * 100, 2)
                    tendencia = "alza" if precio_cop_kg > prev else "baja" if precio_cop_kg < prev else "estable"
                else:
                    variacion_pct = 0.0
                    tendencia     = "estable"

                _cacao_cache["data"] = {
                    "precio_cop_kg":      precio_cop_kg,
                    "precio_usd_ton":     round(cacao_usd_ton, 2),
                    "trm_cop":            round(trm_cop, 2),
                    "tendencia":          tendencia,
                    "variacion_pct":      variacion_pct,
                    "ultima_actualizacion": ahora.strftime("%Y-%m-%dT%H:%M:%S"),
                    "fecha_precio":       ahora.strftime("%d/%m/%Y"),
                    "fuente_cacao":       "ICE Cocoa Futures (CC=F) via Yahoo Finance",
                    "fuente_trm":         "dolar.wilkinsonpc.com.co",
                    "referencia":         "https://www.fepcacao.com.co/",
                }
                if hora >= 14:
                    _cacao_cache["last_fetch_14"] = hoy
                    _cacao_cache["last_fetch_8"]  = hoy
                elif hora >= 8:
                    _cacao_cache["last_fetch_8"]  = hoy
        except Exception:
            pass

    if _cacao_cache["data"]:
        return _cacao_cache["data"]

    raise HTTPException(
        status_code=503,
        detail="El servicio de precio de cacao no está disponible en este momento."
    )
