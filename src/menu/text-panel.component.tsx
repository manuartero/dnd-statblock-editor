import s from './menu.module.css'

const isMac = /Mac|iPhone|iPad/.test(navigator.platform)

type Props = {
  openTextLibrary: () => void
}

export function TextPanel({ openTextLibrary }: Props) {
  return (
    <>
      <button class={`${s.button} ${s.accent}`} onClick={openTextLibrary} type="button">
        Insert from library…
      </button>
      <p class={s.hint}>
        Weapon attacks, monster traits, class features, spellcasting lines and a few spells, in the rulebook wording.
        Each entry lands in the section you pick.
      </p>
      <p class={s.hint}>
        <kbd class={s.kbd}>{isMac ? '⌘' : 'Ctrl'}</kbd>
        <kbd class={s.kbd}>K</kbd> opens it from anywhere.
      </p>
    </>
  )
}
