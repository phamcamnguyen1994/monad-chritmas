import { useMemo, useEffect, useRef } from 'react'
import { RigidBody, CylinderCollider } from '@react-three/rapier'
import { useFrame } from '@react-three/fiber'
import { createNoise2D } from 'simplex-noise'
import { useGLTF } from '@react-three/drei'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import * as THREE from 'three'

export const TERRAIN_SIZE = 360
export const TERRAIN_HALF = TERRAIN_SIZE / 2
export const SEGMENTS = 240
const SNOW_PARTICLE_COUNT = 1400
const TREE_COUNT = 320

const TREE_VARIANTS = [
  '/models/pine1.glb',
  '/models/pine2.glb',
  '/models/pine3.glb',
  '/models/pine4.glb',
]

export default function WinterWorld({ onTerrainReady }) {
  const pine1GLTF = useGLTF(TREE_VARIANTS[0])
  const pine2GLTF = useGLTF(TREE_VARIANTS[1])
  const pine3GLTF = useGLTF(TREE_VARIANTS[2])
  const pine4GLTF = useGLTF(TREE_VARIANTS[3])
  const pineVariants = useMemo(() => [pine1GLTF, pine2GLTF, pine3GLTF, pine4GLTF], [pine1GLTF, pine2GLTF, pine3GLTF, pine4GLTF])

  const treeSwayTime = useRef({ value: 0 })
  const windDirection = useRef({ value: new THREE.Vector2(0.8, 0.2).normalize() })
  const windStrength = useRef({ value: 0.5 })
  const windClock = useRef(0)
  const noiseLayers = useMemo(
    () => ({
      a: createNoise2D(),
      b: createNoise2D(),
      c: createNoise2D(),
    }),
    []
  )

  const heights = useMemo(() => generateHeightField(SEGMENTS, 6, noiseLayers), [noiseLayers])
  const heightStats = useMemo(() => computeHeightStats(heights), [heights])
  const heightSampler = useMemo(() => createHeightSampler(heights), [heights])

  function layeredNoise(x, y, layers) {
    const n1 = layers.a(x * 0.9, y * 0.9)
    const n2 = layers.b(x * 2.3 + 100, y * 2.3 + 220)
    const n3 = layers.c(x * 5.4 - 42, y * 5.4 + 57)
    return n1 * 0.65 + n2 * 0.25 + n3 * 0.1
  }

  function generateHeightField(size, amplitude, layers) {
    const data = new Float32Array((size + 1) * (size + 1))
    for (let z = 0; z <= size; z += 1) {
      for (let x = 0; x <= size; x += 1) {
        const idx = z * (size + 1) + x
        const nx = x / size - 0.5
        const nz = z / size - 0.5
        const falloff = THREE.MathUtils.clamp(1 - Math.pow(Math.sqrt(nx * nx + nz * nz), 1.6), 0, 1)
        const noise = layeredNoise(nx * 2, nz * 2, layers) * amplitude
        const ridge = Math.sin(nx * 6.5) * Math.cos(nz * 5.8) * 1.2
        data[idx] = (noise + ridge * 0.35) * falloff
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
    const heightRange = Math.max(heightStats.max - heightStats.min, 0.001)
    for (let i = 0; i < position.count; i += 1) {
      const y = position.getY(i)
      const heightT = THREE.MathUtils.clamp((y - heightStats.min) / heightRange, 0, 1)
      normalVec.set(normalAttr.getX(i), normalAttr.getY(i), normalAttr.getZ(i)).normalize()
      const slope = 1 - Math.abs(normalVec.y)
      const ridgeAccent = Math.pow(slope, 2.15)
      const facingCamera = THREE.MathUtils.mapLinear(normalVec.dot(viewHint), -1, 1, 1.2, 0.65)
      const sideLight = THREE.MathUtils.mapLinear(normalVec.dot(sideLightDir), -1, 1, 0.78, 1.25)
      const hue = THREE.MathUtils.lerp(0.56, 0.48, heightT)
      const saturation = THREE.MathUtils.clamp(0.1 + ridgeAccent * 0.42 + heightT * 0.14, 0.08, 0.52)
      const lightnessBase = THREE.MathUtils.lerp(0.58, 0.92, heightT)
      const lightness = THREE.MathUtils.clamp(lightnessBase * facingCamera * sideLight - ridgeAccent * 0.22, 0.3, 0.98)
      color.setHSL(hue, saturation, lightness)
      const idx = i * 3
      colors[idx] = color.r
      colors[idx + 1] = color.g
      colors[idx + 2] = color.b
    }
    plane.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return plane
  }, [heights, heightStats])

  const snowPositions = useMemo(() => {
    const arr = new Float32Array(SNOW_PARTICLE_COUNT * 3)
    for (let i = 0; i < SNOW_PARTICLE_COUNT; i += 1) {
      const idx = i * 3
      arr[idx] = (Math.random() - 0.5) * TERRAIN_SIZE * 0.8
      arr[idx + 1] = Math.random() * 30 + 10
      arr[idx + 2] = (Math.random() - 0.5) * TERRAIN_SIZE * 0.8
    }
    return arr
  }, [])

  const snowTexture = useMemo(() => {
    if (typeof document === 'undefined') return null
    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)')
    gradient.addColorStop(0.45, 'rgba(255,255,255,0.65)')
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

  useFrame((state, delta) => {
    windClock.current += delta
    const dir = windDirection.current.value
    dir.set(Math.sin(windClock.current * 0.18), Math.cos(windClock.current * 0.23)).normalize()
    windStrength.current.value = 0.45 + Math.sin(windClock.current * 0.32) * 0.25
    treeSwayTime.current.value = treeSwayTime.current.value + delta * (0.8 + windStrength.current.value * 0.6)

    const snow = state.scene.getObjectByName('chog-snow-particles')
    if (!snow) return
    const positions = snow.geometry.attributes.position
    const windX = dir.x * windStrength.current.value * 3.6
    const windZ = dir.y * windStrength.current.value * 3.6
    for (let i = 0; i < SNOW_PARTICLE_COUNT; i += 1) {
      const idx = i * 3
      positions.array[idx] += windX * delta
      positions.array[idx + 1] -= delta * (2.8 + windStrength.current.value * 1.1)
      positions.array[idx + 2] += windZ * delta
      if (positions.array[idx + 1] < 0) {
        positions.array[idx] = (Math.random() - 0.5) * TERRAIN_SIZE * 0.8
        positions.array[idx + 1] = Math.random() * 30 + 10
        positions.array[idx + 2] = (Math.random() - 0.5) * TERRAIN_SIZE * 0.8
      }
    }
    positions.needsUpdate = true
  })

  const treeData = useMemo(() => {
    const trees = []
    for (let i = 0; i < TREE_COUNT; i += 1) {
      const radius = Math.random() * (TERRAIN_SIZE * 0.45)
      const angle = Math.random() * Math.PI * 2
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      const nx = ((x + TERRAIN_SIZE / 2) / TERRAIN_SIZE) * SEGMENTS
      const nz = ((z + TERRAIN_SIZE / 2) / TERRAIN_SIZE) * SEGMENTS
      const idx = Math.round(nz) * (SEGMENTS + 1) + Math.round(nx)
      const y = heights[idx] ?? 0
      const scale = 3.8 + Math.random() * 2.4
      trees.push({
        position: [x, y + 1.2, z],
        scale,
        colliderHalfHeight: scale * 0.95,
        colliderRadius: scale * 0.36,
        variant: Math.floor(Math.random() * TREE_VARIANTS.length),
      })
    }
    return trees
  }, [heights])

  const treeInstances = useMemo(() => {
    const enhanceMaterial = (material) => {
      if (!material) return material
      const clonedMaterial = material.clone()
      if (clonedMaterial.color) clonedMaterial.color = new THREE.Color('#d9ffef')
      if (clonedMaterial.emissive) clonedMaterial.emissive = new THREE.Color('#1f4d2b')
      if (typeof clonedMaterial.emissiveIntensity === 'number') clonedMaterial.emissiveIntensity = 0.2
      if (typeof clonedMaterial.roughness === 'number') clonedMaterial.roughness = Math.min(clonedMaterial.roughness, 0.6)
      return clonedMaterial
    }

    return treeData.map((tree) => {
      const scene = clone(pineVariants[tree.variant].scene)
      const swayPhase = Math.random() * Math.PI * 2
      const swayAmplitude = 0.1 + Math.random() * 0.05

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
float sway = sin(uSwayTime + uSwayPhase) * uSwayAmplitude * (0.6 + uSwayStrength * 0.8);
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
      <ambientLight intensity={0.45} color="#e0f2ff" />
      <directionalLight
        position={[40, 80, -30]}
        intensity={1.75}
        color="#c8e7ff"
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
      <hemisphereLight skyColor="#8dd6ff" groundColor="#1a2744" intensity={0.32} />
      <directionalLight position={[-60, 32, 84]} intensity={0.62} color="#71bfff" castShadow={false} />
      <directionalLight position={[32, -36, -70]} intensity={0.38} color="#ff9d82" castShadow={false} />

      <RigidBody type="fixed" colliders="trimesh">
        <mesh geometry={geometry} receiveShadow castShadow>
          <meshStandardMaterial vertexColors roughness={0.78} metalness={0.04} />
        </mesh>
      </RigidBody>

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
          <primitive object={tree.scene} scale={tree.scale} castShadow receiveShadow />
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
          size={0.25}
          color="#ffffff"
          sizeAttenuation
          transparent
          opacity={0.92}
          depthWrite={false}
          alphaMap={snowTexture ?? undefined}
          map={snowTexture ?? undefined}
          alphaTest={0.1}
          depthTest
          blending={THREE.NormalBlending}
        />
      </points>
    </>
  )
}

TREE_VARIANTS.forEach((path) => {
  useGLTF.preload(path)
})
