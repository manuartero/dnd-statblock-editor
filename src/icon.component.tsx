/**
 * Flat, single-stroke icons for the editor chrome. Hand-drawn on a 24px grid so
 * the app carries no icon dependency; the game icons on the parchment are a
 * different family and live in public/icons.
 */

export type IconName =
  | 'd20'
  | 'blocks'
  | 'scroll'
  | 'sliders'
  | 'book'
  | 'export'
  | 'download'
  | 'link'
  | 'close'

const PATHS: Record<IconName, string> = {
  // A twenty-sider seen vertex-on: hexagon, front face, and the edges that meet it.
  d20: 'M12 2.5 20.5 7v10L12 21.5 3.5 17V7z M6.5 10h11L12 19z M12 2.5 6.5 10 3.5 7 M12 2.5l5.5 7.5 3-3 M3.5 17 12 19l8.5-2',
  // Two rows already in the block and a plus where the next one goes.
  blocks: 'M3.5 5.5A1.5 1.5 0 0 1 5 4h14a1.5 1.5 0 0 1 1.5 1.5v3A1.5 1.5 0 0 1 19 10H5a1.5 1.5 0 0 1-1.5-1.5z M3.5 15.5A1.5 1.5 0 0 1 5 14h7a1.5 1.5 0 0 1 1.5 1.5v3A1.5 1.5 0 0 1 12 20H5a1.5 1.5 0 0 1-1.5-1.5z M18.5 14v6 M15.5 17h6',
  // A sheet whose foot rolls under: pre-written text in the rulebook wording.
  scroll: 'M18 4H6v12.5A2.5 2.5 0 0 0 8.5 19h12a2.5 2.5 0 0 1-2.5-2.5V4z M6 4a2.5 2.5 0 0 0-2.5 2.5V8H6 M9.5 8.5h5.5 M9.5 12h5.5',
  sliders: 'M4 7h9.5 M18.5 7H20 M4 17h3.5 M12.5 17H20 M16 4.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 1 0 0-5z M10 14.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 1 0 0-5z',
  book: 'M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3 M9 7h6',
  export: 'M12 15V4 M8 8l4-4 4 4 M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4',
  download: 'M12 4v11 M7.5 10.5 12 15l4.5-4.5 M4 19.5h16',
  link: 'M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1 M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1',
  close: 'M6 6l12 12 M18 6 6 18',
}

type Props = {
  name: IconName
  /** Rendered size in px; the stroke stays at 1.75 units of the 24px grid. */
  size?: number
  class?: string
}

export function Icon({ name, size = 20, class: className }: Props) {
  return (
    <svg
      class={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
