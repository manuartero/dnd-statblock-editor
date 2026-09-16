import { Icon } from '../icon.component'
import { EDIT_ITEMS, FILE_ITEMS } from './menu.model'
import type { PanelId, RailItem } from './menu.model'
import s from './menu.module.css'

type Props = {
  panel: PanelId | null
  /** Marks the Saves button when the editor differs from its save. */
  dirty: boolean
  onToggle: (id: PanelId) => void
}

export function Rail({ panel, dirty, onToggle }: Props) {
  const button = ({ id, label, title, icon }: RailItem) => (
    <button
      key={id}
      id={`rail-${id}`}
      class={`${s.railButton} ${panel === id ? s.railActive : ''}`}
      aria-expanded={panel === id}
      aria-controls={panel === id ? 'menu-panel' : undefined}
      title={title}
      onClick={() => onToggle(id)}
      type="button"
    >
      <Icon name={icon} />
      <span class={s.railLabel}>{label}</span>
      {id === 'saves' && dirty && <span class={s.dot} aria-label="Unsaved changes" />}
    </button>
  )

  return (
    <nav class={s.rail} aria-label="Editor tools">
      <div class={s.mark}>
        <Icon name="d20" size={26} />
        <span class="sr-only">Stat Block editor</span>
      </div>
      <div class={s.railGroup}>{EDIT_ITEMS.map(button)}</div>
      <div class={s.railGroup}>{FILE_ITEMS.map(button)}</div>
    </nav>
  )
}
