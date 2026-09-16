import type { ComponentChildren } from 'preact'
import s from './menu.module.css'

type Props = {
  title?: string
  children: ComponentChildren
}

/** A titled cluster of controls inside a panel; consecutive groups are separated by a rule. */
export function PanelGroup({ title, children }: Props) {
  return (
    <div class={s.group}>
      {title && <p class={s.groupTitle}>{title}</p>}
      {children}
    </div>
  )
}
