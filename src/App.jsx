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
      onPointerDown={handlePointerDown}
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
      style={{
        position: 'absolute',
        right: 16,
        bottom: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        alignItems: 'flex-end',
        pointerEvents: 'none',
        color: 'rgba(255,255,255,0.82)',
        fontSize: 13,
        textAlign: 'right',
      }}
    >
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onToggle()
        }}
        style={{
          pointerEvents: 'auto',
          background: active ? 'rgba(0, 128, 255, 0.8)' : 'rgba(0,0,0,0.55)',
          border: '1px solid rgba(255,255,255,0.25)',
          borderRadius: 6,
          padding: '6px 12px',
          color: '#fff',
          cursor: 'pointer',
          fontSize: 13,
        }}
      >
        {active ? 'Unlock cursor (Esc)' : 'Enable mouse look (L / double-click)'}
      </button>
      <span style={{ opacity: 0.8 }}>Drag or touch to look around · Enable mouse look for full control</span>
    </div>
  )
}

export default App

