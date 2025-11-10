import { useState } from 'react'
import { getProvider } from '../utils/monadRPC'

export default function WalletConnect({
  walletConnected,
  walletAddress,
  onConnect,
  onDisconnect,
  variant = 'default',
}) {
  const [connecting, setConnecting] = useState(false)

  const pillButtonBase =
    'rounded-full px-4 py-2 text-xs font-semibold tracking-wide transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:opacity-60 disabled:cursor-not-allowed'
  const pillPrimary = `${pillButtonBase} bg-sky-500 hover:bg-sky-400 text-white focus-visible:ring-sky-200`
  const pillSecondary = `${pillButtonBase} bg-white/10 hover:bg-white/20 text-white focus-visible:ring-white/40`

  const connectWallet = async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      alert('Please install MetaMask or another Web3 wallet!')
      return
    }

    setConnecting(true)
    try {
      const provider = getProvider()
      const accounts = await provider.send('eth_requestAccounts', [])
      if (accounts.length > 0) {
        onConnect(accounts[0])
      }
    } catch (error) {
      console.error('Error connecting wallet:', error)
      alert('Failed to connect wallet. Please try again.')
    } finally {
      setConnecting(false)
    }
  }

  const disconnectWallet = () => {
    onDisconnect()
  }

  return (
    <div className={`flex items-center gap-2 ${variant === 'overlay' ? 'text-white text-xs' : ''}`}>
      {walletConnected ? (
        <>
          <span
            className={`rounded-full px-3 py-1 font-semibold ${
              variant === 'overlay'
                ? 'bg-emerald-400/20 text-emerald-100 border border-emerald-300/40 text-[11px]'
                : 'text-white text-sm bg-green-500/30'
            }`}
          >
            {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
          </span>
          <button onClick={disconnectWallet} className={variant === 'overlay' ? pillSecondary : 'px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm'}>
            Disconnect
          </button>
        </>
      ) : (
        <button
          onClick={connectWallet}
          disabled={connecting}
          className={variant === 'overlay' ? pillPrimary : 'px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50'}
        >
          {connecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
      )}
    </div>
  )
}

