import { useCallback, useEffect, useState } from 'preact/hooks'
import { sampleCreature, type Creature } from './model'
import { readCreatureFromUrl, writeCreatureToUrl } from './url'
import { useLibrary } from './library'
import { StatBlock } from './components/StatBlock'
import { Menu } from './components/Menu'
import { LoadScreen } from './components/LoadScreen'

export function App() {
  const [creature, setCreature] = useState<Creature>(() => readCreatureFromUrl() ?? sampleCreature())
  const [currentSaveId, setCurrentSaveId] = useState<string | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)

  const update = useCallback((fn: (c: Creature) => Creature) => setCreature((c) => fn(c)), [])

  /** Blank / sample: a fresh creature that belongs to no save. */
  const replace = useCallback((c: Creature) => {
    setCreature(c)
    setCurrentSaveId(null)
  }, [])

  const library = useLibrary({ creature, setCreature, currentSaveId, setCurrentSaveId })

  useEffect(() => {
    writeCreatureToUrl(creature)
    document.title = creature.name ? `${creature.name} · Stat Block` : 'Stat Block'
  }, [creature])

  return (
    <>
      <main class="canvas">
        <StatBlock creature={creature} update={update} />
      </main>
      <Menu
        creature={creature}
        update={update}
        replace={replace}
        library={library}
        openLibrary={() => setLibraryOpen(true)}
      />
      {libraryOpen && <LoadScreen library={library} onClose={() => setLibraryOpen(false)} />}
    </>
  )
}
