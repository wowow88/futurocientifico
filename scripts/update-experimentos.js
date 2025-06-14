// src/scripts/update-experimentos.js
import fs from 'fs/promises';
import fetch from 'node-fetch';
import xml2js from 'xml2js';
const JSON_PATH = 'src/data/experimentos-videos.json';

const CHANNELS = [
  { name: 'PowerKids', id: 'UC...' },
  { name: 'ExperimentosCiencia', id: 'UC...' },
  { name: 'AmigosDeLaQuimica', id: 'UCTiu0apxEtCGpuLYeI-owkg' },
];

async function fetchLatest(channelId) {
  const rss = await (await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`)).text();
  const parsed = await xml2js.parseStringPromise(rss);
  const entry = parsed.feed.entry?.[0];
  return { title: entry.title[0], link: entry.link[0].$.href, published: entry.published[0] };
}

async function main() {
  let existing = [];
  try { existing = JSON.parse(await fs.readFile(JSON_PATH)); } catch{}
  const links = new Set(existing.map(v => v.link));
  for (const ch of CHANNELS) {
    const video = await fetchLatest(ch.id);
    if (!links.has(video.link)) existing.unshift({ channel: ch.name, ...video });
  }
  await fs.writeFile(JSON_PATH, JSON.stringify(existing, null, 2));
}
main();
