// update-videos.js
import fs from 'fs/promises'
import fetch from 'node-fetch'
import xml2js from 'xml2js'

const CHANNELS = [
  { name: 'NatGeoKids', id: 'UCXVCgDuD_QCkI7gTKU7-tpg' },
  { name: 'SciShowKids', id: 'UC7DdEm33SyaTDtWYGO2CwdA' },
  { name: 'CrashCourseKids', id: 'UCcbwNJ8zkNqZpzFZ1FTsZkQ' },
  { name: 'MinutePhysics', id: 'UCUHW94eEFW7hkUMVaZz4eDg' },
  { name: 'SmileAndLearn', id: 'UCxoDMG0tvaYO5Xobvtqw5nw' },
]

async function fetchLatestVideo(channelId) {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
  const resp = await fetch(url)
  const xml = await resp.text()
  const rss = await xml2js.parseStringPromise(xml)
  const entry = rss.feed.entry?.[0]
  return {
    title: entry.title[0],
    link: entry.link[0].$.href,
    published: entry.published[0],
  }
}

async function main() {
  const videos = []
  for (const ch of CHANNELS) {
    try {
      const vid = await fetchLatestVideo(ch.id)
      videos.push({ channel: ch.name, ...vid })
    } catch (e) {
      console.error(`Error loading ${ch.name}:`, e)
    }
  }
  await fs.writeFile('src/data/latest-videos.json', JSON.stringify(videos, null, 2))
}

main().catch(console.error)
