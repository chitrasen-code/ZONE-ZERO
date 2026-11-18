import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

interface EnvironmentRigProps {
  shadowsEnabled: boolean;
  isSoftwareGl: boolean;
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  onReady?: () => void;
}

const HORIZON_COLOR = '#a9bfd1';
const SKY_ZENITH_COLOR = '#4e79a7';

export function EnvironmentRig({
  shadowsEnabled,
  isSoftwareGl,
  playerPosRef,
  onReady,
}: EnvironmentRigProps) {
  const { scene, gl, camera } = useThree();
  const sunRef = useRef<THREE.DirectionalLight>(null);

  // Build procedural gradient sky dome so horizon & sky blend seamlessly with fog
  const skyMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(SKY_ZENITH_COLOR) },
        horizonColor: { value: new THREE.Color(HORIZON_COLOR) },
        sunDir: { value: new THREE.Vector3(0.65, 0.48, 0.58).normalize() },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 sunDir;
        varying vec3 vWorldPos;
        void main() {
          vec3 dir = normalize(vWorldPos);
          float h = clamp(dir.y, 0.0, 1.0);
          vec3 col = mix(horizonColor, topColor, pow(h, 0.65));
          float sunDot = max(dot(dir, sunDir), 0.0);
          col += vec3(1.0, 0.88, 0.68) * pow(sunDot, 42.0) * 0.45;
          col += vec3(1.0, 0.94, 0.84) * pow(sunDot, 420.0) * 0.9;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
  }, []);

  useEffect(() => {
    // Generate procedural studio IBL environment map on every device
    const pmremGenerator = new THREE.PMREMGenerator(gl);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    scene.background = new THREE.Color(HORIZON_COLOR);
    scene.fog = new THREE.FogExp2(HORIZON_COLOR, 0.0038);

    if (!isSoftwareGl) {
      gl.compile(scene, camera);
    }

    roomEnv.dispose();
    pmremGenerator.dispose();

    const readyTimer = window.setTimeout(() => {
      onReady?.();
    }, 120);

    return () => {
      window.clearTimeout(readyTimer);
      envTarget.dispose();
      skyMaterial.dispose();
      scene.environment = null;
    };
  }, [gl, scene, camera, isSoftwareGl, onReady, skyMaterial]);

  // Keep directional sun shadow frustum centered near the player for crisp shadows everywhere
  useFrame(() => {
    const sun = sunRef.current;
    if (!sun) return;
    const p = playerPosRef.current;
    sun.position.set(p.x + 65, p.y + 72, p.z + 58);
    sun.target.position.set(p.x, p.y, p.z);
    sun.target.updateMatrixWorld();
  });

  const castShadow = shadowsEnabled && !isSoftwareGl;

  return (
    <>
      {/* Procedural Sky Dome */}
      <mesh renderOrder={-10} frustumCulled={false}>
        <sphereGeometry args={[950, 24, 16]} />
        <primitive object={skyMaterial} attach="material" />
      </mesh>

      {/* Cool sky / warm earth hemisphere fill */}
      <hemisphereLight args={['#b8d4f0', '#4f493b', 0.78]} />

      {/* Warm golden-afternoon tactical key light */}
      <directionalLight
        ref={sunRef}
        color="#fff1d6"
        intensity={2.35}
        position={[65, 82, 58]}
        castShadow={castShadow}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={10}
        shadow-camera-far={210}
        shadow-camera-left={-55}
        shadow-camera-right={55}
        shadow-camera-top={55}
        shadow-camera-bottom={-55}
        shadow-bias={-0.0005}
        shadow-normalBias={0.025}
      />

      {/* Cool backlight rim to separate silhouette */}
      <directionalLight color="#9ec3e6" intensity={0.55} position={[-75, 38, -80]} />
    </>
  );
}
