import json
import feedparser
import os
from bs4 import BeautifulSoup
from datetime import datetime

sources = [
    ("Andalucía – BOJA Educación", "https://juntadeandalucia.es/boja/distribucion/s51.xml"),
    ("Aragón – ANPE Aragón", "https://www.anpearagon.es/rss"),
    ("Castilla y León – Educacyl", "https://www.educa.jcyl.es/educacyl/cm/rss?locale=es_ES&textOnly=false&rssContent=5"),
    ("Galicia – Cultura Galicia", "https://www.cultura.gal/es/rss"),
    ("Madrid – RRHH Educación", "https://www.comunidad.madrid/sites/default/files/doc/educacion/rh20/edu_dgrrhh.xml"),
]

def fetch_rss(name, url):
    articles = []
    feed = feedparser.parse(url)
    for entry in feed.entries[:5]:
        try:
            date = datetime(*entry.published_parsed[:6]).date().isoformat()
        except AttributeError:
            try:
                date = datetime(*entry.updated_parsed[:6]).date().isoformat()
            except AttributeError:
                date = datetime.now().date().isoformat()

        original_title = entry.title.strip()
        short_title = " ".join(original_title.split()[:5]) + "…" if len(original_title.split()) > 5 else original_title

        article = {
            "title": original_title,
            "title_es": short_title,
            "url": entry.link,
            "date": date,
            "source": name,
            "content_es": BeautifulSoup(entry.get("summary", entry.get("description", "")), "html.parser").get_text()
        }
        articles.append(article)
    return articles

def main():
    archivo_json = "public/eduflash.json"
    datos_existentes = []

    # Leer si existe el archivo
    if os.path.exists(archivo_json):
        with open(archivo_json, "r", encoding="utf-8") as f:
            datos_existentes = json.load(f)

    urls_existentes = {item["url"] for item in datos_existentes}

    # Descargar y filtrar nuevas noticias
    nuevas_noticias = []
    for name, url in sources:
        nuevos = fetch_rss(name, url)
        for noticia in nuevos:
            if noticia["url"] not in urls_existentes:
                nuevas_noticias.append(noticia)

    todos_los_datos = datos_existentes + nuevas_noticias

    # Ordenar por fecha descendente
    try:
        todos_los_datos.sort(key=lambda x: datetime.strptime(x["date"], "%Y-%m-%d"), reverse=True)
    except Exception as e:
        print("⚠️ Error al ordenar fechas:", e)

    # Guardar archivo final
    with open(archivo_json, "w", encoding="utf-8") as f:
        json.dump(todos_los_datos, f, ensure_ascii=False, indent=2)

    print(f"✅ eduflash.json actualizado con {len(nuevas_noticias)} nuevas noticias. Total: {len(todos_los_datos)}.")

if __name__ == "__main__":
    main()
