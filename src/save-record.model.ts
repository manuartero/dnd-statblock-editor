import { uid } from './creature.model'
import type { AttrLine, Creature, Entry, Section, SectionKind } from './creature.model'

/**
 * Plain-TS parsing of creatures and save records. No schema library: every
 * field is checked by hand, missing optional fields get defaults, and
 * anything that is not recognisably a creature is rejected with `null`.
 */

export const SCHEMA_VERSION = 1

export type SaveRecord = {
  schemaVersion: typeof SCHEMA_VERSION
  id: string
  /** ISO timestamps. */
  savedAt: string
  updatedAt: string
  creature: Creature
}

const SECTION_KINDS = new Set<SectionKind>([
  'traits',
  'actions',
  'bonus',
  'reactions',
  'legendary',
  'spellcasting',
  'custom',
])

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

const str = (v: unknown) => (typeof v === 'string' ? v : '')

const id = (v: unknown) => (typeof v === 'string' && v.length > 0 ? v : uid())

const score = (v: unknown) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseInt(v, 10) : NaN
  return Number.isFinite(n) ? Math.trunc(n) : 10
}

function parseEntry(v: unknown): Entry | null {
  if (!isObject(v)) return null
  return { id: id(v.id), name: str(v.name), text: str(v.text) }
}

function parseSection(v: unknown): Section | null {
  if (!isObject(v)) return null
  const kind = SECTION_KINDS.has(v.kind as SectionKind) ? (v.kind as SectionKind) : 'custom'
  const entries = Array.isArray(v.entries) ? v.entries.map(parseEntry).filter((e): e is Entry => e !== null) : []
  return {
    id: id(v.id),
    kind,
    title: str(v.title),
    intro: typeof v.intro === 'string' ? v.intro : null,
    entries,
  }
}

function parseAttribute(v: unknown): AttrLine | null {
  if (!isObject(v)) return null
  return { id: id(v.id), label: str(v.label), value: str(v.value) }
}

/** Returns a complete creature, or `null` when the input is not one. */
export function parseCreature(input: unknown): Creature | null {
  if (!isObject(input)) return null
  if (typeof input.name !== 'string') return null

  const core = isObject(input.core)
    ? { ac: str(input.core.ac), hp: str(input.core.hp), speed: str(input.core.speed) }
    : null

  const ab = isObject(input.abilities) ? input.abilities : {}
  const abilities = {
    str: score(ab.str),
    dex: score(ab.dex),
    con: score(ab.con),
    int: score(ab.int),
    wis: score(ab.wis),
    cha: score(ab.cha),
  }

  const attributes = Array.isArray(input.attributes)
    ? input.attributes.map(parseAttribute).filter((a): a is AttrLine => a !== null)
    : []
  const sections = Array.isArray(input.sections)
    ? input.sections.map(parseSection).filter((s): s is Section => s !== null)
    : []

  return {
    name: input.name,
    subtitle: str(input.subtitle),
    core,
    abilities,
    attributes,
    sections,
    image: typeof input.image === 'string' && input.image.length > 0 ? input.image : null,
    columns: input.columns === 2 ? 2 : 1,
    icons: input.icons === true,
  }
}

export const newSaveId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${uid()}`

type RecordInput = {
  creature: Creature
  /** An existing save to update in place; omit for a brand-new record. */
  base?: Pick<SaveRecord, 'id' | 'savedAt'>
}

export function makeRecord({ creature, base }: RecordInput): SaveRecord {
  const now = new Date().toISOString()
  return {
    schemaVersion: SCHEMA_VERSION,
    id: base?.id ?? newSaveId(),
    savedAt: base?.savedAt ?? now,
    updatedAt: now,
    creature,
  }
}

export type ParseResult = { ok: true; record: SaveRecord } | { ok: false; error: string }

/**
 * Upgrades a record from an older schema to the current one. Only v1 exists
 * today; each future bump adds a step here.
 */
function migrate(input: Record<string, unknown>): Record<string, unknown> | string {
  const version = typeof input.schemaVersion === 'number' ? input.schemaVersion : 1
  if (version > SCHEMA_VERSION) return `This file was made by a newer version of the editor (schema ${version}).`
  // v1 → current: nothing to do yet.
  return { ...input, schemaVersion: SCHEMA_VERSION }
}

/**
 * Parses a save record. A bare creature (no `schemaVersion`, no `creature`
 * field) is accepted too and wrapped in a fresh record.
 */
export function parseSaveRecord(input: unknown): ParseResult {
  if (!isObject(input)) return { ok: false, error: 'Expected a JSON object.' }

  const migrated = migrate(input)
  if (typeof migrated === 'string') return { ok: false, error: migrated }

  const raw = 'creature' in migrated ? migrated.creature : migrated
  const creature = parseCreature(raw)
  if (!creature) return { ok: false, error: 'This does not look like a stat block: it needs at least a name.' }

  const savedAt = isoOr({ value: migrated.savedAt })
  return {
    ok: true,
    record: {
      schemaVersion: SCHEMA_VERSION,
      id: id(migrated.id),
      savedAt,
      updatedAt: isoOr({ value: migrated.updatedAt, fallback: savedAt }),
      creature,
    },
  }
}

const isoOr = ({ value, fallback = new Date().toISOString() }: { value: unknown; fallback?: string }) =>
  typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : fallback

/** The JSON file format is the save record itself. */
export function exportCreatureJson(input: RecordInput) {
  return JSON.stringify(makeRecord(input), null, 2)
}

export function importCreatureJson(text: string): ParseResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: 'The file is not valid JSON.' }
  }
  return parseSaveRecord(data)
}

export const fileSlug = (name: string) => name.trim().replace(/\s+/g, '-').toLowerCase() || 'creature'

export function downloadJson({ json, filename }: { json: string; filename: string }) {
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
