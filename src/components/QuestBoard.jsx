import { useEffect, useState } from 'react'
import { useQuestStore } from '../store/questStore'
import { useDappData } from '../hooks/useDappData'

export default function QuestBoard() {
  const deliveryMission = useQuestStore((state) => state.deliveryMission)
  const activeBuffs = useQuestStore((state) => state.activeBuffs)
  const discoveredCount = useQuestStore((state) => state.discoveredDapps.length)
  const quests = useQuestStore((state) => state.quests)
  const { dapps } = useDappData()

  const [timeLeft, setTimeLeft] = useState(0)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (deliveryMission.active) {
      const remaining = Math.max(0, Math.ceil((deliveryMission.deadline - now) / 1000))
      setTimeLeft(remaining)
      if (remaining === 0 && deliveryMission.active) {
        useQuestStore.getState().failDelivery()
      }
    }
  }, [now, deliveryMission.active, deliveryMission.deadline])

  const targetDapp = dapps.find((d) => d.id === deliveryMission.targetId)
  const totalDapps = dapps.length || 0

  const buffs = [
    {
      type: 'speed',
      label: '⚡ Speed boost',
      active: activeBuffs.speed > now,
      timeLeft: activeBuffs.speed > now ? Math.ceil((activeBuffs.speed - now) / 1000) : 0,
    },
    {
      type: 'jump',
      label: '🦘 Jump boost',
      active: activeBuffs.jump > now,
      timeLeft: activeBuffs.jump > now ? Math.ceil((activeBuffs.jump - now) / 1000) : 0,
    },
    {
      type: 'shield',
      label: '🛡️ Shield',
      active: activeBuffs.shield > now,
      timeLeft: activeBuffs.shield > now ? Math.ceil((activeBuffs.shield - now) / 1000) : 0,
    },
  ].filter((b) => b.active)

  // Calculate quest progress percentages
  const collectDeFiProgress = quests.collectDeFi
    ? Math.min(100, (quests.collectDeFi.progress / quests.collectDeFi.target) * 100)
    : 0
  const distanceProgress = quests.distance
    ? Math.min(100, (quests.distance.progress / quests.distance.target) * 100)
    : 0
  const monadProgress = quests.discoverMonad
    ? Math.min(100, (quests.discoverMonad.progress / quests.discoverMonad.target) * 100)
    : 0

  if (!deliveryMission.active && !buffs.length && discoveredCount === 0 && !quests.discoverMonad?.progress) return null

  return (
    <div className="quest-board glass-panel">
      <div className="mission-header">
        <div>
          <div className="mission-label">Winter Missions</div>
          <div className="mission-subtitle">Collect badges & complete deliveries</div>
        </div>
        <div className="mission-badges">
          <span className="mission-badge-count">{discoveredCount}</span>
          <span className="mission-badge-total">/ {totalDapps || '–'} badges</span>
        </div>
      </div>

      {deliveryMission.active && (
        <div className="mission-card">
          <div className="mission-title">📦 Delivery Dash</div>
          <div className="mission-target">
            Current target:
            <strong>{targetDapp?.name || 'Unknown dApp'}</strong>
          </div>
          <p className="mission-description">
            Reach the glowing marker for this dApp, press <span className="key-hint">Y</span>, then hit{' '}
            <strong>Complete Delivery</strong> on the card before the timer runs out.
          </p>
          <div className={`mission-timer ${timeLeft < 30 ? 'urgent' : ''}`}>
            {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
          </div>
        </div>
      )}

      {/* Quest Progress */}
      <div className="quest-progress-section">
        <div className="quest-item">
          <div className="quest-item-header">
            <span className="quest-item-label">🎯 Collect DeFi dApps</span>
            <span className="quest-item-progress-text">
              {quests.collectDeFi?.progress || 0} / {quests.collectDeFi?.target || 5}
            </span>
          </div>
          <div className="quest-progress-bar">
            <div
              className="quest-progress-fill"
              style={{ width: `${collectDeFiProgress}%` }}
            />
          </div>
          {quests.collectDeFi?.completed && (
            <div className="quest-completed-badge">✓ Completed</div>
          )}
        </div>

        <div className="quest-item">
          <div className="quest-item-header">
            <span className="quest-item-label">🏃 Travel Distance</span>
            <span className="quest-item-progress-text">
              {Math.round(quests.distance?.progress || 0)} / {quests.distance?.target || 500}m
            </span>
          </div>
          <div className="quest-progress-bar">
            <div
              className="quest-progress-fill"
              style={{ width: `${distanceProgress}%` }}
            />
          </div>
          {quests.distance?.completed && (
            <div className="quest-completed-badge">✓ Completed</div>
          )}
        </div>

        {/* Monad Quest */}
        {quests.discoverMonad && (
          <div className="quest-item quest-item-monad">
            <div className="quest-item-header">
              <span className="quest-item-label">⭐ Discover Monad</span>
              <span className="quest-item-progress-text">
                {quests.discoverMonad.progress} / {quests.discoverMonad.target}
                {quests.discoverMonad.completed && (
                  <span className="quest-completed-badge">✓</span>
                )}
              </span>
            </div>
            <div className="quest-progress-bar">
              <div
                className="quest-progress-fill quest-progress-fill-monad"
                style={{ width: `${monadProgress}%` }}
              />
            </div>
            {!quests.discoverMonad.completed && (
              <div className="quest-hint">Visit the glowing beacon at the center of the map!</div>
            )}
          </div>
        )}
      </div>

      {buffs.length > 0 && (
        <div className="buff-list">
          {buffs.map((buff) => (
            <div key={buff.type} className="buff-item">
              <span>{buff.label}</span>
              <span className="buff-timer">{buff.timeLeft}s</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}



