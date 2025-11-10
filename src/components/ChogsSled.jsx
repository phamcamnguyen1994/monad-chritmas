import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useBox } from '@react-three/cannon'
import { useKeyboardControls } from '@react-three/drei'
import * as THREE from 'three'

const forwardVector = new THREE.Vector3()
const sideVector = new THREE.Vector3()
const dampingForce = new THREE.Vector3()
const tempVec = new THREE.Vector3()
const upVector = new THREE.Vector3(0, 1, 0)
const quat = new THREE.Quaternion()
const euler = new THREE.Euler()

const ChogsSled = forwardRef(function ChogsSled(
  {
    position = [0, 8, 0],
    enabled = true,
    acceleration = 40,
    downhillAssist = 18,
    turnStrength = 18,
    brakeStrength = 24,
    maxSpeed = 28,
    driftDamping = 0.12,
    onVelocityChange,
    ...props
  },
  ref
) {
  const [, getKeys] = useKeyboardControls()
  const velocityRef = useRef(new THREE.Vector3())

  const [physicsRef, api] = useBox(
    () => ({
      args: [1.1, 0.5, 2.2],
      mass: 4.5,
      position,
      angularDamping: 0.8,
      linearDamping: driftDamping,
      material: 'sled',
      allowSleep: false,
      ...props,
    }),
    undefined,
    [position, driftDamping]
  )

  const objectRef = useRef(null)
  const setCombinedRef = useCallback(
    (value) => {
      physicsRef(value)
      objectRef.current = value
    },
    [physicsRef]
  )

  useEffect(
    () =>
      api.velocity.subscribe((velocity) => {
        velocityRef.current.fromArray(velocity)
        if (typeof onVelocityChange === 'function') {
          onVelocityChange(velocity)
        }
      }),
    [api.velocity, onVelocityChange]
  )

  useImperativeHandle(ref, () => ({
    object: objectRef.current,
    api,
  }))

  useFrame((state, delta) => {
    const sled = objectRef.current
    if (!sled || delta <= 0) return

    if (!enabled) {
      api.angularVelocity.set(0, 0, 0)
      api.velocity.set(0, 0, 0)
      return
    }

    const input = getKeys()
    const forward = Number(input.forward) - Number(input.backward)
    const steer = Number(input.right) - Number(input.left)
    const braking = input.brake

    const velocity = velocityRef.current
    const horizontalSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z)

    sled.getWorldQuaternion(quat)
    forwardVector.set(0, 0, -1).applyQuaternion(quat).normalize()
    sideVector.set(1, 0, 0).applyQuaternion(quat).normalize()

    if (forward > 0) {
      tempVec.copy(forwardVector).multiplyScalar(acceleration * delta)
      api.applyImpulse(tempVec.toArray(), [0, 0, 0])
    }

    if (forward < 0) {
      tempVec.copy(forwardVector).multiplyScalar(-acceleration * 0.5 * delta)
      api.applyImpulse(tempVec.toArray(), [0, 0, 0])
    }

    if (braking || forward < 0) {
      dampingForce.copy(velocity).multiplyScalar(-brakeStrength * delta)
      api.applyImpulse(dampingForce.toArray(), [0, 0, 0])
    }

    if (horizontalSpeed < maxSpeed) {
      const upAxis = upVector.clone().applyQuaternion(quat)
      const slopeFactor = THREE.MathUtils.clamp(1 - upAxis.y, 0, 1)
      if (slopeFactor > 0.01) {
        tempVec.copy(forwardVector).multiplyScalar(slopeFactor * downhillAssist * delta)
        api.applyForce(tempVec.toArray(), [0, 0, 0])
      }
    }

    if (steer !== 0) {
      const steerTorque = steer * turnStrength * (1 + Math.min(horizontalSpeed / 12, 1.8))
      api.applyTorque([0, steerTorque, 0])
    }

    if (horizontalSpeed > 0.5) {
      const lateralSpeed = sideVector.dot(velocity)
      if (Math.abs(lateralSpeed) > 0.01) {
        tempVec.copy(sideVector).multiplyScalar(lateralSpeed * -driftDamping)
        api.applyImpulse(tempVec.toArray(), [0, 0, 0])
      }
    }

    if (horizontalSpeed > maxSpeed) {
      const clampFactor = 1 - maxSpeed / horizontalSpeed
      dampingForce.set(velocity.x, 0, velocity.z).multiplyScalar(-clampFactor * 0.6)
      api.applyImpulse(dampingForce.toArray(), [0, 0, 0])
    }

    const targetYaw = Math.atan2(-velocity.x, -velocity.z)
    if (Number.isFinite(targetYaw) && horizontalSpeed > 1.2) {
      euler.setFromQuaternion(quat, 'YXZ')
      let yaw = euler.y
      let deltaYaw = targetYaw - yaw
      deltaYaw = ((deltaYaw + Math.PI) % (Math.PI * 2)) - Math.PI
      const torque = THREE.MathUtils.clamp(deltaYaw * 12, -12, 12)
      api.applyTorque([0, torque, 0])
    }
  })

  return (
    <group ref={setCombinedRef} castShadow>
      <mesh position={[0, -0.08, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.26, 2.2]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.35} metalness={0.28} />
      </mesh>

      <group position={[0, -0.18, 0]}>
        <mesh position={[0, 0, 0.56]}
          castShadow
          receiveShadow
        >
          <cylinderGeometry args={[0.09, 0.09, 2.2, 14]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.4} metalness={0.6} />
        </mesh>
        <mesh position={[0, 0, -0.56]} castShadow receiveShadow>
          <cylinderGeometry args={[0.09, 0.09, 2.2, 14]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.4} metalness={0.6} />
        </mesh>
      </group>

      <mesh position={[0, 0.46, -0.82]} rotation={[Math.PI / 1.9, 0, 0]} castShadow>
        <torusGeometry args={[0.42, 0.06, 16, 28]} />
        <meshStandardMaterial color="#1f2937" roughness={0.7} metalness={0.2} />
      </mesh>

      <mesh position={[0, 0.38, 0]} castShadow>
        <boxGeometry args={[0.6, 0.18, 1.2]} />
        <meshStandardMaterial color="#0f172a" roughness={0.6} metalness={0.18} />
      </mesh>

      <group position={[0, 0.65, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.42, 24, 18]} />
          <meshStandardMaterial color="#f97316" emissive="#fb923c" emissiveIntensity={0.25} roughness={0.45} metalness={0.18} />
        </mesh>
        <mesh position={[0, 0.52, 0]} castShadow>
          <sphereGeometry args={[0.32, 22, 16]} />
          <meshStandardMaterial color="#1e293b" roughness={0.45} metalness={0.2} />
        </mesh>
      </group>
    </group>
  )
})

export default ChogsSled
