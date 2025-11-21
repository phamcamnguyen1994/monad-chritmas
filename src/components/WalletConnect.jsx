import { useEffect, useState } from 'react'
import { useWalletStore } from '../store/walletStore'

export default function WalletConnect() {
  const { address, isConnected, isConnecting, error, connect, disconnect, checkConnection } = useWalletStore()
  const [showMenu, setShowMenu] = useState(false)

  useEffect(() => {
    // Check if already connected on mount
    checkConnection()
  }, [checkConnection])

  const handleConnect = async () => {
    const success = await connect()
    if (success) {
      setShowMenu(false)
    }
  }

  const handleDisconnect = () => {
    disconnect()
    setShowMenu(false)
  }

  const formatAddress = (addr) => {
    if (!addr) return ''
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  if (!isConnected) {
    return (
      <div className="wallet-connect-container">
        <button
          type="button"
          onClick={handleConnect}
          disabled={isConnecting}
          className="wallet-connect-btn glass-panel"
        >
          {isConnecting ? (
            <>
              <span className="wallet-connect-icon">⏳</span>
              Connecting...
            </>
          ) : (
            <>
              <span className="wallet-connect-icon">🦊</span>
              Connect Wallet
            </>
          )}
        </button>
        {error && <div className="wallet-error">{error}</div>}
      </div>
    )
  }

  return (
    <div className="wallet-connect-container">
      <button
        type="button"
        onClick={() => setShowMenu(!showMenu)}
        className="wallet-connected-btn glass-panel"
      >
        <span className="wallet-connect-icon">🦊</span>
        <span className="wallet-address">{formatAddress(address)}</span>
        <span className="wallet-menu-icon">{showMenu ? '▲' : '▼'}</span>
      </button>
      {showMenu && (
        <div className="wallet-menu glass-panel">
          <div className="wallet-menu-item">
            <span className="wallet-menu-label">Address:</span>
            <span className="wallet-menu-value">{address}</span>
          </div>
          <button type="button" onClick={handleDisconnect} className="wallet-disconnect-btn">
            Disconnect
          </button>
        </div>
      )}
    </div>
  )
}

