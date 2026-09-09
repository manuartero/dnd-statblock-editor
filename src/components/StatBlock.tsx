import { useMemo } from 'preact/hooks'
import {
  ABILITIES,
  INLINE_ATTRIBUTES,
  makeEntry,
  modifier,
  type AttrLine,
  type Creature,
  type Entry,
  type Section,
} from '../model'
import { Editable } from './Editable'
import s from './StatBlock.module.css'

/** Class marking editor-only controls; the PNG exporter strips them. */
export const UI_ONLY = 'ui-only'

type Update = (fn: (c: Creature) => Creature) => void

interface Props {
  creature: Creature
  update: Update
}

const Rule = () => (
  <svg class={s.rule} viewBox="0 0 400 5" preserveAspectRatio="none" aria-hidden="true">
    <polyline points="0,0 400,2.5 0,5" />
  </svg>
)

export function StatBlock({ creature, update }: Props) {
  const pageStyle = creature.image ? { backgroundImage: `url("${creature.image}")` } : undefined
  return (
    <div id="stat-page" class={`${s.page} ${creature.image ? s.pageWithImage : ''} ${creature.columns === 2 ? s.pageTwoColumns : ''}`} style={pageStyle}>
      <article class={`${s.block} ${creature.columns === 2 ? s.twoColumns : ''}`}>
        <header>
          <Editable
            tag="h1"
            class={s.name}
            value={creature.name}
            placeholder="Name"
            onChange={(name) => update((c) => ({ ...c, name }))}
          />
          <Editable
            class={s.subtitle}
            value={creature.subtitle}
            placeholder="Size type, alignment"
            onChange={(subtitle) => update((c) => ({ ...c, subtitle }))}
          />
        </header>
        <Rule />
        {creature.core && (
          <>
            <CoreBlock creature={creature} update={update} />
            <Rule />
          </>
        )}
        <Abilities creature={creature} update={update} />
        <Rule />
        {creature.attributes.length > 0 && (
          <>
            <Attributes creature={creature} update={update} />
            <Rule />
          </>
        )}
        {creature.sections.map((section) => (
          <SectionView key={section.id} section={section} update={update} />
        ))}
      </article>
    </div>
  )
}

function CoreBlock({ creature, update }: Props) {
  const core = creature.core!
  const set = (key: keyof typeof core) => (value: string) =>
    update((c) => ({ ...c, core: { ...c.core!, [key]: value } }))
  return (
    <div class={s.props}>
      <div class={s.prop}>
        <RemoveButton onClick={() => update((c) => ({ ...c, core: null }))} title="Remove AC/HP/Speed" />
        <span class={s.propLabel}>Armor Class</span>
        <Editable value={core.ac} onChange={set('ac')} placeholder="10" />
      </div>
      <div class={s.prop}>
        <span class={s.propLabel}>Hit Points</span>
        <Editable value={core.hp} onChange={set('hp')} placeholder="10 (2d8 + 1)" />
      </div>
      <div class={s.prop}>
        <span class={s.propLabel}>Speed</span>
        <Editable value={core.speed} onChange={set('speed')} placeholder="30 ft." />
      </div>
    </div>
  )
}

function Abilities({ creature, update }: Props) {
  return (
    <div class={s.abilities}>
      {ABILITIES.map((key) => (
        <div key={key}>
          <div class={s.abilityLabel}>{key.toUpperCase()}</div>
          <div>
            <Editable
              class={s.abilityScore}
              value={String(creature.abilities[key])}
              onChange={(v) => {
                const n = parseInt(v, 10)
                update((c) => ({
                  ...c,
                  abilities: { ...c.abilities, [key]: Number.isFinite(n) ? n : 10 },
                }))
              }}
            />{' '}
            ({modifier(creature.abilities[key])})
          </div>
        </div>
      ))}
    </div>
  )
}

function Attributes({ creature, update }: Props) {
  // Group consecutive inline attributes (Challenge + Proficiency Bonus) onto one row.
  const rows = useMemo(() => {
    const out: AttrLine[][] = []
    for (const line of creature.attributes) {
      const prev = out[out.length - 1]
      if (prev && INLINE_ATTRIBUTES.has(line.label) && prev.every((l) => INLINE_ATTRIBUTES.has(l.label))) {
        prev.push(line)
      } else {
        out.push([line])
      }
    }
    return out
  }, [creature.attributes])

  const setLine = (id: string, patch: Partial<AttrLine>) =>
    update((c) => ({
      ...c,
      attributes: c.attributes.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }))
  const removeLine = (id: string) =>
    update((c) => ({ ...c, attributes: c.attributes.filter((l) => l.id !== id) }))

  return (
    <div class={s.props}>
      {rows.map((row) => (
        <div key={row[0].id} class={row.length > 1 ? s.propInline : undefined}>
          {row.map((line) => (
            <div key={line.id} class={s.prop}>
              <RemoveButton onClick={() => removeLine(line.id)} title={`Remove ${line.label}`} />
              <Editable
                class={s.propLabel}
                value={line.label}
                onChange={(label) => setLine(line.id, { label })}
              />
              <Editable
                value={line.value}
                onChange={(value) => setLine(line.id, { value })}
                placeholder="…"
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function SectionView({ section, update }: { section: Section; update: Update }) {
  const patchSection = (patch: Partial<Section>) =>
    update((c) => ({
      ...c,
      sections: c.sections.map((sec) => (sec.id === section.id ? { ...sec, ...patch } : sec)),
    }))
  const patchEntry = (id: string, patch: Partial<Entry>) =>
    patchSection({ entries: section.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) })
  const removeEntry = (id: string) =>
    patchSection({ entries: section.entries.filter((e) => e.id !== id) })
  const addEntry = () => patchSection({ entries: [...section.entries, makeEntry()] })
  const removeSection = () =>
    update((c) => ({ ...c, sections: c.sections.filter((sec) => sec.id !== section.id) }))

  const hasHeading = section.kind !== 'traits'

  return (
    <section class={s.section}>
      <div class={s.sectionHead}>
        <RemoveButton onClick={removeSection} title="Remove section" />
        {hasHeading && (
          <Editable
            tag="h2"
            class={s.sectionTitle}
            value={section.title}
            placeholder="Section title"
            onChange={(title) => patchSection({ title })}
          />
        )}
        {section.intro !== null && (
          <Editable
            tag="p"
            class={s.intro}
            value={section.intro}
            multiline
            rich
            placeholder="Intro paragraph"
            onChange={(intro) => patchSection({ intro })}
          />
        )}
      </div>
      {section.entries.map((entry) => (
        <p key={entry.id} class={s.entry}>
          <RemoveButton onClick={() => removeEntry(entry.id)} title="Remove entry" />
          <Editable
            class={s.entryName}
            value={entry.name}
            placeholder="Name"
            onChange={(name) => patchEntry(entry.id, { name })}
          />
          <Editable
            value={entry.text}
            multiline
            rich
            placeholder="Description. Use *italic* and **bold**."
            onChange={(text) => patchEntry(entry.id, { text })}
          />
        </p>
      ))}
      <button class={`${s.add} ${UI_ONLY}`} onClick={addEntry} type="button">
        + entry
      </button>
    </section>
  )
}

function RemoveButton({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <button class={`${s.remove} ${UI_ONLY}`} onClick={onClick} title={title} type="button" aria-label={title}>
      ×
    </button>
  )
}
