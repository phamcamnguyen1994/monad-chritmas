import { Suspense, useMemo, useState, useEffect, useRef, useCallback, createContext, useContext } from 'react'
import { useFrame, extend, useThree } from '@react-three/fiber'
import WinterWorld, { TERRAIN_HALF } from './WinterWorld'
import ChogsSled from './ChogsSled'
import GiftBox from './GiftBox'
import DiscoveredDapps from './DiscoveredDapps'
import MonadLandmark from './MonadLandmark'
import { useQuestStore } from '../store/questStore'
import * as THREE from 'three'
import { useSledInput } from './SledInputContext.jsx'
import { Html, shaderMaterial, Billboard, useGLTF } from '@react-three/drei'
import { useDappData } from '../hooks/useDappData.jsx'
import alea from 'alea'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { playGiftChime } from './AmbientAudio.jsx'

const HEAD_HEIGHT = 1.45

// Context để share animal models cho các component con
const AnimalModelsContext = createContext({ animalModels: {}, loaded: false })

// Parse tên file để xác định type và variant
const parseAnimalModel = (filename) => {
  const name = filename.replace('.glb', '').toLowerCase()
  // animalpenguin1 -> { type: 'penguin', variant: '1' }
  // animal-penguin1 -> { type: 'penguin', variant: '1' }
  // animalfox2 -> { type: 'fox', variant: '2' }
  const match = name.match(/animal[-_]?(penguin|fox|bear|deer|wolf|rabbit|bird)(\d+)?/i)
  if (match) {
    return {
      type: match[1].toLowerCase(),
      variant: match[2] || '1',
      filename,
      url: `/models/${filename}`,
    }
  }
  // Fallback: nếu không match pattern, thử đoán từ tên
  if (name.includes('penguin')) {
    return { type: 'penguin', variant: '1', filename, url: `/models/${filename}` }
  }
  if (name.includes('fox')) {
    return { type: 'fox', variant: '1', filename, url: `/models/${filename}` }
  }
  return null
}

// Hook để load animal models từ manifest file
// Bạn chỉ cần thêm tên file vào public/models/animal-models.json
function useAnimalModels() {
  const [animalModels, setAnimalModels] = useState({})
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/models/animal-models.json')
      .then((res) => res.json())
      .then((data) => {
        const files = data.files || []
        const models = files
          .map(parseAnimalModel)
          .filter(Boolean)
          .reduce((acc, model) => {
            if (!acc[model.type]) acc[model.type] = []
            acc[model.type].push(model)
            return acc
          }, {})
        setAnimalModels(models)
        setLoaded(true)
        if (import.meta.env.DEV) {
          console.log('[AnimalModels] Loaded from manifest:', models)
          console.log('[AnimalModels] Files:', files)
        }
      })
      .catch((err) => {
        console.warn('[AnimalModels] Failed to load manifest, using fallback:', err)
        // Fallback: sử dụng danh sách mặc định
        const fallbackFiles = [
          'animalpenguin1.glb',
          'animalpenguin2.glb',
          'animalfox1.glb',
          'animalfox2.glb',
        ]
        const models = fallbackFiles
          .map(parseAnimalModel)
          .filter(Boolean)
          .reduce((acc, model) => {
            if (!acc[model.type]) acc[model.type] = []
            acc[model.type].push(model)
            return acc
          }, {})
        setAnimalModels(models)
        setLoaded(true)
      })
  }, [])

  return { animalModels, loaded }
}

// Preload sẽ được gọi trong component khi cần

// DebugTelemetryExperience component for Experience scene
const DebugTelemetryExperience = ({ sledBody, terrainInfo }) => {
  const [telemetry, setTelemetry] = useState({
    position: [0, 0, 0],
    velocity: [0, 0, 0],
    slopeFactor: 0,
    accelerating: false,
    ground: null,
    valid: false,
  })
  const lastUpdateRef = useRef(0)
  const prevPosRef = useRef(new THREE.Vector3())

  useFrame((state) => {
    const elapsed = state.clock.elapsedTime
    if (elapsed - lastUpdateRef.current < 0.2) return
    lastUpdateRef.current = elapsed

    if (!sledBody || !sledBody.position) {
      setTelemetry((prev) => (prev.valid ? { ...prev, valid: false } : prev))
      return
    }

    try {
      const position = [sledBody.position.x, sledBody.position.y, sledBody.position.z]

      // Tính velocity từ sự thay đổi position
      const currentPos = new THREE.Vector3(sledBody.position.x, sledBody.position.y, sledBody.position.z)
      const velocity = currentPos.clone().sub(prevPosRef.current).multiplyScalar(5) // Scale để có velocity
      prevPosRef.current.copy(currentPos)

      const velocityArray = [velocity.x, velocity.y, velocity.z]

      // Tính slope từ quaternion
      const quat = sledBody.quaternion || new THREE.Quaternion()
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quat)
      const slope = THREE.MathUtils.clamp(1 - up.y, 0, 1)
      const ground = typeof terrainInfo?.getHeightAt === 'function' ? terrainInfo.getHeightAt(position[0], position[2]) : null

      setTelemetry({
        position,
        velocity: velocityArray,
        slopeFactor: Number(slope.toFixed(3)),
        accelerating: slope > 0.08,
        ground,
        valid: true,
      })
    } catch (error) {
      console.warn('[DebugTelemetryExperience] Error getting telemetry:', error)
      setTelemetry((prev) => (prev.valid ? { ...prev, valid: false } : prev))
    }
  })

  if (!telemetry.valid) return null

  const groundLabel = telemetry.ground != null ? telemetry.ground.toFixed(2) : '??'

  return (
    <Html position={[0, 0, 0]} transform={false} wrapperClass="pointer-events-none">
      <div className="pointer-events-none absolute top-1/2 left-8 -translate-y-1/2 space-y-2 text-xs">
        <div className="pointer-events-auto rounded-2xl border border-emerald-300/40 bg-slate-900/85 px-5 py-4 font-mono shadow-lg shadow-black/60">
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
          <p className={telemetry.accelerating ? 'text-emerald-300 font-semibold' : 'text-rose-300 font-semibold'}>
            assist: {telemetry.accelerating ? 'ON' : 'off'}
          </p>
        </div>
      </div>
    </Html>
  )
}

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

function useLogoTexture(url) {
  const [texture, setTexture] = useState(null)
  useEffect(() => {
    if (!url) {
      setTexture(null)
      return
    }
    let mounted = true
    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        if (mounted) setTexture(tex)
      },
      undefined,
      () => {
        if (mounted) setTexture(null)
      }
    )
    return () => {
      mounted = false
    }
  }, [url])
  return texture
}

// First-person camera - góc nhìn thứ nhất
// Camera đặt tại vị trí "đầu" nhân vật và xoay theo orientationRef (yaw, pitch)
function FirstPersonCamera({ body, orientationRef }) {
  const HEAD_HEIGHT = 1.5 // Chiều cao mắt so với vị trí thân
  const initialized = useRef(false)

  useFrame(({ camera }, delta) => {
    // Đọc từ ref nếu là ref, hoặc từ body trực tiếp
    const actualBody = body?.current || body
    if (!actualBody || !actualBody.position || !orientationRef?.current) return

    const bodyPosition = actualBody.position
    const { yaw, pitch } = orientationRef.current

    // Vị trí camera: ngay trên đầu nhân vật
    const cameraPos = new THREE.Vector3(
      bodyPosition.x,
      bodyPosition.y + HEAD_HEIGHT,
      bodyPosition.z
    )

    // Khởi tạo camera position lần đầu
    if (!initialized.current) {
      camera.position.copy(cameraPos)
      initialized.current = true
    }

    // Cập nhật camera position (smooth nhẹ để đỡ giật)
    camera.position.lerp(cameraPos, 1 - Math.pow(0.1, delta * 60))

    // Xoay camera theo yaw/pitch
    const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ')
    const quat = new THREE.Quaternion().setFromEuler(euler)
    camera.quaternion.copy(quat)
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
  const timeRef = useRef(0)
  const cooldownRef = useRef(0)
  const activeRef = useRef(false)
  
  // Load Santa 3D model (GLB) - hooks phải ở top level
  const santaModel = useGLTF('/images/santa.glb')

  // Clone Santa model scene - hooks phải ở top level, trước mọi điều kiện
  const santaScene = useMemo(() => {
    if (!santaModel?.scene) return null
    const cloned = clone(santaModel.scene)
    cloned.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
        // Thêm glow effect
        if (child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material]
          mats.forEach((mat) => {
            if (mat) {
              mat.emissive = new THREE.Color('#ff6b6b')
              mat.emissiveIntensity = 0.2
            }
          })
        }
      }
    })
    return cloned
  }, [santaModel])

  useEffect(() => {
    activeRef.current = active
  }, [active])

  useFrame((_, delta) => {
    cooldownRef.current -= delta
    if (!activeRef.current && cooldownRef.current <= 0) {
      timeRef.current = 0
      // Giảm cooldown để Santa xuất hiện thường xuyên hơn (15-25 giây)
      cooldownRef.current = 15 + Math.random() * 10
      setActive(true)
    }
    if (!activeRef.current) return

    // Giảm tốc độ để Santa bay chậm hơn, dễ thấy hơn (từ 0.08 xuống 0.04)
    timeRef.current += delta * 0.04
    const t = timeRef.current
    if (t >= 1) {
      setActive(false)
      return
    }
    const progress = THREE.MathUtils.smoothstep(t, 0, 1)
    // Giảm độ cao để Santa gần hơn, dễ thấy hơn (từ 32 xuống 20-25)
    const height = 20 + Math.sin(progress * Math.PI) * 8
    const x = THREE.MathUtils.lerp(-TERRAIN_HALF * 1.2, TERRAIN_HALF * 1.2, progress)
    const z = Math.sin(progress * Math.PI * 2.2) * TERRAIN_HALF * 0.6
    if (santaRef.current) {
      santaRef.current.position.set(x, height, z)
      santaRef.current.rotation.y = -Math.PI / 2 + Math.atan2(
        Math.cos(progress * Math.PI * 2.2) * TERRAIN_HALF * 0.6 * Math.PI * 2.2,
        TERRAIN_HALF * 1.2
      )
    }
  })

  if (!active) {
    return null
  }

  // Tăng kích thước gấp đôi
  const scale = 2.0

  return (
    <group ref={santaRef} scale={scale}>
      {/* Glow effect để dễ thấy hơn */}
      <pointLight position={[0, 0, 0]} intensity={2} distance={15} color="#ff6b6b" />
      {santaScene ? (
        <primitive object={santaScene} />
      ) : (
        // Fallback geometry nếu không có model
        <>
          <mesh position={[0, 0.2, 0]} scale={[1.8, 0.5, 0.9]} castShadow>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#8b1d3b" roughness={0.6} emissive="#8b1d3b" emissiveIntensity={0.3} />
          </mesh>
          <mesh position={[-1.2, 0.35, 0]} scale={[1.4, 0.4, 0.8]} castShadow>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.5} emissive="#ffffff" emissiveIntensity={0.2} />
          </mesh>
          <mesh position={[0.7, 0.6, 0]} scale={[0.6, 0.6, 0.6]} castShadow>
            <sphereGeometry args={[1, 12, 12]} />
            <meshStandardMaterial color="#111827" roughness={0.5} />
          </mesh>
        </>
      )}
    </group>
  )
}

// Ông già Noel chạy dưới nền tuyết
function SantaFlybyGround() {
  const [active, setActive] = useState(false)
  const santaRef = useRef()
  const timeRef = useRef(0)
  const cooldownRef = useRef(0)
  const activeRef = useRef(false)
  
  // Load Santa 3D model (GLB) - hooks phải ở top level
  const santaModel = useGLTF('/images/santa.glb')

  // Clone Santa model scene - hooks phải ở top level, trước mọi điều kiện
  const santaScene = useMemo(() => {
    if (!santaModel?.scene) return null
    const cloned = clone(santaModel.scene)
    cloned.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
        // Thêm glow effect
        if (child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material]
          mats.forEach((mat) => {
            if (mat) {
              mat.emissive = new THREE.Color('#ff6b6b')
              mat.emissiveIntensity = 0.2
            }
          })
        }
      }
    })
    return cloned
  }, [santaModel])

  useEffect(() => {
    activeRef.current = active
  }, [active])

  useFrame((_, delta) => {
    cooldownRef.current -= delta
    if (!activeRef.current && cooldownRef.current <= 0) {
      timeRef.current = 0
      // Cooldown riêng cho Santa dưới đất (20-30 giây)
      cooldownRef.current = 20 + Math.random() * 10
      setActive(true)
    }
    if (!activeRef.current) return

    // Tốc độ chậm hơn một chút (từ 0.07 xuống 0.035)
    timeRef.current += delta * 0.035
    const t = timeRef.current
    if (t >= 1) {
      setActive(false)
      return
    }
    const progress = THREE.MathUtils.smoothstep(t, 0, 1)
    // Chạy dưới nền tuyết (height thấp, 2-5)
    const height = 3 + Math.sin(progress * Math.PI) * 2
    // Đi ngược hướng với Santa trên trời để tạo sự đa dạng
    const x = THREE.MathUtils.lerp(TERRAIN_HALF * 1.2, -TERRAIN_HALF * 1.2, progress)
    const z = Math.sin(progress * Math.PI * 2.5) * TERRAIN_HALF * 0.5
    if (santaRef.current) {
      santaRef.current.position.set(x, height, z)
      santaRef.current.rotation.y = Math.PI / 2 + Math.atan2(
        Math.cos(progress * Math.PI * 2.5) * TERRAIN_HALF * 0.5 * Math.PI * 2.5,
        -TERRAIN_HALF * 1.2
      )
    }
  })

  if (!active) {
    return null
  }

  // Tăng kích thước gấp đôi
  const scale = 2.0

  return (
    <group ref={santaRef} scale={scale}>
      {/* Glow effect để dễ thấy hơn */}
      <pointLight position={[0, 0, 0]} intensity={2} distance={15} color="#ff6b6b" />
      {santaScene ? (
        <primitive object={santaScene} />
      ) : (
        // Fallback geometry nếu không có model
        <>
          <mesh position={[0, 0.2, 0]} scale={[1.8, 0.5, 0.9]} castShadow>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#8b1d3b" roughness={0.6} emissive="#8b1d3b" emissiveIntensity={0.3} />
          </mesh>
          <mesh position={[-1.2, 0.35, 0]} scale={[1.4, 0.4, 0.8]} castShadow>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.5} emissive="#ffffff" emissiveIntensity={0.2} />
          </mesh>
          <mesh position={[0.7, 0.6, 0]} scale={[0.6, 0.6, 0.6]} castShadow>
            <sphereGeometry args={[1, 12, 12]} />
            <meshStandardMaterial color="#111827" roughness={0.5} />
          </mesh>
        </>
      )}
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

// Component riêng để load GLB model cho Penguin
function PenguinGLB({ url, leftWingRef, rightWingRef }) {
  const glbModel = useGLTF(url)
  const glbScene = useMemo(() => {
    if (!glbModel?.scene) {
      if (import.meta.env.DEV) {
        console.warn('[PenguinGLB] No scene in model:', url)
      }
      return null
    }
    const cloned = clone(glbModel.scene)
    
    // Tính bounding box để điều chỉnh scale
    const box = new THREE.Box3().setFromObject(cloned)
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)
    const targetSize = 1.2 // Kích thước mục tiêu (tương đương procedural model)
    const scale = targetSize / maxDim
    
    cloned.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
        // Giữ nguyên material properties để màu không bị thay đổi
        if (Array.isArray(child.material)) {
          child.material = child.material.map((mat) => {
            if (!mat) return mat
            const clonedMat = mat.clone()
            if (clonedMat.toneMapped !== undefined) clonedMat.toneMapped = true
            return clonedMat
          })
        } else if (child.material) {
          const clonedMat = child.material.clone()
          if (clonedMat.toneMapped !== undefined) clonedMat.toneMapped = true
          child.material = clonedMat
        }
      }
      // Tìm và lưu ref cho wings nếu có
      if (child.name?.toLowerCase().includes('wing') || child.name?.toLowerCase().includes('left')) {
        leftWingRef.current = child
      }
      if (child.name?.toLowerCase().includes('wing') || child.name?.toLowerCase().includes('right')) {
        rightWingRef.current = child
      }
    })
    
    if (import.meta.env.DEV) {
      console.log('[PenguinGLB] Loaded:', url, 'size:', size, 'scale:', scale)
    }
    
    return { cloned, scale }
  }, [glbModel, url, leftWingRef, rightWingRef])
  
  if (!glbScene) return null
  return <primitive object={glbScene.cloned} scale={[glbScene.scale, glbScene.scale, glbScene.scale]} />
}

function Penguin({ origin, speed, terrainInfo }) {
  const groupRef = useRef()
  const leftWingRef = useRef()
  const rightWingRef = useRef()
  const { animalModels, loaded } = useContext(AnimalModelsContext)
  
  // Wander behavior: di chuyển thẳng với random direction changes
  const positionRef = useRef(new THREE.Vector3(origin.x, origin.y, origin.z))
  const directionRef = useRef(Math.random() * Math.PI * 2) // Hướng di chuyển hiện tại
  const nextTurnTimeRef = useRef(Math.random() * 3 + 2) // Thời gian đến lần đổi hướng tiếp theo
  const turnTimerRef = useRef(0)
  const waddleTimeRef = useRef(0)

  // Tự động chọn GLB model nếu có, fallback về procedural
  const penguinModels = animalModels.penguin || []
  const hasGLBModel = loaded && penguinModels.length > 0
  
  // Chọn model một lần và lưu vào ref để không đổi mỗi render
  const selectedModelRef = useRef(null)
  if (hasGLBModel && !selectedModelRef.current) {
    selectedModelRef.current = penguinModels[Math.floor(Math.random() * penguinModels.length)]
  }

  useFrame((_, delta) => {
    if (!groupRef.current) return
    
    // Update turn timer
    turnTimerRef.current += delta
    waddleTimeRef.current += delta * 2.4
    
    // Đổi hướng ngẫu nhiên sau một khoảng thời gian
    if (turnTimerRef.current >= nextTurnTimeRef.current) {
      // Đổi hướng một góc nhỏ (không quá đột ngột)
      const turnAmount = (Math.random() - 0.5) * Math.PI * 0.6 // ±54 độ
      directionRef.current += turnAmount
      turnTimerRef.current = 0
      nextTurnTimeRef.current = Math.random() * 4 + 2 // 2-6 giây
    }
    
    // Di chuyển theo hướng hiện tại
    const moveSpeed = speed * delta
    positionRef.current.x += Math.cos(directionRef.current) * moveSpeed
    positionRef.current.z += Math.sin(directionRef.current) * moveSpeed
    
    // Giới hạn trong khu vực (boundary check)
    const maxDistance = TERRAIN_HALF * 0.75
    const distanceFromOrigin = Math.sqrt(
      (positionRef.current.x - origin.x) ** 2 + 
      (positionRef.current.z - origin.z) ** 2
    )
    if (distanceFromOrigin > maxDistance) {
      // Quay về phía origin
      directionRef.current = Math.atan2(origin.z - positionRef.current.z, origin.x - positionRef.current.x)
    }
    
    // Lấy height từ terrain
    const groundY = terrainInfo?.getHeightAt?.(positionRef.current.x, positionRef.current.z) ?? origin.y
    positionRef.current.y = groundY + 0.6
    
    // Update position và rotation
    groupRef.current.position.copy(positionRef.current)
    groupRef.current.rotation.y = directionRef.current + Math.PI / 2
    
    // Animation cho wings (waddle effect)
    const waddle = Math.sin(waddleTimeRef.current) * 0.25
    if (leftWingRef.current) leftWingRef.current.rotation.z = 0.25 + waddle * 0.6
    if (rightWingRef.current) rightWingRef.current.rotation.z = -0.25 - waddle * 0.6
  })

  // Debug log
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('[Penguin] loaded:', loaded, 'hasGLBModel:', hasGLBModel, 'selectedModel:', selectedModelRef.current?.url)
    }
  }, [loaded, hasGLBModel])

  return (
    <group ref={groupRef}>
      {hasGLBModel && selectedModelRef.current ? (
        <Suspense fallback={<PenguinModel leftWingRef={leftWingRef} rightWingRef={rightWingRef} />}>
          <PenguinGLB 
            url={selectedModelRef.current.url} 
            leftWingRef={leftWingRef} 
            rightWingRef={rightWingRef} 
          />
        </Suspense>
      ) : (
        <PenguinModel leftWingRef={leftWingRef} rightWingRef={rightWingRef} />
      )}
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

// Component riêng để load GLB model cho Fox
function FoxGLB({ url, tailRef }) {
  const glbModel = useGLTF(url)
  const glbScene = useMemo(() => {
    if (!glbModel?.scene) return null
    const cloned = clone(glbModel.scene)
    cloned.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
        // Giữ nguyên material properties để màu không bị thay đổi
        if (Array.isArray(child.material)) {
          child.material = child.material.map((mat) => {
            if (!mat) return mat
            const clonedMat = mat.clone()
            if (clonedMat.toneMapped !== undefined) clonedMat.toneMapped = true
            return clonedMat
          })
        } else if (child.material) {
          const clonedMat = child.material.clone()
          if (clonedMat.toneMapped !== undefined) clonedMat.toneMapped = true
          child.material = clonedMat
        }
      }
      if (child.name?.toLowerCase().includes('tail')) {
        tailRef.current = child
      }
    })
    
    // Tính scale tự động
    const box = new THREE.Box3().setFromObject(cloned)
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)
    const targetSize = 1.0
    const scale = targetSize / maxDim
    
    return { cloned, scale }
  }, [glbModel, url, tailRef])
  
  if (!glbScene) return null
  return <primitive object={glbScene.cloned} scale={[glbScene.scale, glbScene.scale, glbScene.scale]} />
}

function Fox({ origin, speed, terrainInfo }) {
  const groupRef = useRef()
  const tailRef = useRef()
  const { animalModels, loaded } = useContext(AnimalModelsContext)
  
  // Wander behavior: di chuyển thẳng với random direction changes
  const positionRef = useRef(new THREE.Vector3(origin.x, origin.y, origin.z))
  const directionRef = useRef(Math.random() * Math.PI * 2)
  const nextTurnTimeRef = useRef(Math.random() * 2 + 1.5) // Fox đổi hướng nhanh hơn
  const turnTimerRef = useRef(0)
  const tailTimeRef = useRef(0)

  // Tự động chọn GLB model nếu có, fallback về procedural
  const foxModels = animalModels.fox || []
  const hasGLBModel = loaded && foxModels.length > 0
  
  // Chọn model một lần và lưu vào ref để không đổi mỗi render
  const selectedModelRef = useRef(null)
  if (hasGLBModel && !selectedModelRef.current) {
    selectedModelRef.current = foxModels[Math.floor(Math.random() * foxModels.length)]
  }

  useFrame((_, delta) => {
    if (!groupRef.current) return
    
    // Update timers
    turnTimerRef.current += delta
    tailTimeRef.current += delta * 3.5
    
    // Đổi hướng ngẫu nhiên (fox linh hoạt hơn)
    if (turnTimerRef.current >= nextTurnTimeRef.current) {
      const turnAmount = (Math.random() - 0.5) * Math.PI * 0.8 // ±72 độ
      directionRef.current += turnAmount
      turnTimerRef.current = 0
      nextTurnTimeRef.current = Math.random() * 3 + 1.5 // 1.5-4.5 giây
    }
    
    // Di chuyển theo hướng hiện tại
    const moveSpeed = speed * delta
    positionRef.current.x += Math.cos(directionRef.current) * moveSpeed
    positionRef.current.z += Math.sin(directionRef.current) * moveSpeed
    
    // Boundary check
    const maxDistance = TERRAIN_HALF * 0.75
    const distanceFromOrigin = Math.sqrt(
      (positionRef.current.x - origin.x) ** 2 + 
      (positionRef.current.z - origin.z) ** 2
    )
    if (distanceFromOrigin > maxDistance) {
      directionRef.current = Math.atan2(origin.z - positionRef.current.z, origin.x - positionRef.current.x)
    }
    
    // Lấy height từ terrain
    const groundY = terrainInfo?.getHeightAt?.(positionRef.current.x, positionRef.current.z) ?? origin.y
    positionRef.current.y = groundY + 0.2
    
    // Update position và rotation
    groupRef.current.position.copy(positionRef.current)
    groupRef.current.rotation.y = directionRef.current + Math.PI / 2
    
    // Animation cho tail
    if (tailRef.current) {
      tailRef.current.rotation.z = Math.sin(tailTimeRef.current) * 0.35
    }
  })

  // Debug log
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('[Fox] hasGLBModel:', hasGLBModel, 'selectedModel:', selectedModelRef.current?.url)
    }
  }, [hasGLBModel])

  return (
    <group ref={groupRef}>
      {hasGLBModel && selectedModelRef.current ? (
        <Suspense fallback={<FoxModel tailRef={tailRef} />}>
          <FoxGLB 
            url={selectedModelRef.current.url} 
            tailRef={tailRef} 
          />
        </Suspense>
      ) : (
        <FoxModel tailRef={tailRef} />
      )}
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
    const minR = Math.max(38, TERRAIN_HALF * 0.18)
    const maxR = TERRAIN_HALF * 0.75
    const distance = minR + nextRandom() * (maxR - minR)
    const x = Math.cos(baseAngle) * distance
    const z = Math.sin(baseAngle) * distance
    const ground = sampler ? sampler(x, z) ?? 0 : 0
    const type = nextRandom() > 0.65 ? 'fox' : 'penguin'
    return {
      type,
      origin: { x, y: ground, z },
      speed: type === 'fox' ? 1.2 + nextRandom() * 0.8 : 0.8 + nextRandom() * 0.6, // Tốc độ di chuyển
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

  if (!animals.current.length || !terrainInfo) return null
  return (
    <group>
      {animals.current.map((animal, index) =>
        animal.type === 'fox' ? (
          <Fox key={`animal-${index}`} origin={animal.origin} speed={animal.speed} terrainInfo={terrainInfo} />
        ) : (
          <Penguin key={`animal-${index}`} origin={animal.origin} speed={animal.speed} terrainInfo={terrainInfo} />
        )
      )}
    </group>
  )
}

// Load tất cả 8 pine models (pine1 đến pine8)
const TREE_MODEL_PATHS = [
  '/models/pine1.glb',
  '/models/pine2.glb',
  '/models/pine3.glb',
  '/models/pine4.glb',
  '/models/pine5.glb',
  '/models/pine6.glb',
  '/models/pine7.glb',
  '/models/pine8.glb',
]

TREE_MODEL_PATHS.forEach((path) => {
  useGLTF.preload(path)
})

function SnowTreeVisual({ collected, variant = 0 }) {
  // Load tất cả 8 pine models
  const pine1 = useGLTF(TREE_MODEL_PATHS[0])
  const pine2 = useGLTF(TREE_MODEL_PATHS[1])
  const pine3 = useGLTF(TREE_MODEL_PATHS[2])
  const pine4 = useGLTF(TREE_MODEL_PATHS[3])
  const pine5 = useGLTF(TREE_MODEL_PATHS[4])
  const pine6 = useGLTF(TREE_MODEL_PATHS[5])
  const pine7 = useGLTF(TREE_MODEL_PATHS[6])
  const pine8 = useGLTF(TREE_MODEL_PATHS[7])
  const pineVariants = useMemo(() => [pine1, pine2, pine3, pine4, pine5, pine6, pine7, pine8], [pine1, pine2, pine3, pine4, pine5, pine6, pine7, pine8])

  const variantIndex = useMemo(() => {
    const count = pineVariants.length
    if (!count) return 0
    if (typeof variant === 'number') {
      if (Number.isFinite(variant)) {
        if (variant >= 0 && variant < 1) {
          return Math.floor(variant * count) % count
        }
        return Math.abs(Math.floor(variant)) % count
      }
    }
    return 0
  }, [variant, pineVariants])

  const selected = pineVariants[variantIndex]

  if (!selected || !selected.scene) {
    return null
  }

  const variantSeed = useMemo(() => {
    if (typeof variant === 'number' && Number.isFinite(variant)) {
      const frac = variant - Math.floor(variant)
      return frac < 0 ? frac + 1 : frac
    }
    return 0
  }, [variant])

  const treeScene = useMemo(() => {
    if (!selected?.scene) return null
    const cloned = clone(selected.scene)
    const rotationOffset = Math.random() * Math.PI * 2
    cloned.rotation.y = rotationOffset
    cloned.traverse((child) => {
      if (!child.isMesh) return
      child.castShadow = true
      child.receiveShadow = true
      if (Array.isArray(child.material)) {
        child.material = child.material.map((mat) => {
          if (!mat) return mat
          const clonedMat = mat.clone()
          // Giữ nguyên tone mapping và color space để màu không bị thay đổi
          if (clonedMat.toneMapped !== undefined) clonedMat.toneMapped = true
          return clonedMat
        })
      } else if (child.material) {
        const clonedMat = child.material.clone()
        // Giữ nguyên tone mapping và color space để màu không bị thay đổi
        if (clonedMat.toneMapped !== undefined) clonedMat.toneMapped = true
        child.material = clonedMat
      }
    })
    return cloned
  }, [selected])

  const { scaleX, scaleY, scaleZ } = useMemo(() => {
    if (collected) {
      return {
        scaleX: 0.26,
        scaleY: 0.3,
        scaleZ: 0.26,
      }
    }
    // Điều chỉnh scale để tương đương với cây thông thường trong WinterWorld
    // Cây thông thường có scale khoảng 7.55 - 8.85
    // Điều chỉnh để cây thông DApp có kích thước tương đương
    const baseScale = 5.6
    const extraTall = 1.6 + variantSeed * 0.8 // 1.6 - 2.4
    const shortVariance = 0.35 + variantSeed * 0.5 // 0.35 - 0.85
    const totalScale = baseScale + extraTall * variantSeed + shortVariance // ~7.55 - 8.85
    
    // Tính scale cho X, Y, Z tương tự cây thông thường
    const nonUniformX = 0.86 + variantSeed * 0.22 // 0.86 - 1.08
    const nonUniformZ = 0.86 + variantSeed * 0.26 // 0.86 - 1.12
    
    return {
      scaleX: totalScale * nonUniformX,
      scaleY: totalScale,
      scaleZ: totalScale * nonUniformZ,
    }
  }, [collected, variantSeed])

  return (
    <group scale={[scaleX, scaleY, scaleZ]} position={[0, 0, 0]}>
      {treeScene ? <primitive object={treeScene} /> : null}
    </group>
  )
}

function StaticAnimal({ type, collected }) {
  const groupRef = useRef()
  // Tất cả hooks phải được gọi ở top level (không được trong conditional)
  const tailRef = useRef()
  const leftWingRef = useRef()
  const rightWingRef = useRef()
  const { animalModels } = useContext(AnimalModelsContext)

  // Chọn model theo type
  const animalTypeModels = animalModels[type] || []
  const hasGLBModel = animalTypeModels.length > 0
  const selectedModel = hasGLBModel ? animalTypeModels[0] : null
  
  // Load GLB model nếu có (hooks phải được gọi ở top level)
  const penguinModel = type === 'penguin' && animalModels.penguin?.[0] ? useGLTF(animalModels.penguin[0].url) : null
  const foxModel = type === 'fox' && animalModels.fox?.[0] ? useGLTF(animalModels.fox[0].url) : null
  const glbModel = type === 'penguin' ? penguinModel : type === 'fox' ? foxModel : null
  
  const glbScene = useMemo(() => {
    if (!glbModel?.scene) return null
    const cloned = clone(glbModel.scene)
    cloned.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
        // Giữ nguyên material properties để màu không bị thay đổi
        if (Array.isArray(child.material)) {
          child.material = child.material.map((mat) => {
            if (!mat) return mat
            const clonedMat = mat.clone()
            if (clonedMat.toneMapped !== undefined) clonedMat.toneMapped = true
            return clonedMat
          })
        } else if (child.material) {
          const clonedMat = child.material.clone()
          if (clonedMat.toneMapped !== undefined) clonedMat.toneMapped = true
          child.material = clonedMat
        }
      }
      // Tìm refs cho animation
      if (child.name?.toLowerCase().includes('tail')) {
        tailRef.current = child
      }
      if (child.name?.toLowerCase().includes('wing') || child.name?.toLowerCase().includes('left')) {
        leftWingRef.current = child
      }
      if (child.name?.toLowerCase().includes('wing') || child.name?.toLowerCase().includes('right')) {
        rightWingRef.current = child
      }
    })
    return cloned
  }, [glbModel])

  useFrame((_, delta) => {
    if (!groupRef.current) return
    const t = performance.now() * 0.001
    const wobble = Math.sin(t * 2.3) * 0.08
    groupRef.current.position.y = collected ? -0.4 : wobble
  })

  // Debug log
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('[StaticAnimal] type:', type, 'hasGLBModel:', hasGLBModel, 'selectedModel:', selectedModel?.url, 'glbScene:', !!glbScene)
    }
  }, [type, hasGLBModel, glbScene])

  if (type === 'fox') {
    return (
      <group ref={groupRef} scale={0.55}>
        {hasGLBModel && glbScene ? (
          <primitive object={glbScene} />
        ) : (
          <FoxModel tailRef={tailRef} />
        )}
      </group>
    )
  }

  return (
    <group ref={groupRef} scale={0.55}>
      {hasGLBModel && glbScene ? (
        <primitive object={glbScene} />
      ) : (
        <PenguinModel leftWingRef={leftWingRef} rightWingRef={rightWingRef} />
      )}
    </group>
  )
}

function DappMarker({ entry, allDapps }) {
  const { dapp, position, hint, trending, representation = 'gift', animalKind, treeVariant } = entry
  const baseColor = trending ? '#fcd34d' : '#60a5fa'
  const [collected, setCollected] = useState(false)
  const setDappPlacements = useQuestStore((state) => state.setDappPlacements)

  useEffect(() => {
    // Register position for proximity check
    setDappPlacements((prev) => ({
      ...prev,
      [dapp.id]: { x: position[0], z: position[2] }
    }))
    return () => {
      // Cleanup if needed, but usually map is static
    }
  }, [dapp.id, position, setDappPlacements])

  const playerPos = useQuestStore((state) => state.playerPosition)
  const activeDapp = useQuestStore((state) => state.activeDapp)
  const closeActiveDapp = useQuestStore((state) => state.closeActiveDapp)
  const activateDapp = useQuestStore((state) => state.activateDapp)
  const collectDapp = useQuestStore((state) => state.collectDapp)
  const discovered = useQuestStore((state) => state.discoveredDapps)
  const distance = useMemo(() => {
    if (!playerPos) return Infinity
    const dx = (playerPos.x ?? 0) - position[0]
    const dz = (playerPos.z ?? 0) - position[2]
    return Math.sqrt(dx * dx + dz * dz)
  }, [playerPos, position])
  const showHint = !collected && distance < (trending ? 20 : 14)
  const glowIntensity = !collected ? (showHint ? (trending ? 1.3 : 0.9) : 0.2) : 0
  const logoTexture = useLogoTexture(dapp.logo)
  // Load Monad 3D logo để thay thế sphere
  const monad3DLogo = useGLTF('/images/monad-logo.glb')
  const monadLogoRef = useRef()
  const isActive = activeDapp === dapp.id
  const { categories } = useDappData()
  const related = useMemo(() => {
    if (!dapp) return []
    const category = categories?.find((cat) => cat.id === dapp.category)
    if (!category?.items) return []
    return category.items.filter((item) => item.id !== dapp.id).slice(0, 3)
  }, [categories, dapp])

  const handleVisit = useCallback(
    (event) => {
      event?.stopPropagation?.()
      if (dapp.website) {
        window.open(dapp.website, '_blank', 'noopener,noreferrer')
      }
    },
    [dapp.website]
  )

  const handleTwitter = useCallback(
    (event) => {
      event?.stopPropagation?.()
      if (dapp.twitter) {
        window.open(dapp.twitter, '_blank', 'noopener,noreferrer')
      }
    },
    [dapp.twitter]
  )

  const handleCollect = useCallback((event) => {
    event?.stopPropagation?.()
    if (collected) return

    collectDapp(dapp.id, dapp.category)
    setCollected(true)
    playGiftChime()
    closeActiveDapp()

    // [NEW] Power-up Logic
    const cat = (dapp.category || '').toLowerCase()
    if (cat === 'defi') {
      useQuestStore.getState().activateBuff('speed', 45)
    } else if (cat === 'nft') {
      useQuestStore.getState().activateBuff('jump', 45)
    } else if (cat === 'infrastructure' || cat === 'infra') {
      useQuestStore.getState().activateBuff('shield', 60)
    }

    // [NEW] Delivery Mission Trigger (30% chance)
    const store = useQuestStore.getState()
    if (!store.deliveryMission.active && Math.random() < 0.3 && allDapps?.length) {
      const potentialTargets = allDapps.filter(d => d.id !== dapp.id)
      if (potentialTargets.length) {
        const target = potentialTargets[Math.floor(Math.random() * potentialTargets.length)]
        store.startDelivery(dapp.id, target.id, 120) // 2 minutes
      }
    }
  }, [dapp, collected, allDapps, collectDapp, closeActiveDapp])

  // [NEW] Shortcuts for Overlay
  useEffect(() => {
    if (!isActive) return
    const handleKeyDown = (e) => {
      if (e.key.toLowerCase() === 'l') handleVisit()
      if (e.key.toLowerCase() === 'c') handleCollect()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isActive, handleVisit, handleCollect])

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

  useEffect(() => {
    if (discovered?.includes(dapp.id)) {
      setCollected(true)
    }
  }, [discovered, dapp.id])

  // Rotate Monad logo 3D
  useFrame((_, delta) => {
    if (monadLogoRef.current) {
      monadLogoRef.current.rotation.y += delta * 0.5
    }
  })

  return (
    <group>
      <GiftBox
        dapp={dapp}
        position={position}
        renderVisual={renderVisual || undefined}
        collected={collected}
        onActivate={(target) => {
          if (!collected) activateDapp(target.id)
        }}
      />
      {!collected ? (
        <>
          {/* Logo Monad 3D thay cho sphere - có thể tô màu, xoay quanh trục Y */}
          {monad3DLogo?.scene ? (
            <group ref={monadLogoRef} position={[position[0], position[1] + (representation === 'gift' ? 0.8 : 1.2), position[2]]} scale={[trending ? 0.4 : 0.3, trending ? 0.4 : 0.3, trending ? 0.4 : 0.3]}>
              <primitive object={clone(monad3DLogo.scene)} />
              {/* Tô màu cho logo Monad */}
              <mesh position={[0, 0, 0]}>
                <sphereGeometry args={[0.5, 16, 16]} />
                <meshStandardMaterial
                  color={baseColor}
                  emissive={baseColor}
                  emissiveIntensity={glowIntensity * 0.5}
                  transparent
                  opacity={0.3}
                />
              </mesh>
            </group>
          ) : (
            <mesh position={[position[0], position[1] + (representation === 'gift' ? 0.8 : 1.2), position[2]]}>
              <sphereGeometry args={[trending ? 0.35 : 0.25, 16, 16]} />
              <meshStandardMaterial emissive={baseColor} emissiveIntensity={glowIntensity} color={baseColor} />
            </mesh>
          )}
          {/* Logo dApp luôn hiển thị trên đầu hộp quà */}
          {logoTexture ? (
            <Billboard position={[position[0], position[1] + (representation === 'gift' ? 1.5 : 1.9), position[2]]} follow={true} lockZ={false}>
              <mesh>
                <planeGeometry args={[0.6, 0.6]} />
                <meshBasicMaterial
                  map={logoTexture}
                  transparent
                  depthWrite={false}
                  toneMapped={false}
                  side={THREE.FrontSide}
                  opacity={0.95}
                />
              </mesh>
            </Billboard>
          ) : null}
        </>
      ) : null}
      {/* Bỏ popup khi lại gần - chỉ giữ logo trên đầu hộp quà */}
      {isActive ? null : null}
    </group>
  )
}
function SledPositionReporter({ body }) {
  const setPlayerPosition = useQuestStore((state) => state.setPlayerPosition)
  const setPlayerSpeed = useQuestStore((state) => state.setPlayerSpeed)
  const lastPosition = useRef({ x: Infinity, z: Infinity })
  const prevPosRef = useRef(new THREE.Vector3())

  useFrame((_, delta) => {
    if (!body || !body.position) return
    const x = body.position.x
    const z = body.position.z
    const prev = lastPosition.current
    if (Math.abs(prev.x - x) > 0.05 || Math.abs(prev.z - z) > 0.05) {
      lastPosition.current = { x, z }
      setPlayerPosition({ x, z })
    }
    // Tính speed từ sự thay đổi position
    const currentPos = new THREE.Vector3(body.position.x, body.position.y, body.position.z)
    const velocity = currentPos.clone().sub(prevPosRef.current).divideScalar(delta || 0.016)
    prevPosRef.current.copy(currentPos)
    const speed = Math.sqrt(velocity.x ** 2 + velocity.z ** 2 + velocity.y ** 2)
    setPlayerSpeed(speed)
  })
  return null
}

export default function Experience() {
  const discoveredDapps = useQuestStore((state) => state.discoveredDapps)
  const setDappPlacements = useQuestStore((state) => state.setDappPlacements)
  const [worldSeed, setWorldSeed] = useState(null)
  const { animalModels, loaded: animalModelsLoaded } = useAnimalModels()

  // Preload tất cả animal models khi đã load xong
  useEffect(() => {
    if (!animalModelsLoaded) return
    Object.values(animalModels)
      .flat()
      .forEach((model) => {
        useGLTF.preload(model.url)
      })
  }, [animalModels, animalModelsLoaded])
  const [sledBody, setSledBody] = useState(null)
  const sledBodyRef = useRef(null) // Ref để camera đọc quaternion mới nhất mỗi frame
  const [debugEnabled, setDebugEnabled] = useState(() => {
    // Đọc từ localStorage khi khởi tạo để sync với GameplayHUD
    if (typeof window !== 'undefined') {
      return localStorage.getItem('telemetryEnabled') === 'true'
    }
    return false
  })
  const [terrainInfo, setTerrainInfo] = useState(null)
  const { orientationRef } = useSledInput()
  const debugAxes = useMemo(() => (import.meta?.env?.DEV ? new THREE.AxesHelper(2) : null), [])
  const { dapps, categories, trending, loading: dappsLoading, error: dappError } = useDappData()
  const atmosphere = useMemo(() => {
    if (!worldSeed) return null
    const rng = alea(`${worldSeed}-atmo`)
    const storm = rng() < 0.28
    const isDaytime = rng() < 0.35 // 35% cơ hội ban ngày
    const fogScale = Math.max(1.2, TERRAIN_HALF / 180)
    
    // Sky palettes: ban đêm và ban ngày
    const nightPalette = [
      { skyBase: '#0d2344', auroraTop: '#6ef8ff', auroraBottom: '#13315c', sparkleColor: '#dbeafe' },
      { skyBase: '#14223c', auroraTop: '#f0abfc', auroraBottom: '#311d58', sparkleColor: '#f5d0fe' },
      { skyBase: '#062a3c', auroraTop: '#5eead4', auroraBottom: '#102c4b', sparkleColor: '#cffafe' },
      { skyBase: '#321437', auroraTop: '#fb7185', auroraBottom: '#231638', sparkleColor: '#fda4af' },
    ]
    
    const dayPalette = [
      { skyBase: '#87ceeb', auroraTop: '#b0e0e6', auroraBottom: '#e0f6ff', sparkleColor: '#ffffff' }, // Sky blue
      { skyBase: '#add8e6', auroraTop: '#d3e8f0', auroraBottom: '#f0f8ff', sparkleColor: '#ffffff' }, // Light blue
      { skyBase: '#b0c4de', auroraTop: '#d4e4f7', auroraBottom: '#f5f9ff', sparkleColor: '#ffffff' }, // Light steel blue
      { skyBase: '#c8e6f5', auroraTop: '#e0f0f8', auroraBottom: '#f8fcff', sparkleColor: '#ffffff' }, // Very light blue
    ]
    
    const palette = isDaytime ? dayPalette : nightPalette
    const variant = palette[Math.floor(rng() * palette.length)]
    const lightLevel = rng()
    const windBase = 0.32 + rng() * 0.35 + (storm ? 0.18 : 0)
    
    return {
      ...variant,
      fogColor: isDaytime 
        ? (storm ? '#b0c4de' : '#c8e6f5')
        : (storm ? '#10243f' : '#102b4c'),
      fogNear: isDaytime
        ? (storm ? 15 + rng() * 15 : 30 + rng() * 40) * fogScale
        : (storm ? 10 + rng() * 12 : 22 + rng() * 32) * fogScale,
      fogFar: isDaytime
        ? (storm ? 120 + rng() * 80 : 250 + rng() * 200) * fogScale
        : (storm ? 90 + rng() * 60 : 210 + rng() * 160) * fogScale,
      auroraHueShift: storm ? 0.06 : 0.03 + rng() * 0.02,
      auroraSatShift: 0.14 + rng() * 0.05,
      auroraLightShift: 0.08 + rng() * 0.05,
      ambientIntensity: isDaytime
        ? (0.65 + lightLevel * 0.25)
        : (0.42 + lightLevel * 0.24),
      sunIntensity: isDaytime
        ? (storm ? 2.2 + lightLevel * 0.3 : 2.8 + lightLevel * 0.6)
        : (storm ? 1.55 + lightLevel * 0.25 : 1.85 + lightLevel * 0.55),
      sunColor: isDaytime
        ? (storm ? '#f0f8ff' : '#fff8dc')
        : (storm ? '#cfe5ff' : '#e2f1ff'),
      skyLightColor: isDaytime
        ? (storm ? '#b0d4ff' : '#c8e6ff')
        : (storm ? '#78c5ff' : '#9ad8ff'),
      backLightColor: isDaytime
        ? (storm ? '#ffd4a3' : '#ffe4b5')
        : (storm ? '#ffc3b6' : '#ffad92'),
      windBase: 0.35 + rng() * 0.25 + (storm ? 0.3 : 0),
      windGust: 0.25 + rng() * 0.3 + (storm ? 0.2 : 0),
      snowIntensity: storm ? 2.5 + rng() * 1.0 : 1.2 + rng() * 0.6,
      sparkleColor: variant.sparkleColor,
      storm,
      isDaytime,
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

  // Lắng nghe event từ GameplayHUD để toggle telemetry
  useEffect(() => {
    const handleTelemetryToggleEvent = (event) => {
      setDebugEnabled(event.detail)
    }
    window.addEventListener('telemetryToggle', handleTelemetryToggleEvent)
    return () => {
      window.removeEventListener('telemetryToggle', handleTelemetryToggleEvent)
    }
  }, [])

  const giftBoxPositions = useMemo(() => {
    if (!terrainInfo?.getHeightAt || !worldSeed || !dapps.length) return []
    const sampler = terrainInfo.getHeightAt
    const rng = alea(`${worldSeed}-gifts`)
    const placements = []
    const outerLimit = TERRAIN_HALF * 0.94

    // [MODIFIED] Limit total dApps to 50%
    const shuffledDapps = [...dapps]
    // Fisher-Yates shuffle with seed
    let currentIndex = shuffledDapps.length, randomIndex;
    while (currentIndex != 0) {
      randomIndex = Math.floor(rng() * currentIndex);
      currentIndex--;
      [shuffledDapps[currentIndex], shuffledDapps[randomIndex]] = [
        shuffledDapps[randomIndex], shuffledDapps[currentIndex]];
    }
    const limitedDapps = shuffledDapps.slice(0, Math.ceil(dapps.length * 0.5))
    const trendingSet = new Set((trending ?? []).map((item) => item.id))

    const minDistanceSq = (pointA, pointB) => {
      const dx = pointA[0] - pointB[0]
      const dz = pointA[2] - pointB[2]
      return dx * dx + dz * dz
    }

    const baseProfiles = {
      defi: { min: outerLimit * 0.1, max: outerLimit * 0.45, bias: 1.18 },
      infra: { min: outerLimit * 0.16, max: outerLimit * 0.7, bias: 1.05 },
      gaming: { min: outerLimit * 0.32, max: outerLimit, bias: 0.68 },
      nft: { min: outerLimit * 0.24, max: outerLimit * 0.92, bias: 0.8 },
      social: { min: outerLimit * 0.2, max: outerLimit * 0.82, bias: 0.88 },
      payments: { min: outerLimit * 0.14, max: outerLimit * 0.6, bias: 1 },
      default: { min: outerLimit * 0.18, max: outerLimit * 0.85, bias: 0.9 },
    }

    const clampProfile = (profile) => {
      const min = Math.max(12, Math.min(profile.min ?? outerLimit * 0.2, outerLimit - 18))
      const max = Math.max(min + 16, Math.min(profile.max ?? outerLimit, outerLimit))
      return { min, max, bias: profile.bias ?? 0.9 }
    }

    const profileFor = (dapp) => {
      const key = (dapp.category || '').toLowerCase()
      return clampProfile(baseProfiles[key] ?? baseProfiles.default)
    }

    const chooseRepresentation = (isTrending) => {
      if (isTrending) {
        return { representation: 'gift', animalKind: null, treeVariant: null }
      }
      const roll = rng()
      if (roll < 0.28) {
        return { representation: 'animal', animalKind: rng() > 0.5 ? 'fox' : 'penguin', treeVariant: null }
      }
      if (roll < 0.58) {
        return { representation: 'tree', animalKind: null, treeVariant: rng() }
      }
      return { representation: 'gift', animalKind: null, treeVariant: null }
    }

    const attemptPlacement = (dapp, options = {}) => {
      const isTrending = options.trending ?? false
      const baseProfile = clampProfile(options.profile ?? profileFor(dapp))
      const baseBias = THREE.MathUtils.clamp(options.bias ?? baseProfile.bias, 0.25, 1.6)
      const maxAttempts = options.maxAttempts ?? 100
      const spacingOverride = options.minSpacing

      const tryWithProfile = (profile, spacingScale = 1) => {
        if (!(profile.max > profile.min)) return false
        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
          const sample = Math.max(rng(), 1e-4)
          const radial = profile.min + Math.pow(sample, baseBias) * (profile.max - profile.min)
          if (!Number.isFinite(radial) || radial <= 0) continue
          const angle = rng() * Math.PI * 2
          const x = Math.cos(angle) * radial
          const z = Math.sin(angle) * radial
          const groundHeight = sampler(x, z)
          if (groundHeight == null) continue
          const radiusRatio = Math.min(1, radial / outerLimit)
          // [MODIFIED] Reduced spacing for smaller map (TERRAIN_SIZE 270)
          const spacingBase = spacingOverride ?? Math.max(9, THREE.MathUtils.lerp(10, 20, radiusRatio))
          const minSpacing = Math.max(7, spacingBase * spacingScale)
          const candidate = [x, groundHeight + 0.95, z]
          const tooClose = placements.some((entry) => minDistanceSq(entry.position, candidate) < minSpacing * minSpacing)
          if (tooClose) continue

          const hintDistanceBase = Math.min(4.5, 1.0 + radial * 0.045)
          const hintDistance = hintDistanceBase * (0.85 + rng() * 0.55)
          const hintAngle = angle + (rng() - 0.5) * 0.9
          const hint = [x + Math.cos(hintAngle) * hintDistance, groundHeight + 0.7, z + Math.sin(hintAngle) * hintDistance]

          const { representation, animalKind, treeVariant } = chooseRepresentation(isTrending)
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
          return true
        }
        return false
      }

      if (tryWithProfile(baseProfile, 1)) return true

      const relaxedProfile = clampProfile({
        min: baseProfile.min * 0.88,
        max: Math.min(outerLimit, baseProfile.max * 1.08),
        bias: baseBias,
      })

      return tryWithProfile(relaxedProfile, 0.8)
    }

    const trendingList = trending ?? []
    trendingList.forEach((dapp, index) => {
      const startFactor = 0.05 + index * 0.015
      const endFactor = 0.16 + index * 0.03
      const trendingProfile = {
        min: outerLimit * startFactor,
        max: outerLimit * endFactor,
        bias: 0.4,
      }
      attemptPlacement(dapp, {
        profile: trendingProfile,
        bias: 0.35,
        minSpacing: Math.max(12, outerLimit * 0.07),
        maxAttempts: 140,
        trending: true,
      })
    })

    const otherDapps = limitedDapps.filter((dapp) => !trendingSet.has(dapp.id))
    for (let i = otherDapps.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1))
        ;[otherDapps[i], otherDapps[j]] = [otherDapps[j], otherDapps[i]]
    }

    otherDapps.forEach((dapp) => {
      if (rng() > 0.5) return
      const profile = profileFor(dapp)
      const biasJitter = THREE.MathUtils.clamp(profile.bias * (0.9 + (rng() - 0.5) * 0.2), 0.25, 1.6)
      attemptPlacement(dapp, {
        profile,
        bias: biasJitter,
        minSpacing: undefined,
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

  // [NEW] Proximity Check Logic
  useFrame(() => {
    const playerPos = useQuestStore.getState().playerPosition
    const placements = useQuestStore.getState().dappPlacements
    const setNearbyDapp = useQuestStore.getState().setNearbyDapp

    let closest = null
    let minDist = Infinity

    // Check distance to all placed dApps
    Object.entries(placements).forEach(([id, pos]) => {
      const dx = playerPos.x - pos.x
      const dz = playerPos.z - pos.z
      const dist = Math.sqrt(dx * dx + dz * dz)

      if (dist < 8 && dist < minDist) { // 8 units interaction range
        minDist = dist
        closest = { id, distance: dist }
      }
    })

    const currentNearby = useQuestStore.getState().nearbyDapp
    if (closest?.id !== currentNearby?.id) {
      setNearbyDapp(closest)
    } else if (!closest && currentNearby) {
      setNearbyDapp(null)
    }
  })

  // [NEW] 'Y' Key Listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key.toLowerCase() === 'y') {
        const nearby = useQuestStore.getState().nearbyDapp
        const activeDapp = useQuestStore.getState().activeDapp
        if (nearby && !activeDapp) {
          useQuestStore.getState().activateDapp(nearby.id)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <AnimalModelsContext.Provider value={{ animalModels, loaded: animalModelsLoaded }}>
      <Suspense fallback={null}>
        <AtmosphereController atmosphere={atmosphere} />
        {!atmosphere?.isDaytime && <AuroraSky atmosphere={atmosphere} />}
        <SparkleField atmosphere={atmosphere} />
        <WinterWorld
          onTerrainReady={setTerrainInfo}
          onSeedReady={setWorldSeed}
          atmosphere={atmosphere}
        />
        <SantaFlyby />
        <SantaFlybyGround />
        {/* Monad Landmark at center of map */}
        <MonadLandmark position={[0, 0, 0]} />
        <ChogsSled
          onReady={(body) => {
            setSledBody(body)
            sledBodyRef.current = body // Cập nhật ref ngay lập tức
          }}
          getGroundHeight={terrainInfo?.getHeightAt}
          orientationRef={orientationRef}
        />
        {debugAxes ? <primitive object={debugAxes} /> : null}
        {sledBody ? (
          <>
            <FirstPersonCamera body={sledBodyRef} orientationRef={orientationRef} />
            <SledPositionReporter body={sledBody} />
            {debugEnabled ? (
              <DebugTelemetryExperience
                sledBody={sledBody}
                terrainInfo={terrainInfo}
              />
            ) : null}
          </>
        ) : null}
        <WildlifeManager terrainInfo={terrainInfo} worldSeed={worldSeed} />
        {giftBoxPositions.map((entry) => (
          <DappMarker key={entry.dapp.id} entry={entry} allDapps={dapps} />
        ))}
        <DiscoveredDapps
          dapps={dapps.filter((dapp) => discoveredDapps.includes(dapp.id))}
          origin={[-18, 3.2, 12]}
        />
      </Suspense>
    </AnimalModelsContext.Provider>
  )
}

