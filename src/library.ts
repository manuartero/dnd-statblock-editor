import { useCallback, useMemo, useState } from 'preact/hooks'
import type { Creature } from './model'
import {
  downloadJson,
  exportCreatureJson,
  fileSlug,
  importCreatureJson,
  makeRecord,
  type SaveRecord,
} from './persist'
import { deleteSave, describeError, duplicateSave, listSaves, putSave, renameSave } from './storage'

export interface Outcome {
  ok: boolean
  message: string
}

export interface Library {
  saves: SaveRecord[]
  /** The save the editor is working on, if any. */
  currentSaveId: string | null
  /** The editor differs from what is stored under `currentSaveId`. */
  dirty: boolean
  save(): Outcome
  saveAsNew(): Outcome
  load(id: string): void
  duplicate(id: string): Outcome
  rename(id: string, name: string): Outcome
  remove(id: string): Outcome
  exportJson(): Outcome
  importJson(file: File): Promise<Outcome>
}

interface Params {
  creature: Creature
  setCreature: (c: Creature) => void
  currentSaveId: string | null
  setCurrentSaveId: (id: string | null) => void
}

const ok = (message: string): Outcome => ({ ok: true, message })
const fail = (err: unknown): Outcome => ({ ok: false, message: describeError(err) })

/** Saves, loads and the JSON round trip, all against localStorage. */
export function useLibrary({ creature, setCreature, currentSaveId, setCurrentSaveId }: Params): Library {
  const [saves, setSaves] = useState<SaveRecord[]>(() => listSaves())
  const refresh = useCallback(() => setSaves(listSaves()), [])

  const current = useMemo(() => saves.find((r) => r.id === currentSaveId) ?? null, [saves, currentSaveId])

  // The creature only changes on commit (blur), so a stringify here is cheap enough.
  const dirty = useMemo(() => {
    if (!current) return false
    if (current.creature === creature) return false
    return JSON.stringify(current.creature) !== JSON.stringify(creature)
  }, [current, creature])

  const store = (record: SaveRecord): Outcome => {
    try {
      putSave(record)
      setCurrentSaveId(record.id)
      refresh()
      return ok(`Saved ${record.creature.name || 'creature'}`)
    } catch (err) {
      return fail(err)
    }
  }

  const save = () => store(current ? makeRecord(creature, current) : makeRecord(creature))
  const saveAsNew = () => store(makeRecord(creature))

  const load = (id: string) => {
    const record = saves.find((r) => r.id === id)
    if (!record) return
    setCreature(record.creature)
    setCurrentSaveId(record.id)
  }

  const duplicate = (id: string): Outcome => {
    try {
      const copy = duplicateSave(id)
      refresh()
      return copy ? ok(`Duplicated as ${copy.creature.name}`) : fail(new Error('That save no longer exists.'))
    } catch (err) {
      return fail(err)
    }
  }

  const rename = (id: string, name: string): Outcome => {
    try {
      const renamed = renameSave(id, name)
      refresh()
      // Keep the editor in step when its own save is renamed and has no other pending edits.
      if (renamed && id === currentSaveId && !dirty) setCreature(renamed.creature)
      return renamed ? ok('Renamed') : fail(new Error('That save no longer exists.'))
    } catch (err) {
      return fail(err)
    }
  }

  const remove = (id: string): Outcome => {
    try {
      deleteSave(id)
      if (id === currentSaveId) setCurrentSaveId(null)
      refresh()
      return ok('Deleted')
    } catch (err) {
      return fail(err)
    }
  }

  const exportJson = (): Outcome => {
    try {
      downloadJson(exportCreatureJson(creature, current ?? undefined), `${fileSlug(creature.name)}.json`)
      return ok('JSON downloaded')
    } catch (err) {
      return fail(err)
    }
  }

  const importJson = async (file: File): Promise<Outcome> => {
    let text: string
    try {
      text = await file.text()
    } catch {
      return fail(new Error('Could not read the file.'))
    }
    const parsed = importCreatureJson(text)
    if (!parsed.ok) return { ok: false, message: parsed.error }
    // Imported files become a new save; the id in the file is not trusted to be unique.
    const record = makeRecord(parsed.record.creature)
    const outcome = store(record)
    if (!outcome.ok) return outcome
    setCreature(record.creature)
    return ok(`Imported ${record.creature.name || 'creature'}`)
  }

  return { saves, currentSaveId, dirty, save, saveAsNew, load, duplicate, rename, remove, exportJson, importJson }
}
