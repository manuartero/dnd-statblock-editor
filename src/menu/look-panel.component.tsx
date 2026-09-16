import { useState } from 'preact/hooks'
import type { Creature, UpdateCreature } from '../creature.model'
import { PanelGroup } from './panel-group.component'
import s from './menu.module.css'

type Props = {
  creature: Creature
  update: UpdateCreature
}

export function LookPanel({ creature, update }: Props) {
  const [imageUrl, setImageUrl] = useState('')

  const setImage = (image: string | null) => update((c) => ({ ...c, image }))

  const onFile = (e: Event) => {
    const file = (e.currentTarget as HTMLInputElement).files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setImage(String(reader.result))
    reader.readAsDataURL(file)
  }

  return (
    <>
      <PanelGroup title="Columns">
        <div class={s.segment}>
          {([1, 2] as const).map((n) => (
            <button
              key={n}
              class={creature.columns === n ? s.active : undefined}
              onClick={() => update((c) => ({ ...c, columns: n }))}
              type="button"
            >
              {n === 1 ? 'One' : 'Two'}
            </button>
          ))}
        </div>
      </PanelGroup>

      <PanelGroup title="Iconography">
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
          An AC badge next to Armor Class, weapon icons after attack names, dice and damage-type icons in
          descriptions, and one pip per spell slot.
        </p>
      </PanelGroup>

      <PanelGroup title="Background art">
        <div class={s.pair}>
          <input
            class={s.input}
            type="url"
            placeholder="https://…/art.png"
            aria-label="Image URL"
            value={imageUrl}
            onInput={(e) => setImageUrl((e.currentTarget as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && imageUrl) setImage(imageUrl)
            }}
          />
          <button class={`${s.button} ${s.useUrl}`} disabled={!imageUrl} onClick={() => setImage(imageUrl)} type="button">
            Use
          </button>
        </div>
        <label class={s.button}>
          Upload a file…
          <input class={s.fileHidden} type="file" accept="image/*" onChange={onFile} />
        </label>
        {creature.image && (
          <button class={s.button} onClick={() => setImage(null)} type="button">
            Remove image
          </button>
        )}
        {creature.image?.startsWith('data:') && (
          <p class={s.hint}>Uploaded images are embedded in the link, which makes it very long. Use a URL to share.</p>
        )}
      </PanelGroup>
    </>
  )
}
