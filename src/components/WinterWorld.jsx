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

const createTerrain = ({ size, segments, amplitude, colorStops }) => {
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments)
  geometry.rotateX(-Math.PI / 2)

  const position = geometry.attributes.position
  const vertexCount = position.count
  const colors = new Float32Array(vertexCount * 3)

  for (let i = 0; i < vertexCount; i += 1) {
    const x = position.getX(i)
    const z = position.getZ(i)
    const height = generateHeight(x, z, 0.02, amplitude) + generateHeight(x, z, 0.005, amplitude * 0.6)
    position.setY(i, height)

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

  return {
    geometry,
    vertices,
    indices,
  }
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
