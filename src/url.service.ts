import {
  compressToEncodedURIComponent as compress,
  decompressFromEncodedURIComponent as decompress,
} from 'lz-string'
import type { Creature } from './creature.model'
import { parseCreature } from './save-record.model'

export function readCreatureFromUrl() {
  const hash = location.hash.slice(1)
  if (!hash) return null
  try {
    const json = decompress(hash)
    if (!json) return null
    // Links made before a field existed simply lack it; the parser fills the defaults.
    return parseCreature(JSON.parse(json))
  } catch {
    return null
  }
}

export function writeCreatureToUrl(creature: Creature) {
  history.replaceState(null, '', `#${compress(JSON.stringify(creature))}`)
}
