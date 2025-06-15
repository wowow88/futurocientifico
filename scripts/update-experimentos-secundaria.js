// scripts/update-experimentos-secundaria.js
import fs from 'fs/promises';
import fetch from 'node-fetch';
import xml2js from 'xml2js';

const JSON_PATH = 'src/data/experimentos-videos.json';

const CHANNELS = [
  { name: 'PowerKids', id: 'UCgJg8hbyuA4rU3xz1DqRM9w' },
  { name: 'Experimentos Escolares', id: 'UC1K9JUZptwTr2eosL6gZX8Q' },
  { name: 'Amigos de la Química', id: 'UCTiu0apxEtCGpuLYeI-owkg' },
];

async function fetchLatest(channelId) {
  try {
    const rss = await (await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`)).text();
    const parsed = await xml2js.parseStringPromise(rss);
    const entry = parsed.feed.entry?.[0];
    if (!entry) throw new Error('No video entries found');
    return { title: entry.title[0], link: entry.link[0].$.href, published: entry.published[0] };
  } catch (err) {
    console.error(`Error fetching or parsing RSS for channel ${channelId}:`, err.message);
    return null;
  }
}

async function main() {
  let existing = [];
  try {
    existing = JSON.parse(await fs.readFile(JSON_PATH));
  } catch {
    existing = [];
  }

  const links = new Set(existing.map(v => v.link));

  for (const ch of CHANNELS) {
    const video = await fetchLatest(ch.id);
    if (video && !links.has(video.link)) {
      existing.unshift({ channel: ch.name, ...video });
    }
  }

  await fs.writeFile(JSON_PATH, JSON.stringify(existing, null, 2));
}

main();
