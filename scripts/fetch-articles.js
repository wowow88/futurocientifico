import Parser from 'rss-parser';
import fs from 'fs';
import fetch from 'node-fetch';

const parser = new Parser();
const feed = await parser.parseURL('https://export.arxiv.org/rss/cs');

const articles = feed.items.slice(0, 5).map(item => ({
  titulo: item.title,
  url: item.link,
  resumen: item.contentSnippet,
  fecha: item.pubDate,
  fuente: 'arXiv',
  tipo: 'revista',
  imagen: 'https://upload.wikimedia.org/wikipedia/commons/9/91/ArXiv_logo.png',
  tema: 'tecnología',
  titulo_es: item.title // Aquí podrías traducir con DeepL si se desea
}));

// Verificar y crear carpeta 'public' si no existe
if (!fs.existsSync('./public')) {
  fs.mkdirSync('./public', { recursive: true });
}

// Guardar artículos
fs.writeFileSync('./public/articles.json', JSON.stringify(articles, null, 2));
console.log('✅ Artículos reales guardados desde arXiv.');
