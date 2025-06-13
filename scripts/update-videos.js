// src/scripts/update-videos.js

import fs from 'fs/promises'
import fetch from 'node-fetch'
import xml2js from 'xml2js'
import path from 'path'

const DATA_PATH = path.resolve('src/data/latest-videos.json')

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
  let existing = []

  try {
    const raw = await fs.readFile(DATA_PATH, 'utf-8')
    existing = JSON.parse(raw)
  } catch {
    existing = []
  }

  const existingLinks = new Set(existing.map(v => v.link))
  const videos = [...existing]

  for (const ch of CHANNELS) {
    try {
      const vid = await fetchLatestVideo(ch.id)
      if (!existingLinks.has(vid.link)) {
        videos.unshift({ channel: ch.name, ...vid })
      }
    } catch (e) {
      console.error(`Error loading ${ch.name}:`, e)
    }
  }

  await fs.writeFile(DATA_PATH, JSON.stringify(videos, null, 2))
}

main().catch(console.error)
