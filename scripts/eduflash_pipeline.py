import json
import feedparser
from bs4 import BeautifulSoup
from datetime import datetime

sources = [
{ name: 'And. Educación – Actualidad', url: 'https://www.juntadeandalucia.es/educacion/portales/web/educacion/actualidad' },
{ name: 'Xunta Galicia Educación', url: 'https://www.edu.xunta.gal/portal/es/actualidade' }, 
]

def fetch_rss(name, url):
    articles = []
    feed = feedparser.parse(url)
    for entry in feed.entries[:5]:
        try:
            date = datetime(*entry.published_parsed[:6]).date().isoformat()
        except AttributeError:
            date = datetime.now().date().isoformat()
        article = {
            "title": entry.title,
            "url": entry.link,
            "date": date,
            "source": name,
            "content_es": BeautifulSoup(entry.get("summary", ""), "html.parser").get_text()
        }
        articles.append(article)
    return articles

def main():
    all_articles = []
    for name, url in sources:
        all_articles += fetch_rss(name, url)

    unique_articles = {a["url"]: a for a in all_articles}

    with open("public/eduflash.json", "w", encoding="utf-8") as f:
        json.dump(list(unique_articles.values()), f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()
