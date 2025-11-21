import { useMemo, useEffect, useState, useCallback } from 'react'
import { useQuestStore } from '../store/questStore'
import { useDappData } from '../hooks/useDappData.jsx'
import { playGiftChime } from './AmbientAudio.jsx'
import { useNotificationStore } from '../store/notificationStore'

export default function DappOverlay() {
  const activeDapp = useQuestStore((state) => state.activeDapp)
  const closeActiveDapp = useQuestStore((state) => state.closeActiveDapp)
  const collectDapp = useQuestStore((state) => state.collectDapp)
  const discoveredDapps = useQuestStore((state) => state.discoveredDapps)
  const { dapps, categories } = useDappData()

  const dapp = useMemo(
    () => (activeDapp ? dapps.find((item) => item.id === activeDapp) ?? null : null),
    [activeDapp, dapps]
  )

  const [collected, setCollected] = useState(false)

  useEffect(() => {
    if (dapp && discoveredDapps.includes(dapp.id)) {
      setCollected(true)
    } else {
      setCollected(false)
    }
  }, [dapp, discoveredDapps])

  const related = useMemo(() => {
    if (!dapp) return []
    const category = categories.find((cat) => cat.id === dapp.category)
    if (!category?.items) return []
    return category.items.filter((item) => item.id !== dapp.id).slice(0, 3)
  }, [dapp, categories])

  const handleVisit = useCallback(() => {
    if (dapp?.website) {
      window.open(dapp.website, '_blank', 'noopener,noreferrer')
    }
  }, [dapp])

  const handleTwitter = useCallback(() => {
    if (dapp?.twitter) {
      window.open(dapp.twitter, '_blank', 'noopener,noreferrer')
    }
  }, [dapp])

  const handleCollect = useCallback(() => {
    if (!dapp || collected) return

    const store = useQuestStore.getState()
    const prevScore = store.score
    const prevQuestState = { ...store.quests }

    collectDapp(dapp.id, dapp.category)
    setCollected(true)
    playGiftChime()
    closeActiveDapp()

    // Calculate score increase
    const newScore = useQuestStore.getState().score
    const scoreIncrease = newScore - prevScore

    // Show notification
    const { addNotification } = useNotificationStore.getState()
    addNotification({
      type: 'success',
      title: '🎁 Badge Collected!',
      message: `+${scoreIncrease} points`,
      duration: 3000,
    })

    // Check if quest completed
    const newQuestState = useQuestStore.getState().quests
    if (!prevQuestState.collectDeFi?.completed && newQuestState.collectDeFi?.completed) {
      addNotification({
        type: 'success',
        title: '🏆 Quest Completed!',
        message: 'Collect DeFi dApps quest finished! +50 bonus',
        duration: 4000,
      })
    }

    // Power-up Logic
    const cat = (dapp.category || '').toLowerCase()
    if (cat === 'defi') {
      useQuestStore.getState().activateBuff('speed', 45)
      addNotification({
        type: 'info',
        title: '⚡ Speed Boost Activated!',
        message: '45 seconds of extra speed',
        duration: 3000,
      })
    } else if (cat === 'nft') {
      useQuestStore.getState().activateBuff('jump', 45)
      addNotification({
        type: 'info',
        title: '🦘 Jump Boost Activated!',
        message: '45 seconds of extra jump',
        duration: 3000,
      })
    } else if (cat === 'infrastructure' || cat === 'infra') {
      useQuestStore.getState().activateBuff('shield', 60)
      addNotification({
        type: 'info',
        title: '🛡️ Shield Activated!',
        message: '60 seconds of protection',
        duration: 3000,
      })
    }

    // Delivery Mission Trigger (30% chance)
    if (!store.deliveryMission.active && Math.random() < 0.3 && dapps?.length) {
      const placements = store.dappPlacements
      const placedDappIds = Object.keys(placements)

      // Only select targets that are actually placed in the world
      const potentialTargets = dapps.filter((d) => d.id !== dapp.id && placedDappIds.includes(d.id))

      if (potentialTargets.length) {
        const target = potentialTargets[Math.floor(Math.random() * potentialTargets.length)]
        store.startDelivery(dapp.id, target.id, 120) // 2 minutes
        addNotification({
          type: 'info',
          title: '📦 New Delivery Mission!',
          message: `Deliver to ${target.name}`,
          duration: 4000,
        })
      }
    }
  }, [dapp, collected, collectDapp, closeActiveDapp, dapps])

  const handleCompleteDelivery = useCallback(() => {
    useQuestStore.getState().completeDelivery()
    playGiftChime()
    closeActiveDapp()
    
    // Show notification instead of alert
    const { addNotification } = useNotificationStore.getState()
    addNotification({
      type: 'success',
      title: '🎉 Delivery Completed!',
      message: '+100 points',
      duration: 3000,
    })
  }, [closeActiveDapp])

  // Keyboard Shortcuts
  useEffect(() => {
    if (!activeDapp) return
    const handleKeyDown = (e) => {
      if (e.key.toLowerCase() === 'l') handleVisit()
      if (e.key.toLowerCase() === 'c') handleCollect()
      if (e.key === 'Escape') closeActiveDapp()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeDapp, handleVisit, handleCollect, closeActiveDapp])

  if (!activeDapp || !dapp) return null

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

  const isDeliveryTarget =
    useQuestStore.getState().deliveryMission.active &&
    useQuestStore.getState().deliveryMission.targetId === dapp.id

  const logoUrl = dapp.logo || dapp.logoImage
  const hasLogo = !!logoUrl
  const initials = (dapp.name || '?').slice(0, 2).toUpperCase()

  const totalBadges = dapps.length || 0
  const collectedBadges = discoveredDapps.length

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
          <div className="overlay-header-main">
            <div className="overlay-logo">
              {hasLogo ? (
                <img src={logoUrl} alt={`${dapp.name} logo`} />
              ) : (
                <span className="overlay-logo-fallback">{initials}</span>
              )}
            </div>
            <div>
              <p className="overlay-subtitle">{dapp.category}</p>
              <h2 className="overlay-title">{dapp.name}</h2>
              <p className="overlay-badge-line">
                Badge:{' '}
                <span className={collected ? 'overlay-badge-collected' : 'overlay-badge-uncollected'}>
                  {collected ? 'Collected' : 'Not collected yet'}
                </span>
                <span className="overlay-badge-count">
                  · {collectedBadges}/{totalBadges || '–'} total
                </span>
              </p>
            </div>
          </div>
          <button type="button" onClick={closeActiveDapp} className="overlay-close" aria-label="Close (Esc)">
            ×
          </button>
        </header>

        <p className="overlay-description">{dapp.description}</p>

        <div className="overlay-actions">
          <button type="button" onClick={handleVisit} className="overlay-action vote">
            Open Website [L]
          </button>
          <button
            type="button"
            onClick={handleCollect}
            className="overlay-action collect"
            disabled={collected}
          >
            {collected ? 'Badge Collected' : 'Collect Badge [C]'}
          </button>

          {isDeliveryTarget && (
            <button
              type="button"
              onClick={handleCompleteDelivery}
              className="overlay-action vote"
              style={{ backgroundColor: '#10b981', color: 'white', marginLeft: 8 }}
            >
              📦 Complete Delivery
            </button>
          )}
        </div>

        <div className="overlay-meta">
          <span>TVL: {dapp.tvlUsd ? `$${(dapp.tvlUsd / 1_000_000).toFixed(1)}M` : 'N/A'}</span>
          <span>Users 24h: {dapp.users24h ? dapp.users24h.toLocaleString() : 'N/A'}</span>
          <span>Status: {dapp.status}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, alignItems: 'center' }}>
          <p className="overlay-hint">
            <span className="overlay-hint-key">Esc</span> close · <span className="overlay-hint-key">L</span> open ·{' '}
            <span className="overlay-hint-key">C</span> collect
          </p>
          {dapp.twitter && (
            <button type="button" onClick={handleTwitter} className="overlay-secondary-link">
              Twitter
            </button>
          )}
        </div>

        {related.length ? (
          <div className="overlay-related">
            <h3>Suggested Next</h3>
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


