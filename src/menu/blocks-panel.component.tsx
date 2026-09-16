import { ATTRIBUTE_PRESETS, SECTION_LABELS, insertSection, makeAttribute, makeSection } from '../creature.model'
import type { Creature, SectionKind, UpdateCreature } from '../creature.model'
import { PanelGroup } from './panel-group.component'
import s from './menu.module.css'

const SECTION_KINDS = Object.keys(SECTION_LABELS) as SectionKind[]

type Props = {
  creature: Creature
  update: UpdateCreature
}

export function BlocksPanel({ creature, update }: Props) {
  const addCore = () => update((c) => ({ ...c, core: { ac: '10', hp: '10 (2d8 + 1)', speed: '30 ft.' } }))

  const addSection = (kind: SectionKind) =>
    update((c) => ({ ...c, sections: insertSection({ sections: c.sections, section: makeSection(kind) }) }))

  const addAttribute = (label: string) =>
    update((c) => ({ ...c, attributes: [...c.attributes, makeAttribute(label)] }))

  const hasAttribute = (label: string) => creature.attributes.some((a) => a.label === label)

  return (
    <>
      <PanelGroup title="Sections">
        <div class={s.list}>
          <button class={s.chip} disabled={creature.core !== null} onClick={addCore} type="button">
            AC / HP / Speed
          </button>
          {SECTION_KINDS.map((kind) => (
            <button key={kind} class={s.chip} onClick={() => addSection(kind)} type="button">
              {SECTION_LABELS[kind]}
            </button>
          ))}
        </div>
      </PanelGroup>

      <PanelGroup title="Attribute lines">
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
      </PanelGroup>

      <p class={s.hint}>
        Click any text in the block to edit it. Hover an entry for the remove button. Use *italic* and **bold** in
        descriptions.
      </p>
    </>
  )
}
