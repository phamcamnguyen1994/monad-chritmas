import { useMemo, useEffect, useRef } from 'react'
import { RigidBody, CylinderCollider } from '@react-three/rapier'
import { useFrame } from '@react-three/fiber'
import alea from 'alea'
import { createNoise2D } from 'simplex-noise'
import { useGLTF } from '@react-three/drei'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import * as THREE from 'three'

// Preload house model
useGLTF.preload('/images/house.glb')

// Component để render các cabin sử dụng house.glb model
function CabinHouses({ cabins }) {
  const houseModel = useGLTF('/images/house.glb')
  
  const houseScenes = useMemo(() => {
    if (!houseModel?.scene) return []
    return cabins.map(() => {
      const cloned = clone(houseModel.scene)
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
      })
      return cloned
    })
  }, [houseModel, cabins])

  // Tính bounding box của model để điều chỉnh vị trí Y
  const modelBounds = useMemo(() => {
    if (!houseModel?.scene) return null
    const box = new THREE.Box3()
    box.setFromObject(houseModel.scene)
    return box
  }, [houseModel])

  return (
    <group>
      {cabins.map((cabin, index) => {
        // Tính offset Y dựa trên bounding box của model và scale
        let yOffset = 0.5 // Offset mặc định tăng lên
        if (modelBounds) {
          // modelBounds.min.y là điểm thấp nhất của model (thường là âm hoặc 0)
          // Nhân với scale để tính đúng với scale của cabin
          // Thêm offset để đảm bảo đáy model nằm trên mặt đất
          yOffset = -modelBounds.min.y * cabin.scale + 0.3 // Thêm 0.3 để đảm bảo không chạm đất
        }
        
        return (
          <group 
            key={`cabin-${index}`} 
            position={[cabin.position[0], cabin.position[1] + yOffset, cabin.position[2]]} 
            rotation={[0, cabin.rotation, 0]} 
            scale={cabin.scale}
          >
            {houseScenes[index] ? (
              <primitive object={houseScenes[index]} />
            ) : (
              // Fallback nếu không có model
              <mesh castShadow receiveShadow>
                <boxGeometry args={[0.7, 0.5, 0.7]} />
                <meshStandardMaterial color="#43302b" roughness={0.6} metalness={0.05} />
              </mesh>
            )}
          </group>
        )
      })}
    </group>
  )
}

export const TERRAIN_SIZE = 270 // Giảm xuống một nửa (từ 540)
export const TERRAIN_HALF = TERRAIN_SIZE / 2
export const SEGMENTS = 90 // Giảm xuống một nửa (từ 180)
const SNOW_PARTICLE_COUNT = 800 // Tăng lên để tuyết dày hơn
const TREE_COUNT = 90 // Giảm theo diện tích (1/4 của 360)

// Tự động lấy tất cả các model cây thông có tên bắt đầu bằng "pine" trong public/models
// Ví dụ: pine1.glb, pine2.glb, pine-big.glb,...
const pineModules = import.meta.glob('../public/models/pine*.glb', {
  eager: true,
  as: 'url',
})
const TREE_VARIANTS = Object.values(pineModules).length
  ? Object.values(pineModules)
  : [
      '/models/pine1.glb',
      '/models/pine2.glb',
      '/models/pine3.glb',
      '/models/pine4.glb',
      '/models/pine5.glb',
      '/models/pine6.glb',
      '/models/pine7.glb',
      '/models/pine8.glb',
    ]

function useSessionSeed() {
  return useMemo(() => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID()
    }
    return `${Math.random()}-${performance.now()}`
  }, [])
}

export default function WinterWorld({ onTerrainReady, onSeedReady, atmosphere }) {
  const seed = useSessionSeed()
  useEffect(() => {
    onSeedReady?.(seed)
  }, [seed, onSeedReady])
  const pineGLTFs = TREE_VARIANTS.map((path) => useGLTF(path))
  const pineVariants = useMemo(() => pineGLTFs, [pineGLTFs])

  const treeSwayTime = useRef({ value: 0 })
  const windDirection = useRef({ value: new THREE.Vector2(0.8, 0.2).normalize() })
  const windStrength = useRef({ value: 0.1 })
  const windClock = useRef(0)
  const stormActive = useRef(false)
  const stormTimer = useRef(0)
  const stormCooldown = useRef(0)
  
  // Gió mạnh hơn
  const windBase = atmosphere?.windBase ?? 0.35
  const windGust = atmosphere?.windGust ?? 0.25
  const baseSnowIntensity = atmosphere?.snowIntensity ?? 1
  const ambientIntensity = atmosphere?.ambientIntensity ?? 0.45
  const sunIntensity = atmosphere?.sunIntensity ?? 1.75
  const sunColor = atmosphere?.sunColor ?? '#c8e7ff'
  const skyLightColor = atmosphere?.skyLightColor ?? '#8dd6ff'
  const backLightColor = atmosphere?.backLightColor ?? '#ff9d82'
  const noiseLayers = useMemo(() => {
    const rng = alea(seed)
    return {
      a: createNoise2D(rng),
      b: createNoise2D(rng),
      c: createNoise2D(rng),
    }
  }, [seed])

  // Tăng amplitude để có độ dốc và variation hơn
  const terrainAmplitude = useMemo(() => Math.max(10, TERRAIN_SIZE / 60), [])
  const heights = useMemo(() => generateHeightField(SEGMENTS, terrainAmplitude, noiseLayers), [noiseLayers, terrainAmplitude])
  const heightStats = useMemo(() => computeHeightStats(heights), [heights])
  const heightSampler = useMemo(() => createHeightSampler(heights), [heights])

  function layeredNoise(x, y, layers) {
    const n1 = layers.a(x * 0.9, y * 0.9)
    const n2 = layers.b(x * 2.3 + 100, y * 2.3 + 220)
    const n3 = layers.c(x * 5.4 - 42, y * 5.4 + 57)
    // Điều chỉnh weights để có variation rõ ràng hơn
    return n1 * 0.55 + n2 * 0.3 + n3 * 0.15
  }

  function generateHeightField(size, amplitude, layers) {
    const data = new Float32Array((size + 1) * (size + 1))
    // Tăng ridge strength để có variation cao thấp rõ ràng hơn
    const ridgeStrength = THREE.MathUtils.clamp((TERRAIN_SIZE / 360) * 0.5, 0.4, 0.9)
    for (let z = 0; z <= size; z += 1) {
      for (let x = 0; x <= size; x += 1) {
        const idx = z * (size + 1) + x
        const nx = x / size - 0.5
        const nz = z / size - 0.5
        const falloff = THREE.MathUtils.clamp(1 - Math.pow(Math.sqrt(nx * nx + nz * nz), 1.6), 0, 1)
        // Tăng scale của noise để có variation nhỏ hơn, chi tiết hơn
        const noise = layeredNoise(nx * 2.5, nz * 2.5, layers) * amplitude
        // Thêm thêm một layer ridge để tạo độ dốc
        const ridge = Math.sin(nx * 6.5) * Math.cos(nz * 5.8) * 1.2
        // Thêm variation nhỏ hơn với frequency cao hơn
        const detailRidge = Math.sin(nx * 12) * Math.cos(nz * 10) * 0.6
        data[idx] = (noise + ridge * ridgeStrength + detailRidge * 0.3) * falloff
      }
    }
    return data
  }

  function computeHeightStats(heights) {
    let min = Infinity
    let max = -Infinity
    for (let i = 0; i < heights.length; i += 1) {
      const value = heights[i]
      if (value < min) min = value
      if (value > max) max = value
    }
    return { min, max }
  }

  function createHeightSampler(heights) {
    const gridResolution = SEGMENTS + 1
    return (x, z) => {
      const half = TERRAIN_HALF
      if (x < -half || x > half || z < -half || z > half) return null
      const normalizedX = (x + half) / TERRAIN_SIZE
      const normalizedZ = (z + half) / TERRAIN_SIZE
      const gridX = normalizedX * SEGMENTS
      const gridZ = normalizedZ * SEGMENTS
      const x0 = Math.floor(gridX)
      const z0 = Math.floor(gridZ)
      const x1 = Math.min(x0 + 1, SEGMENTS)
      const z1 = Math.min(z0 + 1, SEGMENTS)
      const tx = gridX - x0
      const tz = gridZ - z0
      const idx = z0 * gridResolution + x0
      const idxX1 = z0 * gridResolution + x1
      const idxZ1 = z1 * gridResolution + x0
      const idxDiag = z1 * gridResolution + x1
      const h00 = heights[idx] ?? 0
      const h10 = heights[idxX1] ?? 0
      const h01 = heights[idxZ1] ?? 0
      const h11 = heights[idxDiag] ?? 0
      const hx0 = h00 * (1 - tx) + h10 * tx
      const hx1 = h01 * (1 - tx) + h11 * tx
      return hx0 * (1 - tz) + hx1 * tz
    }
  }

  const geometry = useMemo(() => {
    const plane = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, SEGMENTS, SEGMENTS)
    plane.rotateX(-Math.PI / 2)
    const position = plane.attributes.position
    for (let i = 0; i < position.count; i += 1) {
      position.setY(i, heights[i])
    }
    position.needsUpdate = true
    plane.computeVertexNormals()
    const normalAttr = plane.attributes.normal
    const colors = new Float32Array(position.count * 3)
    const color = new THREE.Color()
    const normalVec = new THREE.Vector3()
    const viewHint = new THREE.Vector3(0, 0, 1).normalize()
    const sideLightDir = new THREE.Vector3(-0.45, 0.65, 0.28).normalize()
    const sunDir = new THREE.Vector3(0.32, 0.78, -0.52).normalize()
    const heightRange = Math.max(heightStats.max - heightStats.min, 0.001)
    for (let i = 0; i < position.count; i += 1) {
      const y = position.getY(i)
      const heightT = THREE.MathUtils.clamp((y - heightStats.min) / heightRange, 0, 1)
      normalVec.set(normalAttr.getX(i), normalAttr.getY(i), normalAttr.getZ(i)).normalize()
      const slope = 1 - Math.abs(normalVec.y)
      const ridgeAccent = Math.pow(slope, 2.35)
      const facingCamera = THREE.MathUtils.mapLinear(normalVec.dot(viewHint), -1, 1, 1.28, 0.58)
      const sideLight = THREE.MathUtils.mapLinear(normalVec.dot(sideLightDir), -1, 1, 0.7, 1.32)
      const sunLight = THREE.MathUtils.clamp(normalVec.dot(sunDir), -0.6, 1)
      const contour = Math.pow(0.5 + 0.5 * Math.cos(heightT * Math.PI * 9.5), 1.8)
      const valleyBoost = THREE.MathUtils.mapLinear(slope, 0, 1, 0.06, 0.32) * (0.72 - sunLight * 0.5)
      const hue = THREE.MathUtils.lerp(0.58, 0.44, heightT) - valleyBoost * 0.12
      const saturation = THREE.MathUtils.clamp(0.14 + ridgeAccent * 0.52 + heightT * 0.18 - valleyBoost * 0.28, 0.08, 0.72)
      const lightnessBase = THREE.MathUtils.lerp(0.54, 0.94, heightT)
      const lightShadow = THREE.MathUtils.clamp(1.12 - sunLight * 0.42, 0.45, 1.35)
      const contourShade = THREE.MathUtils.lerp(0.78, 1.18, contour)
      const lightness = THREE.MathUtils.clamp(
        lightnessBase * facingCamera * sideLight * lightShadow * contourShade - ridgeAccent * 0.28,
        0.22,
        1
      )
      color.setHSL(hue, saturation, lightness)
      const idx = i * 3
      colors[idx] = color.r
      colors[idx + 1] = color.g
      colors[idx + 2] = color.b
    }
    plane.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return plane
  }, [heights, heightStats])

  const snowSpread = TERRAIN_SIZE * 1.25

  const snowPositions = useMemo(() => {
    const rng = alea(`${seed}-snow`)
    const arr = new Float32Array(SNOW_PARTICLE_COUNT * 3)
    for (let i = 0; i < SNOW_PARTICLE_COUNT; i += 1) {
      const idx = i * 3
      arr[idx] = (rng() - 0.5) * snowSpread
      // Tăng height range để có nhiều tuyết hơn ở các độ cao khác nhau
      arr[idx + 1] = rng() * 50 + 8
      arr[idx + 2] = (rng() - 0.5) * snowSpread
    }
    return arr
  }, [seed, snowSpread])

  const snowTexture = useMemo(() => {
    if (typeof document === 'undefined') return null
    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    // Tăng opacity để tuyết rõ hơn
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)')
    gradient.addColorStop(0.35, 'rgba(255,255,255,0.85)')
    gradient.addColorStop(0.7, 'rgba(255,255,255,0.5)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
    const texture = new THREE.Texture(canvas)
    texture.needsUpdate = true
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.generateMipmaps = true
    return texture
  }, [])

  const snowUpdateAccumulator = useRef(0)
  const SNOW_UPDATE_INTERVAL = 1 / 60 // Update at 60fps max, can skip frames if needed

  useFrame((state, delta) => {
    // Clamp delta để tránh animation nhảy khi frame rate thấp (khi di chuyển)
    const clampedDelta = Math.min(delta, 0.033) // Max 33ms = ~30fps minimum
    
    // Storm system - random trigger bão tuyết
    stormCooldown.current -= clampedDelta
    if (!stormActive.current && stormCooldown.current <= 0) {
      // 15% chance mỗi 30-60 giây để trigger bão
      if (Math.random() < 0.15) {
        stormActive.current = true
        stormTimer.current = 8 + Math.random() * 12 // Bão kéo dài 8-20 giây
        stormCooldown.current = 30 + Math.random() * 30 // Cooldown 30-60 giây
      } else {
        stormCooldown.current = 10 + Math.random() * 20 // Check lại sau 10-30 giây
      }
    }
    
    if (stormActive.current) {
      stormTimer.current -= clampedDelta
      if (stormTimer.current <= 0) {
        stormActive.current = false
      }
    }
    
    windClock.current += clampedDelta
    const dir = windDirection.current.value
    
    // Gió mạnh hơn và thay đổi hướng nhanh hơn khi có bão
    const windSpeed = stormActive.current ? 0.35 : 0.18
    dir.set(Math.sin(windClock.current * windSpeed), Math.cos(windClock.current * (windSpeed * 1.3))).normalize()
    
    // Wind strength mạnh hơn, đặc biệt khi có bão
    const currentWindBase = stormActive.current ? windBase * 2.5 : windBase
    const currentWindGust = stormActive.current ? windGust * 2.0 : windGust
    windStrength.current.value = currentWindBase + Math.sin(windClock.current * 0.32) * currentWindGust
    
    // Tree sway nhanh hơn khi có gió mạnh
    const swaySpeed = stormActive.current ? 0.4 + windStrength.current.value * 0.3 : 0.2 + windStrength.current.value * 0.2
    treeSwayTime.current.value = treeSwayTime.current.value + clampedDelta * swaySpeed

    // Throttle snow updates to reduce lag
    snowUpdateAccumulator.current += delta
    if (snowUpdateAccumulator.current >= SNOW_UPDATE_INTERVAL) {
      const snow = state.scene.getObjectByName('chog-snow-particles')
      if (snow) {
        const positions = snow.geometry.attributes.position
        // Tăng wind effect cho tuyết, đặc biệt khi có bão
        // Tính toán snow intensity dựa trên storm (real-time)
        const currentSnowIntensity = stormActive.current ? baseSnowIntensity * 3.5 : baseSnowIntensity
        const windMultiplier = stormActive.current ? 6.0 : 4.5
        const windX = dir.x * windStrength.current.value * windMultiplier * currentSnowIntensity
        const windZ = dir.y * windStrength.current.value * windMultiplier * currentSnowIntensity
        const fallBase = (3.4 + windStrength.current.value * 1.5) * currentSnowIntensity
        const updateDelta = snowUpdateAccumulator.current
        for (let i = 0; i < SNOW_PARTICLE_COUNT; i += 1) {
          const idx = i * 3
          positions.array[idx] += windX * updateDelta
          positions.array[idx + 1] -= updateDelta * fallBase
          positions.array[idx + 2] += windZ * updateDelta
          if (positions.array[idx + 1] < 0) {
            positions.array[idx] = (Math.random() - 0.5) * snowSpread
            // Tăng height range khi respawn
            positions.array[idx + 1] = Math.random() * 50 + 8
            positions.array[idx + 2] = (Math.random() - 0.5) * snowSpread
          }
        }
        positions.needsUpdate = true
      }
      snowUpdateAccumulator.current = 0
    }
  })

  const mountainData = useMemo(() => {
    const rng = alea(`${seed}-mountains`)
    const count = 18
    const mountains = []
    const radiusInner = TERRAIN_SIZE * 0.62
    const radiusOuter = TERRAIN_SIZE * 0.78
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + rng() * 0.2
      const radius = THREE.MathUtils.lerp(radiusInner, radiusOuter, rng())
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      const baseIndex =
        Math.round(((z + TERRAIN_SIZE / 2) / TERRAIN_SIZE) * SEGMENTS) * (SEGMENTS + 1) +
        Math.round(((x + TERRAIN_SIZE / 2) / TERRAIN_SIZE) * SEGMENTS)
      const baseHeight = heights[baseIndex] ?? 0
      const height = 18 + rng() * 12
      const scale = 18 + rng() * 10
      mountains.push({
        position: [x, baseHeight - 2, z],
        height,
        scale,
        color: new THREE.Color().setHSL(0.58 + rng() * 0.04, 0.18, 0.72),
      })
    }
    return mountains
  }, [heights, seed])

  const cabinData = useMemo(() => {
    const cabins = []
    const count = 6
    const rng = alea(`${seed}-cabins`)
    for (let i = 0; i < count; i += 1) {
      const angle = rng() * Math.PI * 2
      const radius = TERRAIN_SIZE * (0.35 + rng() * 0.18)
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      const idx =
        Math.round(((z + TERRAIN_SIZE / 2) / TERRAIN_SIZE) * SEGMENTS) * (SEGMENTS + 1) +
        Math.round(((x + TERRAIN_SIZE / 2) / TERRAIN_SIZE) * SEGMENTS)
      const ground = heights[idx] ?? 0
      // Đảm bảo house luôn ở trên mặt tuyết với offset đủ lớn
      // Scale lớn hơn thì cần offset cao hơn để không bị chôn
      const baseOffset = 0.3 // Offset cơ bản
      cabins.push({
        position: [x, ground + baseOffset, z],
        scale: 3.2 + rng() * 1.6,
        rotation: rng() * Math.PI * 2,
      })
    }
    return cabins
  }, [heights, seed])

  const treeData = useMemo(() => {
    const trees = []
    const maxRadius = TERRAIN_SIZE * 0.48
    const minRadius = 6
    let attempts = 0
    const maxAttempts = TREE_COUNT * 18

    const rng = alea(`${seed}-trees`)
    while (trees.length < TREE_COUNT && attempts < maxAttempts) {
      attempts += 1
      const radiusSample = Math.pow(rng(), 0.55)
      const radius = minRadius + radiusSample * (maxRadius - minRadius)
      const angle = rng() * Math.PI * 2
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      const normalizedX = ((x + TERRAIN_SIZE / 2) / TERRAIN_SIZE) * SEGMENTS
      const normalizedZ = ((z + TERRAIN_SIZE / 2) / TERRAIN_SIZE) * SEGMENTS
      const idx = Math.round(normalizedZ) * (SEGMENTS + 1) + Math.round(normalizedX)
      const y = heights[idx] ?? 0

      const densityFactor = radius / maxRadius
      const minSpacing = THREE.MathUtils.lerp(3.8, 9.6, densityFactor)
      let tooClose = false
      for (let i = 0; i < trees.length; i += 1) {
        const existing = trees[i].position
        const dx = existing[0] - x
        const dz = existing[2] - z
        if (dx * dx + dz * dz < minSpacing * minSpacing) {
          tooClose = true
          break
        }
      }
      if (tooClose) continue

      const tallnessPreference = THREE.MathUtils.lerp(0.45, 1.0, 1 - densityFactor)
      const randomJitter = rng()
      const baseScale = 5.6
      const extraTall = THREE.MathUtils.lerp(1.6, 2.4, tallnessPreference)
      const shortVariance = THREE.MathUtils.lerp(0.35, 0.85, randomJitter)
      const scale = baseScale + extraTall * randomJitter + shortVariance
      const nonUniformScale = {
        x: THREE.MathUtils.lerp(0.86, 1.08, rng()),
        z: THREE.MathUtils.lerp(0.86, 1.12, rng()),
      }

      trees.push({
        position: [x, y + 1.2, z],
        scale,
        scaleXZ: nonUniformScale,
        colliderHalfHeight: scale * 0.95,
        colliderRadius: scale * 0.36,
        variant: Math.floor(rng() * TREE_VARIANTS.length),
      })
    }
    return trees
  }, [heights, seed])

  const treeInstances = useMemo(() => {
    const enhanceMaterial = (material) => {
      if (!material) return material
      const clonedMaterial = material.clone()
      // GIỮ NGUYÊN màu và properties gốc của material - không thay đổi
      // Chỉ đảm bảo tone mapping được bật để màu hiển thị đúng
      if (clonedMaterial.toneMapped !== undefined) clonedMaterial.toneMapped = true
      return clonedMaterial
    }

    return treeData.map((tree) => {
      const scene = clone(pineVariants[tree.variant].scene)
      const swayPhase = Math.random() * Math.PI * 2
      // Biên độ lắc tăng lên để phản ánh gió mạnh hơn
      const swayAmplitude = 0.03 + Math.random() * 0.02

      scene.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true
          child.receiveShadow = true
          const applyMaterial = (mat) => {
            const enhanced = enhanceMaterial(mat)
            const geometry = child.geometry
            if (geometry && !geometry.boundingBox) {
              geometry.computeBoundingBox()
            }
            const bbox = geometry?.boundingBox
            const height = Math.max((bbox?.max.y ?? 2) - (bbox?.min.y ?? 0), 0.001)
            const base = bbox?.min.y ?? 0

            enhanced.onBeforeCompile = (shader) => {
              shader.uniforms.uSwayTime = treeSwayTime.current
              shader.uniforms.uSwayPhase = { value: swayPhase }
              shader.uniforms.uSwayHeight = { value: height }
              shader.uniforms.uSwayBase = { value: base }
              shader.uniforms.uSwayDir = windDirection.current
              shader.uniforms.uSwayStrength = windStrength.current
              shader.uniforms.uSwayAmplitude = { value: swayAmplitude }

              shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                `
#include <common>
uniform float uSwayTime;
uniform float uSwayPhase;
uniform float uSwayHeight;
uniform float uSwayBase;
uniform vec2 uSwayDir;
uniform float uSwayStrength;
uniform float uSwayAmplitude;
`
              )

              shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
#include <begin_vertex>
float swaySpan = max(uSwayHeight, 0.001);
float swayWeight = clamp((position.y - uSwayBase) / swaySpan, 0.0, 1.0);
vec2 windDir = normalize(uSwayDir);
// Gió mạnh hơn - giảm threshold và tăng multiplier
float windFactor = max(0.0, (uSwayStrength - 0.1) / 0.6);
float sway = sin(uSwayTime + uSwayPhase) * uSwayAmplitude * windFactor * 0.6;
vec2 swayOffset = windDir * sway * swayWeight;
transformed.xz += swayOffset;
`
              )
            }
            enhanced.needsUpdate = true
            return enhanced
          }

          if (Array.isArray(child.material)) {
            child.material = child.material.map((mat) => applyMaterial(mat))
          } else if (child.material) {
            child.material = applyMaterial(child.material)
          }
        }
      })
      return {
        ...tree,
        scene,
      }
    })
  }, [treeData, pineVariants])

  useEffect(() => {
    onTerrainReady?.({ getHeightAt: heightSampler })
  }, [heightSampler, onTerrainReady])

  return (
    <>
      <ambientLight intensity={ambientIntensity} color={atmosphere?.ambientColor ?? '#e0f2ff'} />
      <directionalLight
        position={[40, 80, -30]}
        intensity={sunIntensity}
        color={sunColor}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={220}
        shadow-camera-left={-120}
        shadow-camera-right={120}
        shadow-camera-top={120}
        shadow-camera-bottom={-120}
      />
      <hemisphereLight skyColor={skyLightColor} groundColor="#1a2744" intensity={0.24 + ambientIntensity * 0.6} />
      <directionalLight position={[-60, 32, 84]} intensity={0.5 + (atmosphere?.storm ? 0.25 : 0)} color={skyLightColor} castShadow={false} />
      <directionalLight position={[32, -36, -70]} intensity={0.3 + (atmosphere?.storm ? 0.2 : 0)} color={backLightColor} castShadow={false} />

      <RigidBody type="fixed" colliders="trimesh">
        <mesh geometry={geometry} receiveShadow castShadow>
          <meshStandardMaterial vertexColors roughness={0.78} metalness={0.04} />
        </mesh>
      </RigidBody>

      <group>
        {mountainData.map((mountain, index) => (
          <group key={`mountain-${index}`} position={mountain.position}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[mountain.scale, mountain.scale, mountain.height]}>
              <coneGeometry args={[1, 1.1, 7]} />
              <meshStandardMaterial color={mountain.color} roughness={0.8} metalness={0.02} />
            </mesh>
            <mesh position={[0, mountain.height * 0.42, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[mountain.scale * 0.7, mountain.scale * 0.7, mountain.height * 0.45]}>
              <coneGeometry args={[1, 1.1, 9]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.5} metalness={0.01} />
            </mesh>
          </group>
        ))}
      </group>

      <CabinHouses cabins={cabinData} />

      {treeInstances.map((tree) => (
        <RigidBody
          key={`${tree.position[0]}-${tree.position[2]}-${tree.variant}`}
          type="fixed"
          colliders={false}
          position={tree.position}
        >
          <CylinderCollider
            args={[tree.colliderHalfHeight, tree.colliderRadius]}
            position={[0, tree.colliderHalfHeight, 0]}
          />
          <primitive
            object={tree.scene}
            scale={[tree.scale * tree.scaleXZ.x, tree.scale, tree.scale * tree.scaleXZ.z]}
            castShadow
            receiveShadow
          />
        </RigidBody>
      ))}

      <points name="chog-snow-particles">
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={snowPositions}
            count={SNOW_PARTICLE_COUNT}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.5}
          color="#ffffff"
          sizeAttenuation
          transparent
          opacity={1.0}
          depthWrite={false}
          alphaMap={snowTexture ?? undefined}
          map={snowTexture ?? undefined}
          alphaTest={0.05}
          depthTest
          blending={THREE.AdditiveBlending}
        />
      </points>
    </>
  )
}

TREE_VARIANTS.forEach((path) => {
  useGLTF.preload(path)
})
