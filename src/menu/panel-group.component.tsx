import type { ComponentChildren } from 'preact'
import s from './menu.module.css'

type Props = {
  title?: string
  children: ComponentChildren
}

const groupId = (title: string) => `panel-group-${title.toLowerCase().replace(/\W+/g, '-')}`

/** A titled cluster of controls inside a panel; consecutive groups are separated by a rule. */
export function PanelGroup({ title, children }: Props) {
  if (!title) return <div class={s.group}>{children}</div>
  const id = groupId(title)
  return (
    <div class={s.group} role="group" aria-labelledby={id}>
      <h3 id={id} class={s.groupTitle}>
        {title}
      </h3>
      {children}
    </div>
  )
}
