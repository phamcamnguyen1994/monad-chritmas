import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { MathUtils } from 'three'

const InputContext =
  globalThis.__SLED_INPUT_CONTEXT__ ??
  (globalThis.__SLED_INPUT_CONTEXT__ = createContext(null))

const MIN_DISTANCE = 2.5
const MAX_DISTANCE = 6.0
const DEFAULT_DISTANCE = 3.6
const SHOULDER_OFFSET = 0.45
const YAW_SENSITIVITY = 0.24
const PITCH_SENSITIVITY = 0.17
const PITCH_MIN = MathUtils.degToRad(-50)
const PITCH_MAX = MathUtils.degToRad(60)
const AUTO_CENTER_DELAY = 2200
const DRAG_DEADZONE = 0.002
const TOUCH_DEADZONE = 2
const GAMEPAD_DEADZONE = 0.2
const GAMEPAD_YAW_SPEED = MathUtils.degToRad(240)
const GAMEPAD_PITCH_SPEED = MathUtils.degToRad(180)

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function wrapAngle(radians) {
  return MathUtils.euclideanModulo(radians + Math.PI, Math.PI * 2) - Math.PI
}

export function SledInputProvider({ children }) {
  const orientationRef = useRef({
    yaw: 0,
    pitch: MathUtils.degToRad(-6),
  })
  const lastInputTimeRef = useRef(performance.now())
  const [distance, setDistance] = useState(DEFAULT_DISTANCE)
  const [shoulderSide, setShoulderSide] = useState(1)
  const [pointerLockActive, setPointerLockActive] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const pointerLockSupported = typeof document !== 'undefined' && 'pointerLockElement' in document

  useEffect(() => {
    console.log('[SledInput] provider ready', {
      pointerLockSupported,
    })
  }, [pointerLockSupported])
  const dragStateRef = useRef({
    active: false,
    pointerId: null,
    isTouch: false,
    lastX: 0,
    lastY: 0,
    secondPointerId: null,
    initialPinchDistance: null,
  })
  const activeTouchesRef = useRef(new Map())
  const pointerLockElementRef = useRef(null)
  const gamepadPrevButtonsRef = useRef({ left: false, right: false })

  const markInput = useCallback(() => {
    lastInputTimeRef.current = performance.now()
  }, [])

  const rotateBy = useCallback(
    (deltaYaw, deltaPitch) => {
      if (!Number.isFinite(deltaYaw) || !Number.isFinite(deltaPitch)) return
      const orientation = orientationRef.current
      orientation.yaw = wrapAngle(orientation.yaw - deltaYaw)
      orientation.pitch = clamp(orientation.pitch - deltaPitch, PITCH_MIN, PITCH_MAX)
      markInput()
    },
    [markInput]
  )

  const applyPointerDelta = useCallback(
    (dx, dy, source = 'pointer') => {
      if (!dx && !dy) return
      if (source === 'mouse') return
      rotateBy(dx * YAW_SENSITIVITY, dy * PITCH_SENSITIVITY)
    },
    [rotateBy]
  )

  const requestPointerLock = useCallback((element) => {
    if (!element || typeof element.requestPointerLock !== 'function') return
    pointerLockElementRef.current = element
    element.requestPointerLock()
  }, [])

  const exitPointerLock = useCallback(() => {
    if (document.exitPointerLock) {
      document.exitPointerLock()
    }
  }, [])

  useEffect(() => {
    const handlePointerLockChange = () => {
      const locked = document.pointerLockElement === pointerLockElementRef.current
      setPointerLockActive(locked)
      if (!locked) {
        setIsDragging(false)
      }
    }
    const handlePointerLockError = () => {
      setPointerLockActive(false)
    }
    document.addEventListener('pointerlockchange', handlePointerLockChange)
    document.addEventListener('pointerlockerror', handlePointerLockError)
    return () => {
      document.removeEventListener('pointerlockchange', handlePointerLockChange)
      document.removeEventListener('pointerlockerror', handlePointerLockError)
    }
  }, [])

  useEffect(() => {
    if (!pointerLockActive) return
    const handleMouseMove = () => {}
    const handleMouseDown = (event) => {
      if (event.button === 1 || event.button === 2) {
        event.preventDefault()
      }
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mousedown', handleMouseDown)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [pointerLockActive, applyPointerDelta])

  const updateDragPosition = useCallback(
    (event) => {
      const dragState = dragStateRef.current
      if (!dragState.active || (dragState.isTouch && !activeTouchesRef.current.has(event.pointerId))) {
        return
      }

      if (!dragState.isTouch) {
        dragState.lastX = event.clientX
        dragState.lastY = event.clientY
        return
      }

      // Touch handling
      activeTouchesRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (activeTouchesRef.current.size === 1) {
        const previous = dragState.lastTouch ?? { x: event.clientX, y: event.clientY }
        const dx = event.clientX - previous.x
        const dy = event.clientY - previous.y
        dragState.lastTouch = { x: event.clientX, y: event.clientY }
        if (Math.abs(dx) > TOUCH_DEADZONE || Math.abs(dy) > TOUCH_DEADZONE) {
          applyPointerDelta(dx * 0.4, dy * 0.4, 'touch')
        }
      } else if (activeTouchesRef.current.size === 2) {
        const touches = Array.from(activeTouchesRef.current.values())
        const dx = ((touches[0].x + touches[1].x) / 2 - (dragState.lastTouch?.x ?? (touches[0].x + touches[1].x) / 2))
        const dy = ((touches[0].y + touches[1].y) / 2 - (dragState.lastTouch?.y ?? (touches[0].y + touches[1].y) / 2))
        dragState.lastTouch = { x: (touches[0].x + touches[1].x) / 2, y: (touches[0].y + touches[1].y) / 2 }
        if (Math.abs(dx) > TOUCH_DEADZONE || Math.abs(dy) > TOUCH_DEADZONE) {
          applyPointerDelta(dx * 0.35, dy * 0.35, 'touch')
        }
        const currentDistance = Math.hypot(touches[0].x - touches[1].x, touches[0].y - touches[1].y)
        if (dragState.initialPinchDistance != null) {
          const pinchDelta = dragState.initialPinchDistance - currentDistance
          if (Math.abs(pinchDelta) > 2) {
            setDistance((prev) =>
              clamp(prev + pinchDelta * 0.01, MIN_DISTANCE, MAX_DISTANCE)
            )
            dragState.initialPinchDistance = currentDistance
          }
        } else {
          dragState.initialPinchDistance = currentDistance
        }
      }
    },
    [applyPointerDelta]
  )

  const endDrag = useCallback(() => {
    dragStateRef.current = {
      active: false,
      pointerId: null,
      isTouch: false,
      lastX: 0,
      lastY: 0,
      secondPointerId: null,
      initialPinchDistance: null,
      lastTouch: null,
    }
    activeTouchesRef.current.clear()
    setIsDragging(false)
  }, [])

  const handlePointerDown = useCallback(
    (event) => {
      if (pointerLockActive) return
      if (event.pointerType === 'mouse') {
        if (event.button === 2 || event.button === 1 || event.button === 0) {
          dragStateRef.current = {
            active: true,
            pointerId: event.pointerId,
            isTouch: false,
            lastX: event.clientX,
            lastY: event.clientY,
          }
          event.currentTarget?.setPointerCapture?.(event.pointerId)
          setIsDragging(true)
          event.preventDefault()
        }
      } else if (event.pointerType === 'touch') {
        activeTouchesRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
        dragStateRef.current = {
          ...dragStateRef.current,
          active: true,
          pointerId: dragStateRef.current.pointerId ?? event.pointerId,
          isTouch: true,
          lastTouch: { x: event.clientX, y: event.clientY },
        }
        if (activeTouchesRef.current.size === 2) {
          const touches = Array.from(activeTouchesRef.current.values())
          dragStateRef.current.initialPinchDistance = Math.hypot(
            touches[0].x - touches[1].x,
            touches[0].y - touches[1].y
          )
        }
        setIsDragging(true)
      }
    },
    [pointerLockActive]
  )

  const handlePointerMove = useCallback(
    (event) => {
      if (pointerLockActive) return
      updateDragPosition(event)
    },
    [pointerLockActive, updateDragPosition]
  )

  const handlePointerUp = useCallback(
    (event) => {
      if (dragStateRef.current.active) {
        if (event.pointerType === 'touch') {
          activeTouchesRef.current.delete(event.pointerId)
          if (activeTouchesRef.current.size >= 1) {
            dragStateRef.current.pointerId = Array.from(activeTouchesRef.current.keys())[0]
            dragStateRef.current.lastTouch = Array.from(activeTouchesRef.current.values())[0]
            dragStateRef.current.initialPinchDistance = null
            return
          }
        }
        event.currentTarget?.releasePointerCapture?.(event.pointerId)
        endDrag()
      }
    },
    [endDrag]
  )

  const handlePointerLeave = useCallback(
    (event) => {
      if (dragStateRef.current.active && !pointerLockActive) {
        event.currentTarget?.releasePointerCapture?.(event.pointerId)
        endDrag()
      }
    },
    [pointerLockActive, endDrag]
  )

  const handleWheel = useCallback(
    (event) => {
      if (!pointerLockActive && event.cancelable) {
        event.preventDefault()
      }
    },
    [pointerLockActive]
  )

  const toggleShoulderSide = useCallback(() => {
    setShoulderSide((prev) => -prev)
  }, [])

  useEffect(() => {
    let animationFrame
    let lastTime = performance.now()

    const pollGamepad = () => {
      animationFrame = requestAnimationFrame(pollGamepad)
      const pads = navigator.getGamepads ? navigator.getGamepads() : null
      if (!pads) return
      const pad = Array.from(pads).find((p) => p && p.connected)
      const now = performance.now()
      const deltaTime = (now - lastTime) / 1000
      lastTime = now
      if (!pad || deltaTime <= 0) return

      const rx = pad.axes?.[2] ?? 0
      const ry = pad.axes?.[3] ?? 0
      const absRx = Math.abs(rx)
      const absRy = Math.abs(ry)
      if (absRx > GAMEPAD_DEADZONE || absRy > GAMEPAD_DEADZONE) {
        const yawRate = rx * GAMEPAD_YAW_SPEED * deltaTime
        const pitchRate = ry * GAMEPAD_PITCH_SPEED * deltaTime
        rotateBy(yawRate, pitchRate)
      }

      const leftShoulder = pad.buttons?.[4]?.pressed ?? false
      const rightShoulder = pad.buttons?.[5]?.pressed ?? false
      if ((leftShoulder && !gamepadPrevButtonsRef.current.left) || (rightShoulder && !gamepadPrevButtonsRef.current.right)) {
        toggleShoulderSide()
      }
      gamepadPrevButtonsRef.current.left = leftShoulder
      gamepadPrevButtonsRef.current.right = rightShoulder

      const zoomAxis = pad.axes?.[1] ?? 0
      if (Math.abs(zoomAxis) > GAMEPAD_DEADZONE) {
        setDistance((prev) => clamp(prev + zoomAxis * deltaTime * 2, MIN_DISTANCE, MAX_DISTANCE))
      }
    }

    animationFrame = requestAnimationFrame(pollGamepad)
    return () => cancelAnimationFrame(animationFrame)
  }, [rotateBy, toggleShoulderSide])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key.toLowerCase() === 'l') {
        if (pointerLockActive) {
          exitPointerLock()
        } else if (pointerLockElementRef.current) {
          requestPointerLock(pointerLockElementRef.current)
        }
      }
      if (event.key.toLowerCase() === 'q') {
        toggleShoulderSide()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pointerLockActive, exitPointerLock, requestPointerLock, toggleShoulderSide])

  return (
    <InputContext.Provider
      value={{
        orientationRef,
        pointerLockActive,
        pointerLockSupported,
        isDragging,
        distance,
        minDistance: MIN_DISTANCE,
        maxDistance: MAX_DISTANCE,
        shoulderOffset: SHOULDER_OFFSET * shoulderSide,
        autoCenterDelay: AUTO_CENTER_DELAY,
        lastInputTimeRef,
        requestPointerLock,
        exitPointerLock,
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
        handlePointerLeave,
        handleWheel,
        markInput,
      }}
    >
      {children}
    </InputContext.Provider>
  )
}

export function useSledInput() {
  const context = useContext(InputContext)
  if (!context) {
    throw new Error('useSledInput must be used within SledInputProvider')
  }
  return context
}
