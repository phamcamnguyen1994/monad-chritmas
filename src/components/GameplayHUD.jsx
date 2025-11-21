import { useEffect, useMemo, useState } from 'react'
import { useQuestStore } from '../store/questStore'
import MiniMap from './MiniMap'
import QuestBoard from './QuestBoard'
import WalletConnect from './WalletConnect'
import Leaderboard from './Leaderboard'
import NotificationToast from './NotificationToast'

const CONTROL_HINTS = [
  { keys: 'W', label: 'Move forward' },
  { keys: 'S', label: 'Brake / reverse' },
  { keys: 'A / D', label: 'Steer left / right' },
  { keys: 'Shift', label: 'Hold for extra thrust' },
  { keys: 'M', label: 'Open leaderboard' },
]

export default function GameplayHUD() {
  const playerSpeed = useQuestStore((state) => state.playerSpeed)
  const score = useQuestStore((state) => state.score)
  const [displayScore, setDisplayScore] = useState(0)
  const [scoreChange, setScoreChange] = useState(null)

  const formattedSpeed = useMemo(() => {
    if (!Number.isFinite(playerSpeed)) return '0'
    return Math.round(playerSpeed * 3.6).toString()
  }, [playerSpeed])

  // Animate score changes
  useEffect(() => {
    if (score !== displayScore) {
      const diff = score - displayScore
      const increment = diff > 0 ? Math.ceil(diff / 10) : Math.floor(diff / 10)
      
      if (Math.abs(diff) > 0) {
        const timer = setInterval(() => {
          setDisplayScore((prev) => {
            const newVal = prev + increment
            if ((increment > 0 && newVal >= score) || (increment < 0 && newVal <= score)) {
              clearInterval(timer)
              return score
            }
            return newVal
          })
        }, 30)
        return () => clearInterval(timer)
      }
    }
  }, [score, displayScore])

  // Show score change animation
  useEffect(() => {
    if (score > displayScore) {
      const change = score - displayScore
      setScoreChange(change)
      const timer = setTimeout(() => setScoreChange(null), 2000)
      return () => clearTimeout(timer)
    }
  }, [score, displayScore])

  // Initialize displayScore with current score
  useEffect(() => {
    if (displayScore === 0 && score > 0) {
      setDisplayScore(score)
    }
  }, [score, displayScore])


  return (
    <>
      <NotificationToast />
      <div className="hud-container">
        {/* [NEW] Interaction Hint */}
        {useQuestStore((state) => state.nearbyDapp) && (
          <div className="interaction-hint glass-panel">
            Press <span className="key-hint">Y</span> to Interact
          </div>
        )}

      <div className="hud-top-left">
        <QuestBoard />
      </div>

            <div className="hud-top-right">
              <MiniMap />
              {/* Monad Logo Branding */}
              <div className="hud-monad-branding">
                <img src="/images/monad-logo.png" alt="Monad" onError={(e) => { e.target.style.display = 'none' }} />
              </div>
              <div className="hud-wallet-section">
                <WalletConnect />
              </div>
        <div className="hud-score-section glass-panel">
          <div className="hud-score-label">Score</div>
          <div className="hud-score-value-container">
            <div className="hud-score-value">{displayScore.toLocaleString()}</div>
            {scoreChange && scoreChange > 0 && (
              <div className="hud-score-change">+{scoreChange}</div>
            )}
          </div>
        </div>
        <div className="hud-leaderboard-section">
          <Leaderboard />
        </div>
      </div>

      <div className="hud-controls-section glass-panel">
        <h3 className="hud-title">Controls</h3>
        <ul className="hud-controls">
          {CONTROL_HINTS.map((hint) => (
            <li key={hint.keys}>
              <span className="hud-keys">{hint.keys}</span>
              <span className="hud-label">{hint.label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="hud-speed-section glass-panel">
        <div className="hud-speed-value">
          <span className="hud-speed-number">{formattedSpeed}</span>
          <span className="hud-speed-unit">KM/H</span>
        </div>
      </div>
      </div>
    </>
  )
}
