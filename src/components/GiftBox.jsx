import { useMemo, useState } from 'react'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useGLTF } from '@react-three/drei'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { useQuestStore } from '../store/questStore'
import { playGiftChime } from './AmbientAudio.jsx'

const BOX_SIZE = 1.1
const GIFT_VARIANTS = [
  '/models/gift1.glb',
  '/models/gift2.glb',
  '/models/gift3.glb',
  '/models/gift4.glb',
]

export default function GiftBox({ dapp, position }) {
  const [collected, setCollected] = useState(false)
  const collectDapp = useQuestStore((state) => state.collectDapp)
  const variantIndex = useMemo(() => Math.floor(Math.random() * GIFT_VARIANTS.length), [])
  const gift1 = useGLTF(GIFT_VARIANTS[0])
  const gift2 = useGLTF(GIFT_VARIANTS[1])
  const gift3 = useGLTF(GIFT_VARIANTS[2])
  const gift4 = useGLTF(GIFT_VARIANTS[3])
  const giftScenes = useMemo(() => [gift1, gift2, gift3, gift4], [gift1, gift2, gift3, gift4])
  const model = giftScenes[variantIndex]
  const scene = useMemo(() => {
    const cloned = clone(model.scene)
    cloned.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
        if (Array.isArray(child.material)) {
          child.material = child.material.map((mat) => (mat ? mat.clone() : mat))
        } else if (child.material) {
          child.material = child.material.clone()
        }
      }
    })
    return cloned
  }, [model, variantIndex])

  if (collected) return null

  return (
    <RigidBody type="fixed" position={position} colliders={false}>
      <CuboidCollider
        args={[BOX_SIZE * 0.55, BOX_SIZE * 0.55, BOX_SIZE * 0.55]}
        sensor
        onIntersectionEnter={() => {
          collectDapp(dapp.id, dapp.category)
          setCollected(true)
          playGiftChime()
        }}
      />
      <primitive object={scene} />
    </RigidBody>
  )
}

GIFT_VARIANTS.forEach((path) => {
  useGLTF.preload(path)
})

