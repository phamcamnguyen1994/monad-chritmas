import { useMemo } from 'react'
import { useQuestStore } from '../store/questStore'
import { useDappData } from '../hooks/useDappData.jsx'
import { TERRAIN_HALF } from './WinterWorld'

export default function MiniMap() {
  const { dapps } = useDappData()
  const { discovered, placements, player } = useQuestStore((state) => ({
    discovered: state.discoveredDapps,
    placements: state.dappPlacements,
    player: state.playerPosition,
  }))

  const visibleDapps = useMemo(() => {
    const size = TERRAIN_HALF * 2 || 1
    const toPercent = (value) => ((value + TERRAIN_HALF) / size) * 100
    return dapps
      .map((dapp) => {
        const placement = placements[dapp.id]
        if (!placement) return null
        return {
          id: dapp.id,
          label: dapp.name,
          collected: discovered.includes(dapp.id),
          left: toPercent(placement.x),
          top: 100 - toPercent(placement.z),
        }
      })
      .filter(Boolean)
  }, [placements, discovered, dapps])

  const playerMarker = useMemo(() => {
    if (typeof player?.x !== 'number' || typeof player?.z !== 'number') return null
    const size = TERRAIN_HALF * 2 || 1
    const toPercent = (value) => ((value + TERRAIN_HALF) / size) * 100
    return {
      left: toPercent(player.x),
      top: 100 - toPercent(player.z),
    }
  }, [player])

  return (
    <div className="minimap-root">
      <div className="minimap-header">
        <span>Mini Map</span>
        <span>
          {discovered.length}/{dapps.length}
        </span>
      </div>
      <div className="minimap-grid">
        <div className="minimap-ring" />
        {playerMarker ? (
          <span
            className="minimap-player"
            style={{
              left: `${playerMarker.left}%`,
              top: `${playerMarker.top}%`,
            }}
          />
        ) : null}
        {visibleDapps.map((dapp) => (
          <span
            key={dapp.id}
            className={`minimap-dot ${dapp.collected ? 'minimap-dot--collected' : ''}`}
            style={{
              left: `${dapp.left}%`,
              top: `${dapp.top}%`,
            }}
            title={dapp.label}
          />
        ))}
      </div>
    </div>
  )
}

