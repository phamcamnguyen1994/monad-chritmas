import { useEffect, useState } from 'react'
import { useLeaderboardStore } from '../store/leaderboardStore'
import { useWalletStore } from '../store/walletStore'
import { useQuestStore } from '../store/questStore'

export default function Leaderboard() {
  const [isOpen, setIsOpen] = useState(false)
  const [userRank, setUserRank] = useState(null)
  const [userEntry, setUserEntry] = useState(null)
  const { entries, loading, fetchLeaderboard, getLeaderboard, getUserRank, getUserEntry, updateEntry } =
    useLeaderboardStore()
  const { address, isConnected } = useWalletStore()
  const { score, discoveredDapps } = useQuestStore()

  // Fetch leaderboard when opened
  useEffect(() => {
    if (isOpen) {
      fetchLeaderboard(10)
    }
  }, [isOpen, fetchLeaderboard])

  // Fetch user rank and entry when connected and opened
  useEffect(() => {
    if (isOpen && isConnected && address) {
      getUserRank(address).then(setUserRank)
      getUserEntry(address).then(setUserEntry)
    } else {
      setUserRank(null)
      setUserEntry(null)
    }
  }, [isOpen, isConnected, address, getUserRank, getUserEntry])

  // Sync user's score to leaderboard when connected
  useEffect(() => {
    if (isConnected && address && score > 0) {
      updateEntry(address, score, discoveredDapps.length)
      // Refresh leaderboard and user data after update
      if (isOpen) {
        fetchLeaderboard(10)
        getUserRank(address).then(setUserRank)
        getUserEntry(address).then(setUserEntry)
      }
    }
  }, [isConnected, address, score, discoveredDapps.length, isOpen, updateEntry, fetchLeaderboard, getUserRank, getUserEntry])

  // Keyboard shortcut: M to toggle leaderboard
  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.key.toLowerCase() === 'm' && event.target.tagName !== 'INPUT' && event.target.tagName !== 'TEXTAREA') {
        event.preventDefault()
        setIsOpen((prev) => !prev)
      }
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [isOpen])

  const leaderboard = getLeaderboard(10)

  const formatAddress = (addr) => {
    if (!addr) return ''
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const getRankIcon = (rank) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `#${rank}`
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="leaderboard-toggle glass-panel"
        title="View Leaderboard (Press M)"
      >
        🏆 Leaderboard
      </button>
    )
  }

  return (
    <div className="leaderboard-overlay">
      <div className="leaderboard-panel glass-panel">
        <div className="leaderboard-header">
          <h2 className="leaderboard-title">🏆 Leaderboard</h2>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="leaderboard-close"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {isConnected && (userEntry !== null || userRank !== null) && (
          <div className="leaderboard-user-stats">
            <div className="leaderboard-user-stat">
              <span className="leaderboard-stat-label">Your Rank:</span>
              <span className="leaderboard-stat-value">
                {userRank ? getRankIcon(userRank) : userRank === null ? 'Loading...' : 'Not ranked'}
              </span>
            </div>
            <div className="leaderboard-user-stat">
              <span className="leaderboard-stat-label">Your Score:</span>
              <span className="leaderboard-stat-value">
                {userEntry ? userEntry.score.toLocaleString() : score.toLocaleString()}
              </span>
            </div>
            <div className="leaderboard-user-stat">
              <span className="leaderboard-stat-label">Badges:</span>
              <span className="leaderboard-stat-value">
                {userEntry ? userEntry.badges : discoveredDapps.length}
              </span>
            </div>
          </div>
        )}

        <div className="leaderboard-list">
          {loading ? (
            <div className="leaderboard-empty">Loading leaderboard...</div>
          ) : leaderboard.length === 0 ? (
            <div className="leaderboard-empty">No entries yet. Be the first!</div>
          ) : (
            leaderboard.map((entry, index) => {
              const rank = index + 1
              const isCurrentUser = isConnected && address && entry.address.toLowerCase() === address.toLowerCase()

              return (
                <div
                  key={entry.address}
                  className={`leaderboard-entry ${isCurrentUser ? 'leaderboard-entry-current' : ''}`}
                >
                  <div className="leaderboard-rank">{getRankIcon(rank)}</div>
                  <div className="leaderboard-info">
                    <div className="leaderboard-address">
                      {formatAddress(entry.address)}
                      {isCurrentUser && <span className="leaderboard-you"> (You)</span>}
                    </div>
                    <div className="leaderboard-meta">
                      <span className="leaderboard-badges">🎖️ {entry.badges} badges</span>
                    </div>
                  </div>
                  <div className="leaderboard-score">{entry.score.toLocaleString()}</div>
                </div>
              )
            })
          )}
        </div>

        <div className="leaderboard-hint">
          Press <span className="key-hint">M</span> to toggle · <span className="key-hint">Esc</span> to close
        </div>

        {!isConnected && (
          <div className="leaderboard-connect-hint">
            Connect your wallet to join the leaderboard!
          </div>
        )}
      </div>
    </div>
  )
}

