import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { ABILITIES, modifier } from '../model'
import type { SaveRecord } from '../persist'
import type { Library, Outcome } from '../library'
import { relativeTime } from '../time'
import s from './LoadScreen.module.css'

interface Props {
  library: Library
  onClose: () => void
}

/** Above this many saves the search box appears. */
const SEARCH_THRESHOLD = 6

/**
 * Full-viewport overlay listing every save as a small parchment slip.
 * Click a slip (or its Load button) to open it in the editor.
 */
export function LoadScreen({ library, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState<Outcome | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    const previous = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus()
    }
  }, [onClose])

  const report = (outcome: Outcome) => {
    setNotice(outcome)
    if (outcome.ok) setTimeout(() => setNotice((n) => (n === outcome ? null : n)), 2500)
  }

  const load = (id: string) => {
    library.load(id)
    onClose()
  }

  const onImportFile = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    const outcome = await library.importJson(file)
    if (outcome.ok) onClose()
    else report(outcome)
  }

  const needle = query.trim().toLowerCase()
  const visible = useMemo(
    () =>
      needle
        ? library.saves.filter(
            (r) =>
              r.creature.name.toLowerCase().includes(needle) || r.creature.subtitle.toLowerCase().includes(needle),
          )
        : library.saves,
    [library.saves, needle],
  )

  const count = library.saves.length
  const importInput = (
    <label class={s.importLabel}>
      Import JSON
      <input class={s.fileHidden} type="file" accept="application/json,.json" onChange={onImportFile} />
    </label>
  )

  return (
    <div class={s.backdrop} onClick={onClose}>
      <div
        ref={panelRef}
        class={s.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="library-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <header class={s.head}>
          <div class={s.heading}>
            <h2 id="library-title" class={s.title}>
              Library
            </h2>
            <p class={s.count}>
              {count === 0 ? 'No saved creatures' : count === 1 ? 'One creature' : `${count} creatures`}
            </p>
          </div>
          {count > SEARCH_THRESHOLD && (
            <input
              class={s.search}
              type="search"
              placeholder="Search by name or type"
              value={query}
              onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
              aria-label="Search saved creatures"
            />
          )}
          {count > 0 && importInput}
          <button class={s.close} onClick={onClose} type="button" aria-label="Close library">
            ×
          </button>
        </header>

        {notice && <p class={`${s.notice} ${notice.ok ? '' : s.noticeError}`}>{notice.message}</p>}

        {count === 0 ? (
          <div class={s.empty}>
            <div class={s.emptySlip}>
              <p class={s.emptyTitle}>Nothing here yet</p>
              <p class={s.emptyText}>
                Save the creature you are editing from the side menu, and it will show up here. You can also bring
                in a JSON file exported earlier.
              </p>
              {importInput}
            </div>
          </div>
        ) : visible.length === 0 ? (
          <p class={s.noMatch}>No creature matches “{query.trim()}”.</p>
        ) : (
          <ul class={s.grid}>
            {visible.map((record) => (
              <SaveCard
                key={record.id}
                record={record}
                current={record.id === library.currentSaveId}
                onLoad={() => load(record.id)}
                onDuplicate={() => report(library.duplicate(record.id))}
                onRename={(name) => report(library.rename(record.id, name))}
                onDelete={() => report(library.remove(record.id))}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

interface CardProps {
  record: SaveRecord
  current: boolean
  onLoad: () => void
  onDuplicate: () => void
  onRename: (name: string) => void
  onDelete: () => void
}

/** First token of a stat like "13 (armor scraps)" or "1/4 (50 XP)". */
const compact = (value: string) => value.trim().split(/\s+/)[0] ?? ''

function SaveCard({ record, current, onLoad, onDuplicate, onRename, onDelete }: CardProps) {
  const { creature } = record
  const [renaming, setRenaming] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [draft, setDraft] = useState(creature.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renaming) inputRef.current?.select()
  }, [renaming])

  const commitRename = () => {
    setRenaming(false)
    const name = draft.trim()
    if (name && name !== creature.name) onRename(name)
    else setDraft(creature.name)
  }

  const cr = creature.attributes.find((a) => a.label === 'Challenge')?.value
  const stats: [string, string][] = []
  if (creature.core) {
    if (creature.core.ac) stats.push(['AC', compact(creature.core.ac)])
    if (creature.core.hp) stats.push(['HP', compact(creature.core.hp)])
  }
  if (cr) stats.push(['CR', compact(cr)])

  // The whole slip opens the save, except when a control inside it was the target.
  const onCardClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('button, input, label')) return
    if (renaming || confirming) return
    onLoad()
  }

  return (
    <li class={`${s.card} ${current ? s.cardCurrent : ''}`} onClick={onCardClick}>
      <div class={s.cardHead}>
        {renaming ? (
          <input
            ref={inputRef}
            class={s.renameInput}
            value={draft}
            aria-label="New name"
            onInput={(e) => setDraft((e.currentTarget as HTMLInputElement).value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commitRename()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                e.stopPropagation()
                setDraft(creature.name)
                setRenaming(false)
              }
            }}
          />
        ) : (
          <h3 class={s.name}>{creature.name || 'Unnamed creature'}</h3>
        )}
        <p class={s.subtitle}>{creature.subtitle || ' '}</p>
      </div>

      <svg class={s.rule} viewBox="0 0 400 5" preserveAspectRatio="none" aria-hidden="true">
        <polyline points="0,0 400,2.5 0,5" />
      </svg>

      {stats.length > 0 && (
        <p class={s.stats}>
          {stats.map(([label, value]) => (
            <span key={label} class={s.stat}>
              <b>{label}</b> {value}
            </span>
          ))}
        </p>
      )}

      <div class={s.abilities}>
        {ABILITIES.map((key) => (
          <span key={key}>
            <b>{key.toUpperCase()}</b>
            <span>
              {creature.abilities[key]} <small>({modifier(creature.abilities[key])})</small>
            </span>
          </span>
        ))}
      </div>

      <footer class={s.cardFoot}>
        {confirming ? (
          <>
            <span class={s.confirmText}>Delete this creature?</span>
            <span class={s.actions}>
              <button class={`${s.action} ${s.danger}`} onClick={onDelete} type="button">
                Delete
              </button>
              <button class={s.action} onClick={() => setConfirming(false)} type="button" autoFocus>
                Keep
              </button>
            </span>
          </>
        ) : (
          <>
            <span class={s.when}>
              {current ? 'Open in the editor' : `Saved ${relativeTime(record.updatedAt)}`}
            </span>
            <span class={s.actions}>
              <button class={s.action} onClick={() => setRenaming(true)} type="button">
                Rename
              </button>
              <button class={s.action} onClick={onDuplicate} type="button">
                Duplicate
              </button>
              <button class={s.action} onClick={() => setConfirming(true)} type="button">
                Delete
              </button>
              <button class={s.load} onClick={onLoad} type="button">
                Load
              </button>
            </span>
          </>
        )}
      </footer>
    </li>
  )
}
