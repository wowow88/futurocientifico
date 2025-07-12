import json
import feedparser
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
        article = {
            "title": entry.title,
            "url": entry.link,
            "date": date,
            "source": name,
            "content_es": BeautifulSoup(entry.get("summary", entry.get("description", "")), "html.parser").get_text()
        }
        articles.append(article)
    print(f"{name}: {len(articles)} artículos encontrados")
    return articles

def main():
    all_articles = []
    for name, url in sources:
        all_articles += fetch_rss(name, url)

    unique_articles = {a["url"]: a for a in all_articles}

    print("Total artículos únicos:", len(unique_articles))

    with open("public/eduflash.json", "w", encoding="utf-8") as f:
        json.dump(list(unique_articles.values()), f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()
