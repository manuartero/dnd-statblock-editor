import { makeRecord, parseSaveRecord, type SaveRecord } from './persist'

/**
 * All saves live under one localStorage key as an array of records.
 * Every access is guarded: private mode, disabled storage and quota limits
 * all surface as a `StorageError` with a message fit for the UI.
 */

const KEY = 'statblock.saves.v1'

export class StorageError extends Error {
  constructor(
    public kind: 'quota' | 'unavailable',
    message: string,
  ) {
    super(message)
    this.name = 'StorageError'
  }
}

const QUOTA_MESSAGE =
  'Browser storage is full. Embedded images make creatures big: use an image URL instead of an upload, or delete old saves.'
const UNAVAILABLE_MESSAGE = 'Browser storage is not available here (private window or storage disabled).'

const isQuotaError = (err: unknown) =>
  err instanceof DOMException &&
  (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED' || err.code === 22 || err.code === 1014)

function readAll(): SaveRecord[] {
  let raw: string | null
  try {
    raw = localStorage.getItem(KEY)
  } catch {
    return []
  }
  if (!raw) return []
  try {
    const data: unknown = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    const out: SaveRecord[] = []
    for (const item of data) {
      const parsed = parseSaveRecord(item)
      if (parsed.ok) out.push(parsed.record)
    }
    return out
  } catch {
    return []
  }
}

function writeAll(records: SaveRecord[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(records))
  } catch (err) {
    if (isQuotaError(err)) throw new StorageError('quota', QUOTA_MESSAGE)
    throw new StorageError('unavailable', UNAVAILABLE_MESSAGE)
  }
}

const byNewest = (a: SaveRecord, b: SaveRecord) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0)

/** Newest first. */
export function listSaves(): SaveRecord[] {
  return readAll().sort(byNewest)
}

export function getSave(id: string): SaveRecord | null {
  return readAll().find((r) => r.id === id) ?? null
}

/** Inserts or replaces by id. Throws `StorageError`. */
export function putSave(record: SaveRecord) {
  const all = readAll()
  const index = all.findIndex((r) => r.id === record.id)
  if (index === -1) all.unshift(record)
  else all[index] = record
  writeAll(all)
}

/** Throws `StorageError`. */
export function deleteSave(id: string) {
  writeAll(readAll().filter((r) => r.id !== id))
}

/** Copies a save under a new id. Returns the copy, or `null` if the id is unknown. Throws `StorageError`. */
export function duplicateSave(id: string): SaveRecord | null {
  const source = getSave(id)
  if (!source) return null
  const copy = makeRecord({ ...source.creature, name: `${source.creature.name} (copy)` })
  putSave(copy)
  return copy
}

/** Changes the creature's name inside a save. Throws `StorageError`. */
export function renameSave(id: string, name: string): SaveRecord | null {
  const source = getSave(id)
  if (!source) return null
  const renamed: SaveRecord = {
    ...source,
    updatedAt: new Date().toISOString(),
    creature: { ...source.creature, name },
  }
  putSave(renamed)
  return renamed
}

export const describeError = (err: unknown): string =>
  err instanceof StorageError ? err.message : err instanceof Error ? err.message : 'Something went wrong.'
