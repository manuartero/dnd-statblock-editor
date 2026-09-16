import { useState } from 'preact/hooks'
import type { Creature, UpdateCreature } from '../creature.model'
import type { Library, Outcome } from '../library.hook'
import { Icon } from '../icon.component'
import { PANEL_TITLES } from './menu.model'
import type { PanelId } from './menu.model'
import { Rail } from './rail.component'
import { BlocksPanel } from './blocks-panel.component'
import { TextPanel } from './text-panel.component'
import { LookPanel } from './look-panel.component'
import { SavesPanel } from './saves-panel.component'
import { ExportPanel } from './export-panel.component'
import s from './menu.module.css'

type Props = {
  creature: Creature
  update: UpdateCreature
  replace: (c: Creature) => void
  library: Library
  openLibrary: () => void
  status: string
  setStatus: (msg: string) => void
  /** Shows a message in the status line for a moment. */
  flash: (msg: string) => void
  openTextLibrary: () => void
}

/** The icon rail, the one open panel beside it, and the shared status line. */
export function Menu({
  creature,
  update,
  replace,
  library,
  openLibrary,
  status,
  setStatus,
  flash,
  openTextLibrary,
}: Props) {
  const [panel, setPanel] = useState<PanelId | null>('blocks')
  const [libraryStatus, setLibraryStatus] = useState<Outcome | null>(null)

  // Errors stay until the next action; successes fade like the other flashes.
  const report = (outcome: Outcome) => {
    setLibraryStatus(outcome)
    if (outcome.ok) setTimeout(() => setLibraryStatus((o) => (o === outcome ? null : o)), 2500)
  }

  const toggle = (id: PanelId) => setPanel((p) => (p === id ? null : id))

  // Escape inside the panel folds it away and hands focus back to its rail button.
  const onPanelKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || !panel) return
    e.stopPropagation()
    document.getElementById(`rail-${panel}`)?.focus()
    setPanel(null)
  }

  const content = (id: PanelId) => {
    switch (id) {
      case 'blocks':
        return <BlocksPanel creature={creature} update={update} />
      case 'text':
        return <TextPanel openTextLibrary={openTextLibrary} />
      case 'look':
        return <LookPanel creature={creature} update={update} />
      case 'saves':
        return <SavesPanel library={library} report={report} openLibrary={openLibrary} replace={replace} />
      case 'export':
        return <ExportPanel creatureName={creature.name} setStatus={setStatus} flash={flash} />
    }
  }

  // One message at a time: a save outcome wins over an export flash, which wins over the resting save state.
  const toast = libraryStatus?.message || status
  const toastClass = [s.toast, libraryStatus && !libraryStatus.ok ? s.toastError : '', toast ? s.toastLive : '']
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <Rail panel={panel} dirty={library.dirty} onToggle={toggle} />

      {panel && (
        <aside id="menu-panel" class={s.panel} aria-label={PANEL_TITLES[panel]} onKeyDown={onPanelKeyDown}>
          <header class={s.panelHead}>
            <h1 class={s.panelTitle}>{PANEL_TITLES[panel]}</h1>
            <button class={s.close} onClick={() => setPanel(null)} aria-label="Close panel" type="button">
              <Icon name="close" size={18} />
            </button>
          </header>
          <div class={s.panelBody}>{content(panel)}</div>
        </aside>
      )}

      <p class={toastClass} role="status" aria-live="polite">
        {toast}
      </p>
    </>
  )
}
