import { useQuestStore } from '../store/questStore'
import dapps from '../data/dappsData'

export default function DappOverlay() {
  const activeDapp = useQuestStore((state) => state.activeDapp)
  const closeActiveDapp = useQuestStore((state) => state.closeActiveDapp)
  if (!activeDapp) return null
  const dapp = dapps.find((item) => item.id === activeDapp)

  if (!dapp) return null

  const handleVote = () => {
    if (dapp.voteUrl) {
      window.open(dapp.voteUrl, '_blank', 'noopener,noreferrer')
    }
  }

  const handleCollect = () => {
    if (dapp.collectUrl) {
      window.open(dapp.collectUrl, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div className="overlay-root">
      <div className="overlay-card">
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
          <button type="button" onClick={handleVote} className="overlay-action vote">
            Vote trên Farcaster
          </button>
          <button type="button" onClick={handleCollect} className="overlay-action collect">
            Collect NFT
          </button>
        </div>

        <div className="overlay-meta">
          <span>TVL: {dapp.tvlLabel}</span>
          <span>Users: {dapp.userLabel}</span>
        </div>
      </div>
    </div>
  )
}

