import { useMemo } from 'react'
import { useQuestStore } from '../store/questStore'
import { useDappData } from '../hooks/useDappData.jsx'

export default function DappOverlay() {
  const activeDapp = useQuestStore((state) => state.activeDapp)
  const closeActiveDapp = useQuestStore((state) => state.closeActiveDapp)
  const { dapps, categories } = useDappData()
  const dapp = useMemo(
    () => (activeDapp ? dapps.find((item) => item.id === activeDapp) ?? null : null),
    [activeDapp, dapps]
  )

  const related = useMemo(() => {
    if (!dapp) return []
    const category = categories.find((cat) => cat.id === dapp.category)
    if (!category?.items) return []
    return category.items.filter((item) => item.id !== dapp.id).slice(0, 3)
  }, [dapp, categories])

  if (!activeDapp || !dapp) return null

  const handleVisit = () => {
    if (dapp.website) {
      window.open(dapp.website, '_blank', 'noopener,noreferrer')
    }
  }

  const handleTwitter = () => {
    if (dapp.twitter) {
      window.open(dapp.twitter, '_blank', 'noopener,noreferrer')
    }
  }

  const handleOverlayPointerDown = (event) => {
    event.stopPropagation()
  }

  const handleOverlayPointerUp = (event) => {
    event.stopPropagation()
  }

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) {
      closeActiveDapp()
    }
  }

  return (
    <div
      className="overlay-root"
      onPointerDown={handleOverlayPointerDown}
      onPointerUp={handleOverlayPointerUp}
      onPointerMove={handleOverlayPointerDown}
      onClick={handleBackdropClick}
    >
      <div className="overlay-card" onPointerDown={handleOverlayPointerDown} onPointerUp={handleOverlayPointerUp}>
        <header className="overlay-header">
          <div>
            <p className="overlay-subtitle">{dapp.category}</p>
            <h2 className="overlay-title">{dapp.name}</h2>
          </div>
          <button type="button" onClick={closeActiveDapp} className="overlay-close">
            ×
          </button>
        </header>

        <p className="overlay-description">{dapp.description}</p>

        <div className="overlay-actions">
          <button type="button" onClick={handleVisit} className="overlay-action vote">
            Mở website
          </button>
          <button type="button" onClick={handleTwitter} className="overlay-action collect">
            Twitter
          </button>
        </div>

        <div className="overlay-meta">
          <span>TVL: {dapp.tvlUsd ? `$${(dapp.tvlUsd / 1_000_000).toFixed(1)}M` : 'N/A'}</span>
          <span>Users 24h: {dapp.users24h ? dapp.users24h.toLocaleString() : 'N/A'}</span>
          <span>Trạng thái: {dapp.status}</span>
        </div>

        {related.length ? (
          <div className="overlay-related">
            <h3>Gợi ý tiếp theo</h3>
            <ul>
              {related.map((item) => (
                <li key={item.id}>{item.name}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  )
}

