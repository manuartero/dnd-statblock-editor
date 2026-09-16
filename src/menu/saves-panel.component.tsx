import { blankCreature, sampleCreature } from '../creature.model'
import type { Creature } from '../creature.model'
import type { Library, Outcome } from '../library.hook'
import { relativeTime } from '../time.format'
import { PanelGroup } from './panel-group.component'
import s from './menu.module.css'

type Props = {
  library: Library
  /** Shows a save outcome in the menu's status line. */
  report: (outcome: Outcome) => void
  openLibrary: () => void
  replace: (c: Creature) => void
}

export function SavesPanel({ library, report, openLibrary, replace }: Props) {
  const saveState = !library.current
    ? 'Not saved yet'
    : library.dirty
      ? 'Unsaved changes'
      : `Saved ${relativeTime(library.current.updatedAt)}`

  const onImportFile = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (file) report(await library.importJson(file))
  }

  return (
    <>
      <PanelGroup>
        <div class={s.pair}>
          <button class={`${s.button} ${s.primary}`} onClick={() => report(library.save())} type="button">
            Save
          </button>
          <button class={s.button} onClick={() => report(library.saveAsNew())} type="button">
            Save as new
          </button>
        </div>
        <button class={s.button} onClick={openLibrary} type="button">
          Load…{library.saves.length > 0 ? ` (${library.saves.length})` : ''}
        </button>
        <p class={`${s.saveState} ${library.dirty ? s.saveStateDirty : ''}`}>{saveState}</p>
      </PanelGroup>

      <PanelGroup title="Move between browsers">
        <div class={s.pair}>
          <button class={s.button} onClick={() => report(library.exportJson())} type="button">
            Export JSON
          </button>
          <label class={s.button}>
            Import JSON
            <input class={s.fileHidden} type="file" accept="application/json,.json" onChange={onImportFile} />
          </label>
        </div>
        <p class={s.hint}>Saves stay in this browser's storage. Export JSON gives you a file to keep or move.</p>
      </PanelGroup>

      <PanelGroup title="Start over">
        <div class={s.pair}>
          <button class={s.button} onClick={() => replace(blankCreature())} type="button">
            Blank creature
          </button>
          <button class={s.button} onClick={() => replace(sampleCreature())} type="button">
            Sample: Skeleton
          </button>
        </div>
        <p class={s.hint}>Replaces the block on the table. Save first if you want to keep it.</p>
      </PanelGroup>
    </>
  )
}
