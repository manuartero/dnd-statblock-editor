import { makeRecord, parseSaveRecord } from './save-record.model'
import type { SaveRecord } from './save-record.model'

/**
 * All saves live under one localStorage key as an array of records.
 * Every access is guarded: private mode, disabled storage and quota limits
 * all surface as a storage error with a message fit for the UI.
 */

const KEY = 'statblock.saves.v1'

const STORAGE_ERROR = 'StorageError'

const storageError = (message: string) => {
  const err = new Error(message)
  err.name = STORAGE_ERROR
  return err
}

export const isStorageError = (err: unknown) => err instanceof Error && err.name === STORAGE_ERROR

const QUOTA_MESSAGE =
  'Browser storage is full. Embedded images make creatures big: use an image URL instead of an upload, or delete old saves.'
const UNAVAILABLE_MESSAGE = 'Browser storage is not available here (private window or storage disabled).'

const isQuotaError = (err: unknown) =>
  err instanceof DOMException &&
  (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED' || err.code === 22 || err.code === 1014)

function readAll() {
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
    throw storageError(isQuotaError(err) ? QUOTA_MESSAGE : UNAVAILABLE_MESSAGE)
  }
}

const byNewest = (a: SaveRecord, b: SaveRecord) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0)

/** Newest first. */
export function listSaves() {
  return readAll().sort(byNewest)
}

export function getSave(id: string) {
  return readAll().find((r) => r.id === id) ?? null
}

/** Inserts or replaces by id. Throws a storage error. */
export function putSave(record: SaveRecord) {
  const all = readAll()
  const index = all.findIndex((r) => r.id === record.id)
  if (index === -1) all.unshift(record)
  else all[index] = record
  writeAll(all)
}

/** Throws a storage error. */
export function deleteSave(id: string) {
  writeAll(readAll().filter((r) => r.id !== id))
}

/** Copies a save under a new id. Returns the copy, or `null` if the id is unknown. Throws a storage error. */
export function duplicateSave(id: string) {
  const source = getSave(id)
  if (!source) return null
  const copy = makeRecord({ creature: { ...source.creature, name: `${source.creature.name} (copy)` } })
  putSave(copy)
  return copy
}

/** Changes the creature's name inside a save. Throws a storage error. */
export function renameSave({ id, name }: { id: string; name: string }) {
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

export const describeError = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong.')
