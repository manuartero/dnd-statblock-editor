import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import {
  CATEGORIES,
  EDITIONS,
  LIBRARY,
  destination,
  resolve,
  sectionLabel,
  type Category,
  type Edition,
  type ResolvedSnippet,
} from '../textLibrary'
import { SECTION_LABELS, type Creature, type Section } from '../model'
import { renderInline } from '../inline'
import s from './TextLibrary.module.css'

interface Props {
  creature: Creature
  /** Section the picker was opened from; null when opened from the menu or the shortcut. */
  into: Section | null
  onClose: () => void
  onInsert: (snippet: ResolvedSnippet) => void
}

const EDITION_KEY = 'statblock-editor:edition'

function loadEdition(): Edition {
  try {
    const v = localStorage.getItem(EDITION_KEY)
    if (v === '2014' || v === '2024') return v
  } catch {
    /* private mode or storage disabled: fall through to the default */
  }
  return '2024'
}

function saveEdition(edition: Edition) {
  try {
    localStorage.setItem(EDITION_KEY, edition)
  } catch {
    /* not remembered, still applied */
  }
}

/** Plain text of the body for the two-line preview: markup stripped, no icons. */
const plain = (text: string) => text.replace(/\*/g, '')

export function TextLibrary({ creature, into, onClose, onInsert }: Props) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Category | null>(null)
  const [edition, setEdition] = useState<Edition>(loadEdition)
  const [active, setActive] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const pickEdition = (e: Edition) => {
    setEdition(e)
    saveEdition(e)
  }

  // Everything the picker may offer here: all snippets, or only those for the section it was opened from.
  const pool = useMemo(() => {
    const all = LIBRARY.map((sn) => resolve(sn, edition))
    return into ? all.filter((sn) => sn.kind === into.kind) : all
  }, [edition, into])

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

  const current: ResolvedSnippet | undefined = results[Math.min(active, results.length - 1)]

  useEffect(() => searchRef.current?.focus(), [])
  useEffect(() => setActive(0), [results])
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

  const dest = current ? destination(creature, current, into) : null
  const heading = into ? `Add to ${into.title || SECTION_LABELS[into.kind]}` : 'Text library'

  return (
    <div class={s.backdrop} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div class={s.dialog} role="dialog" aria-modal="true" aria-label={heading} onKeyDown={onKeyDown}>
        <header class={s.head}>
          <h2 class={s.heading}>{heading}</h2>
          <div class={s.edition} role="group" aria-label="Rules wording">
            <span class={s.editionLabel}>Wording</span>
            {EDITIONS.map((e) => (
              <button
                key={e}
                class={edition === e ? s.editionActive : undefined}
                onClick={() => pickEdition(e)}
                type="button"
              >
                {e}
              </button>
            ))}
          </div>
        </header>

        <input
          ref={searchRef}
          class={s.search}
          type="search"
          placeholder="Search a weapon, trait, feature or spell…"
          value={query}
          onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
          aria-label="Search the library"
          autocomplete="off"
          spellcheck={false}
        />

        <div class={s.chips}>
          <button class={category === null ? s.chipActive : s.chip} onClick={() => setCategory(null)} type="button">
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              class={category === c ? s.chipActive : s.chip}
              onClick={() => setCategory(category === c ? null : c)}
              type="button"
            >
              {c}
            </button>
          ))}
        </div>

        <div class={s.body}>
          <ul class={s.results} ref={listRef} role="listbox" aria-label="Snippets">
            {groups.map((g) => (
              <li key={g.category} class={s.group}>
                <p class={s.groupTitle}>{g.category}</p>
                <ul class={s.groupList}>
                  {g.items.map((sn) => {
                    const index = results.indexOf(sn)
                    const isActive = sn === current
                    return (
                      <li
                        key={sn.id}
                        class={isActive ? s.rowActive : s.row}
                        data-active={isActive || undefined}
                        role="option"
                        aria-selected={isActive}
                        onMouseMove={() => index !== active && setActive(index)}
                        onClick={() => onInsert(sn)}
                      >
                        <span class={s.rowName}>{sn.name}</span>
                        <span class={s.rowTag}>{sectionLabel(sn.kind, sn.section)}</span>
                        <span class={s.rowText}>{plain(sn.text)}</span>
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
            {results.length === 0 && (
              <li class={s.empty}>
                Nothing matches “{query}”. Try a weapon, a trait, a class feature or a spell name.
              </li>
            )}
          </ul>

          <aside class={s.preview} aria-live="polite">
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
          <span class={s.count}>
            {results.length} of {pool.length}
          </span>
        </footer>
      </div>
    </div>
  )
}
