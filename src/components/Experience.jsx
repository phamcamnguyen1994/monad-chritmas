import { Suspense, useMemo, useState, useEffect, useRef } from 'react'
import { useFrame, extend } from '@react-three/fiber'
import WinterWorld, { TERRAIN_HALF } from './WinterWorld'
import ChogsSled from './ChogsSled'
import GiftBox from './GiftBox'
import DiscoveredDapps from './DiscoveredDapps'
import { useQuestStore } from '../store/questStore'
import dapps from '../data/dappsData'
import * as THREE from 'three'
import { useSledInput } from './SledInputContext.jsx'
import { shaderMaterial } from '@react-three/drei'

const HEAD_HEIGHT = 1.45

const AuroraMaterial = shaderMaterial(
  {
    uTime: 0,
    uTopColor: new THREE.Color('#6ef8ff'),
    uBottomColor: new THREE.Color('#102849'),
  },
  `
    varying vec3 vWorldPosition;
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,
  `
    uniform float uTime;
    uniform vec3 uTopColor;
    uniform vec3 uBottomColor;
    varying vec3 vWorldPosition;

    void main() {
      float heightFactor = smoothstep(-20.0, 130.0, vWorldPosition.y);
      float wave = sin(vWorldPosition.x * 0.018 + uTime * 0.32) * 0.35;
      wave += cos(vWorldPosition.z * 0.015 - uTime * 0.27) * 0.28;
      float bands = clamp(heightFactor + wave, 0.0, 1.0);
      float flicker = sin(uTime * 0.85 + vWorldPosition.x * 0.006) * 0.12;
      vec3 color = mix(uBottomColor, uTopColor, clamp(bands + flicker, 0.0, 1.0));
      float alpha = smoothstep(0.25, 0.9, bands) * 0.82;
      if (alpha < 0.02) discard;
      gl_FragColor = vec4(color, alpha);
    }
  `
)

extend({ AuroraMaterial })

function createDeterministicRandom(seed) {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

function FirstPersonCamera({ body }) {
  const headOffset = useMemo(() => new THREE.Vector3(0, HEAD_HEIGHT, 0), [])
  const targetPosition = useMemo(() => new THREE.Vector3(), [])
  const targetQuaternion = useMemo(() => new THREE.Quaternion(), [])
  const euler = useMemo(() => new THREE.Euler(), [])
  const { orientationRef } = useSledInput()

  useFrame(({ camera }, delta) => {
    if (!body) return
    const orientation = orientationRef.current
    const translation = body.translation()

    targetPosition.set(translation.x, translation.y, translation.z).add(headOffset)
    camera.position.lerp(targetPosition, 1 - Math.pow(0.12, delta * 60))

    euler.set(orientation.pitch, orientation.yaw, 0, 'YXZ')
    targetQuaternion.setFromEuler(euler)
    camera.quaternion.slerp(targetQuaternion, 1 - Math.pow(0.1, delta * 60))
  })

  return null
}

function AuroraSky() {
  const materialRef = useRef()
  useFrame((_, delta) => {
    if (materialRef.current) {
      materialRef.current.uTime += delta
    }
  })
  return (
    <group position={[0, 40, -60]}>
      <mesh rotation={[-Math.PI / 6, 0, 0]} scale={[280, 180, 1]}>
        <planeGeometry args={[1, 1, 128, 64]} />
        <auroraMaterial ref={materialRef} transparent depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function SledPositionReporter({ body }) {
  const setPlayerPosition = useQuestStore((state) => state.setPlayerPosition)
  const setPlayerSpeed = useQuestStore((state) => state.setPlayerSpeed)
  const lastPosition = useRef({ x: Infinity, z: Infinity })

  useFrame(() => {
    if (!body) return
    const translation = body.translation()
    const x = translation.x
    const z = translation.z
    const prev = lastPosition.current
    if (Math.abs(prev.x - x) > 0.05 || Math.abs(prev.z - z) > 0.05) {
      lastPosition.current = { x, z }
      setPlayerPosition({ x, z })
    }
    const velocity = body.linvel()
    const speed = Math.sqrt(velocity.x ** 2 + velocity.z ** 2 + velocity.y ** 2)
    setPlayerSpeed(speed)
  })
  return null
}

export default function Experience() {
  const discoveredDapps = useQuestStore((state) => state.discoveredDapps)
  const setDappPlacements = useQuestStore((state) => state.setDappPlacements)
  const [sledBody, setSledBody] = useState(null)
  const [terrainInfo, setTerrainInfo] = useState(null)
  const { orientationRef } = useSledInput()
  const debugAxes = useMemo(() => (import.meta?.env?.DEV ? new THREE.AxesHelper(2) : null), [])

  useEffect(() => {
    const current = orientationRef?.current
    if (current) {
      if (!Number.isFinite(current.yaw)) {
        console.warn('[Experience] orientation yaw was invalid; resetting', current.yaw)
        current.yaw = 0
      }
      if (!Number.isFinite(current.pitch)) {
        console.warn('[Experience] orientation pitch was invalid; resetting', current.pitch)
        current.pitch = THREE.MathUtils.degToRad(-6)
      }
    }
    console.log('[Experience] orientation ref current', current)
  }, [orientationRef])

  useEffect(() => {
    if (!sledBody || !orientationRef?.current) return
    const rotation = sledBody.rotation()
    const quat = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w)
    const euler = new THREE.Euler().setFromQuaternion(quat, 'YXZ')
    orientationRef.current.yaw = euler.y
  }, [sledBody, orientationRef])

  const giftBoxPositions = useMemo(() => {
    if (!terrainInfo?.getHeightAt) return []
    const sampler = terrainInfo.getHeightAt
    const placements = []
    const usableRadius = TERRAIN_HALF * 0.88

    dapps.forEach((dapp, index) => {
      const rng = createDeterministicRandom(`${dapp.id}-${index}`)
      let position = [0, 4, 0]
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const angle = rng() * Math.PI * 2
        const radius = Math.sqrt(rng()) * usableRadius
        const x = Math.cos(angle) * radius
        const z = Math.sin(angle) * radius
        const groundHeight = sampler(x, z)
        if (groundHeight != null) {
          position = [x, groundHeight + 0.95, z]
          break
        }
      }
      placements.push({ dapp, position })
    })
    return placements
  }, [terrainInfo])

  useEffect(() => {
    if (!giftBoxPositions.length) return
    const placementMap = {}
    giftBoxPositions.forEach(({ dapp, position }) => {
      placementMap[dapp.id] = { x: position[0], z: position[2] }
    })
    setDappPlacements(placementMap)
  }, [giftBoxPositions, setDappPlacements])

  return (
    <>
      <Suspense fallback={null}>
        <AuroraSky />
        <WinterWorld onTerrainReady={setTerrainInfo} />
        <ChogsSled
          onReady={setSledBody}
          getGroundHeight={terrainInfo?.getHeightAt}
          orientationRef={orientationRef}
        />
        {debugAxes ? <primitive object={debugAxes} /> : null}
        {sledBody ? (
          <>
            <FirstPersonCamera body={sledBody} />
            <SledPositionReporter body={sledBody} />
          </>
        ) : null}
        {giftBoxPositions.map(({ dapp, position }) => (
          <GiftBox key={dapp.id} dapp={dapp} position={position} />
        ))}
        <DiscoveredDapps
          dapps={dapps.filter((dapp) => discoveredDapps.includes(dapp.id))}
          origin={[-18, 3.2, 12]}
        />
      </Suspense>
    </>
  )
}

