import { Icon } from '../icon.component'
import s from './menu.module.css'

type Props = {
  creatureName: string
  setStatus: (msg: string) => void
  /** Shows a message in the status line for a moment. */
  flash: (msg: string) => void
}

export function ExportPanel({ creatureName, setStatus, flash }: Props) {
  const exportPng = async () => {
    const node = document.getElementById('stat-page')
    if (!node) return
    setStatus('Rendering…')
    node.dataset.exporting = 'true'
    try {
      const { toPng } = await import('html-to-image')
      const dataUrl = await toPng(node, { pixelRatio: 2, cacheBust: true })
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `${creatureName.trim().replace(/\s+/g, '-').toLowerCase() || 'creature'}.png`
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
    <>
      <button class={`${s.button} ${s.primary} ${s.withIcon}`} onClick={exportPng} type="button">
        <Icon name="download" size={16} />
        Export PNG
      </button>
      <button class={`${s.button} ${s.withIcon}`} onClick={copyLink} type="button">
        <Icon name="link" size={16} />
        Copy shareable link
      </button>
      <p class={s.hint}>
        The PNG is rendered at twice the on-screen size. The link always holds the current creature, so anyone who
        opens it sees this exact block.
      </p>
    </>
  )
}
