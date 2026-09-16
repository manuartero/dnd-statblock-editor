import type { IconName } from '../icon.component'

export type PanelId = 'blocks' | 'text' | 'look' | 'saves' | 'export'

export type RailItem = { id: PanelId; label: string; title: string; icon: IconName }

/** Editing tools first, then the file tools; the rail draws a gap between the two. */
export const EDIT_ITEMS: RailItem[] = [
  { id: 'blocks', label: 'Blocks', title: 'Blocks', icon: 'blocks' },
  { id: 'text', label: 'Text', title: 'Text library', icon: 'scroll' },
  { id: 'look', label: 'Look', title: 'Look', icon: 'sliders' },
]
export const FILE_ITEMS: RailItem[] = [
  { id: 'saves', label: 'Saves', title: 'Saved creatures', icon: 'book' },
  { id: 'export', label: 'Export', title: 'Export', icon: 'export' },
]

export const PANEL_TITLES = Object.fromEntries([...EDIT_ITEMS, ...FILE_ITEMS].map((i) => [i.id, i.title])) as Record<
  PanelId,
  string
>
