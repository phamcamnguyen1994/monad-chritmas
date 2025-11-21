import { useEffect, useState, useRef } from 'react'
import { useWalletStore } from '../store/walletStore'

export default function WalletConnect() {
  const { address, isConnected, isConnecting, error, connect, disconnect, checkConnection } = useWalletStore()
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    // Check if already connected on mount
    checkConnection()
  }, [checkConnection])

  // Close menu when clicking outside
  useEffect(() => {
    if (!showMenu) return

    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMenu])

  const handleConnect = async () => {
    try {
      const success = await connect()
      if (success) {
        setShowMenu(false)
      }
    } catch (err) {
      console.error('Connect button error:', err)
      // Error is already handled in the store
    }
  }

  const handleDisconnect = (e) => {
    e?.preventDefault()
    e?.stopPropagation()
    console.log('Disconnect clicked')
    disconnect()
    setShowMenu(false)
  }

  const formatAddress = (addr) => {
    if (!addr) return ''
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  if (!isConnected) {
    return (
      <div className="wallet-connect-container" ref={containerRef}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            handleConnect()
          }}
          onMouseDown={(e) => {
            e.stopPropagation()
          }}
          disabled={isConnecting}
          className="wallet-connect-btn glass-panel"
          style={{ pointerEvents: 'auto', zIndex: 10000, position: 'relative' }}
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
    <div className="wallet-connect-container" ref={containerRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setShowMenu(!showMenu)
        }}
        className="wallet-connected-btn glass-panel"
      >
        <span className="wallet-connect-icon">🦊</span>
        <span className="wallet-address">{formatAddress(address)}</span>
        <span className="wallet-menu-icon">{showMenu ? '▲' : '▼'}</span>
      </button>
      {showMenu && (
        <div 
          ref={menuRef}
          className="wallet-menu glass-panel"
          onClick={(e) => e.stopPropagation()}
          style={{ zIndex: 99999, position: 'relative' }}
        >
          <div className="wallet-menu-item">
            <span className="wallet-menu-label">Address:</span>
            <span className="wallet-menu-value">{address}</span>
          </div>
          <button 
            type="button" 
            onClick={handleDisconnect}
            onMouseDown={(e) => {
              e.stopPropagation()
              e.preventDefault()
            }}
            className="wallet-disconnect-btn"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  )
}

