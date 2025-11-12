import { useEffect, useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, useRapier } from '@react-three/rapier'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { useQuestStore } from '../store/questStore'

const FWD_FORCE = 26
const KEY_TURN_RATE = 2.2
const KEY_TURN_DAMPING = 9.5
const DOWNHILL_BOOST = 12
const DRAG = 0.99
const MAX_SPEED = 22
const SLED_MODEL_PATH = '/models/chog-sled.glb'

const wrapAngle = (angle) => THREE.MathUtils.euclideanModulo(angle + Math.PI, Math.PI * 2) - Math.PI
const shortestAngleDifference = (target, current) => wrapAngle(target - current)

const keyStates = {
  w: false,
  a: false,
  d: false,
  s: false,
  shift: false,
  turn: 0,
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase()
    if (key in keyStates) {
      keyStates[key] = true
      if (key === 'a') keyStates.turn = 1
      if (key === 'd') keyStates.turn = -1
    }
  })
  window.addEventListener('keyup', (event) => {
    const key = event.key.toLowerCase()
    if (key in keyStates) {
      keyStates[key] = false
      if (key === 'a' && !keyStates.d) keyStates.turn = 0
      if (key === 'd' && !keyStates.a) keyStates.turn = 0
      if (keyStates.a && !keyStates.d) keyStates.turn = 1
      if (keyStates.d && !keyStates.a) keyStates.turn = -1
    }
  })
}

export default function ChogsSled({ onReady, getGroundHeight, orientationRef }) {
  const ref = useRef()
  const hasLoggedRef = useRef(false)
  const orientationWarnedRef = useRef(false)
  const rotationWarnedRef = useRef(false)
  const bodyYawWarnedRef = useRef(false)
  const { world } = useRapier()
  const addDistance = useQuestStore((state) => state.addDistance)
  const prevPositionRef = useRef(new THREE.Vector3())
  const sledModel = useGLTF(SLED_MODEL_PATH)
  const movementForwardRef = useMemo(() => new THREE.Vector3(), [])
  const movementRightRef = useMemo(() => new THREE.Vector3(), [])
  const movementVectorRef = useMemo(() => new THREE.Vector3(), [])
  const sledScene = useMemo(() => {
    const enhanceMaterial = (material) => {
      if (!material) return material
      const clonedMaterial = material.clone()
      if (clonedMaterial.color) clonedMaterial.color = new THREE.Color('#fdf6ba')
      if (clonedMaterial.emissive) clonedMaterial.emissive = new THREE.Color('#fde68a')
      if (typeof clonedMaterial.emissiveIntensity === 'number') clonedMaterial.emissiveIntensity = 0.35
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
    if (!ref.current) return
    ref.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
    ref.current.setAngvel({ x: 0, y: 0, z: 0 }, true)
    const translation = ref.current.translation()
    prevPositionRef.current.set(translation.x, translation.y, translation.z)
    onReady?.(ref.current)
  }, [onReady])

  useFrame((_, delta) => {
    const body = ref.current
    if (!body) return

    if (!hasLoggedRef.current) {
      hasLoggedRef.current = true
    }

    let yaw = 0
    if (orientationRef?.current) {
      if (!Number.isFinite(orientationRef.current.yaw)) {
        if (!orientationWarnedRef.current) {
          console.warn('[ChogsSled] orientation yaw invalid; resetting', orientationRef.current.yaw)
          orientationWarnedRef.current = true
        }
        orientationRef.current.yaw = 0
      } else {
        orientationWarnedRef.current = false
      }
      if (keyStates.turn !== 0) {
        orientationRef.current.yaw = THREE.MathUtils.euclideanModulo(
          orientationRef.current.yaw + keyStates.turn * KEY_TURN_RATE * delta + Math.PI,
          Math.PI * 2
        ) - Math.PI
      } else {
        const rawRotation = body.rotation()
        const rotationInvalid =
          !Number.isFinite(rawRotation?.x) ||
          !Number.isFinite(rawRotation?.y) ||
          !Number.isFinite(rawRotation?.z) ||
          !Number.isFinite(rawRotation?.w)
        if (rotationInvalid) {
          if (!rotationWarnedRef.current) {
            console.warn('[ChogsSled] body rotation invalid; resetting', rawRotation)
            rotationWarnedRef.current = true
          }
          body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true)
        } else {
          rotationWarnedRef.current = false
        }
        const safeRotation = body.rotation()
        let bodyYaw = new THREE.Euler().setFromQuaternion(safeRotation, 'YXZ').y
        if (!Number.isFinite(bodyYaw)) {
          if (!bodyYawWarnedRef.current) {
            console.warn('[ChogsSled] computed bodyYaw invalid; falling back to orientation yaw', {
              safeRotation,
              bodyYaw,
            })
            bodyYawWarnedRef.current = true
          }
          bodyYaw = orientationRef.current.yaw
        } else {
          bodyYawWarnedRef.current = false
        }
        const yawDiff = shortestAngleDifference(bodyYaw, orientationRef.current.yaw)
        const damping = 1 - Math.pow(0.02, delta * KEY_TURN_DAMPING)
        orientationRef.current.yaw = THREE.MathUtils.euclideanModulo(
          orientationRef.current.yaw + yawDiff * damping + Math.PI,
          Math.PI * 2
        ) - Math.PI
      }
      yaw = orientationRef.current.yaw
      const targetQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0, 'YXZ'))
      body.setRotation({ x: targetQuat.x, y: targetQuat.y, z: targetQuat.z, w: targetQuat.w }, true)
    } else {
      const rotation = body.rotation()
      const quat = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w)
      yaw = new THREE.Euler().setFromQuaternion(quat, 'YXZ').y
    }

    movementForwardRef.set(Math.sin(yaw), 0, -Math.cos(yaw)).normalize()
    movementRightRef.set(Math.cos(yaw), 0, Math.sin(yaw)).normalize()

    const movementVector = movementVectorRef.set(0, 0, 0)
    if (keyStates.w) movementVector.add(movementForwardRef)
    if (keyStates.s) movementVector.addScaledVector(movementForwardRef, -1)

    const rotation = body.rotation()
    const bodyQuat = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w)
    const bodyForward = new THREE.Vector3(0, 0, -1).applyQuaternion(bodyQuat).normalize()
    const bodyRight = new THREE.Vector3(1, 0, 0).applyQuaternion(bodyQuat).normalize()

    const linvel = body.linvel()
    let velocity = new THREE.Vector3(linvel.x, linvel.y, linvel.z)
    let horizontalSpeed = Math.sqrt(velocity.x ** 2 + velocity.z ** 2)

    if (movementVector.lengthSq() > 0) {
      movementVector.normalize()
      const boostMultiplier = keyStates.shift ? 1.8 : 1
      movementVector.multiplyScalar(FWD_FORCE * boostMultiplier * delta)
      body.applyImpulse({ x: movementVector.x, y: movementVector.y, z: movementVector.z }, true)
    }

    const translation = body.translation()
    const currentPosition = new THREE.Vector3(translation.x, translation.y, translation.z)
    const traveled = currentPosition.distanceTo(prevPositionRef.current)
    if (traveled > 0.01) {
      addDistance(traveled)
      prevPositionRef.current.copy(currentPosition)
    }

    if (typeof getGroundHeight === 'function') {
      const groundHeight = getGroundHeight(translation.x, translation.z)
      if (groundHeight != null) {
        const targetHeight = groundHeight + 0.75
        const newY = translation.y < targetHeight ? targetHeight : translation.y
        if (translation.y !== newY) {
          body.setTranslation({ x: translation.x, y: newY, z: translation.z }, true)
          const currentVel = body.linvel()
          if (currentVel.y < 0) {
            body.setLinvel({ x: currentVel.x, y: 0, z: currentVel.z }, true)
          }
          prevPositionRef.current.set(translation.x, newY, translation.z)
        }
      }
    }

    if (horizontalSpeed < MAX_SPEED) {
      const ray = world.castRay(
        {
          origin: body.translation(),
          dir: { x: 0, y: -1, z: 0 },
          maxToi: 3,
        },
        true
      )
      if (ray && ray.toi < 1) {
        const downhill = bodyForward.y < -0.15
        if (downhill) {
          const downhillImpulse = bodyForward.clone().setY(0).normalize().multiplyScalar(DOWNHILL_BOOST * delta)
          body.applyImpulse(downhillImpulse, true)
        }
      }
    }

    const updatedLinvel = body.linvel()
    velocity.set(updatedLinvel.x, updatedLinvel.y, updatedLinvel.z)
    horizontalSpeed = Math.sqrt(velocity.x ** 2 + velocity.z ** 2)

    if (keyStates.w) {
      const forwardComponent = bodyForward.dot(velocity)
      if (forwardComponent < 0) {
        const correction = bodyForward.clone().multiplyScalar(-forwardComponent * 0.8)
        body.applyImpulse(correction, true)
        const correctedVel = body.linvel()
        velocity.set(correctedVel.x, correctedVel.y, correctedVel.z)
        horizontalSpeed = Math.sqrt(velocity.x ** 2 + velocity.z ** 2)
      }
    }

    if (keyStates.s) {
      const forwardComponent = bodyForward.dot(velocity)
      if (forwardComponent > 0) {
        const correction = bodyForward.clone().multiplyScalar(-forwardComponent * 0.8)
        body.applyImpulse(correction, true)
        const correctedVel = body.linvel()
        velocity.set(correctedVel.x, correctedVel.y, correctedVel.z)
        horizontalSpeed = Math.sqrt(velocity.x ** 2 + velocity.z ** 2)
      }
    }

    if (horizontalSpeed > MAX_SPEED) {
      const clampFactor = 1 - MAX_SPEED / Math.max(horizontalSpeed, 0.001)
      const clampImpulse = velocity.clone().multiplyScalar(-clampFactor * 0.6)
      body.applyImpulse(clampImpulse, true)
      const clamped = body.linvel()
      velocity.set(clamped.x, clamped.y, clamped.z)
    }

    velocity.multiplyScalar(DRAG)
    body.setLinvel({ x: velocity.x, y: velocity.y, z: velocity.z }, true)

    const lateral = bodyRight.dot(velocity)
    if (Math.abs(lateral) > 0.01) {
      const sidewaysCorrection = bodyRight.clone().multiplyScalar(-lateral * 0.35)
      body.applyImpulse(sidewaysCorrection, true)
    }

    const angvel = body.angvel()
    body.setAngvel({ x: 0, y: angvel.y * 0.6, z: 0 }, true)
  })

  return (
    <RigidBody
      ref={ref}
      position={[0, 6, 0]}
      mass={4}
      colliders="cuboid"
      linearDamping={0.18}
      angularDamping={1.5}
      enabledTranslations={[true, true, true]}
      enabledRotations={[false, true, false]}
    >
      <primitive object={sledScene} />
    </RigidBody>
  )
}

useGLTF.preload(SLED_MODEL_PATH)
