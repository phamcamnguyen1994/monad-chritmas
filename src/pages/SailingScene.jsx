import { Suspense, useCallback, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, Environment, KeyboardControls, Sky } from '@react-three/drei'
import * as THREE from 'three'
import { Physics } from '@react-three/cannon'
import WinterWorld from '../components/WinterWorld'
import ChogsSled from '../components/ChogsSled'
import Snowfall from '../components/Snowfall'
import WalletConnect from '../components/WalletConnect'
import { useQuestStore } from '../store/questStore'

const keyboardMap = [
  { name: 'forward', keys: ['KeyW', 'ArrowUp'] },
  { name: 'backward', keys: ['KeyS', 'ArrowDown'] },
  { name: 'left', keys: ['KeyA', 'ArrowLeft'] },
  { name: 'right', keys: ['KeyD', 'ArrowRight'] },
  { name: 'brake', keys: ['Space'] },
  { name: 'boost', keys: ['ShiftLeft', 'ShiftRight'] },
]

const followOffset = new THREE.Vector3(0, 6.4, 10.5)
const lookOffset = new THREE.Vector3(0, 1.8, 0)
const tempDirection = new THREE.Vector3()
const desiredPosition = new THREE.Vector3()
const lookTarget = new THREE.Vector3()

function WinterCameraRig({ sledRef }) {
  const smoothPosition = useRef(new THREE.Vector3())
  const smoothTarget = useRef(new THREE.Vector3())

  useFrame((state, delta) => {
    const sled = sledRef.current?.object
    if (!sled) return

    const camera = state.camera

    tempDirection.set(0, 0, -1).applyQuaternion(sled.quaternion).normalize()
    desiredPosition.copy(sled.position)
    desiredPosition.addScaledVector(tempDirection, -followOffset.z)
    desiredPosition.y += followOffset.y
    desiredPosition.x += followOffset.x

    smoothPosition.current.lerp(desiredPosition, 1 - Math.pow(0.0009, delta * 60))
    camera.position.copy(smoothPosition.current)

    lookTarget.copy(sled.position).add(lookOffset)
    smoothTarget.current.lerp(lookTarget, 1 - Math.pow(0.0012, delta * 60))
    camera.lookAt(smoothTarget.current)
  })

  return null
}

function DebugTelemetry({ sledRef, plateauHeight, sampleHeight }) {
  const [telemetry, setTelemetry] = useState({
    position: [0, 0, 0],
    velocity: [0, 0, 0],
    slopeFactor: 0,
    accelerating: false,
    ground: null,
    valid: false,
    input: null,
  })
  const lastUpdateRef = useRef(0)

  useFrame((state) => {
    const elapsed = state.clock.elapsedTime
    if (elapsed - lastUpdateRef.current < 0.2) return
    lastUpdateRef.current = elapsed

    const sledHandle = sledRef.current
    const sled = sledHandle?.object
    if (!sled) {
      setTelemetry((prev) => (prev.valid ? { ...prev, valid: false } : prev))
      return
    }

    const position = [sled.position.x, sled.position.y, sled.position.z]
    const velocityVector = sledHandle.velocity
    const velocity = velocityVector
      ? [velocityVector.x, velocityVector.y, velocityVector.z]
      : [0, 0, 0]

    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(sled.quaternion)
    const slope = THREE.MathUtils.clamp(1 - up.y, 0, 1)
    const ground = typeof sampleHeight === 'function' ? sampleHeight(position[0], position[2]) : null

    const inputState = sledHandle?.getInputState?.() || null

    setTelemetry({
      position,
      velocity,
      slopeFactor: Number(slope.toFixed(3)),
      accelerating: slope > 0.08,
      ground,
      input: inputState,
      valid: true,
    })
  })

  if (!telemetry.valid) return null

  const plateauLabel = plateauHeight != null ? plateauHeight.toFixed(2) : '??'
  const groundLabel = telemetry.ground != null ? telemetry.ground.toFixed(2) : '??'

  return (
    <Html position={[0, 0, 0]} transform={false} wrapperClass="pointer-events-none">
      <div className="pointer-events-none absolute top-1/2 left-8 -translate-y-1/2 space-y-2 text-xs">
        <div className="pointer-events-auto rounded-2xl border border-emerald-300/40 bg-slate-900/85 px-5 py-4 font-mono shadow-lg shadow-black/60">
          <p className="text-emerald-300">plateau ≈ {plateauLabel}</p>
          <p className="text-sky-300">ground ≈ {groundLabel}</p>
          <p className="text-white">
            pos:{' '}
            <span className="text-amber-200">
              {telemetry.position.map((v) => v.toFixed(2)).join(', ')}
            </span>
          </p>
          <p className="text-white">
            vel:{' '}
            <span className="text-amber-200">
              {telemetry.velocity.map((v) => v.toFixed(2)).join(', ')}
            </span>
          </p>
          <p className="text-fuchsia-300">slope: {telemetry.slopeFactor}</p>
          {telemetry.input ? (
            <div className="text-xs text-cyan-200">
              <p>
                input: f {telemetry.input.forward ? '1' : '0'} · b{' '}
                {telemetry.input.backward ? '1' : '0'} · l{' '}
                {telemetry.input.left ? '1' : '0'} · r{' '}
                {telemetry.input.right ? '1' : '0'} · brake{' '}
                {telemetry.input.brake ? '1' : '0'}
              </p>
            </div>
          ) : null}
          <p className={telemetry.accelerating ? 'text-emerald-300 font-semibold' : 'text-rose-300 font-semibold'}>
            assist: {telemetry.accelerating ? 'ON' : 'off'}
          </p>
        </div>
      </div>
    </Html>
  )
}

function ControlsHint({ debugEnabled, onToggleDebug }) {
  return (
    <div className="pointer-events-none absolute bottom-16 left-8">
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-slate-300/40 bg-slate-900/70 px-5 py-3 text-white/90 shadow-lg shadow-black/50 backdrop-blur">
        <div className="flex items-center gap-1 text-xs font-semibold tracking-[0.3em]">
          <span className="rounded-md border border-emerald-200/70 bg-emerald-500/20 px-2 py-1 text-emerald-100">W</span>
          <span className="rounded-md border border-sky-200/70 bg-sky-500/20 px-2 py-1 text-sky-100">A</span>
          <span className="rounded-md border border-sky-200/70 bg-sky-500/20 px-2 py-1 text-sky-100">S</span>
          <span className="rounded-md border border-emerald-200/70 bg-emerald-500/20 px-2 py-1 text-emerald-100">D</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-slate-200">
          <span>Space: Hãm trượt</span>
          <span className="rounded-full border border-slate-200/70 bg-white/10 px-3 py-1 text-white">Giữ đà</span>
        </div>
        <button
          type="button"
          onClick={onToggleDebug}
          className={`ml-2 rounded-full px-3 py-1 text-[10px] font-semibold tracking-[0.2em] transition ${
            debugEnabled
              ? 'bg-emerald-400 text-emerald-950 shadow-lg shadow-emerald-500/40'
              : 'bg-slate-700 text-white shadow'
          }`}
        >
          {debugEnabled ? 'Telemetry ON' : 'Telemetry OFF'}
        </button>
      </div>
    </div>
  )
}

function ExpeditionOverlay({ walletConnected, walletAddress, onConnect, onDisconnect }) {
  const levelInfo = useQuestStore((state) => state.getLevelInfo())
  const visited = useQuestStore((state) => state.visitedDapps?.length || 0)
  const totalQuests = useQuestStore((state) => state.getQuestList()?.length || 0)
  const progress = levelInfo?.progress ?? 0

  return (
    <div className="pointer-events-none absolute top-8 left-8 space-y-4 text-white/85">
      <div className="pointer-events-auto rounded-3xl border border-slate-200/50 bg-slate-900/75 px-6 py-5 text-white shadow-xl shadow-black/40 backdrop-blur">
        <p className="text-xs uppercase tracking-[0.35em] text-sky-300">Chog&apos;s Winter Expedition</p>
        <h2 className="mt-1 text-2xl font-semibold text-white drop-shadow">Khởi hành vào sương tuyết</h2>
        <p className="mt-2 max-w-sm text-[12px] text-slate-200">
          Lướt xuống các triền núi lạnh giá để khám phá dApp ẩn sâu dưới lớp băng. Giai đoạn 2 sẽ mở khóa các hộp quà và bất ngờ từ hệ sinh thái Monad.
        </p>
      </div>

      <div className="pointer-events-auto flex items-center gap-3 rounded-3xl border border-slate-200/50 bg-slate-900/70 px-5 py-3 text-white shadow-lg shadow-black/40 backdrop-blur">
        <WalletConnect
          walletConnected={walletConnected}
          walletAddress={walletAddress}
          onConnect={onConnect}
          onDisconnect={onDisconnect}
          variant="overlay"
        />
        <div className="flex flex-col text-xs uppercase tracking-[0.3em] text-slate-200">
          <span className="text-sky-200">Level {levelInfo?.level || 1}</span>
          <div className="mt-1 h-1.5 w-36 rounded-full bg-slate-700/80">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-400 via-slate-100 to-emerald-300 shadow-inner shadow-black/40"
              style={{ width: `${Math.max(progress * 100, 6)}%` }}
        />
      </div>
          <span className="mt-1 text-[10px] text-slate-300">Đã mở khóa: {visited} dApp · Quest: {totalQuests}</span>
        </div>
      </div>
    </div>
  )
}

function WinterSunLight() {
  const lightRef = useRef()
  useFrame(({ clock }) => {
    const light = lightRef.current
    if (!light) return
    const t = clock.elapsedTime * 0.05
    light.position.x = Math.sin(t) * 60
    light.position.z = Math.cos(t) * 40
  })
  return (
    <directionalLight
      ref={lightRef}
      castShadow
      position={[35, 48, 35]}
      intensity={1.35}
      color="white"
      shadow-mapSize-width={2048}
      shadow-mapSize-height={2048}
      shadow-camera-near={1}
      shadow-camera-far={220}
      shadow-camera-left={-120}
      shadow-camera-right={120}
      shadow-camera-top={120}
      shadow-camera-bottom={-120}
    />
  )
}

function ExpeditionStatus({ speed }) {
  return (
    <div className="pointer-events-none absolute bottom-16 right-8">
      <div className="pointer-events-auto min-w-[220px] rounded-3xl border border-slate-200/50 bg-slate-900/70 px-5 py-3 text-white/90 shadow-lg shadow-black/50 backdrop-blur">
        <p className="text-xs uppercase tracking-[0.3em] text-sky-200">Trạng thái</p>
        <div className="mt-2 flex items-end justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.4em] text-slate-200">Tốc độ</p>
            <p className="text-2xl font-semibold text-white drop-shadow">{speed.toFixed(1)} m/s</p>
          </div>
          <div className="flex flex-col items-end text-[11px] uppercase tracking-[0.28em] text-slate-200">
            <span className="text-emerald-200">Trượt tự do</span>
            <span className="text-emerald-200">Giai đoạn 1</span>
          </div>
        </div>
      </div>
    </div>
  )
}

const SLED_HALF_HEIGHT = 0.5
const SLED_CLEARANCE = 0.02
const DEFAULT_DAMPING = 0.12

export default function SailingScene({ walletConnected, walletAddress, onConnect, onDisconnect }) {
  const sledRef = useRef(null)
  const winterWorldRef = useRef(null)
  const heightSamplerRef = useRef(null)
  const [plateauHeight, setPlateauHeight] = useState(null)
  const [speed, setSpeed] = useState(0)
  const [spawnHeight, setSpawnHeight] = useState(12)
  const [debugEnabled, setDebugEnabled] = useState(false)

  const handleWinterWorldRef = useCallback((instance) => {
    winterWorldRef.current = instance
    if (instance && typeof instance.plateauHeight === 'number') {
      setPlateauHeight(instance.plateauHeight)
      heightSamplerRef.current = typeof instance.getHeightAt === 'function' ? instance.getHeightAt : null
      setSpawnHeight(instance.plateauHeight + SLED_HALF_HEIGHT + SLED_CLEARANCE)
    }
  }, [])

  const handleVelocityChange = useCallback((velocity) => {
    if (!velocity) return
    const [x, , z] = velocity
    setSpeed(Math.sqrt(x * x + z * z))
  }, [])

  const handleTelemetryToggle = useCallback(() => {
    setDebugEnabled((prev) => !prev)
  }, [])

  const physicsConfig = useMemo(
    () => ({
      iterations: 18,
      broadphase: 'SAP',
      gravity: [0, -28, 0],
      defaultContactMaterial: {
        friction: 0.6,
        restitution: 0.03,
      },
    }),
    []
  )

  return (
    <div className="relative mt-4 min-h-[calc(100vh-140px)] w-full px-4">
      <div className="absolute inset-0 overflow-hidden rounded-[32px] border border-white/8 bg-gradient-to-br from-[#020924] via-[#0a172f] to-[#0f1a2f] shadow-[0_45px_120px_rgba(4,12,35,0.65)]">
        <KeyboardControls map={keyboardMap}>
          <Canvas
            shadows
            camera={{ position: [0, 6, 12], fov: 52, near: 0.1, far: 500 }}
            onCreated={({ scene }) => {
              scene.fog = new THREE.FogExp2('#0c1426', 0.007)
            }}
          >
            <color attach="background" args={['#0c1729']} />
            <ambientLight intensity={0.45} color="#dbeafe" />
            <WinterSunLight />
            <directionalLight position={[-25, 16, -30]} intensity={0.35} color="#d0d9ff" />

            <Sky
              distance={450000}
              sunPosition={[0.4, 1.4, -0.6]}
              inclination={0.52}
              turbidity={4.2}
              mieCoefficient={0.0045}
              mieDirectionalG={0.9}
              rayleigh={2.6}
            />
            <Environment preset="sunset" background={false} />

                <Suspense fallback={null}>
              <Physics {...physicsConfig}>
                <WinterWorld ref={handleWinterWorldRef} size={420} segments={200} amplitude={18} />
                <ChogsSled
                  ref={sledRef}
                  position={[0, spawnHeight, 0]}
                  respawnHeight={spawnHeight}
                  onVelocityChange={handleVelocityChange}
                  driftDamping={DEFAULT_DAMPING}
                  getGroundHeight={heightSamplerRef.current}
                />
                {debugEnabled ? (
                  <DebugTelemetry
                    sledRef={sledRef}
                    plateauHeight={plateauHeight}
                    sampleHeight={heightSamplerRef.current}
                  />
                ) : null}
              </Physics>
              <Snowfall />
            </Suspense>

            <WinterCameraRig sledRef={sledRef} />
          </Canvas>
        </KeyboardControls>
      </div>

      <ExpeditionOverlay
            walletConnected={walletConnected}
            walletAddress={walletAddress}
            onConnect={onConnect}
            onDisconnect={onDisconnect}
          />
      <ControlsHint debugEnabled={debugEnabled} onToggleDebug={handleTelemetryToggle} />
      <ExpeditionStatus speed={speed} />
    </div>
  )
}


