#!/usr/bin/env node
// Fetches game iconography from https://bg3.wiki and stores it under public/icons/bg3/,
// sorted into folders. Icons are discovered through the wiki's own file categories
// (MediaWiki API), so a spell page, a class page or the Damage page all resolve to the
// same underlying files.
//
//   pnpm icons                 fetch everything (idempotent, skips unchanged files)
//   pnpm icons -- --only dice  only sources whose folder starts with "dice"
//   pnpm icons -- --dry-run    list what would be downloaded, touch nothing
//   pnpm icons -- --force      re-download even if the local file matches
//
// Zero dependencies. Requires Node 20+ (global fetch).

import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const API = 'https://bg3.wiki/w/api.php'
const USER_AGENT = 'dnd-statblock-editor icon fetcher (https://github.com/manuartero/dnd-statblock-editor)'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'public', 'icons', 'bg3')
const MAX_ICON_SIDE = 512 // anything bigger is artwork / a tooltip image, not an icon
const DOWNLOAD_CONCURRENCY = 4

/**
 * What to fetch and where to put it. Order matters: a file that sits in several categories
 * lands in the first folder that claims it.
 *
 *   recurse: false    only files directly in the category
 *   recurse: 'flat'   include subcategories, same folder
 *   recurse: 'nested' include subcategories, one subfolder per subcategory (mirrors the wiki tree)
 */
const SOURCES = [
  // Rules & interface
  { folder: 'dice', category: 'Die icons' },
  { folder: 'damage-types', category: 'Damage type icons' },
  { folder: 'resources', category: 'Resource icons' }, // action, bonus action, reaction, spell slot, movement...
  { folder: 'interface', category: 'Interface icons' }, // saving throw, concentration, range, duration, proficiency...
  { folder: 'abilities', category: 'Ability score icons' },
  { folder: 'skills', category: 'Skill icons' },
  { folder: 'weapon-types', category: 'Weapon type icons' },
  { folder: 'hud', category: 'HUD icons', recurse: 'flat' },
  { folder: 'menu', category: 'Menu icons' },
  { folder: 'map', category: 'Map icons' },
  { folder: 'generic', category: 'Generic icons' },
  // Character
  { folder: 'classes', category: 'Class images', recurse: 'flat' },
  { folder: 'races', category: 'Race icons' },
  { folder: 'backgrounds', category: 'Background icons' },
  { folder: 'deities', category: 'Deity icons' },
  // Abilities: spells, actions, features, conditions
  { folder: 'spells', category: 'Spell icons' },
  { folder: 'actions', category: 'Action icons' },
  { folder: 'weapon-actions', category: 'Weapon action icons' },
  { folder: 'legendary-actions', category: 'Legendary action icons' },
  { folder: 'passive-features', category: 'Passive feature icons' },
  { folder: 'tadpole', category: 'Tadpole icons' },
  { folder: 'areas', category: 'Area icons' },
  { folder: 'conditions', category: 'Condition Icons', recurse: 'flat' },
  // Items: weapons, armour, consumables... mirrors the wiki tree (items/equipment/weapon/longsword)
  { folder: 'items', category: 'Item icons', recurse: 'nested' },
  { folder: 'achievements', category: 'Achievement icons' },
]

const args = new Set(process.argv.slice(2))
const DRY_RUN = args.has('--dry-run')
const FORCE = args.has('--force')
const ONLY = (() => {
  const i = process.argv.indexOf('--only')
  return i === -1 ? null : process.argv[i + 1]
})()

// ---------------------------------------------------------------------------------------- wiki API

async function fetchWithRetry(url, attempt = 0) {
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT } })
  if ((res.status === 429 || res.status >= 500) && attempt < 5) {
    const wait = 1000 * 2 ** attempt
    console.warn(`  ${res.status} from wiki, retrying in ${wait}ms`)
    await new Promise((r) => setTimeout(r, wait))
    return fetchWithRetry(url, attempt + 1)
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`)
  return res
}

async function api(params) {
  const url = new URL(API)
  url.search = new URLSearchParams({ format: 'json', formatversion: '2', maxlag: '5', ...params })
  const json = await (await fetchWithRetry(url)).json()
  if (json.error) throw new Error(`API error ${json.error.code}: ${json.error.info}`)
  return json
}

/** Yields every page of a paginated query. */
async function* paginate(params) {
  let cont = {}
  do {
    const json = await api({ ...params, ...cont })
    yield json
    cont = json.continue ?? null
  } while (cont)
}

/** Files and subcategories directly inside a category. */
async function categoryMembers(category) {
  const files = []
  const subcats = []
  for await (const page of paginate({
    action: 'query',
    list: 'categorymembers',
    cmtitle: `Category:${category}`,
    cmtype: 'file|subcat',
    cmlimit: '500',
  })) {
    for (const m of page.query.categorymembers) {
      if (m.ns === 6) files.push(m.title)
      else if (m.ns === 14) subcats.push(m.title.replace(/^Category:/, ''))
    }
  }
  return { files, subcats }
}

/** Walks a source's category tree and returns [{ title, folder, category }]. */
async function collect(source, seen) {
  const out = []
  const visited = new Set()
  const queue = [{ category: source.category, folder: source.folder }]
  while (queue.length) {
    const { category, folder } = queue.shift()
    if (visited.has(category)) continue
    visited.add(category)
    const { files, subcats } = await categoryMembers(category)
    for (const title of files) {
      if (seen.has(title)) continue
      seen.add(title)
      out.push({ title, folder, category })
    }
    if (!source.recurse) continue
    for (const sub of subcats) {
      queue.push({ category: sub, folder: source.recurse === 'nested' ? join(folder, categorySlug(sub)) : folder })
    }
  }
  return out
}

/** Resolves url/size/mime/sha1 for a list of File: titles, 50 at a time. */
async function imageInfo(titles) {
  const byTitle = new Map()
  for (let i = 0; i < titles.length; i += 50) {
    const json = await api({
      action: 'query',
      prop: 'imageinfo',
      iiprop: 'url|size|mime|sha1',
      titles: titles.slice(i, i + 50).join('|'),
    })
    for (const page of json.query.pages) {
      const info = page.imageinfo?.[0]
      if (info) byTitle.set(page.title, info)
    }
  }
  return byTitle
}

// ---------------------------------------------------------------------------------------- naming

function slug(text) {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // Selûne -> Selune
    .replace(/\+/g, ' plus ')
    .replace(/['’]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

/** "Longsword icons" -> "longsword", "Subclass images" -> "subclass" */
function categorySlug(category) {
  return slug(category.replace(/\s+(icons?|images)$/i, ''))
}

/** "File:Hold Person Unfaded Icon.webp" -> { stem: "hold-person", ext: ".webp" } */
function fileName(title) {
  const name = title.replace(/^File:/, '')
  const dot = name.lastIndexOf('.')
  const ext = name.slice(dot).toLowerCase()
  const stem = name
    .slice(0, dot)
    .replace(/\s+unfaded/i, '')
    .replace(/\s+icons?$/i, '')
  return { stem: slug(stem) || 'icon', ext }
}

/** Assigns unique relative paths, appending -2, -3... on collisions inside a folder. */
function assignPaths(entries) {
  const taken = new Set()
  for (const e of entries.sort((a, b) => a.title.localeCompare(b.title))) {
    const { stem, ext } = fileName(e.title)
    let candidate = join(e.folder, stem + ext)
    for (let n = 2; taken.has(candidate); n++) candidate = join(e.folder, `${stem}-${n}${ext}`)
    if (candidate !== join(e.folder, stem + ext)) console.warn(`  name clash: ${e.title} -> ${candidate}`)
    taken.add(candidate)
    e.file = candidate
  }
  return entries
}

// ---------------------------------------------------------------------------------------- download

async function localSha1(path) {
  try {
    return createHash('sha1').update(await readFile(path)).digest('hex')
  } catch {
    return null
  }
}

async function download(entry) {
  const dest = join(OUT_DIR, entry.file)
  if (!FORCE && existsSync(dest) && (await localSha1(dest)) === entry.sha1) return 'skipped'
  if (DRY_RUN) return 'would-download'
  const res = await fetchWithRetry(entry.url)
  const bytes = new Uint8Array(await res.arrayBuffer())
  await mkdir(dirname(dest), { recursive: true })
  await writeFile(dest, bytes)
  return 'downloaded'
}

async function runPool(items, worker, concurrency) {
  const results = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < items.length) {
        const i = next++
        results[i] = await worker(items[i], i)
      }
    }),
  )
  return results
}

// ---------------------------------------------------------------------------------------- main

async function main() {
  const sources = ONLY ? SOURCES.filter((s) => s.folder.startsWith(ONLY)) : SOURCES
  if (!sources.length) throw new Error(`--only ${ONLY} matched no source folder`)

  console.log(`Collecting file lists from ${sources.length} wiki categories...`)
  const seen = new Set()
  const entries = []
  for (const source of sources) {
    const found = await collect(source, seen)
    console.log(`  ${source.folder.padEnd(18)} ${String(found.length).padStart(5)} files  (Category:${source.category})`)
    entries.push(...found)
  }

  console.log(`Resolving URLs for ${entries.length} files...`)
  const info = await imageInfo(entries.map((e) => e.title))
  const icons = []
  for (const e of entries) {
    const i = info.get(e.title)
    if (!i) {
      console.warn(`  no image info for ${e.title}, skipping`)
      continue
    }
    if (!i.mime.startsWith('image/')) continue
    if (i.width > MAX_ICON_SIDE || i.height > MAX_ICON_SIDE) {
      console.warn(`  not an icon (${i.width}x${i.height}): ${e.title}, skipping`)
      continue
    }
    icons.push({ ...e, url: i.url, width: i.width, height: i.height, bytes: i.size, mime: i.mime, sha1: i.sha1 })
  }
  assignPaths(icons)

  console.log(`${DRY_RUN ? 'Checking' : 'Downloading'} ${icons.length} icons into ${relative(ROOT, OUT_DIR)}/ ...`)
  const tally = { downloaded: 0, skipped: 0, 'would-download': 0, failed: 0 }
  let done = 0
  await runPool(
    icons,
    async (icon) => {
      try {
        tally[await download(icon)]++
      } catch (err) {
        tally.failed++
        console.warn(`  failed ${icon.title}: ${err.message}`)
      }
      if (++done % 250 === 0) console.log(`  ${done}/${icons.length}`)
    },
    DOWNLOAD_CONCURRENCY,
  )

  if (!DRY_RUN) {
    await mkdir(OUT_DIR, { recursive: true })
    const manifest = {
      source: 'https://bg3.wiki',
      generatedAt: new Date().toISOString(),
      count: icons.length,
      icons: icons
        .sort((a, b) => a.file.localeCompare(b.file))
        .map(({ file, title, folder, category, url, width, height, bytes, sha1 }) => ({
          file,
          title: title.replace(/^File:/, ''),
          folder,
          category,
          source: `https://bg3.wiki/wiki/File:${encodeURIComponent(title.replace(/^File:/, '').replace(/ /g, '_'))}`,
          url,
          width,
          height,
          bytes,
          sha1,
        })),
    }
    await writeFile(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  }

  const totalBytes = icons.reduce((n, i) => n + i.bytes, 0)
  console.log(
    `Done. ${tally.downloaded} downloaded, ${tally.skipped} already up to date, ` +
      `${tally['would-download']} pending, ${tally.failed} failed. ` +
      `${icons.length} icons, ${(totalBytes / 1024 / 1024).toFixed(1)} MB.`,
  )
  if (tally.failed) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
