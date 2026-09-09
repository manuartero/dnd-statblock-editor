import { useCallback, useEffect, useState } from 'preact/hooks'
import { sampleCreature, type Creature } from './model'
import { readCreatureFromUrl, writeCreatureToUrl } from './url'
import { StatBlock } from './components/StatBlock'
import { Menu } from './components/Menu'

export function App() {
  const [creature, setCreature] = useState<Creature>(() => readCreatureFromUrl() ?? sampleCreature())

  const update = useCallback((fn: (c: Creature) => Creature) => setCreature((c) => fn(c)), [])

  useEffect(() => {
    writeCreatureToUrl(creature)
    document.title = creature.name ? `${creature.name} · Stat Block` : 'Stat Block'
  }, [creature])

  return (
    <>
      <main class="canvas">
        <StatBlock creature={creature} update={update} />
      </main>
      <Menu creature={creature} update={update} replace={setCreature} />
    </>
  )
}
