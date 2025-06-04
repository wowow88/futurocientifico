import fs from 'fs';
import Parser from 'rss-parser';

const parser = new Parser();
const FEED_URL = 'https://export.arxiv.org/rss/cs';

async function fetchArxiv() {
  const feed = await parser.parseURL(FEED_URL);
  const articles = feed.items.map(item => ({
    title: item.title,
    title_es: item.title,
    url: item.link,
    date: new Date().toISOString().split('T')[0],
    source: 'arXiv',
    content_es: ''
  }));
  fs.writeFileSync('./public/articles.json', JSON.stringify(articles, null, 2));
  console.log('✅ Artículos reales guardados desde arXiv.');
}

fetchArxiv();
