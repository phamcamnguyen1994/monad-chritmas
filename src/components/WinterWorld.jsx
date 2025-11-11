import { forwardRef, useImperativeHandle, useMemo } from 'react'
import * as THREE from 'three'
import { useTrimesh } from '@react-three/cannon'

const tempColor = new THREE.Color()

const generateHeight = (x, z, scale, amplitude) => {
  const nx = x * scale
  const nz = z * scale
  const ridge = Math.sin(nx * 0.8) * Math.cos(nz * 0.75)
  const valley = Math.sin(nx * 0.22 + Math.cos(nz * 0.18) * 2.4)
  const crest = Math.sin(nx * 1.6 + nz * 0.9) * 0.6
  return (ridge * 0.6 + valley * 0.4 + crest * 0.35) * amplitude
}

const smoothStep = (edge0, edge1, x) => {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

const createTerrain = ({ size, segments, amplitude, colorStops }) => {
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments)
  geometry.rotateX(-Math.PI / 2)

  const position = geometry.attributes.position
  const vertexCount = position.count
  const colors = new Float32Array(vertexCount * 3)
  const heights = new Float32Array(vertexCount)

  const plateauRadius = size * 0.12
  const plateauBlend = plateauRadius * 1.8
  const plateauHeight = amplitude * 0.12

  for (let i = 0; i < vertexCount; i += 1) {
    const x = position.getX(i)
    const z = position.getZ(i)
    const baseHeight = generateHeight(x, z, 0.02, amplitude) + generateHeight(x, z, 0.005, amplitude * 0.6)
    const radius = Math.sqrt(x * x + z * z)

    let height = baseHeight
    if (radius <= plateauRadius) {
      height = plateauHeight
    } else if (radius < plateauBlend) {
      const blend = smoothStep(plateauRadius, plateauBlend, radius)
      height = THREE.MathUtils.lerp(plateauHeight, baseHeight, blend)
    }

    position.setY(i, height)
    heights[i] = height

    const elevation = THREE.MathUtils.clamp((height + amplitude) / (amplitude * 2), 0, 1)
    const lower = Math.floor(elevation * (colorStops.length - 1))
    const upper = Math.min(lower + 1, colorStops.length - 1)
    const lerpFactor = elevation * (colorStops.length - 1) - lower

    tempColor.set(colorStops[lower]).lerp(new THREE.Color(colorStops[upper]), lerpFactor)
    colors[i * 3] = tempColor.r
    colors[i * 3 + 1] = tempColor.g
    colors[i * 3 + 2] = tempColor.b
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.computeVertexNormals()

  const vertices = geometry.attributes.position.array.slice()
  const indices = geometry.index?.array ? geometry.index.array.slice() : undefined
  const gridResolution = segments + 1

  return {
    geometry,
    vertices,
    indices,
    heights,
    plateauHeight,
    plateauRadius,
    size,
    segments,
    gridResolution,
  }
}

const sampleHeight = (terrain, x, z) => {
  if (!terrain) return null
  const { size, segments, gridResolution, heights } = terrain
  const halfSize = size / 2
  const step = size / segments

  const gridX = (x + halfSize) / step
  const gridZ = (z + halfSize) / step

  if (gridX < 0 || gridZ < 0 || gridX > segments || gridZ > segments) return null

  const x0 = Math.floor(gridX)
  const z0 = Math.floor(gridZ)
  const x1 = Math.min(x0 + 1, segments)
  const z1 = Math.min(z0 + 1, segments)

  const tx = gridX - x0
  const tz = gridZ - z0

  const index = z0 * gridResolution + x0
  const indexX1 = z0 * gridResolution + x1
  const indexZ1 = z1 * gridResolution + x0
  const indexDiag = z1 * gridResolution + x1

  const h00 = heights[index]
  const h10 = heights[indexX1]
  const h01 = heights[indexZ1]
  const h11 = heights[indexDiag]

  const hx0 = h00 * (1 - tx) + h10 * tx
  const hx1 = h01 * (1 - tx) + h11 * tx

  return hx0 * (1 - tz) + hx1 * tz
}

const WinterWorld = forwardRef(function WinterWorld({ size = 420, segments = 180, amplitude = 16, snowColorStops, ...props }, ref) {
  const palette = snowColorStops || ['#dce9f5', '#eff6ff', '#f8fafc', '#f1f5f9']

  const terrain = useMemo(
    () => createTerrain({ size, segments, amplitude, colorStops: palette }),
    [size, segments, amplitude, palette]
  )

  const [physicsRef] = useTrimesh(
    () => ({
      args: [terrain.vertices, terrain.indices],
      type: 'Static',
      friction: 1.2,
      restitution: 0.05,
      ...props,
    }),
    undefined,
    [terrain]
  )

  useImperativeHandle(ref, () => ({
    geometry: terrain.geometry,
    plateauHeight: terrain.plateauHeight,
    plateauRadius: terrain.plateauRadius,
    getHeightAt: (x, z) => sampleHeight(terrain, x, z),
  }))

  return (
    <group>
      <mesh ref={physicsRef} geometry={terrain.geometry} receiveShadow castShadow>
        <meshStandardMaterial vertexColors roughness={0.92} metalness={0.02} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.48, 0]} receiveShadow>
        <circleGeometry args={[size * 0.9, 48]} />
        <meshStandardMaterial color="#d0e7ff" roughness={0.95} metalness={0.01} />
      </mesh>
    </group>
  )
})

export default WinterWorld
