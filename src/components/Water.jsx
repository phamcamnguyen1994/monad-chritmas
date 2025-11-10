import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { extend, useFrame } from '@react-three/fiber'
import { shaderMaterial } from '@react-three/drei'

const WaterMaterial = shaderMaterial(
  {
    uTime: 0,
    uWaveHeight: 0.76,
    uWaveScale: 0.19,
    uWaveSpeed: 0.5,
    uColorDeep: new THREE.Color('#032e66'),
    uColorShallow: new THREE.Color('#1a9bff'),
    uSunDirection: new THREE.Vector3(0.45, 1.3, 0.18).normalize(),
    uFoamThreshold: 0.34,
  },
  /* glsl */ `
    precision highp float;

    uniform float uTime;
    uniform float uWaveHeight;
    uniform float uWaveScale;
    uniform float uWaveSpeed;

    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying float vElevation;

    vec3 computeNormal(vec2 position, float time) {
      float waveA = sin((position.x + time * uWaveSpeed) * uWaveScale);
      float waveB = cos((position.y - time * uWaveSpeed * 1.3) * uWaveScale * 0.8);
      float waveC = sin((position.x * 0.6 - time * uWaveSpeed * 0.7) * uWaveScale * 1.7);

      float dHdX = uWaveHeight * (
        cos((position.x + time * uWaveSpeed) * uWaveScale) * uWaveScale +
        cos((position.x * 0.6 - time * uWaveSpeed * 0.7) * uWaveScale * 1.7) * uWaveScale * 1.7 * 0.6
      );

      float dHdY = uWaveHeight * (
        -sin((position.y - time * uWaveSpeed * 1.3) * uWaveScale * 0.8) * uWaveScale * 0.8 +
        cos((position.y * 0.75 + time * uWaveSpeed * 0.5) * uWaveScale * 1.2) * uWaveScale * 1.2 * 0.75
      );

      vec3 tangentX = normalize(vec3(1.0, 0.0, dHdX));
      vec3 tangentY = normalize(vec3(0.0, 1.0, dHdY));
      return normalize(cross(tangentY, tangentX));
    }

    void main() {
      vec3 pos = position;

      float waveA = sin((position.x + uTime * uWaveSpeed) * uWaveScale);
      float waveB = cos((position.y - uTime * uWaveSpeed * 1.3) * uWaveScale * 0.8);
      float waveC = sin((position.x * 0.6 - uTime * uWaveSpeed * 0.7) * uWaveScale * 1.7);
      float waveD = cos((position.y * 0.75 + uTime * uWaveSpeed * 0.5) * uWaveScale * 1.2);
      float elevation = (waveA + waveB + waveC + waveD) * 0.25 * uWaveHeight;

      pos.z += elevation;

      vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
      vWorldPosition = worldPosition.xyz;
      vElevation = elevation;

      vec3 localNormal = computeNormal(position.xy, uTime);
      vNormal = normalize(normalMatrix * localNormal);

      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,
  /* glsl */ `
    precision highp float;

    uniform vec3 uColorDeep;
    uniform vec3 uColorShallow;
    uniform vec3 uSunDirection;
    uniform float uFoamThreshold;

    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying float vElevation;

    void main() {
      vec3 normal = normalize(vNormal);
      vec3 sunDir = normalize(uSunDirection);
      vec3 viewDir = normalize(cameraPosition - vWorldPosition);

      float diffuse = max(dot(normal, sunDir), 0.0);
      vec3 halfway = normalize(sunDir + viewDir);
      float specular = pow(max(dot(normal, halfway), 0.0), 32.0);

      float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.0);
      float foam = smoothstep(uFoamThreshold - 0.05, uFoamThreshold + 0.05, abs(vElevation));

      float colorMix = clamp((vElevation * 1.8) + 0.45, 0.0, 1.0);
      vec3 baseColor = mix(uColorDeep, uColorShallow, colorMix);

      vec3 lighting = baseColor * (0.4 + 0.75 * diffuse) + vec3(0.8, 0.95, 1.0) * specular * 0.85;
      vec3 foamColor = mix(vec3(0.96, 1.0, 1.0), vec3(0.78, 0.92, 1.0), 0.35);

      vec3 finalColor = mix(lighting, foamColor, foam * 0.55 + fresnel * 0.22);
      finalColor += fresnel * 0.7;

      gl_FragColor = vec4(finalColor, 0.92);
    }
  `
)

extend({ WaterMaterial })

export default function Water({
  size = 400,
  resolution = 256,
  position = [0, 0, 0],
  materialConfig = {},
}) {
  const materialRef = useRef(null)

  const geometryArgs = useMemo(() => [size, size, resolution, resolution], [size, size, resolution, resolution])

  useFrame((_, delta) => {
    if (materialRef.current) {
      materialRef.current.uTime += delta
    }
  })

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={position} receiveShadow>
      <planeGeometry args={geometryArgs} />
      <waterMaterial ref={materialRef} transparent {...materialConfig} />
    </mesh>
  )
}


