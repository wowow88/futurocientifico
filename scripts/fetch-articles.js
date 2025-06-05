import fs from 'fs';
import Parser from 'rss-parser';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const rssFeeds = [
  {
    url: 'https://www.sciencedaily.com/rss/top/science.xml',
    tema: 'ciencia',
    fuente: 'ScienceDaily',
  },
  {
    url: 'https://www.nature.com/subjects/astronomy/rss',
    tema: 'astronomía',
    fuente: 'Nature',
  },
  {
    url: 'https://www.nature.com/subjects/biology/rss',
    tema: 'biología',
    fuente: 'Nature',
  }
];

const parser = new Parser();
const articles = [];

async function traducir(texto) {
  const res = await fetch('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
    },
    body: `text=${encodeURIComponent(texto)}&target_lang=ES`,
  });

  const data = await res.json();
  return data.translations?.[0]?.text || texto;
}

for (const feed of rssFeeds) {
  try {
    const parsed = await parser.parseURL(feed.url);
    for (const entry of parsed.items.slice(0, 5)) {
      const titulo = entry.title || '';
      const titulo_es = await traducir(titulo);
      articles.push({
        tipo: 'revista',
        titulo: titulo,
        titulo_es,
        url: entry.link,
        fuente: feed.fuente,
        tema: feed.tema,
        imagen: '/images/placeholder.jpg',
        fecha: entry.isoDate || new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error(`Error con ${feed.url}:`, err.message);
  }
}

fs.writeFileSync('./workspace/astro/public/articles_js.json', JSON.stringify(articles, null, 2));
console.log(`✅ ${articles.length} artículos RSS guardados correctamente.`);
