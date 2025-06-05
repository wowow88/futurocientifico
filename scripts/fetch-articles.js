import fs from 'fs';
import Parser from 'rss-parser';
import fetch from 'node-fetch';
import { franc } from 'franc';

const parser = new Parser();

const fuentes = [
  {
    url: 'https://www.nature.com/subjects/astronomy/rss',
    tema: 'astronomía',
    fuente: 'Nature'
  },
  {
    url: 'https://www.nature.com/subjects/biology/rss',
    tema: 'biología',
    fuente: 'Nature'
  }
  // Puedes añadir más feeds RSS aquí
];

async function traducir(texto) {
  try {
    const res = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`
      },
      body: new URLSearchParams({
        text: texto,
        target_lang: 'ES'
      })
    });
    const data = await res.json();
    return data.translations?.[0]?.text || texto;
  } catch {
    return texto;
  }
}

async function obtenerArticulos() {
  const articulos = [];

  for (const fuente of fuentes) {
    try {
      const feed = await parser.parseURL(fuente.url);

      for (const item of feed.items) {
        const lang = franc(item.title || '');
        if (lang !== 'eng') continue;

        const tituloTraducido = await traducir(item.title);
        articulos.push({
          titulo: item.title,
          titulo_es: tituloTraducido,
          url: item.link,
          fecha: item.pubDate,
          tema: fuente.tema,
          fuente: fuente.fuente,
          tipo: 'revista',
          imagen: 'https://source.unsplash.com/400x200/?science,' + fuente.tema
        });
      }
    } catch (e) {
      console.error(`Error con ${fuente.url}: ${e.message}`);
    }
  }

  return articulos;
}

const todos = await obtenerArticulos();

fs.mkdirSync('./public', { recursive: true });
fs.writeFileSync('./public/articles_js.json', JSON.stringify(todos, null, 2));

console.log('✅ Artículos científicos guardados correctamente.');
