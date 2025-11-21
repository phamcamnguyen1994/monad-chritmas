import { useMemo } from 'react'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useGLTF } from '@react-three/drei'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'

const BOX_SIZE = 1.1

// Tự động lấy tất cả các file GLB có tên bắt đầu bằng "gift" trong public/models
// Ví dụ: gift1.glb, gift2.glb, gift-big.glb,...
const giftModules = import.meta.glob('../public/models/gift*.glb', {
  eager: true,
  as: 'url',
})
const GIFT_VARIANTS = Object.values(giftModules)

export default function GiftBox({ dapp, position, renderVisual, collected, onActivate }) {
  const hasVariants = GIFT_VARIANTS.length > 0
  // Sử dụng dapp.id để đảm bảo mỗi DApp có gift variant cố định và phân bố đều
  const variantIndex = useMemo(() => {
    if (!hasVariants) return 0
    // Hash dapp.id thành một số và map vào range của variants
    let hash = 0
    for (let i = 0; i < dapp.id.length; i++) {
      hash = ((hash << 5) - hash) + dapp.id.charCodeAt(i)
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash) % GIFT_VARIANTS.length
  }, [hasVariants, dapp.id])

  const modelPath = hasVariants ? GIFT_VARIANTS[variantIndex] : '/models/gift1.glb'
  const model = useGLTF(modelPath)
  const scene = useMemo(() => {
    if (renderVisual) return null
    const cloned = clone(model.scene)
    cloned.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
        if (Array.isArray(child.material)) {
          child.material = child.material.map((mat) => {
            if (!mat) return mat
            const clonedMat = mat.clone()
            // Giữ nguyên tone mapping và color space để màu không bị thay đổi
            if (clonedMat.toneMapped !== undefined) clonedMat.toneMapped = true
            return clonedMat
          })
        } else if (child.material) {
          const clonedMat = child.material.clone()
          // Giữ nguyên tone mapping và color space để màu không bị thay đổi
          if (clonedMat.toneMapped !== undefined) clonedMat.toneMapped = true
          child.material = clonedMat
        }
      }
    })
    return cloned
  }, [model, variantIndex, renderVisual])

  if (collected && !renderVisual) return null

  return (
    <RigidBody type="fixed" position={position} colliders={false}>
      <CuboidCollider
        args={[BOX_SIZE * 0.55, BOX_SIZE * 0.55, BOX_SIZE * 0.55]}
        sensor
        onIntersectionEnter={() => {
          if (collected) return
          onActivate?.(dapp)
        }}
      />
      {renderVisual ? renderVisual({ collected: !!collected }) : <primitive object={scene} />}
    </RigidBody>
  )
}

GIFT_VARIANTS.forEach((path) => {
  useGLTF.preload(path)
})

