import {
  compressToEncodedURIComponent as compress,
  decompressFromEncodedURIComponent as decompress,
} from 'lz-string'
import type { Creature } from './model'

export function readCreatureFromUrl(): Creature | null {
  const hash = location.hash.slice(1)
  if (!hash) return null
  try {
    const json = decompress(hash)
    if (!json) return null
    const parsed = JSON.parse(json) as Creature
    return parsed && typeof parsed.name === 'string' ? parsed : null
  } catch {
    return null
  }
}

export function writeCreatureToUrl(creature: Creature) {
  history.replaceState(null, '', `#${compress(JSON.stringify(creature))}`)
}
