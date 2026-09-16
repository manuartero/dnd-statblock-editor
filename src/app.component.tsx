import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import { sampleCreature } from './creature.model'
import type { Creature, Section } from './creature.model'
import { insertSnippet } from './text-library.model'
import type { ResolvedSnippet } from './text-library.model'
import { readCreatureFromUrl, writeCreatureToUrl } from './url.service'
import { useLibrary } from './library.hook'
import { StatBlock } from './stat-block.component'
import { Menu } from './menu.component'
import { LoadScreen } from './load-screen.component'
import { TextLibrary } from './text-library.component'

/** Where the text library picker was opened from: a section, or the menu / shortcut (null). */
type Picker = { into: Section | null }

/** True while the user is typing somewhere: the Cmd/Ctrl+K shortcut must stay out of the way. */
const isTyping = () => {
  const el = document.activeElement as HTMLElement | null
  return !!el && (el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')
}

export function App() {
  const [creature, setCreature] = useState<Creature>(() => readCreatureFromUrl() ?? sampleCreature())
  const [currentSaveId, setCurrentSaveId] = useState<string | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [picker, setPicker] = useState<Picker | null>(null)
  const [status, setStatus] = useState('')
  const statusTimer = useRef<ReturnType<typeof setTimeout>>()

  const update = useCallback((fn: (c: Creature) => Creature) => setCreature((c) => fn(c)), [])

  /** Blank / sample: a fresh creature that belongs to no save. */
  const replace = useCallback((c: Creature) => {
    setCreature(c)
    setCurrentSaveId(null)
  }, [])

  const library = useLibrary({ creature, setCreature, currentSaveId, setCurrentSaveId })

  const flash = useCallback((msg: string) => {
    setStatus(msg)
    clearTimeout(statusTimer.current)
    statusTimer.current = setTimeout(() => setStatus(''), 2500)
  }, [])

  useEffect(() => {
    writeCreatureToUrl(creature)
    document.title = creature.name ? `${creature.name} · Stat Block` : 'Stat Block'
  }, [creature])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && !isTyping()) {
        e.preventDefault()
        setPicker((p) => (p ? null : { into: null }))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const insert = (snippet: ResolvedSnippet) => {
    // The picker may have been opened from a section that has since been removed.
    const into = picker?.into ? creature.sections.find((sec) => sec.id === picker.into!.id) ?? null : null
    const result = insertSnippet({ creature, snippet, into })
    setCreature(result.creature)
    setPicker(null)
    flash(`Added ${snippet.name} to ${result.title}`)
  }

  return (
    <>
      <main class="canvas">
        <StatBlock creature={creature} update={update} openTextLibrary={(section) => setPicker({ into: section })} />
      </main>
      <Menu
        creature={creature}
        update={update}
        replace={replace}
        library={library}
        openLibrary={() => setLibraryOpen(true)}
        status={status}
        setStatus={setStatus}
        flash={flash}
        openTextLibrary={() => setPicker({ into: null })}
      />
      {libraryOpen && <LoadScreen library={library} onClose={() => setLibraryOpen(false)} />}
      {picker && (
        <TextLibrary creature={creature} into={picker.into} onClose={() => setPicker(null)} onInsert={insert} />
      )}
    </>
  )
}
