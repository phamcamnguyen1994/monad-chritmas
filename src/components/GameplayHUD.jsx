import { useMemo } from 'react'
import { useQuestStore } from '../store/questStore'

const CONTROL_HINTS = [
  { keys: 'W', label: 'Move forward' },
  { keys: 'S', label: 'Brake / reverse' },
  { keys: 'A / D', label: 'Steer left / right' },
  { keys: 'Shift', label: 'Hold for extra thrust' },
]

const ACCELERATION_TIPS = [
  'Momentum builds gradually—keep pressing W to reach top speed.',
  'Tilting downhill gives you a bonus push; climbing slopes slows you down.',
  'Releasing W lets drag reduce your speed until you coast to a stop.',
]

export default function GameplayHUD() {
  const playerSpeed = useQuestStore((state) => state.playerSpeed)

  const formattedSpeed = useMemo(() => {
    if (!Number.isFinite(playerSpeed)) return '0'
    return Math.round(playerSpeed * 3.6).toString()
  }, [playerSpeed])

  return (
    <div className="hud-container">
      <div className="hud-card">
        <div className="hud-section">
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
        <div className="hud-section hud-speed">
          <h3 className="hud-title">Speed</h3>
          <div className="hud-speed-value">
            <span className="hud-speed-number">{formattedSpeed}</span>
            <span className="hud-speed-unit">km/h</span>
          </div>
        </div>
        <div className="hud-section hud-acceleration">
          <h3 className="hud-title">Acceleration</h3>
          <ul className="hud-tips">
            {ACCELERATION_TIPS.map((tip, index) => (
              <li key={index}>{tip}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

