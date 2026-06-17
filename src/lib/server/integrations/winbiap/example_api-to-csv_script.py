#!/usr/bin/env python3
"""
Erzeugt eine AllerLeih-Import-CSV aus dem Patzner-Excel-Export (Ratsbücherei Lüneburg)
durch Anreicherung mit Daten aus der datronic WebOPAC API.

Verwendung:
    python3 patzner_to_allerleih_csv.py 260423BibliothekderDinge.xlsx allerleih_ratsbuecherei.csv

Voraussetzungen:
    pip install pandas openpyxl requests

Die erzeugte CSV kann direkt über /user/import in AllerLeih hochgeladen werden.
Voraussetzung: Der Ratsbücherei-Account hat isInstitution=true (Admin-Toggle in PocketBase).
"""

import sys
import csv
import re
import time
import json
import urllib.parse
import urllib.request
import logging
from pathlib import Path

import pandas as pd

# ---------------------------------------------------------------------------
# Konfiguration
# ---------------------------------------------------------------------------

API_BASE = "https://rblg.stadt.lueneburg.de/webopac/service/cataloguedata.aspx"
COVER_BASE = "https://www2.winbiap.de/coverservices-full/getcover.ashx"
LIBRARY_ID = "118"

# Excel-Spaltenpositionen (0-basierter Index, bestätigt durch Datenanalyse)
COL_TITEL    = 2   # Titelzeile
COL_STATUS   = 8   # VERF / ENTL xx.xx.xx / IEIN / AUSG / PRÄ / VORB ...
COL_MEDIA_ID = 9   # Vollständiger Barcode, z.B. "118$5031208P"
COL_STANDORT = 13  # KM / RB / JB

# Edge-Case: 1 Item (CITYSPORTS Walkingpad) hat MediaId in Col 1 der Folgezeile
COL_MEDIA_ID_SHIFTED = 1
COL_STANDORT_SHIFTED = 5

# Status-Kürzel, die zum Ausschluss führen
SKIP_STATUS = {"IEIN", "AUSG", "PRÄ"}

# Standort-Kürzel → lesbarer Ortsname für das "place"-Feld
STANDORT_MAP = {
    "KM": "Zweigstelle Kaltenmoor",
    "RB": "Hauptstelle Marienplatz",
    "JB": "Kinder- und Jugendbücherei",
}

# Pause zwischen API-Calls (Sek.) — schont die Bibliotheks-Infrastruktur
REQUEST_DELAY_SEC = 0.5

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Hilfsfunktionen
# ---------------------------------------------------------------------------

def map_excel_status(raw: str) -> str:
    """Übersetzt Excel-Statuskürzel in AllerLeih-Statuswerte."""
    s = (raw or "").strip().upper()
    if s.startswith("VERF"):
        return "available"
    if s.startswith("ENTL") or s.startswith("VORB") or s.startswith("VABHOL"):
        return "unavailable"
    if s in SKIP_STATUS:
        return "__SKIP__"
    # INTERN, ZWEIGT oder unbekannte Werte: einschließen, Status offen lassen
    return "unknown"


# ---------------------------------------------------------------------------
# Kategorisierung
# ---------------------------------------------------------------------------

_CAT = {
    "SPORT":  "Freizeit und Sport",
    "TOOL":   "Werkzeug und Garten",
    "BOOKS":  "Bücher",
    "GAMES":  "Spiele",
    "KUECHE": "Küche",
    "SOUND":  "Ton und Licht",
    "ELEK":   "Elektronik",
    "KIDS":   "Für Kinder",
    "SONST":  "Sonstiges",
}

def _cats(*keys): return [_CAT[k] for k in keys]

def classify(name: str) -> list[str]:
    """Ordnet einen Item-Namen 1–3 AllerLeih-Kategorien zu."""
    n = name.lower()

    # Für Kinder (Audio-Spielzeug)
    if any(x in n for x in ["toniebox", "tonie-lauscher"]):       return _cats("KIDS", "SOUND")
    if any(x in n for x in ["kekz", "wunderkekz"]):               return _cats("KIDS", "SOUND")
    if "tigerbox" in n:                                            return _cats("KIDS", "SOUND")
    if "bookii" in n:                                              return _cats("KIDS", "BOOKS")
    if re.search(r"tiptoi|der stift.*tiptoi|tiptoi.*stift", n):   return _cats("KIDS", "BOOKS")
    if "edurino" in n:                                             return _cats("KIDS", "ELEK")
    if "calliope" in n:                                            return _cats("KIDS", "ELEK")
    if "ozobot" in n:                                              return _cats("KIDS", "ELEK", "GAMES")
    if "sphero" in n:                                              return _cats("KIDS", "ELEK", "GAMES")
    if n.strip() == "dash":                                        return _cats("KIDS", "ELEK", "GAMES")
    if "proxi" in n:                                               return _cats("KIDS", "GAMES")
    if "kamishibai" in n:                                          return _cats("KIDS", "SONST")
    if "kindergitarre" in n:                                       return _cats("KIDS", "SOUND")
    if "tongue drum" in n:                                         return _cats("KIDS", "SOUND")
    if "singende harfe" in n or "happy harp" in n:                 return _cats("KIDS", "SOUND")
    if "dezimalrechensatz" in n:                                   return _cats("KIDS", "GAMES")
    if "mikroskop" in n:                                           return _cats("KIDS", "ELEK")
    if "schnitzset" in n:                                          return _cats("KIDS", "TOOL")
    if "seifenblase" in n:                                         return _cats("KIDS", "GAMES")
    if "spielteppich" in n:                                        return _cats("KIDS", "GAMES")
    if "nestschaukel" in n:                                        return _cats("KIDS", "SPORT")
    if "schwungtuch" in n:                                         return _cats("KIDS", "SPORT")
    if "laufstelzen" in n:                                         return _cats("KIDS", "SPORT")
    if "kosmos fernrohr" in n:                                     return _cats("KIDS", "SPORT")
    if "maxi-roller" in n or "maxi roller" in n:                   return _cats("KIDS", "SPORT")
    if "beleduc" in n and "balance" in n:                          return _cats("KIDS", "SPORT")
    if "grundschaltungen" in n:                                    return _cats("KIDS", "ELEK")
    # Spiele / Gaming
    if any(x in n for x in ["nintendo switch", "joy-con"]):        return _cats("GAMES")
    if any(x in n for x in ["playstation", "dualsense"]):          return _cats("GAMES")
    if "controller" in n and any(x in n for x in ["nintendo", "switch", "ps5"]): return _cats("GAMES")
    if "vr-brille" in n or "meta quest" in n or "pico 4" in n:     return _cats("GAMES", "ELEK")
    if "galakto" in n:                                             return _cats("GAMES")
    if "ringfit" in n:                                             return _cats("GAMES", "SPORT")
    if "tischkicker" in n or "air hockey" in n:                    return _cats("GAMES", "SPORT")
    if "tischtennis" in n:                                         return _cats("GAMES", "SPORT")
    if "boccia" in n or "boules" in n:                             return _cats("GAMES", "SPORT")
    if "cornhole" in n:                                            return _cats("GAMES", "SPORT")
    if "riesenmikado" in n:                                        return _cats("GAMES", "SPORT")
    if "dart" in n:                                                return _cats("GAMES", "SPORT")
    if "karaoke" in n:                                             return _cats("GAMES", "SOUND")
    # Freizeit und Sport
    if "skateboard" in n:                                          return _cats("SPORT")
    if "slackline" in n:                                           return _cats("SPORT")
    if any(x in n for x in ["airtrack", "air track", "turnmatte"]): return _cats("SPORT")
    if "balance board" in n or "balanceboard" in n:                return _cats("SPORT")
    if "waveboard" in n:                                           return _cats("SPORT")
    if "hoverboard" in n or "balance scooter" in n:               return _cats("SPORT")
    if "walkingpad" in n:                                          return _cats("SPORT")
    if "schwebebalken" in n:                                       return _cats("SPORT")
    if "stelzen" in n:                                             return _cats("SPORT")
    if "scooter" in n:                                             return _cats("SPORT")
    if "turnringe" in n:                                           return _cats("SPORT")
    if "sup set" in n or "sup-set" in n:                           return _cats("SPORT")
    if "fernglas" in n:                                            return _cats("SPORT")
    if "wildkamera" in n or "scouting cam" in n or "secacam" in n: return _cats("SPORT", "ELEK")
    if "metalldetektor" in n:                                      return _cats("SPORT", "ELEK")
    if "fledermaus" in n:                                          return _cats("SPORT", "ELEK")
    if "fitgun" in n:                                              return _cats("SPORT")
    if "edge explore" in n:                                        return _cats("SPORT", "ELEK")
    if "nachtsichtkamera" in n:                                    return _cats("SPORT", "ELEK")
    # Werkzeug und Garten
    if any(x in n for x in ["bohrer", "schrauber", "bohrmaschine", "schlagbohrmaschine"]): return _cats("TOOL")
    if "stichsäge" in n:                                           return _cats("TOOL")
    if "tacker" in n:                                              return _cats("TOOL")
    if "ortungsgerät" in n:                                        return _cats("TOOL")
    if "lötkolben" in n:                                           return _cats("TOOL", "ELEK")
    if "gehrungssäge" in n:                                        return _cats("TOOL")
    if "werkzeugkoffer" in n:                                      return _cats("TOOL")
    if "hochdruckreiniger" in n:                                   return _cats("TOOL")
    if "laubsäge" in n:                                            return _cats("TOOL")
    if "elektrotacker" in n:                                       return _cats("TOOL")
    if "obstpflücker" in n:                                        return _cats("TOOL", "SPORT")
    if "rollenschneider" in n:                                     return _cats("TOOL", "SONST")
    if "endoskop" in n:                                            return _cats("TOOL", "ELEK")
    if "entfernungsmesser" in n:                                   return _cats("TOOL")
    if "kreuzlinienlaser" in n or "quigo" in n:                    return _cats("TOOL")
    if "graviergerät" in n or "gravur" in n:                       return _cats("TOOL", "SONST")
    if "dremel" in n:                                              return _cats("TOOL")
    if "plotter" in n:                                             return _cats("TOOL", "SONST")
    # Küche
    if "popcorn" in n:                                             return _cats("KUECHE")
    if "waffeleisen" in n:                                         return _cats("KUECHE")
    if "crepe" in n or "crêpe" in n:                               return _cats("KUECHE")
    if "dörrautomat" in n:                                         return _cats("KUECHE")
    if "entsafter" in n:                                           return _cats("KUECHE")
    if "einkochautomat" in n:                                      return _cats("KUECHE")
    if "einmachtrichter" in n:                                     return _cats("KUECHE")
    if "kirschentkerner" in n:                                     return _cats("KUECHE")
    if "pflaumenentsteiner" in n:                                  return _cats("KUECHE")
    if "apfelausstecher" in n:                                     return _cats("KUECHE")
    if "vakuumierer" in n:                                         return _cats("KUECHE")
    if "eismaschine" in n:                                         return _cats("KUECHE")
    if any(x in n for x in ["kaffeemühle", "gewürzmühle", "gewürz- und"]): return _cats("KUECHE")
    if "küchenwaage" in n:                                         return _cats("KUECHE")
    if "joghurtbereiter" in n:                                     return _cats("KUECHE")
    if "zuckerwattemaschine" in n:                                 return _cats("KUECHE")
    if "hot drinks" in n:                                          return _cats("KUECHE")
    # Ton und Licht
    if any(x in n for x in ["ebook", "tolino", "pocketbook"]):     return _cats("BOOKS", "ELEK")
    if "mischpult" in n:                                           return _cats("SOUND", "ELEK")
    if "zoom h5" in n:                                             return _cats("SOUND", "ELEK")
    if "mikrofon" in n or "wireless mic" in n:                     return _cats("SOUND", "ELEK")
    if "usb mikrofone" in n:                                       return _cats("SOUND", "ELEK")
    if any(x in n for x in ["lautsprecher", "soundcore", "partybox", "boombox"]): return _cats("SOUND", "ELEK")
    if "kopfhörer" in n or "headset" in n:                         return _cats("SOUND", "ELEK")
    if "discolicht" in n or "nebelmaschine" in n:                  return _cats("SOUND")
    if "beamer" in n:                                              return _cats("SOUND", "ELEK")
    if "tageslichtlampe" in n:                                     return _cats("SOUND", "ELEK")
    if "led-box" in n or "led box" in n or "lightbox" in n:        return _cats("SOUND", "ELEK")
    if "heimplanetarium" in n:                                     return _cats("SOUND", "KIDS")
    if "diaprojektor" in n:                                        return _cats("SOUND", "ELEK")
    if "apollo" in n:                                              return _cats("SOUND", "ELEK")
    if "ukulele" in n:                                             return _cats("SOUND", "SPORT")
    if "notenpult" in n:                                           return _cats("SOUND")
    if "mini keyboard" in n:                                       return _cats("SOUND", "ELEK")
    if any(x in n for x in ["cd-mp3", "cd/dvd", "blu-ray", "blu ray", "dvd"]): return _cats("SOUND", "ELEK")
    # Elektronik (Rest)
    if any(x in n for x in ["scanner", "scann"]):                  return _cats("ELEK")
    if "aktenvernichter" in n:                                     return _cats("ELEK", "SONST")
    if "buttonmaschine" in n:                                      return _cats("SONST", "ELEK")
    if "laminier" in n:                                            return _cats("ELEK", "SONST")
    if "beschriftungsgerät" in n:                                  return _cats("ELEK", "SONST")
    if "cassette" in n:                                            return _cats("ELEK")
    if any(x in n for x in ["energiemessgerät", "strommessgerät"]): return _cats("ELEK")
    if "powerbank" in n:                                           return _cats("ELEK")
    if "presenter" in n:                                           return _cats("ELEK")
    if "video grabber" in n:                                       return _cats("ELEK")
    if any(x in n for x in ["infrarot-box", "dusch-box", "heiz-box",
                              "richtig-lüften-box", "solar-box", "klimaschutz"]): return _cats("ELEK", "SONST")
    if "stativ" in n:                                              return _cats("ELEK", "SOUND")
    if any(x in n for x in ["instax", "sofortbildkamera", "kamera"]): return _cats("ELEK", "SPORT")
    if "gepäckwaage" in n:                                         return _cats("ELEK", "SONST")
    if "gps" in n:                                                 return _cats("ELEK", "SPORT")
    # Sonstiges
    if "nähmaschine" in n:                                         return _cats("SONST")
    return _cats("SONST")


def determine_api_status(media_items: list) -> str:
    """Bestimmt den Gesamtstatus aus den Exemplar-Datensätzen der API-Antwort.

    Logik:
    - Mindestens ein Exemplar StatusId=1 (verfügbar) → available
    - Alle Exemplare StatusId 2/3/100 (entliehen/vorbestellt/Präsenz) → unavailable
    - Sonst → unknown
    """
    if not media_items:
        return "unknown"
    ids = [item.get("StatusId") for item in media_items]
    if any(s == 1 for s in ids):
        return "available"
    if all(s in (2, 3, 100) for s in ids):
        return "unavailable"
    return "unknown"


def extract_ean(cat: dict) -> str:
    """Extrahiert die EAN-13 aus CatalogData.Ean oder .Isbn.
    Gibt nur rein numerische Werte zurück — Amazon-ASINs (z.B. B07B2R998Y) werden verworfen.
    """
    for field in ("Ean", "Isbn"):
        val = safe_str(cat.get(field))
        if val and val.isdigit():
            return val
    return ""


def build_cover_url(catalogue_id, ean: str = "") -> str:
    if not catalogue_id:
        return ""
    return f"{COVER_BASE}?x13={ean}&catid={catalogue_id}&libid={LIBRARY_ID}&country=DE"


# Minimale Dateigröße in Bytes, ab der ein Cover als "echt" gilt.
# Ein leeres weißes Platzhalterbild ist typischerweise < 500 Bytes.
# Echte Produktbilder sind meist > 5 KB. 2 KB ist ein konservativer Schwellwert.
COVER_MIN_BYTES = 2000

def cover_url_has_image(url: str) -> bool:
    """Prüft per HTTP HEAD, ob die Cover-URL ein echtes Bild zurückgibt.
    Gibt False zurück wenn das Bild fehlt (leerer Platzhalter) oder der Request fehlschlägt.
    """
    try:
        req = urllib.request.Request(
            url,
            method="HEAD",
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                ),
            },
        )
        with urllib.request.urlopen(req, timeout=6) as resp:
            length = resp.headers.get("Content-Length")
            if length is None:
                return True   # kein Content-Length → annehmen dass Bild da ist
            return int(length) >= COVER_MIN_BYTES
    except Exception:
        return False


def _api_call(url: str) -> dict | None:
    """Führt einen einzelnen API-GET aus und gibt Data[0] zurück oder None."""
    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                ),
                "Accept": "*/*",
                "Referer": "https://rblg.stadt.lueneburg.de/webopac/",
            },
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        log.warning(f"  API-Fehler: {exc}")
        return None
    results = data.get("Data") or []
    return results[0] if results else None


def fetch_api(barcode: str) -> dict | None:
    """Ruft einen einzelnen Titel per Mediennummer (SearchCondition1=46) ab.

    Gibt Data[0] zurück oder None bei Fehler / kein Treffer.
    nostats=1 verhindert, dass der Call die Suchstatistik der Bibliothek verfälscht.

    Sonderzeichen im Barcode (z.B. '+', '-', '.'):
    Erster Versuch mit vollständigem Percent-Encoding.
    Falls kein Treffer: zweiter Versuch mit '+' als Literal (manche Server
    interpretieren '%2B' und '+' unterschiedlich im Query-String).
    """
    def build_url(safe_chars=""):
        encoded = urllib.parse.quote(barcode, safe=safe_chars)
        return (
            f"{API_BASE}?json=1&Job=Search"
            f"&SearchCondition1=46&SearchValue1={encoded}"
            f"&nostats=1"
        )

    result = _api_call(build_url(safe_chars=""))

    # Fallback: '+' nicht encoden, falls Barcode ein '+' enthält und kein Treffer kam
    if result is None and "+" in barcode:
        log.debug(f"  Fallback-Versuch mit '+' als Literal für {barcode}")
        result = _api_call(build_url(safe_chars="+"))

    if result is None:
        log.warning(f"  Kein API-Treffer für {barcode} — externalUrl und Bild bleiben leer")
    return result


def safe_str(val) -> str:
    if val is None or (isinstance(val, float) and val != val):  # NaN check
        return ""
    return str(val).strip()


def clean_text(val: str) -> str:
    """Bereinigt Text für CSV: Zeilenumbrüche → Leerzeichen, mehrfache Spaces kollabieren."""
    import re
    text = val.replace("\r\n", " ").replace("\r", " ").replace("\n", " ")
    text = re.sub(r" {2,}", " ", text)
    return text.strip()

# ---------------------------------------------------------------------------
# Excel einlesen
# ---------------------------------------------------------------------------

def read_excel(path: Path) -> list[dict]:
    """Liest den Patzner-Export und gibt eine gefilterte Liste von Item-Dicts zurück.

    Jedes Dict enthält: media_id, excel_titel, place, excel_status
    """
    log.info(f"Lese Excel: {path}")
    df = pd.read_excel(path, header=None, engine="openpyxl")
    log.info(f"  {len(df)} Zeilen gelesen")

    items = []
    skip_count = 0
    i = 0

    while i < len(df):
        row = df.iloc[i]

        media_id = safe_str(row.iloc[COL_MEDIA_ID]) if len(row) > COL_MEDIA_ID else ""
        status_raw = safe_str(row.iloc[COL_STATUS]) if len(row) > COL_STATUS else ""
        titel_raw = safe_str(row.iloc[COL_TITEL]) if len(row) > COL_TITEL else ""
        standort_raw = safe_str(row.iloc[COL_STANDORT]) if len(row) > COL_STANDORT else ""

        # --- Edge-Case: Status "VORB heute zurück" ohne MediaId in Col 9 ---
        # Einziges bekanntes Beispiel: CITYSPORTS Walkingpad (Row 54/55).
        # Die Folgezeile enthält MediaId in Col 1 und Standort in Col 5.
        if not media_id and status_raw.upper().startswith("VORB"):
            if i + 1 < len(df):
                next_row = df.iloc[i + 1]
                shifted_id = safe_str(next_row.iloc[COL_MEDIA_ID_SHIFTED]) if len(next_row) > COL_MEDIA_ID_SHIFTED else ""
                if shifted_id.startswith(f"{LIBRARY_ID}$"):
                    media_id = shifted_id
                    standort_raw = safe_str(next_row.iloc[COL_STANDORT_SHIFTED]) if len(next_row) > COL_STANDORT_SHIFTED else standort_raw
                    i += 1  # Folgezeile überspringen — sie gehört zu diesem Item

        # Nur Zeilen mit MediaId verarbeiten
        if not media_id or not media_id.startswith(f"{LIBRARY_ID}$"):
            i += 1
            continue

        # Status prüfen
        allerleih_status = map_excel_status(status_raw)
        if allerleih_status == "__SKIP__":
            log.debug(f"  SKIP ({status_raw}): {titel_raw or media_id}")
            skip_count += 1
            i += 1
            continue

        place = STANDORT_MAP.get(standort_raw.upper(), standort_raw or "Ratsbücherei Lüneburg")

        items.append({
            "media_id": media_id,
            "excel_titel": titel_raw,
            "place": place,
            "excel_status": allerleih_status,
        })

        i += 1

    log.info(f"  {len(items)} importierbare Items (übersprungen: {skip_count})")
    return items

# ---------------------------------------------------------------------------
# CSV-Zeile bauen
# ---------------------------------------------------------------------------

def build_csv_row(item: dict, api_result: dict | None) -> dict:
    """Kombiniert Excel-Daten mit API-Antwort zu einer AllerLeih-Import-Zeile."""

    if api_result is None:
        # Fallback: nur Excel-Daten, keine API-Anreicherung
        return {
            "externalId":  item["media_id"],
            "name":        item["excel_titel"],
            "description": "",
            "place":       item["place"],
            "categories":  ";".join(classify(item["excel_titel"])),
            "externalUrl": "",
            "status":      item["excel_status"],
            "trusteesOnly": "false",
            "image":       "",
        }

    cat = api_result.get("CatalogData", {})
    media_items = cat.get("MediaItemsUnsorted") or []

    # Titel: API bevorzugen, Excel als Fallback
    name = clean_text(safe_str(cat.get("Titel1")) or safe_str(cat.get("Titel")) or item["excel_titel"])

    # Beschreibung: Annotation + Umfang + Verlag, max. 4.000 Zeichen
    parts = [clean_text(safe_str(cat.get(k))) for k in ("Annotation", "Umfang", "Verlag")]
    description = " | ".join(p for p in parts if p)[:4000]

    # Deep-Link aus API-Feld "Url" (nicht "Link" wie in der Doku — abweichend!)
    external_url = safe_str(cat.get("Url"))

    # Bild-URL: mit EAN → direkt übernehmen (zuverlässig).
    # Ohne EAN → HEAD-Check: nur setzen wenn der Cover-Service ein echtes Bild zurückgibt
    # (der Service liefert sonst ein kleines weißes Platzhalterbild).
    catalogue_id = safe_str(cat.get("CatalogueId"))
    ean = extract_ean(cat)
    candidate_url = build_cover_url(catalogue_id, ean)
    if ean:
        image = candidate_url          # EAN vorhanden → URL ist zuverlässig
    elif candidate_url and cover_url_has_image(candidate_url):
        image = candidate_url          # kein EAN, aber Cover-Service hat trotzdem ein Bild
    else:
        image = ""                     # leerer Platzhalter → AllerLeih-Fallback nutzen

    # Live-Status aus Exemplar-Daten der API (präziser als Excel-Status)
    status = determine_api_status(media_items)

    return {
        "externalId":   item["media_id"],
        "name":         name,
        "description":  description,
        "place":        item["place"],
        "categories":   ";".join(classify(name)),
        "externalUrl":  external_url,
        "status":       status,
        "trusteesOnly": "false",
        "image":        image,
    }

# ---------------------------------------------------------------------------
# Hauptprogramm
# ---------------------------------------------------------------------------

FIELDNAMES = ["externalId", "name", "description", "place", "categories",
              "externalUrl", "status", "trusteesOnly", "image"]

def main():
    if len(sys.argv) < 3:
        print(f"Verwendung: python3 {Path(sys.argv[0]).name} <excel_datei> <ausgabe.csv>")
        print()
        print("  Beispiel:")
        print(f"    python3 {Path(sys.argv[0]).name} 260423BibliothekderDinge.xlsx allerleih_ratsbuecherei.csv")
        sys.exit(1)

    excel_path  = Path(sys.argv[1])
    output_path = Path(sys.argv[2])

    if not excel_path.exists():
        log.error(f"Excel-Datei nicht gefunden: {excel_path}")
        sys.exit(1)

    # --- Excel einlesen ---
    items = read_excel(excel_path)
    if not items:
        log.error("Keine importierbaren Items gefunden.")
        sys.exit(1)

    # --- API-Calls + CSV schreiben ---
    api_hits = 0
    api_misses = 0

    # utf-8-sig = UTF-8 mit BOM → Excel erkennt Umlaute korrekt
    with output_path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()

        for idx, item in enumerate(items, 1):
            media_id = item["media_id"]
            log.info(f"[{idx}/{len(items)}] {media_id}  {item['excel_titel'][:60]}")

            api_result = fetch_api(media_id)

            if api_result:
                api_hits += 1
            else:
                api_misses += 1

            writer.writerow(build_csv_row(item, api_result))

            if idx < len(items):
                time.sleep(REQUEST_DELAY_SEC)

    # --- Zusammenfassung ---
    log.info("")
    log.info(f"✓ CSV gespeichert: {output_path}")
    log.info(f"  Gesamt:        {len(items)} Items")
    log.info(f"  API-Treffer:   {api_hits}")
    log.info(f"  Nur Excel:     {api_misses}  ← manuell prüfen oder Lauf wiederholen")
    log.info("")
    log.info("Nächster Schritt: CSV über /user/import in AllerLeih hochladen.")
    log.info("(Ratsbücherei-Account benötigt isInstitution=true in PocketBase Admin.)")

    if api_misses > 0:
        log.warning(f"⚠ {api_misses} Items ohne API-Daten: kein Titel/Bild/Deep-Link.")


if __name__ == "__main__":
    main()
