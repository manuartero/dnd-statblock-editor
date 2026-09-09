import { useState } from 'preact/hooks'
import { toPng } from 'html-to-image'
import {
  ATTRIBUTE_PRESETS,
  SECTION_LABELS,
  blankCreature,
  makeAttribute,
  insertSection,
  makeSection,
  sampleCreature,
  type Creature,
  type SectionKind,
} from '../model'
import s from './Menu.module.css'

interface Props {
  creature: Creature
  update: (fn: (c: Creature) => Creature) => void
  replace: (c: Creature) => void
}

const SECTION_KINDS = Object.keys(SECTION_LABELS) as SectionKind[]

export function Menu({ creature, update, replace }: Props) {
  const [status, setStatus] = useState('')
  const [imageUrl, setImageUrl] = useState('')

  const flash = (msg: string) => {
    setStatus(msg)
    setTimeout(() => setStatus(''), 2500)
  }

  const addSection = (kind: SectionKind) =>
    update((c) => ({ ...c, sections: insertSection(c.sections, makeSection(kind)) }))

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

  return (
    <aside class={s.menu}>
      <h1 class={s.title}>Stat Block</h1>

      <div class={s.group}>
        <p class={s.groupTitle}>Add block</p>
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
        <p class={s.groupTitle}>Add attribute line</p>
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

      <div class={s.group}>
        <p class={s.groupTitle}>Layout</p>
        <div class={s.segment}>
          {([1, 2] as const).map((n) => (
            <button
              key={n}
              class={creature.columns === n ? s.active : undefined}
              onClick={() => update((c) => ({ ...c, columns: n }))}
              type="button"
            >
              {n === 1 ? 'One column' : 'Two columns'}
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
          Weapon icons after attack names, dice and damage-type icons in descriptions, and one pip per spell
          slot in the spellcasting section.
        </p>
      </div>

      <div class={s.group}>
        <p class={s.groupTitle}>Image</p>
        <input
          class={s.input}
          type="url"
          placeholder="https://…/art.png"
          value={imageUrl}
          onInput={(e) => setImageUrl((e.currentTarget as HTMLInputElement).value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && imageUrl) setImage(imageUrl)
          }}
        />
        <button class={s.button} disabled={!imageUrl} onClick={() => setImage(imageUrl)} type="button">
          Use URL
        </button>
        <input class={s.input} type="file" accept="image/*" onChange={onFile} />
        {creature.image && (
          <button class={s.button} onClick={() => setImage(null)} type="button">
            Remove image
          </button>
        )}
        {creature.image?.startsWith('data:') && (
          <p class={s.hint}>Uploaded images are embedded in the link, which makes it very long. Use a URL to share.</p>
        )}
      </div>

      <div class={s.group}>
        <p class={s.groupTitle}>Output</p>
        <button class={`${s.button} ${s.primary}`} onClick={exportPng} type="button">
          Export PNG
        </button>
        <button class={s.button} onClick={copyLink} type="button">
          Copy shareable link
        </button>
        <p class={s.status}>{status}</p>
      </div>

      <div class={s.group}>
        <p class={s.groupTitle}>Start over</p>
        <button class={s.button} onClick={() => replace(blankCreature())} type="button">
          Blank creature
        </button>
        <button class={s.button} onClick={() => replace(sampleCreature())} type="button">
          Sample: Skeleton
        </button>
      </div>

      <p class={s.hint}>
        Click any text in the block to edit it. Hover an entry for the remove button. Use *italic* and
        **bold** in descriptions. Everything lives in the URL: nothing is saved anywhere else.
      </p>
    </aside>
  )
}
