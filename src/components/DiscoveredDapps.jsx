import { memo } from 'react'

function DiscoveredDapps({ dapps, origin = [0, 3, 10] }) {
  if (!dapps?.length) return null

  return (
    <group position={origin}>
      {dapps.map((dapp, index) => (
        <group key={dapp.id} position={[index * 1.8, 0, 0]}>
          <mesh>
            <planeGeometry args={[1.4, 1.8]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0, -1.1, 0]}>
            <planeGeometry args={[1.6, 0.4]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export default memo(DiscoveredDapps)

