import { useEffect, useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { useQuestStore } from '../store/questStore'

// Di chuyển đơn giản - không dùng vật lý
const MOVE_SPEED = 16
const TURN_SPEED = 2.5
// Model gốc quay mặt về phía camera → ta xoay nội bộ 180° để sau offset,
// khi yaw = 0 thì mặt nhân vật nhìn theo trục -Z (hướng "forward" chuẩn của game).
const MODEL_YAW_OFFSET = Math.PI
const SLED_MODEL_PATH = '/models/chog-sled.glb'

const keyStates = {
  w: false,
  s: false,
  a: false,
  d: false,
  shift: false,
}

// Export keyStates để camera có thể truy cập
if (typeof window !== 'undefined') {
  window.__keyStates = keyStates
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase()
    if (key === 'w' || key === 's' || key === 'a' || key === 'd') {
      keyStates[key] = true
    }
    if (event.key === 'Shift') {
      keyStates.shift = true
    }
  })
  window.addEventListener('keyup', (event) => {
    const key = event.key.toLowerCase()
    if (key === 'w' || key === 's' || key === 'a' || key === 'd') {
      keyStates[key] = false
    }
    if (event.key === 'Shift') {
      keyStates.shift = false
    }
  })
}

export default function ChogsSled({ onReady, getGroundHeight, orientationRef }) {
  const groupRef = useRef()
  const addDistance = useQuestStore((state) => state.addDistance)
  const prevPositionRef = useRef(new THREE.Vector3(0, 0, 0))
  const sledModel = useGLTF(SLED_MODEL_PATH)
  const positionRef = useRef(new THREE.Vector3(0, 0, 0))
  const sledScene = useMemo(() => {
    const enhanceMaterial = (material) => {
      if (!material) return material
      const clonedMaterial = material.clone()
      if (clonedMaterial.color) clonedMaterial.color = new THREE.Color('#fdf6ba')
      // Bỏ hiệu ứng sáng (emissive)
      if (clonedMaterial.emissive) clonedMaterial.emissive = new THREE.Color('#000000')
      if (typeof clonedMaterial.emissiveIntensity === 'number') clonedMaterial.emissiveIntensity = 0
      return clonedMaterial
    }

    const cloned = clone(sledModel.scene)
    cloned.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
        if (Array.isArray(child.material)) {
          child.material = child.material.map((mat) => enhanceMaterial(mat))
        } else if (child.material) {
          child.material = enhanceMaterial(child.material)
        }
      }
    })
    return cloned
  }, [sledModel])

  useEffect(() => {
    if (!groupRef.current) return
    // Khởi tạo vị trí
    if (typeof getGroundHeight === 'function') {
      const groundHeight = getGroundHeight(0, 0)
      if (groundHeight != null) {
        positionRef.current.y = groundHeight + 0.75
        groupRef.current.position.y = positionRef.current.y
      }
    }
    prevPositionRef.current.copy(positionRef.current)
    // Expose object để camera có thể truy cập - update mỗi frame
    const updateSledObject = () => {
      if (!groupRef.current || !orientationRef?.current) return
      const yaw = orientationRef.current.yaw
      const sledObject = {
        position: positionRef.current,
        quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)),
      }
      onReady?.(sledObject)
    }
    updateSledObject()
  }, [onReady, getGroundHeight, orientationRef])

  const lastLogTime = useRef(0)


  useFrame((_, delta) => {
    if (!groupRef.current) return

    // Kiểm tra orientationRef có tồn tại không
    if (!orientationRef?.current) {
      console.warn('[ChogsSled] orientationRef not available')
      return
    }

    // Di chuyển đơn giản: W/A/D di chuyển theo hướng camera
    const activeBuffs = useQuestStore.getState().activeBuffs
    const speedBuffActive = activeBuffs.speed > Date.now()
    const baseSpeed = keyStates.shift ? MOVE_SPEED * 1.5 : MOVE_SPEED
    const speed = speedBuffActive ? baseSpeed * 1.5 : baseSpeed

    // Lấy yaw từ orientationRef (hướng camera được điều khiển bằng chuột)
    const cameraYaw = orientationRef.current.yaw

    // Tính forward và right vectors từ camera yaw
    // Forward: hướng camera đang nhìn (theo yaw)
    // Lưu ý: Trong Three.js, forward thường là -Z.
    // Với yaw = 0 (nhìn về -Z), sin(0)=0, cos(0)=1 => forwardX=0, forwardZ=-1 (Đúng)
    // Với yaw = 90 (nhìn về -X), sin(90)=1, cos(90)=0 => forwardX=-1, forwardZ=0 (Đúng)
    const forwardX = -Math.sin(cameraYaw)
    const forwardZ = -Math.cos(cameraYaw)
    // Right: hướng bên phải của camera
    // Với yaw = 0, right vector là +X. cos(0)=1, sin(0)=0 => rightX=1, rightZ=0 (Đúng)
    const rightX = Math.cos(cameraYaw)
    const rightZ = -Math.sin(cameraYaw)

    // Tính hướng di chuyển từ các phím
    let moveDirectionX = 0
    let moveDirectionZ = 0

    if (keyStates.w) {
      // W: đi về phía trước (theo hướng camera đang nhìn)
      moveDirectionX += forwardX
      moveDirectionZ += forwardZ
    }
    if (keyStates.s) {
      // S: lùi lại (ngược hướng camera)
      moveDirectionX -= forwardX
      moveDirectionZ -= forwardZ
    }
    if (keyStates.a) {
      // A: đi sang trái (theo hướng camera)
      moveDirectionX -= rightX
      moveDirectionZ -= rightZ
    }
    if (keyStates.d) {
      // D: đi sang phải (theo hướng camera)
      moveDirectionX += rightX
      moveDirectionZ += rightZ
    }

    const hasMovement = moveDirectionX !== 0 || moveDirectionZ !== 0

    // ROTATION LOGIC: Dùng Quaternion để xoay mượt mà
    if (hasMovement) {
      // Hướng mong muốn của nhân vật = hướng vector di chuyển (world yaw)
      const targetAngle = Math.atan2(moveDirectionX, -moveDirectionZ)
      const targetQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, targetAngle, 0))

      // Xoay từ từ về hướng đích
      const rotateStep = TURN_SPEED * delta
      groupRef.current.quaternion.rotateTowards(targetQuaternion, rotateStep)
    }

    // Áp dụng di chuyển
    if (hasMovement) {
      const moveLength = Math.sqrt(moveDirectionX * moveDirectionX + moveDirectionZ * moveDirectionZ)
      const normalizedX = moveDirectionX / moveLength
      const normalizedZ = moveDirectionZ / moveLength
      positionRef.current.x += normalizedX * speed * delta
      positionRef.current.z += normalizedZ * speed * delta
    }

    // Giữ nhân vật trên mặt đất
    if (typeof getGroundHeight === 'function') {
      const groundHeight = getGroundHeight(positionRef.current.x, positionRef.current.z)
      if (groundHeight != null) {
        positionRef.current.y = groundHeight + 0.75
      }
    }

    // Cập nhật vị trí của group (rotation đã được cập nhật trực tiếp vào quaternion ở trên)
    groupRef.current.position.copy(positionRef.current)

    // Cập nhật sledObject để camera có thể truy cập
    const sledObject = {
      position: positionRef.current,
      quaternion: groupRef.current.quaternion.clone(),
    }
    if (onReady) {
      onReady(sledObject)
    }

    // Tính quãng đường di chuyển
    const traveled = positionRef.current.distanceTo(prevPositionRef.current)
    if (traveled > 0.01) {
      addDistance(traveled)
      prevPositionRef.current.copy(positionRef.current)
    }
  })

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Xoay nội bộ model 180° để mặt quay đúng cùng hướng di chuyển */}
      <group rotation={[0, MODEL_YAW_OFFSET, 0]}>
        <primitive object={sledScene} />
      </group>
    </group>
  )
}

useGLTF.preload(SLED_MODEL_PATH)
