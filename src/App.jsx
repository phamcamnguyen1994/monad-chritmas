import { useRef, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import Experience from './components/Experience'
import MiniMap from './components/MiniMap'
import GameplayHUD from './components/GameplayHUD.jsx'
import AmbientAudio from './components/AmbientAudio.jsx'
import { DappDataProvider } from './hooks/useDappData.jsx'
import { SledInputProvider, useSledInput } from './components/SledInputContext.jsx'
import './styles/index.css'
import DappOverlay from './components/DappOverlay.jsx'

function App() {
  return (
    <SledInputProvider>
      <DappDataProvider>
        <PointerCapture>
          <Canvas camera={{ position: [0, 10, 18], fov: 55 }}>
            <Physics gravity={[0, -9.81, 0]}>
              <Experience />
            </Physics>
          </Canvas>
          <MiniMap />
          <GameplayHUD />
          <DappOverlay />
          <AmbientAudio />
        </PointerCapture>
      </DappDataProvider>
    </SledInputProvider>
  )
}

function PointerCapture({ children }) {
  const containerRef = useRef(null)
  const {
    handlePointerMove,
    handlePointerDown,
    handlePointerUp,
    handlePointerLeave,
    handleWheel,
    pointerLockSupported,
    pointerLockActive,
    requestPointerLock,
    exitPointerLock,
    isDragging,
  } = useSledInput()

  const togglePointerLock = useCallback(() => {
    if (!pointerLockSupported) return
    if (pointerLockActive) {
      exitPointerLock()
    } else if (containerRef.current) {
      requestPointerLock(containerRef.current)
    }
  }, [pointerLockSupported, pointerLockActive, exitPointerLock, requestPointerLock])

  const handleContextMenu = useCallback(
    (event) => {
      if (pointerLockActive || isDragging) {
        event.preventDefault()
      }
    },
    [pointerLockActive, isDragging]
  )

  return (
    <div
      ref={containerRef}
      className="app-shell"
      onPointerDown={(e) => {
        // Don't capture events for UI elements
        if (e.target.closest('.wallet-connect-container') || 
            e.target.closest('.hud-wallet-section') ||
            e.target.closest('button') ||
            e.target.closest('.wallet-menu')) {
          return
        }
        handlePointerDown(e)
      }}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      onWheel={handleWheel}
      onDoubleClick={togglePointerLock}
      onContextMenu={handleContextMenu}
    >
      {children}
      <PointerLockOverlay
        active={pointerLockActive}
        supported={pointerLockSupported}
        onToggle={togglePointerLock}
      />
    </div>
  )
}

function PointerLockOverlay({ active, supported, onToggle }) {
  if (!supported) return null
  return (
    <div
      className="pointer-lock-overlay"
      style={{
        position: 'absolute',
        right: 24,
        bottom: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        alignItems: 'flex-end',
        pointerEvents: 'none',
        zIndex: 40,
      }}
    >
      <div
        className="glass-panel"
        style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, rgba(20, 30, 50, 0.6), rgba(30, 40, 60, 0.5))',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '16px',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          alignItems: 'flex-start',
          minWidth: '280px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: '18px' }}>🖱️</span>
          <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#facc15', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Camera Control
          </h3>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
          <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.9)', lineHeight: 1.5 }}>
            <div style={{ marginBottom: 6 }}>
              <strong style={{ color: '#a78bfa' }}>• Drag mouse</strong> or <strong style={{ color: '#a78bfa' }}>touch screen</strong> to look around
            </div>
            <div>
              <strong style={{ color: '#60a5fa' }}>• Enable Mouse Look</strong> for full control (no need to hold mouse)
            </div>
          </div>
          
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onToggle()
            }}
            className="pointer-lock-btn"
            style={{
              pointerEvents: 'auto',
              width: '100%',
              padding: '10px 16px',
              background: active 
                ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.3), rgba(16, 185, 129, 0.3))'
                : 'linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(59, 130, 246, 0.3))',
              border: active 
                ? '1px solid rgba(34, 197, 94, 0.5)'
                : '1px solid rgba(139, 92, 246, 0.5)',
              borderRadius: '10px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'all 0.2s ease',
              boxShadow: active 
                ? '0 0 12px rgba(34, 197, 94, 0.4)'
                : '0 2px 8px rgba(139, 92, 246, 0.3)',
            }}
            onMouseEnter={(e) => {
              if (!active) {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(139, 92, 246, 0.4), rgba(59, 130, 246, 0.4))'
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.4)'
              }
            }}
            onMouseLeave={(e) => {
              if (!active) {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(59, 130, 246, 0.3))'
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(139, 92, 246, 0.3)'
              }
            }}
          >
            {active ? (
              <>
                <span style={{ marginRight: 6 }}>🔓</span>
                Unlock cursor (Esc)
              </>
            ) : (
              <>
                <span style={{ marginRight: 6 }}>🔒</span>
                Enable Mouse Look
                <div style={{ fontSize: '11px', opacity: 0.8, marginTop: 4, fontWeight: 400 }}>
                  Press <span style={{ fontFamily: 'JetBrains Mono', background: 'rgba(255, 255, 255, 0.2)', padding: '2px 6px', borderRadius: 4 }}>L</span> or double-click
                </div>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default App

