import { useRef, useMemo, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useQuestStore } from '../store/questStore'
import { useNotificationStore } from '../store/notificationStore'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'

// Monad colors: purple/blue gradient
const MONAD_COLORS = {
  primary: '#8b5cf6', // Purple
  secondary: '#3b82f6', // Blue
  accent: '#a78bfa', // Light purple
}

export default function MonadLandmark({ position = [0, 0, 0] }) {
  const groupRef = useRef()
  const beaconRef = useRef()
  const particlesRef = useRef()
  const logo3DRef = useRef()
  const timeRef = useRef(0)
  const [discovered, setDiscovered] = useState(false)
  const monadDiscovered = useQuestStore((state) => state.monadDiscovered)
  const { addNotification } = useNotificationStore()

  // Load Monad 3D logo (GLB)
  const monad3DLogo = useGLTF('/images/monad-logo.glb')
  
  // Load Tower 3D model (GLB) - nếu có file
  const tower3DModel = useGLTF('/images/tower.glb')

  // Try to load Monad 2D logo texture as fallback
  const [logoTexture, setLogoTexture] = useState(null)
  
  useEffect(() => {
    const loader = new THREE.TextureLoader()
    
    // Load logo
    loader.load(
      '/images/monad-logo.png',
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        setLogoTexture(tex)
      },
      undefined,
      () => {
        setLogoTexture(null)
      }
    )
  }, [])

  // Clone 3D logo scene if available
  const logo3DScene = useMemo(() => {
    if (!monad3DLogo?.scene) return null
    const cloned = clone(monad3DLogo.scene)
    cloned.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
        // Make logo glow with Monad colors
        if (child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material]
          mats.forEach((mat) => {
            if (mat) {
              mat.emissive = new THREE.Color(MONAD_COLORS.accent)
              mat.emissiveIntensity = 0.6
              if (mat.metalness !== undefined) {
                mat.metalness = 0.8
                mat.roughness = 0.2
              }
            }
          })
        }
      }
    })
    return cloned
  }, [monad3DLogo])

  // Clone 3D tower model if available
  const tower3DScene = useMemo(() => {
    if (!tower3DModel?.scene) return null
    const cloned = clone(tower3DModel.scene)
    cloned.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
        // Make tower glow slightly
        if (child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material]
          mats.forEach((mat) => {
            if (mat) {
              mat.emissive = new THREE.Color(MONAD_COLORS.primary)
              mat.emissiveIntensity = 0.3
            }
          })
        }
      }
    })
    return cloned
  }, [tower3DModel])

  // Create particle positions for sparkles
  const particlePositions = useMemo(() => {
    const count = 50
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      const radius = 3 + Math.random() * 2
      positions[i * 3] = Math.cos(angle) * radius
      positions[i * 3 + 1] = Math.random() * 4 + 2
      positions[i * 3 + 2] = Math.sin(angle) * radius
    }
    return positions
  }, [])

  // Check proximity to player
  useFrame((_, delta) => {
    timeRef.current += delta

    // Check if player is near Monad landmark
    const playerPos = useQuestStore.getState().playerPosition
    if (playerPos && !discovered && !monadDiscovered) {
      const dx = playerPos.x - position[0]
      const dz = playerPos.z - position[2]
      const distance = Math.sqrt(dx * dx + dz * dz)
      
      if (distance < 5) {
        // Player discovered Monad!
        useQuestStore.getState().discoverMonad()
        setDiscovered(true)
        addNotification({
          type: 'success',
          title: '⭐ Monad Discovered!',
          message: '+200 points! You found the Monad beacon!',
          duration: 5000,
        })
      }
    }

    // Rotate beacon
    if (beaconRef.current) {
      beaconRef.current.rotation.y += delta * 0.3
    }

    // Rotate 3D logo slowly quanh trục Y
    if (logo3DRef.current) {
      logo3DRef.current.rotation.y += delta * 0.5
    }

    // Animate particles
    if (particlesRef.current) {
      const positions = particlesRef.current.geometry.attributes.position
      for (let i = 0; i < 50; i++) {
        const idx = i * 3
        const angle = (i / 50) * Math.PI * 2 + timeRef.current * 0.5
        const radius = 3 + Math.sin(timeRef.current + i) * 1
        positions.array[idx] = Math.cos(angle) * radius
        positions.array[idx + 2] = Math.sin(angle) * radius
        positions.array[idx + 1] = Math.sin(timeRef.current * 2 + i) * 0.5 + 4
      }
      positions.needsUpdate = true
    }

    // Pulse glow
    if (groupRef.current) {
      const glowIntensity = 1.5 + Math.sin(timeRef.current * 2) * 0.5
      groupRef.current.children.forEach((child) => {
        if (child.isPointLight) {
          child.intensity = glowIntensity
        }
      })
    }
  })

  useEffect(() => {
    if (monadDiscovered) {
      setDiscovered(true)
    }
  }, [monadDiscovered])

  return (
    <group ref={groupRef} position={position}>
      {/* Tower 3D Model (GLB) hoặc geometry mặc định - Tăng kích thước */}
      {tower3DScene ? (
        <group ref={beaconRef} position={[0, 0, 0]} scale={[3, 3, 3]}>
          <primitive object={tower3DScene} />
        </group>
      ) : (
        <>
          {/* Base platform - Tăng kích thước */}
          <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <cylinderGeometry args={[3, 3, 0.4, 32]} />
            <meshStandardMaterial
              color={MONAD_COLORS.primary}
              emissive={MONAD_COLORS.primary}
              emissiveIntensity={0.3}
              metalness={0.8}
              roughness={0.2}
            />
          </mesh>

          {/* Central beacon/obelisk - Tăng kích thước và chiều cao */}
          <group ref={beaconRef}>
            <mesh position={[0, 3, 0]} castShadow>
              <cylinderGeometry args={[0.6, 0.9, 6, 16]} />
              <meshStandardMaterial
                color={MONAD_COLORS.secondary}
                emissive={MONAD_COLORS.accent}
                emissiveIntensity={0.6}
                metalness={0.9}
                roughness={0.1}
              />
            </mesh>

            {/* Top crystal - Tăng kích thước */}
            <mesh position={[0, 6.5, 0]} castShadow>
              <octahedronGeometry args={[0.9, 0]} />
              <meshStandardMaterial
                color={MONAD_COLORS.accent}
                emissive={MONAD_COLORS.accent}
                emissiveIntensity={1.2}
                transparent
                opacity={0.9}
                metalness={1.0}
                roughness={0.05}
              />
            </mesh>
          </group>
        </>
      )}

      {/* Monad Logo - 3D ở ngay trên đỉnh tháp, chạm đỉnh */}
      {logo3DScene ? (
        <group ref={logo3DRef} position={[0, tower3DScene ? 7 : 7.2, 0]} scale={[2, 2, 2]}>
          <primitive object={logo3DScene} />
        </group>
      ) : (
        <Billboard position={[0, tower3DScene ? 7 : 7.2, 0]} follow lockX lockZ>
          <mesh>
            <planeGeometry args={[2, 2]} />
            <meshBasicMaterial
              map={logoTexture || new THREE.CanvasTexture(createMonadLogoCanvas())}
              transparent
              opacity={0.9}
              depthWrite={false}
            />
          </mesh>
        </Billboard>
      )}

      {/* Glowing particles/sparkles */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={particlePositions}
            count={50}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.15}
          color={MONAD_COLORS.accent}
          transparent
          opacity={0.8}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Point lights for glow effect */}
      <pointLight position={[0, 4, 0]} intensity={2} distance={10} color={MONAD_COLORS.primary} />
      <pointLight position={[0, 2, 0]} intensity={1.5} distance={8} color={MONAD_COLORS.secondary} />

      {/* Ring of light */}
      <mesh position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.5, 0.1, 16, 32]} />
        <meshStandardMaterial
          color={MONAD_COLORS.accent}
          emissive={MONAD_COLORS.accent}
          emissiveIntensity={1.0}
          transparent
          opacity={0.6}
        />
      </mesh>
    </group>
  )
}

// Fallback: Create simple Monad logo canvas if image not found
function createMonadLogoCanvas() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')

  // Draw simple "M" shape
  ctx.fillStyle = '#8b5cf6'
  ctx.font = 'bold 180px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('M', 128, 128)

  return canvas
}

