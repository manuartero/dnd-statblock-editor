import { useEffect, useRef, useState } from 'preact/hooks'
import {
  ATTRIBUTE_PRESETS,
  SECTION_LABELS,
  blankCreature,
  makeAttribute,
  insertSection,
  makeSection,
  sampleCreature,
} from './creature.model'
import type { Creature, SectionKind } from './creature.model'
import type { Library, Outcome } from './library.hook'
import { relativeTime } from './time.format'
import { Icon } from './icon.component'
import type { IconName } from './icon.component'
import s from './menu.module.css'

type Props = {
  creature: Creature
  update: (fn: (c: Creature) => Creature) => void
  replace: (c: Creature) => void
  library: Library
  openLibrary: () => void
  status: string
  setStatus: (msg: string) => void
  /** Shows a message in the status line for a moment. */
  flash: (msg: string) => void
  openTextLibrary: () => void
}

type PanelId = 'blocks' | 'text' | 'look' | 'saves' | 'export'

type RailItem = { id: PanelId; label: string; title: string; icon: IconName }

/** Editing tools first, then the file tools; the rail draws a gap between the two. */
const EDIT_ITEMS: RailItem[] = [
  { id: 'blocks', label: 'Blocks', title: 'Blocks', icon: 'blocks' },
  { id: 'text', label: 'Text', title: 'Text library', icon: 'scroll' },
  { id: 'look', label: 'Look', title: 'Look', icon: 'sliders' },
]
const FILE_ITEMS: RailItem[] = [
  { id: 'saves', label: 'Saves', title: 'Saved creatures', icon: 'book' },
  { id: 'export', label: 'Export', title: 'Export', icon: 'export' },
]
const TITLES = Object.fromEntries([...EDIT_ITEMS, ...FILE_ITEMS].map((i) => [i.id, i.title])) as Record<
  PanelId,
  string
>

const isMac = /Mac|iPhone|iPad/.test(navigator.platform)

const SECTION_KINDS = Object.keys(SECTION_LABELS) as SectionKind[]

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
  const [imageUrl, setImageUrl] = useState('')
  const panelRef = useRef<HTMLElement>(null)

  // Errors stay until the next action; successes fade like the other flashes.
  const report = (outcome: Outcome) => {
    setLibraryStatus(outcome)
    if (outcome.ok) setTimeout(() => setLibraryStatus((o) => (o === outcome ? null : o)), 2500)
  }

  const toggle = (id: PanelId) => setPanel((p) => (p === id ? null : id))

  // Escape inside the panel folds it away and hands focus back to its rail button.
  useEffect(() => {
    const node = panelRef.current
    if (!node || !panel) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setPanel(null)
      document.getElementById(`rail-${panel}`)?.focus()
    }
    node.addEventListener('keydown', onKey)
    return () => node.removeEventListener('keydown', onKey)
  }, [panel])

  const onImportFile = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (file) report(await library.importJson(file))
  }

  const current = library.saves.find((r) => r.id === library.currentSaveId)
  const saveState = !current
    ? 'Not saved yet'
    : library.dirty
      ? 'Unsaved changes'
      : `Saved ${relativeTime(current.updatedAt)}`

  const addSection = (kind: SectionKind) =>
    update((c) => ({ ...c, sections: insertSection({ sections: c.sections, section: makeSection(kind) }) }))

  const addAttribute = (label: string) =>
    update((c) => ({ ...c, attributes: [...c.attributes, makeAttribute(label)] }))

  const hasAttribute = (label: string) => creature.attributes.some((a) => a.label === label)

  const setImage = (image: string | null) => update((c) => ({ ...c, image }))

  const onFile = (e: Event) => {
    const file = (e.currentTarget as HTMLInputElement).files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setImage(String(reader.result))
    reader.readAsDataURL(file)
  }

  const exportPng = async () => {
    const node = document.getElementById('stat-page')
    if (!node) return
    setStatus('Rendering…')
    node.dataset.exporting = 'true'
    try {
      // Only needed for this one action: keep the rasteriser out of the initial bundle.
      const { toPng } = await import('html-to-image')
      const dataUrl = await toPng(node, { pixelRatio: 2, cacheBust: true })
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `${creature.name.trim().replace(/\s+/g, '-').toLowerCase() || 'creature'}.png`
      a.click()
      flash('PNG downloaded')
    } catch (err) {
      console.error(err)
      flash('Export failed (cross-origin image?)')
    } finally {
      delete node.dataset.exporting
    }
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(location.href)
    flash(`Link copied (${Math.round(location.href.length / 1024)} KB)`)
  }

  // One message at a time: a save outcome wins over an export flash, which wins over the resting save state.
  const toast = libraryStatus?.message || status
  const toastClass = [s.toast, libraryStatus && !libraryStatus.ok ? s.toastError : '', toast ? s.toastLive : '']
    .filter(Boolean)
    .join(' ')

  const railButton = ({ id, label, title, icon }: RailItem) => (
    <button
      key={id}
      id={`rail-${id}`}
      class={`${s.railButton} ${panel === id ? s.railActive : ''}`}
      aria-pressed={panel === id}
      aria-controls="menu-panel"
      title={title}
      onClick={() => toggle(id)}
      type="button"
    >
      <Icon name={icon} />
      <span class={s.railLabel}>{label}</span>
      {id === 'saves' && library.dirty && <span class={s.dot} aria-label="Unsaved changes" />}
    </button>
  )

  return (
    <>
      <nav class={s.rail} aria-label="Editor tools">
        <div class={s.mark} title="Stat Block">
          <Icon name="d20" size={26} />
        </div>
        <div class={s.railGroup}>{EDIT_ITEMS.map(railButton)}</div>
        <div class={s.railGroup}>{FILE_ITEMS.map(railButton)}</div>
      </nav>

      {panel && (
        <aside id="menu-panel" class={s.panel} ref={panelRef} aria-label={TITLES[panel]}>
          <header class={s.panelHead}>
            <h1 class={s.panelTitle}>{TITLES[panel]}</h1>
            <button class={s.close} onClick={() => setPanel(null)} aria-label="Close panel" type="button">
              <Icon name="close" size={18} />
            </button>
          </header>

          <div class={s.panelBody}>
            {panel === 'blocks' && (
              <>
                <div class={s.group}>
                  <p class={s.groupTitle}>Sections</p>
                  <div class={s.list}>
                    <button
                      class={s.chip}
                      disabled={creature.core !== null}
                      onClick={() => update((c) => ({ ...c, core: { ac: '10', hp: '10 (2d8 + 1)', speed: '30 ft.' } }))}
                      type="button"
                    >
                      AC / HP / Speed
                    </button>
                    {SECTION_KINDS.map((kind) => (
                      <button key={kind} class={s.chip} onClick={() => addSection(kind)} type="button">
                        {SECTION_LABELS[kind]}
                      </button>
                    ))}
                  </div>
                </div>

                <div class={s.group}>
                  <p class={s.groupTitle}>Attribute lines</p>
                  <div class={s.list}>
                    {ATTRIBUTE_PRESETS.map((label) => (
                      <button
                        key={label}
                        class={s.chip}
                        disabled={hasAttribute(label)}
                        onClick={() => addAttribute(label)}
                        type="button"
                      >
                        {label}
                      </button>
                    ))}
                    <button class={s.chip} onClick={() => addAttribute('Label')} type="button">
                      Custom…
                    </button>
                  </div>
                </div>

                <p class={s.hint}>
                  Click any text in the block to edit it. Hover an entry for the remove button. Use *italic* and
                  **bold** in descriptions.
                </p>
              </>
            )}

            {panel === 'text' && (
              <>
                <button class={`${s.button} ${s.accent}`} onClick={openTextLibrary} type="button">
                  Insert from library…
                </button>
                <p class={s.hint}>
                  Weapon attacks, monster traits, class features, spellcasting lines and a few spells, in the
                  rulebook wording. Each entry lands in the section you pick.
                </p>
                <p class={s.hint}>
                  <kbd class={s.kbd}>{isMac ? '⌘' : 'Ctrl'}</kbd>
                  <kbd class={s.kbd}>K</kbd> opens it from anywhere.
                </p>
              </>
            )}

            {panel === 'look' && (
              <>
                <div class={s.group}>
                  <p class={s.groupTitle}>Columns</p>
                  <div class={s.segment}>
                    {([1, 2] as const).map((n) => (
                      <button
                        key={n}
                        class={creature.columns === n ? s.active : undefined}
                        onClick={() => update((c) => ({ ...c, columns: n }))}
                        type="button"
                      >
                        {n === 1 ? 'One' : 'Two'}
                      </button>
                    ))}
                  </div>
                </div>

                <div class={s.group}>
                  <p class={s.groupTitle}>Iconography</p>
                  <div class={s.segment}>
                    {([false, true] as const).map((on) => (
                      <button
                        key={String(on)}
                        class={creature.icons === on ? s.active : undefined}
                        onClick={() => update((c) => ({ ...c, icons: on }))}
                        type="button"
                      >
                        {on ? 'Game icons' : 'Text only'}
                      </button>
                    ))}
                  </div>
                  <p class={s.hint}>
                    An AC badge next to Armor Class, weapon icons after attack names, dice and damage-type icons in
                    descriptions, and one pip per spell slot.
                  </p>
                </div>

                <div class={s.group}>
                  <p class={s.groupTitle}>Background art</p>
                  <div class={s.pair}>
                    <input
                      class={s.input}
                      type="url"
                      placeholder="https://…/art.png"
                      aria-label="Image URL"
                      value={imageUrl}
                      onInput={(e) => setImageUrl((e.currentTarget as HTMLInputElement).value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && imageUrl) setImage(imageUrl)
                      }}
                    />
                    <button
                      class={`${s.button} ${s.useUrl}`}
                      disabled={!imageUrl}
                      onClick={() => setImage(imageUrl)}
                      type="button"
                    >
                      Use
                    </button>
                  </div>
                  <label class={s.button}>
                    Upload a file…
                    <input class={s.fileHidden} type="file" accept="image/*" onChange={onFile} />
                  </label>
                  {creature.image && (
                    <button class={s.button} onClick={() => setImage(null)} type="button">
                      Remove image
                    </button>
                  )}
                  {creature.image?.startsWith('data:') && (
                    <p class={s.hint}>Uploaded images are embedded in the link, which makes it very long. Use a URL to share.</p>
                  )}
                </div>
              </>
            )}

            {panel === 'saves' && (
              <>
                <div class={s.group}>
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
                </div>

                <div class={s.group}>
                  <p class={s.groupTitle}>Move between browsers</p>
                  <div class={s.pair}>
                    <button class={s.button} onClick={() => report(library.exportJson())} type="button">
                      Export JSON
                    </button>
                    <label class={s.button}>
                      Import JSON
                      <input class={s.fileHidden} type="file" accept="application/json,.json" onChange={onImportFile} />
                    </label>
                  </div>
                  <p class={s.hint}>
                    Saves stay in this browser's storage. Export JSON gives you a file to keep or move.
                  </p>
                </div>

                <div class={s.group}>
                  <p class={s.groupTitle}>Start over</p>
                  <div class={s.pair}>
                    <button class={s.button} onClick={() => replace(blankCreature())} type="button">
                      Blank creature
                    </button>
                    <button class={s.button} onClick={() => replace(sampleCreature())} type="button">
                      Sample: Skeleton
                    </button>
                  </div>
                  <p class={s.hint}>Replaces the block on the table. Save first if you want to keep it.</p>
                </div>
              </>
            )}

            {panel === 'export' && (
              <>
                <button class={`${s.button} ${s.primary} ${s.withIcon}`} onClick={exportPng} type="button">
                  <Icon name="download" size={16} />
                  Export PNG
                </button>
                <button class={`${s.button} ${s.withIcon}`} onClick={copyLink} type="button">
                  <Icon name="link" size={16} />
                  Copy shareable link
                </button>
                <p class={s.hint}>
                  The PNG is rendered at twice the on-screen size. The link always holds the current creature, so
                  anyone who opens it sees this exact block.
                </p>
              </>
            )}
          </div>
        </aside>
      )}

      <p class={toastClass} role="status" aria-live="polite">
        {toast}
      </p>
    </>
  )
}
