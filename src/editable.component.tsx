import { useEffect, useRef, useState } from 'preact/hooks'
import type { JSX } from 'preact'
import { renderInline } from './inline.render'

type Props = {
  value: string
  onChange: (value: string) => void
  tag?: keyof JSX.IntrinsicElements
  class?: string
  /** Enter inserts a line break instead of committing. */
  multiline?: boolean
  /** Render *italic* / **bold** markup while not editing. */
  rich?: boolean
  /** Also decorate dice and damage types with game icons (rich only). */
  icons?: boolean
  placeholder?: string
  /** Accessible name; falls back to the placeholder. */
  label?: string
}

/**
 * A contenteditable element. Shows rendered text while idle, raw text while
 * focused, and commits on blur. Committing on blur keeps the caret stable.
 */
export function Editable({
  value,
  onChange,
  tag = 'span',
  class: cls,
  multiline = false,
  rich = false,
  icons = false,
  placeholder,
  label,
}: Props) {
  const ref = useRef<HTMLElement>(null)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (editing) {
      // Icons are decoration, never part of the text: drop them while editing.
      if (el.innerText !== value || el.querySelector('img')) {
        el.innerText = value
        placeCaretAtEnd(el)
      }
    } else {
      el.innerHTML = rich ? renderInline(value, { icons }) : renderInline(value).replace(/<\/?[bi]>/g, '')
    }
  }, [value, editing, rich, icons])

  const Tag = tag as 'span'
  return (
    <Tag
      ref={ref as never}
      class={cls}
      contentEditable
      role="textbox"
      aria-label={label ?? placeholder}
      aria-multiline={multiline}
      spellcheck={false}
      data-placeholder={placeholder}
      onFocus={() => setEditing(true)}
      onBlur={(e) => {
        setEditing(false)
        onChange((e.currentTarget as HTMLElement).innerText.replace(/\n+$/, ''))
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' || (e.key === 'Enter' && !multiline)) {
          e.preventDefault()
          ;(e.currentTarget as HTMLElement).blur()
        }
      }}
    />
  )
}

function placeCaretAtEnd(el: HTMLElement) {
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
}
