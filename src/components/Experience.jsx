import { Suspense, useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { useFrame, extend, useThree } from '@react-three/fiber'
import WinterWorld, { TERRAIN_HALF } from './WinterWorld'
import ChogsSled from './ChogsSled'
import GiftBox from './GiftBox'
import DiscoveredDapps from './DiscoveredDapps'
import { useQuestStore } from '../store/questStore'
import * as THREE from 'three'
import { useSledInput } from './SledInputContext.jsx'
import { Html, shaderMaterial } from '@react-three/drei'
import { useDappData } from '../hooks/useDappData.jsx'
import alea from 'alea'

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

const SparkleMaterial = shaderMaterial(
  {
    uTime: 0,
    uCenter: new THREE.Vector3(),
    uColor: new THREE.Color('#dbeafe'),
  },
  `
    uniform float uTime;
    uniform vec3 uCenter;
    attribute vec3 offset;
    attribute float phase;
    varying float vAlpha;

    void main() {
      float wobble = sin(uTime * 1.4 + phase) * 0.25;
      vec3 worldPosition = uCenter + offset;
      worldPosition.y += wobble;
      vec4 mvPosition = modelViewMatrix * vec4(worldPosition, 1.0);
      float baseSize = 6.0 + 4.0 * sin(uTime * 1.9 + phase * 2.7);
      float distanceFactor = 1.0 / max(-mvPosition.z, 0.001);
      gl_PointSize = baseSize * distanceFactor;
      vAlpha = 0.45 + 0.45 * sin(uTime * 2.4 + phase * 3.1);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  `
    uniform vec3 uColor;
    varying float vAlpha;

    void main() {
      vec2 coord = gl_PointCoord - 0.5;
      float dist = length(coord);
      float soft = smoothstep(0.45, 0.0, dist);
      float alpha = soft * vAlpha;
      if (alpha <= 0.02) discard;
      gl_FragColor = vec4(uColor, alpha);
    }
  `
)

extend({ SparkleMaterial })

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

function AuroraSky({ atmosphere }) {
  const materialRef = useRef()
  const timeRef = useRef(0)
  const topBase = useMemo(() => {
    const color = new THREE.Color(atmosphere?.auroraTop ?? '#6ef8ff')
    const hsl = { h: 0, s: 0, l: 0 }
    color.getHSL(hsl)
    return hsl
  }, [atmosphere])
  const bottomBase = useMemo(() => {
    const color = new THREE.Color(atmosphere?.auroraBottom ?? '#102849')
    const hsl = { h: 0, s: 0, l: 0 }
    color.getHSL(hsl)
    return hsl
  }, [atmosphere])

  useFrame((_, delta) => {
    if (materialRef.current) {
      timeRef.current += delta
      const uniforms = materialRef.current.uniforms
      uniforms.uTime.value += delta
      const t = timeRef.current
      const topColor = uniforms.uTopColor.value
      const bottomColor = uniforms.uBottomColor.value
      const topHue = THREE.MathUtils.euclideanModulo(topBase.h + (atmosphere?.auroraHueShift ?? 0.04) * Math.sin(t * 0.07), 1)
      const topSat = THREE.MathUtils.clamp(
        topBase.s + (atmosphere?.auroraSatShift ?? 0.12) * Math.sin(t * 0.11 + 1.3),
        0.2,
        0.95
      )
      const topLight = THREE.MathUtils.clamp(
        topBase.l + (atmosphere?.auroraLightShift ?? 0.1) * Math.sin(t * 0.09 + 0.6),
        0.45,
        0.9
      )
      topColor.setHSL(topHue, topSat, topLight)
      const bottomHue = THREE.MathUtils.euclideanModulo(
        bottomBase.h + (atmosphere?.auroraHueShift ?? 0.03) * Math.sin(t * 0.05 + 0.8),
        1
      )
      const bottomSat = THREE.MathUtils.clamp(
        bottomBase.s + (atmosphere?.auroraSatShift ?? 0.15) * Math.sin(t * 0.08 + 2.1),
        0.25,
        0.9
      )
      const bottomLight = THREE.MathUtils.clamp(
        bottomBase.l + (atmosphere?.auroraLightShift ?? 0.09) * Math.sin(t * 0.1 + 1.8),
        0.05,
        0.32
      )
      bottomColor.setHSL(bottomHue, bottomSat, bottomLight)
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

const SPARKLE_COUNT = 140

function SparkleField({ atmosphere }) {
  const materialRef = useRef()
  const offsets = useMemo(() => {
    const rng = atmosphere?.seed ? alea(`${atmosphere.seed}-sparkles`) : Math.random
    const arr = new Float32Array(SPARKLE_COUNT * 3)
    for (let i = 0; i < SPARKLE_COUNT; i += 1) {
      const rand = typeof rng === 'function' ? rng() : Math.random()
      const radius = 4 + rand * 7
      const angle = (typeof rng === 'function' ? rng() : Math.random()) * Math.PI * 2
      const height = 0.8 + (typeof rng === 'function' ? rng() : Math.random()) * 2.4
      arr[i * 3] = Math.cos(angle) * radius
      arr[i * 3 + 1] = height
      arr[i * 3 + 2] = Math.sin(angle) * radius
    }
    return arr
  }, [atmosphere])
  const phases = useMemo(() => {
    const rng = atmosphere?.seed ? alea(`${atmosphere.seed}-spark-phase`) : Math.random
    const arr = new Float32Array(SPARKLE_COUNT)
    for (let i = 0; i < SPARKLE_COUNT; i += 1) {
      arr[i] = (typeof rng === 'function' ? rng() : Math.random()) * Math.PI * 2
    }
    return arr
  }, [atmosphere])
  const playerPosition = useQuestStore((state) => state.playerPosition)

  useFrame(() => {
    if (!materialRef.current) return
    const uniforms = materialRef.current.uniforms
    uniforms.uTime.value += 0.016
    uniforms.uCenter.value.set(playerPosition.x, 1.6, playerPosition.z)
    if (atmosphere) {
      uniforms.uColor.value.set(atmosphere.sparkleColor ?? '#dbeafe')
    }
  })

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-offset" array={offsets} count={SPARKLE_COUNT} itemSize={3} />
        <bufferAttribute attach="attributes-phase" array={phases} count={SPARKLE_COUNT} itemSize={1} />
      </bufferGeometry>
      <sparkleMaterial ref={materialRef} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  )
}

function AtmosphereController({ atmosphere }) {
  const { scene } = useThree()
  useEffect(() => {
    if (!atmosphere) return
    const backgroundColor = new THREE.Color(atmosphere.skyBase ?? '#081633')
    scene.background = backgroundColor
    if (!scene.fog) {
      scene.fog = new THREE.Fog(atmosphere.fogColor ?? '#0a1731', atmosphere.fogNear ?? 12, atmosphere.fogFar ?? 120)
    } else {
      scene.fog.color.set(atmosphere.fogColor ?? '#0a1731')
      scene.fog.near = atmosphere.fogNear ?? 12
      scene.fog.far = atmosphere.fogFar ?? 120
    }
  }, [scene, atmosphere])
  return null
}

function SantaFlyby() {
  const [active, setActive] = useState(false)
  const santaRef = useRef()
  const trailRef = useRef()
  const timeRef = useRef(0)
  const cooldownRef = useRef(0)
  const activeRef = useRef(false)

  useEffect(() => {
    activeRef.current = active
  }, [active])

  useFrame((_, delta) => {
    cooldownRef.current -= delta
    if (!activeRef.current && cooldownRef.current <= 0) {
      timeRef.current = 0
      cooldownRef.current = 28 + Math.random() * 18
      setActive(true)
    }
    if (!activeRef.current) return

    timeRef.current += delta * 0.22
    const t = timeRef.current
    if (t >= 1) {
      setActive(false)
      return
    }
    const progress = THREE.MathUtils.smoothstep(t, 0, 1)
    const height = 32 + Math.sin(progress * Math.PI) * 12
    const x = THREE.MathUtils.lerp(-TERRAIN_HALF * 1.2, TERRAIN_HALF * 1.2, progress)
    const z = Math.sin(progress * Math.PI * 2.2) * TERRAIN_HALF * 0.6
    if (santaRef.current) {
      santaRef.current.position.set(x, height, z)
      santaRef.current.rotation.y = -Math.PI / 2 + Math.atan2(
        Math.cos(progress * Math.PI * 2.2) * TERRAIN_HALF * 0.6 * Math.PI * 2.2,
        TERRAIN_HALF * 1.2
      )
    }
    if (trailRef.current) {
      trailRef.current.rotation.z += delta * 0.8
    }
  })

  if (!active) {
    return null
  }

  return (
    <group ref={santaRef}>
      <mesh position={[0, 0.2, 0]} scale={[1.8, 0.5, 0.9]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#8b1d3b" roughness={0.6} />
      </mesh>
      <mesh position={[-1.2, 0.35, 0]} scale={[1.4, 0.4, 0.8]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.5} />
      </mesh>
      <mesh position={[0.7, 0.6, 0]} scale={[0.6, 0.6, 0.6]} castShadow>
        <sphereGeometry args={[1, 12, 12]} />
        <meshStandardMaterial color="#111827" roughness={0.5} />
      </mesh>
      <mesh position={[1.2, 0.55, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.3, 0.8, 0.3]} castShadow>
        <coneGeometry args={[1, 1.6, 8]} />
        <meshStandardMaterial color="#f43f5e" roughness={0.4} />
      </mesh>
      <mesh position={[0.6, 0, 0.7]} scale={[0.9, 0.2, 0.1]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#facc15" roughness={0.3} metalness={0.8} />
      </mesh>
      <mesh position={[0.6, 0, -0.7]} scale={[0.9, 0.2, 0.1]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#facc15" roughness={0.3} metalness={0.8} />
      </mesh>
      <mesh ref={trailRef} position={[-1.5, 0.4, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.4, 0.08, 8, 24]} />
        <meshStandardMaterial emissive="#fde68a" emissiveIntensity={1.4} color="#fde68a" transparent opacity={0.6} />
      </mesh>
    </group>
  )
}

function PenguinModel({ leftWingRef, rightWingRef }) {
  return (
    <>
      <mesh position={[0, 0.9, 0]} scale={[0.55, 0.95, 0.55]} castShadow receiveShadow>
        <sphereGeometry args={[1, 18, 18]} />
        <meshStandardMaterial color="#111827" roughness={0.7} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0.78, 0.25]} scale={[0.4, 0.65, 0.4]} castShadow receiveShadow>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.4} metalness={0.05} />
      </mesh>
      <mesh position={[0, 1.25, 0.2]} scale={[0.22, 0.28, 0.22]} castShadow>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial color="#1f2937" roughness={0.6} metalness={0.05} />
      </mesh>
      <mesh position={[0, 1.1, 0.55]} rotation={[Math.PI / 2, 0, 0]} scale={[0.22, 0.22, 0.4]} castShadow>
        <coneGeometry args={[1, 1.2, 12]} />
        <meshStandardMaterial color="#f97316" roughness={0.35} metalness={0.1} />
      </mesh>
      <mesh ref={leftWingRef} position={[-0.55, 0.8, 0]} rotation={[0, 0, 0.4]} castShadow>
        <boxGeometry args={[0.18, 0.75, 0.4]} />
        <meshStandardMaterial color="#0f172a" roughness={0.75} />
      </mesh>
      <mesh ref={rightWingRef} position={[0.55, 0.8, 0]} rotation={[0, 0, -0.4]} castShadow>
        <boxGeometry args={[0.18, 0.75, 0.4]} />
        <meshStandardMaterial color="#0f172a" roughness={0.75} />
      </mesh>
      <mesh position={[-0.22, 0.38, 0.05]} rotation={[0, 0, 0.12]} scale={[0.24, 0.12, 0.4]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#f59e0b" roughness={0.6} />
      </mesh>
      <mesh position={[0.22, 0.38, 0.05]} rotation={[0, 0, -0.12]} scale={[0.24, 0.12, 0.4]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#f59e0b" roughness={0.6} />
      </mesh>
      <mesh position={[-0.18, 1.24, 0.38]} scale={[0.08, 0.08, 0.08]}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshStandardMaterial color="#fefce8" />
      </mesh>
      <mesh position={[0.18, 1.24, 0.38]} scale={[0.08, 0.08, 0.08]}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshStandardMaterial color="#fefce8" />
      </mesh>
      <mesh position={[-0.18, 1.23, 0.46]} scale={[0.04, 0.04, 0.04]}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshStandardMaterial color="#020617" />
      </mesh>
      <mesh position={[0.18, 1.23, 0.46]} scale={[0.04, 0.04, 0.04]}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshStandardMaterial color="#020617" />
      </mesh>
    </>
  )
}

function Penguin({ origin, radius, speed, phase }) {
  const groupRef = useRef()
  const timeRef = useRef(Math.random() * Math.PI * 2)
  const leftWingRef = useRef()
  const rightWingRef = useRef()

  useFrame((_, delta) => {
    timeRef.current += delta * speed
    const angle = timeRef.current + phase
    const x = origin.x + Math.cos(angle) * radius
    const z = origin.z + Math.sin(angle) * radius
    const y = origin.y + Math.sin(angle * 1.3) * 0.05 + 0.6
    if (groupRef.current) {
      groupRef.current.position.set(x, y, z)
      groupRef.current.rotation.y = -angle + Math.PI / 2
    }
    const waddle = Math.sin(angle * 2.4) * 0.25
    if (leftWingRef.current) leftWingRef.current.rotation.z = 0.25 + waddle * 0.6
    if (rightWingRef.current) rightWingRef.current.rotation.z = -0.25 - waddle * 0.6
  })

  return (
    <group ref={groupRef} position={[origin.x, origin.y + 0.6, origin.z]}>
      <PenguinModel leftWingRef={leftWingRef} rightWingRef={rightWingRef} />
    </group>
  )
}

function FoxModel({ tailRef }) {
  return (
    <>
      <mesh position={[0, 0.35, 0]} scale={[0.9, 0.5, 0.4]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#f97316" roughness={0.5} />
      </mesh>
      <mesh position={[0.35, 0.48, 0]} scale={[0.45, 0.4, 0.3]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#f97316" roughness={0.5} />
      </mesh>
      <mesh position={[0.6, 0.52, 0.26]} scale={[0.16, 0.2, 0.12]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#fef3c7" roughness={0.4} />
      </mesh>
      <mesh position={[0.6, 0.52, -0.26]} scale={[0.16, 0.2, 0.12]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#fef3c7" roughness={0.4} />
      </mesh>
      <mesh position={[0.8, 0.45, 0]} rotation={[0, 0, Math.PI / 4]} scale={[0.22, 0.3, 0.18]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#f97316" roughness={0.5} />
      </mesh>
      <mesh position={[0.4, 0.82, 0.14]} scale={[0.18, 0.2, 0.12]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#fef3c7" />
      </mesh>
      <mesh position={[0.4, 0.82, -0.14]} scale={[0.18, 0.2, 0.12]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#fef3c7" />
      </mesh>
      <mesh position={[0.62, 0.88, 0.14]} scale={[0.08, 0.1, 0.08]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      <mesh position={[0.62, 0.88, -0.14]} scale={[0.08, 0.1, 0.08]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      <mesh position={[-0.45, 0.32, 0]} scale={[0.6, 0.18, 0.18]} ref={tailRef} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#f97316" roughness={0.4} />
      </mesh>
    </>
  )
}

function Fox({ origin, pathRadius, speed, phase }) {
  const groupRef = useRef()
  const tailRef = useRef()
  const timeRef = useRef(Math.random() * Math.PI * 2)

  useFrame((_, delta) => {
    timeRef.current += delta * speed
    const angle = timeRef.current + phase
    const x = origin.x + Math.cos(angle) * pathRadius
    const z = origin.z + Math.sin(angle) * pathRadius
    const y = origin.y + Math.sin(angle * 1.7) * 0.08 + 0.2
    if (groupRef.current) {
      groupRef.current.position.set(x, y, z)
      groupRef.current.rotation.y = -angle
    }
    if (tailRef.current) {
      tailRef.current.rotation.z = Math.sin(angle * 3.5) * 0.35
    }
  })

  return (
    <group ref={groupRef}>
      <FoxModel tailRef={tailRef} />
    </group>
  )
}
function WildlifeManager({ terrainInfo, worldSeed }) {
  const animals = useRef([])
  const sampler = terrainInfo?.getHeightAt
  const respawnTimers = useRef([])
  const rngRef = useRef(null)

  useEffect(() => {
    rngRef.current = worldSeed ? alea(`${worldSeed}-wildlife`) : Math.random
    animals.current = []
    respawnTimers.current = []
  }, [worldSeed])

  const nextRandom = useCallback(() => {
    if (!rngRef.current) rngRef.current = Math.random
    if (typeof rngRef.current === 'function') {
      try {
        return rngRef.current()
      } catch (error) {
        return Math.random()
      }
    }
    return Math.random()
  }, [])

  const spawnAnimal = useCallback(() => {
    const baseAngle = nextRandom() * Math.PI * 2
    const minR = 28
    const maxR = 60
    const distance = minR + nextRandom() * (maxR - minR)
    const x = Math.cos(baseAngle) * distance
    const z = Math.sin(baseAngle) * distance
    const ground = sampler ? sampler(x, z) ?? 0 : 0
    const type = nextRandom() > 0.65 ? 'fox' : 'penguin'
    return {
      type,
      origin: { x, y: ground + 0.1, z },
      radius: 3 + nextRandom() * 5,
      speed: type === 'fox' ? 0.5 + nextRandom() * 0.3 : 0.3 + nextRandom() * 0.25,
      phase: nextRandom() * Math.PI * 2,
    }
  }, [sampler, nextRandom])

  const ensurePenguins = useCallback(() => {
    if (!sampler) return
    if (animals.current.length === 0) {
      for (let i = 0; i < 8; i += 1) {
        const animal = spawnAnimal()
        animals.current.push(animal)
        respawnTimers.current.push(15 + nextRandom() * 15)
      }
    }
  }, [sampler, spawnAnimal, nextRandom])

  useEffect(() => {
    if (!sampler) return
    ensurePenguins()
  }, [sampler, ensurePenguins, worldSeed])

  useFrame((_, delta) => {
    if (!sampler) return
    ensurePenguins()
    for (let i = 0; i < respawnTimers.current.length; i += 1) {
      respawnTimers.current[i] -= delta
      if (respawnTimers.current[i] <= 0) {
        animals.current[i] = spawnAnimal()
        respawnTimers.current[i] = 16 + nextRandom() * 28
      }
    }
  })

  if (!animals.current.length) return null
  return (
    <group>
      {animals.current.map((animal, index) =>
        animal.type === 'fox' ? (
          <Fox key={`animal-${index}`} origin={animal.origin} pathRadius={animal.radius} speed={animal.speed} phase={animal.phase} />
        ) : (
          <Penguin key={`animal-${index}`} origin={animal.origin} radius={animal.radius} speed={animal.speed} phase={animal.phase} />
        )
      )}
    </group>
  )
}

function DappHintCard({ dapp, position, trending }) {
  return (
    <Html
      position={position}
      center
      distanceFactor={22}
      transform
      style={{
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          minWidth: 120,
          padding: '6px 10px',
          borderRadius: 10,
          background: trending ? 'rgba(250, 204, 21, 0.82)' : 'rgba(30, 64, 175, 0.78)',
          color: trending ? '#1f2937' : '#e0f2ff',
          fontSize: 12,
          lineHeight: 1.4,
          boxShadow: '0 8px 16px rgba(8, 15, 30, 0.45)',
          backdropFilter: 'blur(4px)',
        }}
      >
        <div style={{ fontWeight: 600 }}>{dapp.name}</div>
        <div style={{ opacity: 0.8 }}>{dapp.category}</div>
      </div>
    </Html>
  )
}

function SnowTreeVisual({ collected, variant = 0 }) {
  const scale = collected ? 0.2 : 1
  const hueShift = variant * 0.05
  const foliageColor = new THREE.Color().setHSL(0.38 - hueShift, 0.42, 0.36 + hueShift * 0.3)
  return (
    <group scale={scale}>
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.9, 6]} />
        <meshStandardMaterial color="#3b2f1e" />
      </mesh>
      <mesh position={[0, 1.0, 0]}>
        <coneGeometry args={[0.9, 1.2, 9]} />
        <meshStandardMaterial color={foliageColor} roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.6, 0]} scale={[0.75, 0.75, 0.75]}>
        <coneGeometry args={[0.7, 1.1, 8]} />
        <meshStandardMaterial color={foliageColor.clone().offsetHSL(0, 0.05, 0.1)} roughness={0.55} />
      </mesh>
      <mesh position={[0, 2.1, 0]} scale={[0.55, 0.55, 0.55]}>
        <coneGeometry args={[0.6, 0.9, 7]} />
        <meshStandardMaterial color={foliageColor.clone().offsetHSL(-0.03, 0.02, 0.08)} roughness={0.55} />
      </mesh>
      <mesh position={[0, 2.6, 0]}>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshStandardMaterial emissive="#fde047" emissiveIntensity={0.9} color="#fef9c3" />
      </mesh>
    </group>
  )
}

function StaticAnimal({ type, collected }) {
  const groupRef = useRef()
  useFrame((_, delta) => {
    if (!groupRef.current) return
    const t = performance.now() * 0.001
    const wobble = Math.sin(t * 2.3) * 0.08
    groupRef.current.position.y = collected ? -0.4 : wobble
  })
  if (type === 'fox') {
    const tailRef = useRef()
    return (
      <group ref={groupRef} scale={0.55}>
        <FoxModel tailRef={tailRef} />
      </group>
    )
  }
  const leftWingRef = useRef()
  const rightWingRef = useRef()
  return (
    <group ref={groupRef} scale={0.55}>
      <PenguinModel leftWingRef={leftWingRef} rightWingRef={rightWingRef} />
    </group>
  )
}

function DappMarker({ entry }) {
  const { dapp, position, hint, trending, representation = 'gift', animalKind, treeVariant } = entry
  const baseColor = trending ? '#fcd34d' : '#60a5fa'
  const [collected, setCollected] = useState(false)
  const playerPos = useQuestStore((state) => state.playerPosition)
  const distance = useMemo(() => {
    if (!playerPos) return Infinity
    const dx = (playerPos.x ?? 0) - position[0]
    const dz = (playerPos.z ?? 0) - position[2]
    return Math.sqrt(dx * dx + dz * dz)
  }, [playerPos, position])
  const showHint = !collected && distance < (trending ? 20 : 14)
  const glowIntensity = !collected ? (showHint ? (trending ? 1.3 : 0.9) : 0.2) : 0

  const renderVisual = useMemo(() => {
    if (representation === 'tree') {
      return ({ collected: innerCollected }) => <SnowTreeVisual collected={innerCollected} variant={treeVariant} />
    }
    if (representation === 'animal') {
      const animalType = animalKind ?? 'penguin'
      return ({ collected: innerCollected }) => <StaticAnimal type={animalType} collected={innerCollected} />
    }
    return null
  }, [representation, treeVariant, animalKind])

  return (
    <group>
      <GiftBox
        dapp={dapp}
        position={position}
        renderVisual={renderVisual || undefined}
        onCollected={() => setCollected(true)}
      />
      {!collected ? (
        <mesh position={[position[0], position[1] + (representation === 'gift' ? 0.8 : 1.2), position[2]]}>
          <sphereGeometry args={[trending ? 0.35 : 0.25, 16, 16]} />
          <meshStandardMaterial emissive={baseColor} emissiveIntensity={glowIntensity} color={baseColor} />
        </mesh>
      ) : null}
      {hint && showHint ? (
        <>
          <mesh position={[hint[0], hint[1] - 0.3, hint[2]]} rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.18, 0.4, 8]} />
            <meshStandardMaterial color={baseColor} emissive={baseColor} emissiveIntensity={0.4} />
          </mesh>
          <DappHintCard dapp={dapp} position={[hint[0], hint[1], hint[2]]} trending={trending} />
        </>
      ) : null}
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
  const [worldSeed, setWorldSeed] = useState(null)
  const [sledBody, setSledBody] = useState(null)
  const [terrainInfo, setTerrainInfo] = useState(null)
  const { orientationRef } = useSledInput()
  const debugAxes = useMemo(() => (import.meta?.env?.DEV ? new THREE.AxesHelper(2) : null), [])
  const { dapps, categories, trending, loading: dappsLoading, error: dappError } = useDappData()
  const atmosphere = useMemo(() => {
    if (!worldSeed) return null
    const rng = alea(`${worldSeed}-atmo`)
    const storm = rng() < 0.28
    const skyPalette = [
      { skyBase: '#0a1632', auroraTop: '#6ef8ff', auroraBottom: '#102849', sparkleColor: '#dbeafe' },
      { skyBase: '#11182b', auroraTop: '#f0abfc', auroraBottom: '#271443', sparkleColor: '#f5d0fe' },
      { skyBase: '#041b24', auroraTop: '#5eead4', auroraBottom: '#0f1f3a', sparkleColor: '#cffafe' },
      { skyBase: '#210b2a', auroraTop: '#fb7185', auroraBottom: '#1a0d29', sparkleColor: '#fda4af' },
    ]
    const variant = skyPalette[Math.floor(rng() * skyPalette.length)]
    const lightLevel = rng()
    const windBase = 0.32 + rng() * 0.35 + (storm ? 0.18 : 0)
    return {
      ...variant,
      fogColor: storm ? '#0b1320' : '#0a1932',
      fogNear: storm ? 10 + rng() * 10 : 18 + rng() * 24,
      fogFar: storm ? 70 + rng() * 40 : 140 + rng() * 90,
      auroraHueShift: storm ? 0.06 : 0.03 + rng() * 0.02,
      auroraSatShift: 0.14 + rng() * 0.05,
      auroraLightShift: 0.08 + rng() * 0.05,
      ambientIntensity: 0.32 + lightLevel * 0.22,
      sunIntensity: storm ? 1.35 + lightLevel * 0.2 : 1.55 + lightLevel * 0.45,
      sunColor: storm ? '#bcd7ff' : '#dbe7ff',
      skyLightColor: storm ? '#6fb3ff' : '#8dd6ff',
      backLightColor: storm ? '#ffb3a7' : '#ff9d82',
      windBase,
      windGust: 0.18 + rng() * 0.3 + (storm ? 0.14 : 0),
      snowIntensity: storm ? 1.8 + rng() * 0.6 : 0.9 + rng() * 0.5,
      sparkleColor: variant.sparkleColor,
      storm,
      seed: worldSeed,
    }
  }, [worldSeed])

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
    if (!terrainInfo?.getHeightAt || !worldSeed || !dapps.length) return []
    const sampler = terrainInfo.getHeightAt
    const rng = alea(`${worldSeed}-gifts`)
    const placements = []
    const trendingSet = new Set((trending ?? []).map((item) => item.id))

    const minDistanceSq = (pointA, pointB) => {
      const dx = pointA[0] - pointB[0]
      const dz = pointA[2] - pointB[2]
      return dx * dx + dz * dz
    }

    const placeDapp = (dapp, options = {}) => {
      const {
        radiusMin = 8,
        radiusMax = TERRAIN_HALF * 0.86,
        baseAngle = rng() * Math.PI * 2,
        angleSpread = Math.PI,
        minSpacing = trendingSet.has(dapp.id) ? 11 : 6 + rng() * 2,
      } = options
      let position = null
      const maxAttempts = 40
      const minSpacingSq = minSpacing * minSpacing
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const radius = radiusMin + rng() * (radiusMax - radiusMin)
        const angle = baseAngle + (rng() - 0.5) * angleSpread
        const x = Math.cos(angle) * radius
        const z = Math.sin(angle) * radius
        const groundHeight = sampler(x, z)
        if (groundHeight != null) {
          position = [x, groundHeight + 0.95, z]
          const tooClose = placements.some((entry) => {
            return minDistanceSq(entry.position, position) < minSpacingSq
          })
          if (tooClose) {
            position = null
            continue
          }
          const hintDistance = 2 + rng() * 1.5
          const hintAngle = angle + (rng() - 0.5) * 0.6
          const hint = [x + Math.cos(hintAngle) * hintDistance, groundHeight + 0.6, z + Math.sin(hintAngle) * hintDistance]
          const isTrending = trendingSet.has(dapp.id)
          const representation = isTrending
            ? 'gift'
            : rng() < 0.3
            ? 'animal'
            : rng() < 0.55
            ? 'tree'
            : 'gift'
          const animalKind = representation === 'animal' ? (rng() > 0.5 ? 'fox' : 'penguin') : null
          const treeVariant = representation === 'tree' ? rng() : null
          placements.push({
            dapp,
            position,
            hint,
            zone: dapp.category,
            trending: isTrending,
            representation,
            animalKind,
            treeVariant,
          })
          break
        }
      }
      if (!position) {
        const fallbackAttempts = 80
        for (let attempt = 0; attempt < fallbackAttempts; attempt += 1) {
          const radius = 6 + rng() * (TERRAIN_HALF * 0.9 - 6)
          const angle = rng() * Math.PI * 2
          const x = Math.cos(angle) * radius
          const z = Math.sin(angle) * radius
          const groundHeight = sampler(x, z)
          if (groundHeight == null) continue
          const candidate = [x, groundHeight + 0.95, z]
          const tooClose = placements.some((entry) => minDistanceSq(entry.position, candidate) < (minSpacing * 0.6) ** 2)
          if (tooClose) continue
          const hintDistance = 1.5 + rng() * 1.2
          const hintAngle = angle + (rng() - 0.5) * 0.8
          const hint = [x + Math.cos(hintAngle) * hintDistance, groundHeight + 0.6, z + Math.sin(hintAngle) * hintDistance]
          const isTrending = trendingSet.has(dapp.id)
          const representation = isTrending
            ? 'gift'
            : rng() < 0.3
            ? 'animal'
            : rng() < 0.6
            ? 'tree'
            : 'gift'
          const animalKind = representation === 'animal' ? (rng() > 0.5 ? 'fox' : 'penguin') : null
          const treeVariant = representation === 'tree' ? rng() : null
          placements.push({
            dapp,
            position: candidate,
            hint,
            zone: dapp.category,
            trending: isTrending,
            representation,
            animalKind,
            treeVariant,
          })
          position = candidate
          break
        }
      }
    }

    // Trending dapps near trung tâm
    const trendingList = trending ?? []
    trendingList.forEach((dapp, index) => {
      placeDapp(dapp, {
        radiusMin: 8 + index * 2,
        radiusMax: 24 + index * 2,
        angleSpread: Math.PI / 3,
        minSpacing: 12,
      })
    })

    const otherDapps = dapps.filter((dapp) => !trendingSet.has(dapp.id))
    // shuffle
    for (let i = otherDapps.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1))
      ;[otherDapps[i], otherDapps[j]] = [otherDapps[j], otherDapps[i]]
    }

    const innerRadius = TERRAIN_HALF * 0.25
    const outerRadius = TERRAIN_HALF * 0.86

    otherDapps.forEach((dapp, index) => {
      const ring = Math.floor(index / 40)
      const radiusMin = Math.min(innerRadius + ring * 8, outerRadius - 6)
      const radiusMax = Math.min(radiusMin + 20, outerRadius)
      placeDapp(dapp, {
        radiusMin,
        radiusMax,
        angleSpread: Math.PI,
      })
    })

    return placements
  }, [terrainInfo, dapps, worldSeed, trending, categories])

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
        <AtmosphereController atmosphere={atmosphere} />
        <AuroraSky atmosphere={atmosphere} />
        <SparkleField atmosphere={atmosphere} />
        <WinterWorld
          onTerrainReady={setTerrainInfo}
          onSeedReady={setWorldSeed}
          atmosphere={atmosphere}
        />
        <SantaFlyby />
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
        <WildlifeManager terrainInfo={terrainInfo} worldSeed={worldSeed} />
        {giftBoxPositions.map((entry) => (
          <DappMarker key={entry.dapp.id} entry={entry} />
        ))}
        <DiscoveredDapps
          dapps={dapps.filter((dapp) => discoveredDapps.includes(dapp.id))}
          origin={[-18, 3.2, 12]}
        />
      </Suspense>
    </>
  )
}

