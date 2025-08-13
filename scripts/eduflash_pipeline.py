# scripts/eduflash_pipeline.py
# FuturoCientífico – Pipeline RSS -> public/eduflash.json
# Cambios clave en esta versión:
# - Descarga con requests + reintentos y timeout (evita "Remote end closed connection")
# - Manejo de errores por fuente (no tumba el pipeline completo)
# - Escritura atómica, normalización de URLs y límites como antes
# - Parseo de fechas más robusto (email.utils.parsedate_to_datetime)

from __future__ import annotations
import json
import os
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Tuple
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
from email.utils import parsedate_to_datetime

import feedparser  # pip install feedparser
from bs4 import BeautifulSoup  # pip install beautifulsoup4
import requests  # pip install requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# ------------ Configuración ------------

# Fuentes RSS (nombre, url)
SOURCES: List[Tuple[str, str]] = [
    ("Andalucía – BOJA Educación", "https://juntadeandalucia.es/boja/distribucion/s51.xml"),
    ("Aragón – ANPE Aragón", "https://www.anpearagon.es/rss"),
    ("Castilla y León – Educacyl", "https://www.educa.jcyl.es/educacyl/cm/rss?locale=es_ES&textOnly=false&rssContent=5"),
    ("Galicia – Cultura Galicia", "https://www.cultura.gal/es/rss"),
    ("Madrid – RRHH Educación", "https://www.comunidad.madrid/sites/default/files/doc/educacion/rh20/edu_dgrrhh.xml"),
]

ITEMS_PER_SOURCE = 5
MAX_TOTAL_ITEMS = 300   # para no dejar crecer el JSON sin control
CONTENT_TRIM_CHARS = 200
TITLE_ES_MAX_WORDS = 8

# User-Agent (algunos sitios rechazan UA vacíos)
UA = "FuturoCientificoBot/1.0 (+https://futurocientifico.vercel.app)"
feedparser.USER_AGENT = UA

# Salida (relativa a este archivo)
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent  # asumiendo scripts/eduflash_pipeline.py
OUTPUT_JSON = REPO_ROOT / "public" / "eduflash.json"

# ------------ Utilidades ------------

def log(msg: str) -> None:
    print(msg, file=sys.stdout, flush=True)


def clean_url(url: str) -> str:
    """Quita parámetros de tracking (utm_*, fbclid, gclid, etc.) para deduplicar."""
    try:
        parts = urlsplit(url)
        query_pairs = [
            (k, v)
            for k, v in parse_qsl(parts.query, keep_blank_values=True)
            if not (k.lower().startswith("utm_") or k.lower() in {"fbclid", "gclid", "mc_cid", "mc_eid"})
        ]
        new_query = urlencode(query_pairs, doseq=True)
        return urlunsplit((parts.scheme, parts.netloc, parts.path, new_query, parts.fragment))
    except Exception:
        return url


def text_only(html_or_text: str) -> str:
    return BeautifulSoup(html_or_text or "", "html.parser").get_text(" ", strip=True)


def truncate_chars(text: str, limit: int) -> str:
    if not text:
        return ""
    text = text.strip()
    return text if len(text) <= limit else text[:limit].rstrip() + "…"


def shorten_words(title: str, max_words: int) -> str:
    if not title:
        return ""
    words = title.split()
    return title if len(words) <= max_words else " ".join(words[:max_words]) + "…"


def parse_date(entry) -> str:
    """Devuelve fecha ISO (YYYY-MM-DD) con varios fallbacks."""
    # 1) struct_time que ya provee feedparser
    for attr in ("published_parsed", "updated_parsed", "created_parsed"):
        dt_struct = getattr(entry, attr, None)
        if dt_struct:
            try:
                return datetime(*dt_struct[:6], tzinfo=timezone.utc).date().isoformat()
            except Exception:
                pass
    # 2) Cadenas
    for attr in ("published", "updated", "created"):
        val = getattr(entry, attr, None)
        if isinstance(val, str) and len(val) > 6:
            try:
                dt = parsedate_to_datetime(val)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt.date().isoformat()
            except Exception:
                pass
    # 3) Último recurso: hoy (UTC)
    return datetime.now(timezone.utc).date().isoformat()


# ------------ Red con reintentos ------------

def make_session() -> requests.Session:
    s = requests.Session()
    retries = Retry(
        total=3,
        connect=3,
        read=3,
        backoff_factor=0.8,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=("GET",),
        raise_on_status=False,
        respect_retry_after_header=True,
    )
    s.headers.update({"User-Agent": UA, "Accept": "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8"})
    s.mount("http://", HTTPAdapter(max_retries=retries))
    s.mount("https://", HTTPAdapter(max_retries=retries))
    return s

SESSION = make_session()


def fetch_rss(source_name: str, url: str) -> List[Dict]:
    try:
        # Descarga robusta con requests (evita caídas por desconexiones remotas)
        resp = SESSION.get(url, timeout=12)
        if not resp.ok:
            log(f"⚠️  {source_name}: HTTP {resp.status_code}. Continuamos…")
        data = resp.content or b""
        feed = feedparser.parse(data)
    except Exception as e:
        log(f"⚠️  {source_name}: Error de descarga/parsing: {e}. Continuamos…")
        return []

    articles: List[Dict] = []
    entries = getattr(feed, "entries", [])[:ITEMS_PER_SOURCE]

    for entry in entries:
        try:
            original_title = getattr(entry, "title", "").strip()
            short_title = shorten_words(original_title, TITLE_ES_MAX_WORDS)
            link = clean_url(getattr(entry, "link", "").strip())
            date = parse_date(entry)
            # contenido
            content_list = getattr(entry, "content", None)
            if isinstance(content_list, list) and content_list:
                content_raw = text_only(content_list[0].get("value", ""))
            else:
                summary_detail = getattr(entry, "summary_detail", None)
                if summary_detail and isinstance(summary_detail, dict):
                    content_raw = text_only(summary_detail.get("value", ""))
                else:
                    content_raw = text_only(getattr(entry, "summary", getattr(entry, "description", "")))

            articles.append({
                "title": original_title,
                "title_es": short_title,
                "url": link,
                "date": date,
                "source": source_name,
                "content_es": truncate_chars(content_raw, CONTENT_TRIM_CHARS),
            })
        except Exception as e:
            log(f"⚠️  {source_name}: Item saltado por error: {e}")

    log(f"• {source_name}: {len(articles)} artículos.")
    return articles


def read_existing(path: Path) -> List[Dict]:
    if not path.exists():
        return []
    try:
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, list):
                for item in data:
                    item["content_es"] = truncate_chars(item.get("content_es", ""), CONTENT_TRIM_CHARS)
                return data
            return []
    except Exception as e:
        log(f"⚠️ Aviso: no se pudo leer {path.name}: {e}. Continuamos con lista vacía.")
        return []


def atomic_write_json(path: Path, data) -> None:
    tmp_fd, tmp_path = tempfile.mkstemp(prefix=path.name, dir=str(path.parent))
    try:
        with os.fdopen(tmp_fd, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp_path, path)  # atómico en la mayoría de SOs
    except Exception as e:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise e


# ------------ Lógica principal ------------

def main() -> None:
    existing = read_existing(OUTPUT_JSON)
    existing_map = {clean_url(item["url"]): item for item in existing if "url" in item}

    new_items: List[Dict] = []
    for name, url in SOURCES:
        new_items.extend(fetch_rss(name, url))

    # Merge por URL normalizada (los nuevos pisan a los viejos)
    for it in new_items:
        existing_map[clean_url(it["url"])] = it

    merged: List[Dict] = list(existing_map.values())

    # Orden por fecha (desc)
    try:
        merged.sort(key=lambda x: datetime.strptime(x.get("date", "1970-01-01"), "%Y-%m-%d"), reverse=True)
    except Exception as e:
        log(f"⚠️ Error al ordenar fechas: {e}")

    # Limita tamaño total
    if len(merged) > MAX_TOTAL_ITEMS:
        merged = merged[:MAX_TOTAL_ITEMS]

    # Garantiza carpeta y escribe atómicamente
    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    atomic_write_json(OUTPUT_JSON, merged)

    log(f"✅ {OUTPUT_JSON.name} actualizado. Nuevos: {len(new_items)} | Total: {len(merged)}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        log(f"❌ Error inesperado: {e}")
        sys.exit(1)


