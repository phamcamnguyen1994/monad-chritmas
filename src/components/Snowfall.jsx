import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function Snowfall({ count = 1200, area = 380, height = 140, speedRange = [0.8, 1.6] }) {
  const pointsRef = useRef(null)

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i += 1) {
      const index = i * 3
      arr[index] = (Math.random() - 0.5) * area
      arr[index + 1] = Math.random() * height + 20
      arr[index + 2] = (Math.random() - 0.5) * area
    }
    return arr
  }, [count, area, height])

  const speeds = useMemo(() => {
    const [min, max] = speedRange
    const arr = new Float32Array(count)
    for (let i = 0; i < count; i += 1) {
      arr[i] = THREE.MathUtils.lerp(min, max, Math.random())
    }
    return arr
  }, [count, speedRange])

  useFrame((_, delta) => {
    const points = pointsRef.current
    if (!points) return
    const positionAttr = points.geometry.attributes.position
    const data = positionAttr.array

    for (let i = 0; i < count; i += 1) {
      const index = i * 3
      data[index] += Math.sin((data[index + 1] + data[index + 2]) * 0.02) * 0.05
      data[index + 1] -= speeds[i] * delta * 12
      data[index + 2] += Math.cos((data[index] + data[index + 1]) * 0.02) * 0.05

      if (data[index + 1] < 2) {
        data[index] = (Math.random() - 0.5) * area
        data[index + 1] = height + Math.random() * 15
        data[index + 2] = (Math.random() - 0.5) * area
      }
    }

    positionAttr.needsUpdate = true
  })

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={count} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={0.6}
        color="#ffffff"
        sizeAttenuation
        transparent
        opacity={0.75}
        depthWrite={false}
      />
    </points>
  )
}
