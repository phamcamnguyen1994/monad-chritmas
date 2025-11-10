import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import SailingScene from './pages/SailingScene'
import './App.css'

function AppShell({ children, walletConnected, walletAddress, onConnect, onDisconnect }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-blue-950 to-[#05012a] overflow-hidden">
      <main className="px-0 py-8">
        {typeof children === 'function'
          ? children({ walletConnected, walletAddress, onConnect, onDisconnect })
          : children}
      </main>
    </div>
  )
}

function App() {
  const [walletConnected, setWalletConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState(null)

  useEffect(() => {
    const savedAddress = localStorage.getItem('walletAddress')
    if (savedAddress) {
      setWalletAddress(savedAddress)
      setWalletConnected(true)
    }
  }, [])

  const handleConnect = (address) => {
    setWalletAddress(address)
    setWalletConnected(true)
    localStorage.setItem('walletAddress', address)
  }

  const handleDisconnect = () => {
    setWalletAddress(null)
    setWalletConnected(false)
    localStorage.removeItem('walletAddress')
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <AppShell
              walletConnected={walletConnected}
              walletAddress={walletAddress}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
            >
              {({ walletConnected: wc, walletAddress: wa, onConnect, onDisconnect }) => (
                <SailingScene
                  walletConnected={wc}
                  walletAddress={wa}
                  onConnect={onConnect}
                  onDisconnect={onDisconnect}
                />
              )}
            </AppShell>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}

export default App

