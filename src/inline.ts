import { iconifyHtml } from './icons'

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export interface InlineOptions {
  /** Decorate dice expressions and damage types with game icons. */
  icons?: boolean
}

/**
 * Minimal inline markup: **bold**, *italic*, line breaks.
 * That is all the stat blocks need ("*Melee Weapon Attack:* +4 to hit…").
 */
export function renderInline(text: string, { icons = false }: InlineOptions = {}): string {
  const html = escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.+?)\*/g, '<i>$1</i>')
    .replace(/\n/g, '<br>')
  return icons ? iconifyHtml(html) : html
}
