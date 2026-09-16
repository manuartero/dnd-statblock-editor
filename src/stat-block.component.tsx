import { useMemo } from 'preact/hooks'
import {
  ABILITIES,
  INLINE_ATTRIBUTES,
  SECTION_LABELS,
  makeEntry,
  modifier,
} from './creature.model'
import type { AttrLine, Creature, Entry, Section } from './creature.model'
import { Editable } from './editable.component'
import { AC_ICON, spellSlotIcons, weaponIcon } from './icons.render'
import s from './stat-block.module.css'

/** Class marking editor-only controls; the PNG exporter strips them. */
export const UI_ONLY = 'ui-only'

type Update = (fn: (c: Creature) => Creature) => void

type Props = {
  creature: Creature
  update: Update
}

type BlockProps = Props & {
  /** Opens the text library to add an entry to the given section. */
  openTextLibrary: (section: Section) => void
}

const Rule = () => (
  <svg class={s.rule} viewBox="0 0 400 5" preserveAspectRatio="none" aria-hidden="true">
    <polyline points="0,0 400,2.5 0,5" />
  </svg>
)

export function StatBlock({ creature, update, openTextLibrary }: BlockProps) {
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
            label="Creature name"
            onChange={(name) => update((c) => ({ ...c, name }))}
          />
          <Editable
            class={s.subtitle}
            value={creature.subtitle}
            placeholder="Size type, alignment"
            label="Size, type and alignment"
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
          <SectionView
            key={section.id}
            section={section}
            icons={creature.icons}
            update={update}
            openTextLibrary={openTextLibrary}
          />
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
    <dl class={s.props}>
      <div class={s.prop}>
        <RemoveButton onClick={() => update((c) => ({ ...c, core: null }))} title="Remove AC/HP/Speed" />
        <dt class={s.propLabel}>Armor Class</dt>
        {creature.icons && <img class="icon icon-ac" src={AC_ICON} alt="" draggable={false} />}
        <Editable tag="dd" label="Armor Class" value={core.ac} onChange={set('ac')} placeholder="10" />
      </div>
      <div class={s.prop}>
        <dt class={s.propLabel}>Hit Points</dt>
        <Editable tag="dd" label="Hit Points" value={core.hp} onChange={set('hp')} placeholder="10 (2d8 + 1)" />
      </div>
      <div class={s.prop}>
        <dt class={s.propLabel}>Speed</dt>
        <Editable tag="dd" label="Speed" value={core.speed} onChange={set('speed')} placeholder="30 ft." />
      </div>
    </dl>
  )
}

function Abilities({ creature, update }: Props) {
  return (
    <dl class={s.abilities}>
      {ABILITIES.map((key) => (
        <div key={key}>
          <dt class={s.abilityLabel}>{key.toUpperCase()}</dt>
          <dd>
            <Editable
              class={s.abilityScore}
              label={`${key.toUpperCase()} score`}
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
          </dd>
        </div>
      ))}
    </dl>
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

  const setLine = ({ id, patch }: { id: string; patch: Partial<AttrLine> }) =>
    update((c) => ({
      ...c,
      attributes: c.attributes.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }))
  const removeLine = (id: string) =>
    update((c) => ({ ...c, attributes: c.attributes.filter((l) => l.id !== id) }))

  return (
    <dl class={s.props}>
      {rows.map((row) => (
        <div key={row[0].id} class={row.length > 1 ? s.propInline : undefined}>
          {row.map((line) => (
            <div key={line.id} class={s.prop}>
              <RemoveButton onClick={() => removeLine(line.id)} title={`Remove ${line.label}`} />
              <Editable
                tag="dt"
                class={s.propLabel}
                label="Attribute name"
                value={line.label}
                onChange={(label) => setLine({ id: line.id, patch: { label } })}
              />
              <Editable
                tag="dd"
                label={line.label || 'Attribute value'}
                value={line.value}
                onChange={(value) => setLine({ id: line.id, patch: { value } })}
                placeholder="…"
              />
            </div>
          ))}
        </div>
      ))}
    </dl>
  )
}

/** Sections whose entry names are attacks, where a weapon icon makes sense. */
const WEAPON_SECTIONS = new Set<Section['kind']>(['actions', 'bonus', 'reactions', 'legendary'])

function SectionView({
  section,
  icons,
  update,
  openTextLibrary,
}: {
  section: Section
  icons: boolean
  update: Update
  openTextLibrary: (section: Section) => void
}) {
  const patchSection = (patch: Partial<Section>) =>
    update((c) => ({
      ...c,
      sections: c.sections.map((sec) => (sec.id === section.id ? { ...sec, ...patch } : sec)),
    }))
  const patchEntry = ({ id, patch }: { id: string; patch: Partial<Entry> }) =>
    patchSection({ entries: section.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) })
  const removeEntry = (id: string) =>
    patchSection({ entries: section.entries.filter((e) => e.id !== id) })
  const addEntry = () => patchSection({ entries: [...section.entries, makeEntry()] })
  const removeSection = () =>
    update((c) => ({ ...c, sections: c.sections.filter((sec) => sec.id !== section.id) }))

  const hasHeading = section.kind !== 'traits'
  const nameIcon = (name: string) => {
    if (!icons) return null
    if (WEAPON_SECTIONS.has(section.kind)) {
      const src = weaponIcon(name)
      return src && <img class="icon icon-weapon" src={src} alt="" draggable={false} />
    }
    if (section.kind === 'spellcasting') {
      const slots = spellSlotIcons(name)
      return (
        slots && (
          <span role="img" aria-label={`${slots.count} ${slots.alt}${slots.count === 1 ? '' : 's'}`}>
            {Array.from({ length: slots.count }, (_, i) => (
              <img key={i} class="icon icon-slot" src={slots.src} alt={slots.alt} draggable={false} />
            ))}
          </span>
        )
      )
    }
    return null
  }

  return (
    <section class={s.section} aria-label={section.title || SECTION_LABELS[section.kind]}>
      <div class={s.sectionHead}>
        <RemoveButton onClick={removeSection} title="Remove section" />
        {hasHeading && (
          <Editable
            tag="h2"
            class={s.sectionTitle}
            value={section.title}
            placeholder="Section title"
            label="Section title"
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
            icons={icons}
            placeholder="Intro paragraph"
            label="Intro paragraph"
            onChange={(intro) => patchSection({ intro })}
          />
        )}
      </div>
      {section.entries.map((entry) => (
        <p key={entry.id} class={s.entry}>
          <RemoveButton onClick={() => removeEntry(entry.id)} title="Remove entry" />
          <span class={s.entryHead}>
            <Editable
              class={s.entryName}
              value={entry.name}
              placeholder="Name"
              label="Entry name"
              onChange={(name) => patchEntry({ id: entry.id, patch: { name } })}
            />
            {'\u2060' /* word joiner: never wrap between the name and its icon */}
            {nameIcon(entry.name)}
          </span>
          <Editable
            value={entry.text}
            multiline
            rich
            icons={icons}
            placeholder="Description. Use *italic* and **bold**."
            label={`${entry.name || 'Entry'} description`}
            onChange={(text) => patchEntry({ id: entry.id, patch: { text } })}
          />
        </p>
      ))}
      <span class={s.addRow}>
        <button class={`${s.add} ${UI_ONLY}`} onClick={addEntry} type="button">
          + entry
        </button>
        <button class={`${s.add} ${UI_ONLY}`} onClick={() => openTextLibrary(section)} type="button">
          + from library
        </button>
      </span>
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
