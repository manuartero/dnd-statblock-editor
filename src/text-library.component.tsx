import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import {
  CATEGORIES,
  LIBRARY,
  destination,
  resolve,
  sectionLabel,
} from './text-library.model'
import type { Category, ResolvedSnippet } from './text-library.model'
import { SECTION_LABELS } from './creature.model'
import type { Creature, Section } from './creature.model'
import { renderInline } from './inline.render'
import s from './text-library.module.css'

type Props = {
  creature: Creature
  /** Section the picker was opened from; null when opened from the menu or the shortcut. */
  into: Section | null
  onClose: () => void
  onInsert: (snippet: ResolvedSnippet) => void
}

/** Plain text of the body for the two-line preview: markup stripped, no icons. */
const plain = (text: string) => text.replace(/\*/g, '')

const RESOLVED = LIBRARY.map(resolve)

const groupId = (category: string) => `snippet-group-${category.toLowerCase().replace(/\s+/g, '-')}`

export function TextLibrary({ creature, into, onClose, onInsert }: Props) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Category | null>(null)
  const [active, setActive] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Everything the picker may offer here: all snippets, or only those for the section it was opened from.
  const pool = useMemo(() => {
    return into ? RESOLVED.filter((sn) => sn.kind === into.kind) : RESOLVED
  }, [into])

  const categories = useMemo(() => CATEGORIES.filter((c) => pool.some((sn) => sn.category === c)), [pool])

  // Matches grouped by category. A hit on the name outranks a hit buried in the body text,
  // both inside a group and between groups, so "fireball" offers the spell before a slot line.
  const groups = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
    const rank = (sn: ResolvedSnippet) => (terms.every((t) => sn.name.toLowerCase().includes(t)) ? 0 : 1)
    const matches = pool.filter(
      (sn) => (!category || sn.category === category) && terms.every((t) => sn.search.includes(t)),
    )
    return CATEGORIES.map((c) => {
      const items = matches.filter((sn) => sn.category === c).sort((a, b) => rank(a) - rank(b))
      return { category: c, items, rank: items.length ? rank(items[0]) : 2 }
    })
      .filter((g) => g.items.length > 0)
      .sort((a, b) => a.rank - b.rank)
  }, [pool, category, query])

  /** Results in display order; arrow keys walk this list. */
  const results = useMemo(() => groups.flatMap((g) => g.items), [groups])
  const indexOf = useMemo(() => new Map(results.map((sn, i) => [sn, i])), [results])

  const current: ResolvedSnippet | undefined = results[Math.min(active, results.length - 1)]

  const search = (q: string) => {
    setQuery(q)
    setActive(0)
  }
  const filter = (c: Category | null) => {
    setCategory(c)
    setActive(0)
  }

  useEffect(() => searchRef.current?.focus(), [])
  useEffect(() => {
    listRef.current?.querySelector('[data-active]')?.scrollIntoView({ block: 'nearest' })
  }, [active, results])

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (current) onInsert(current)
    }
  }

  const dest = current ? destination({ creature, snippet: current, into }) : null
  const heading = into ? `Add to ${into.title || SECTION_LABELS[into.kind]}` : 'Text library'

  return (
    <div class={s.backdrop} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div class={s.dialog} role="dialog" aria-modal="true" aria-labelledby="text-library-title" onKeyDown={onKeyDown}>
        <header class={s.head}>
          <h2 id="text-library-title" class={s.heading}>
            {heading}
          </h2>
        </header>

        <input
          ref={searchRef}
          class={s.search}
          type="search"
          placeholder="Search a weapon, trait, feature or spell…"
          value={query}
          onInput={(e) => search((e.currentTarget as HTMLInputElement).value)}
          aria-label="Search the library"
          role="combobox"
          aria-expanded={true}
          aria-controls="text-library-results"
          aria-activedescendant={current ? `snippet-${current.id}` : undefined}
          aria-autocomplete="list"
          autocomplete="off"
          spellcheck={false}
        />

        <div class={s.chips} role="group" aria-label="Filter by category">
          <button
            class={category === null ? s.chipActive : s.chip}
            aria-pressed={category === null}
            onClick={() => filter(null)}
            type="button"
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              class={category === c ? s.chipActive : s.chip}
              aria-pressed={category === c}
              onClick={() => filter(category === c ? null : c)}
              type="button"
            >
              {c}
            </button>
          ))}
        </div>

        <div class={s.body}>
          <ul id="text-library-results" class={s.results} ref={listRef} role="listbox" aria-label="Snippets">
            {groups.map((g) => (
              <li key={g.category} class={s.group} role="group" aria-labelledby={groupId(g.category)}>
                <p id={groupId(g.category)} class={s.groupTitle}>
                  {g.category}
                </p>
                <ul class={s.groupList} role="none">
                  {g.items.map((sn) => {
                    const index = indexOf.get(sn) ?? 0
                    const isActive = sn === current
                    return (
                      <li
                        key={sn.id}
                        id={`snippet-${sn.id}`}
                        class={isActive ? s.rowActive : s.row}
                        data-active={isActive || undefined}
                        role="option"
                        aria-selected={isActive}
                        onMouseMove={() => index !== active && setActive(index)}
                        onClick={() => onInsert(sn)}
                      >
                        <span class={s.rowName}>{sn.name}</span>
                        <span class={s.rowTag}>{sectionLabel({ kind: sn.kind, section: sn.section })}</span>
                        <span class={s.rowText}>{plain(sn.text)}</span>
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
            {results.length === 0 && (
              <li class={s.empty} role="none">
                Nothing matches “{query}”. Try a weapon, a trait, a class feature or a spell name.
              </li>
            )}
          </ul>

          <aside class={s.preview} aria-label="Preview">
            {current && dest ? (
              <>
                <div class={s.sheet}>
                  {current.intro && (
                    <p class={s.sheetIntro} dangerouslySetInnerHTML={{ __html: renderInline(current.intro, { icons: creature.icons }) }} />
                  )}
                  <p class={s.sheetEntry}>
                    <span class={s.sheetName}>{current.name}.</span>{' '}
                    <span dangerouslySetInnerHTML={{ __html: renderInline(current.text, { icons: creature.icons }) }} />
                  </p>
                </div>
                <p class={s.destination}>
                  {dest.section ? `Appends to ${dest.title}` : `Creates a ${dest.title} section`}
                  {current.intro ? ' and sets its intro paragraph.' : '.'}
                </p>
                <button class={s.insert} onClick={() => onInsert(current)} type="button">
                  Add to {dest.title}
                </button>
              </>
            ) : (
              <p class={s.destination}>Pick a result to read it here before adding it.</p>
            )}
          </aside>
        </div>

        <footer class={s.foot}>
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> move
          </span>
          <span>
            <kbd>↵</kbd> add
          </span>
          <span>
            <kbd>esc</kbd> close
          </span>
          <span class={s.count} aria-live="polite">
            {results.length} of {pool.length}
          </span>
        </footer>
      </div>
    </div>
  )
}
