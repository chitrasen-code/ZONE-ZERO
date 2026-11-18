import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CAMO_PRESETS, HELMET_PRESETS } from '../../data/gameCatalog';
import { WEAPONS } from '../../data/weapons';
import { CharacterLoadout, WeaponId } from '../../types/game';

export interface OperatorAnimState {
  speedRatio: number;
  isGrounded: boolean;
  isCrouching: boolean;
  isAiming: boolean;
  isReloading: boolean;
  isSkydiving: boolean;
  isParachuting: boolean;
  isMenuPreview: boolean;
  recoilKick: number;
  muzzleFlashTimer: number;
  aimPitch: number;
}

interface OperatorModelProps {
  loadout: CharacterLoadout;
  activeWeaponId: WeaponId;
  animStateRef: React.MutableRefObject<OperatorAnimState>;
  groupRef: React.RefObject<THREE.Group | null>;
  shadowsEnabled: boolean;
  isSoftwareGl: boolean;
}

export function OperatorModel({
  loadout,
  activeWeaponId,
  animStateRef,
  groupRef,
  shadowsEnabled,
  isSoftwareGl,
}: OperatorModelProps) {
  const castShadow = shadowsEnabled && !isSoftwareGl;

  const camo = useMemo(
    () => CAMO_PRESETS.find((c) => c.id === loadout.camo) ?? CAMO_PRESETS[0],
    [loadout.camo],
  );
  const helmet = useMemo(
    () => HELMET_PRESETS.find((h) => h.id === loadout.helmet) ?? HELMET_PRESETS[0],
    [loadout.helmet],
  );
  const weapon = WEAPONS[activeWeaponId] ?? WEAPONS.vx47;

  const bodyRootRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const weaponRigRef = useRef<THREE.Group>(null);
  const muzzleFlashRef = useRef<THREE.Mesh>(null);
  const parachuteRef = useRef<THREE.Group>(null);

  const stridePhaseRef = useRef(0);

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const anim = animStateRef.current;
    const t = state.clock.elapsedTime;

    const crouchFactor = anim.isCrouching ? 1 : 0;
    const speed = anim.speedRatio;

    if (speed > 0.05 && anim.isGrounded) {
      stridePhaseRef.current += dt * (4.5 + speed * 7.2);
    }
    const phase = stridePhaseRef.current;

    if (parachuteRef.current) {
      parachuteRef.current.visible = anim.isParachuting;
      if (anim.isParachuting) {
        parachuteRef.current.rotation.z = Math.sin(t * 2.2) * 0.06;
      }
    }

    if (bodyRootRef.current) {
      const targetY =
        (anim.isCrouching ? -0.34 : 0) +
        (speed > 0.05 && anim.isGrounded ? Math.abs(Math.sin(phase)) * 0.045 * speed : Math.sin(t * 2.1) * 0.01);
      bodyRootRef.current.position.y = THREE.MathUtils.damp(bodyRootRef.current.position.y, targetY, 12, dt);
      const targetDivePitch = anim.isSkydiving ? 0.85 : 0;
      bodyRootRef.current.rotation.x = THREE.MathUtils.damp(bodyRootRef.current.rotation.x, targetDivePitch, 8, dt);
    }

    const legSwing = anim.isGrounded ? Math.sin(phase) * 0.62 * Math.min(1, speed * 1.1) : 0.35;
    if (leftLegRef.current && rightLegRef.current) {
      const targetL = anim.isGrounded ? legSwing - crouchFactor * 0.32 : 0.38;
      const targetR = anim.isGrounded ? -legSwing - crouchFactor * 0.32 : -0.25;
      leftLegRef.current.rotation.x = THREE.MathUtils.damp(leftLegRef.current.rotation.x, targetL, 14, dt);
      rightLegRef.current.rotation.x = THREE.MathUtils.damp(rightLegRef.current.rotation.x, targetR, 14, dt);
    }

    if (torsoRef.current) {
      const targetLean = speed * 0.14 + crouchFactor * 0.16;
      torsoRef.current.rotation.x = THREE.MathUtils.damp(torsoRef.current.rotation.x, targetLean, 10, dt);
      torsoRef.current.rotation.y = THREE.MathUtils.damp(
        torsoRef.current.rotation.y,
        anim.isAiming ? -0.18 : 0,
        12,
        dt,
      );
    }

    if (headRef.current) {
      const headPitch = anim.isMenuPreview
        ? Math.sin(t * 0.9) * 0.05
        : THREE.MathUtils.clamp(anim.aimPitch * 0.35, -0.35, 0.35);
      headRef.current.rotation.x = THREE.MathUtils.damp(headRef.current.rotation.x, headPitch, 12, dt);
    }

    if (rightArmRef.current && leftArmRef.current && weaponRigRef.current) {
      if (anim.isParachuting) {
        rightArmRef.current.rotation.x = THREE.MathUtils.damp(rightArmRef.current.rotation.x, -2.55, 10, dt);
        leftArmRef.current.rotation.x = THREE.MathUtils.damp(leftArmRef.current.rotation.x, -2.55, 10, dt);
        weaponRigRef.current.visible = false;
      } else if (anim.isSkydiving) {
        rightArmRef.current.rotation.x = THREE.MathUtils.damp(rightArmRef.current.rotation.x, -0.4, 10, dt);
        leftArmRef.current.rotation.x = THREE.MathUtils.damp(leftArmRef.current.rotation.x, -0.4, 10, dt);
        weaponRigRef.current.visible = false;
      } else {
        weaponRigRef.current.visible = true;
        const reloadDip = anim.isReloading ? Math.sin(t * 8.5) * 0.25 + 0.45 : 0;
        const aimX = anim.isAiming
          ? -1.35 + anim.aimPitch * 0.65
          : -0.82 + Math.sin(phase) * 0.12 * speed;
        const leftArmX = anim.isReloading
          ? -0.45 + Math.sin(t * 9) * 0.25
          : anim.isAiming
            ? -1.28 + anim.aimPitch * 0.65
            : -0.78 - Math.sin(phase) * 0.1 * speed;

        rightArmRef.current.rotation.x = THREE.MathUtils.damp(
          rightArmRef.current.rotation.x,
          aimX - anim.recoilKick * 2.2 + reloadDip * 0.4,
          18,
          dt,
        );
        leftArmRef.current.rotation.x = THREE.MathUtils.damp(
          leftArmRef.current.rotation.x,
          leftArmX - anim.recoilKick * 1.4,
          18,
          dt,
        );

        weaponRigRef.current.position.z = THREE.MathUtils.damp(
          weaponRigRef.current.position.z,
          0.34 - anim.recoilKick * 0.14,
          24,
          dt,
        );
        weaponRigRef.current.position.y = THREE.MathUtils.damp(
          weaponRigRef.current.position.y,
          anim.isAiming ? 1.38 : 1.18,
          14,
          dt,
        );
        weaponRigRef.current.rotation.x = THREE.MathUtils.damp(
          weaponRigRef.current.rotation.x,
          (anim.isAiming ? anim.aimPitch * 0.75 : 0.12) - anim.recoilKick * 1.1 + reloadDip * 0.6,
          20,
          dt,
        );
        weaponRigRef.current.rotation.z = THREE.MathUtils.damp(
          weaponRigRef.current.rotation.z,
          anim.isReloading ? 0.65 : 0,
          12,
          dt,
        );
      }
    }

    if (muzzleFlashRef.current) {
      const active = anim.muzzleFlashTimer > 0;
      muzzleFlashRef.current.visible = active;
      if (active) {
        muzzleFlashRef.current.rotation.z = t * 47;
        const s = 0.8 + Math.random() * 0.55;
        muzzleFlashRef.current.scale.set(s, s, s);
      }
    }
  });

  const isPistol = activeWeaponId === 'p45';
  const isSniper = activeWeaponId === 'lsr90';
  const isShotgun = activeWeaponId === 'sg12';

  return (
    <group ref={groupRef}>
      {/* Contact shadow disc */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.45, 20]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.34} depthWrite={false} />
      </mesh>

      {/* 3D Tactical Parachute Canopy + Suspension Lines */}
      <group ref={parachuteRef} position={[0, 3.6, 0]} visible={false}>
        <mesh position={[0, 0.5, 0]} rotation={[0, 0, 0]}>
          <sphereGeometry args={[2.3, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.45]} />
          <meshStandardMaterial color="#d97706" roughness={0.7} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.48, 0]}>
          <sphereGeometry args={[2.28, 16, 10, 0, Math.PI, 0, Math.PI * 0.45]} />
          <meshStandardMaterial color="#1f2937" roughness={0.75} side={THREE.DoubleSide} />
        </mesh>
        {[
          [-1.4, -0.5],
          [1.4, -0.5],
          [-1.4, 0.5],
          [1.4, 0.5],
        ].map(([cx, cz], idx) => (
          <mesh key={idx} position={[cx * 0.5, -1.1, cz * 0.5]} rotation={[cz * 0.18, 0, -cx * 0.45]}>
            <cylinderGeometry args={[0.012, 0.012, 2.7, 4]} />
            <meshBasicMaterial color="#e2e8f0" />
          </mesh>
        ))}
      </group>

      <group ref={bodyRootRef}>
        {/* LEFT LEG */}
        <group ref={leftLegRef} position={[-0.14, 0.86, 0]}>
          <mesh position={[0, -0.22, 0]} castShadow={castShadow}>
            <boxGeometry args={[0.18, 0.42, 0.2]} />
            <meshStandardMaterial color={camo.pantsHex} roughness={0.85} />
          </mesh>
          <mesh position={[0, -0.44, 0.09]} castShadow={castShadow}>
            <boxGeometry args={[0.15, 0.12, 0.06]} />
            <meshStandardMaterial color="#1f2428" roughness={0.45} metalness={0.25} />
          </mesh>
          <mesh position={[0, -0.62, 0]} castShadow={castShadow}>
            <boxGeometry args={[0.16, 0.36, 0.18]} />
            <meshStandardMaterial color={camo.pantsHex} roughness={0.85} />
          </mesh>
          <mesh position={[0, -0.81, 0.04]} castShadow={castShadow}>
            <boxGeometry args={[0.17, 0.1, 0.27]} />
            <meshStandardMaterial color="#1b1d20" roughness={0.55} metalness={0.15} />
          </mesh>
        </group>

        {/* RIGHT LEG */}
        <group ref={rightLegRef} position={[0.14, 0.86, 0]}>
          <mesh position={[0, -0.22, 0]} castShadow={castShadow}>
            <boxGeometry args={[0.18, 0.42, 0.2]} />
            <meshStandardMaterial color={camo.pantsHex} roughness={0.85} />
          </mesh>
          <mesh position={[0, -0.44, 0.09]} castShadow={castShadow}>
            <boxGeometry args={[0.15, 0.12, 0.06]} />
            <meshStandardMaterial color="#1f2428" roughness={0.45} metalness={0.25} />
          </mesh>
          <mesh position={[0, -0.62, 0]} castShadow={castShadow}>
            <boxGeometry args={[0.16, 0.36, 0.18]} />
            <meshStandardMaterial color={camo.pantsHex} roughness={0.85} />
          </mesh>
          <mesh position={[0, -0.81, 0.04]} castShadow={castShadow}>
            <boxGeometry args={[0.17, 0.1, 0.27]} />
            <meshStandardMaterial color="#1b1d20" roughness={0.55} metalness={0.15} />
          </mesh>
        </group>

        {/* PELVIS & UTILITY BELT */}
        <mesh position={[0, 0.9, 0]} castShadow={castShadow}>
          <boxGeometry args={[0.42, 0.16, 0.25]} />
          <meshStandardMaterial color="#23272b" roughness={0.62} metalness={0.15} />
        </mesh>

        {/* UPPER TORSO */}
        <group ref={torsoRef} position={[0, 0.98, 0]}>
          <mesh position={[0, 0.26, 0]} castShadow={castShadow}>
            <boxGeometry args={[0.45, 0.52, 0.26]} />
            <meshStandardMaterial color={camo.uniformHex} roughness={0.86} />
          </mesh>

          {loadout.armorEquipped && (
            <group position={[0, 0.28, 0]}>
              <mesh castShadow={castShadow}>
                <boxGeometry args={[0.48, 0.42, 0.31]} />
                <meshStandardMaterial color={camo.vestHex} roughness={0.68} metalness={0.12} />
              </mesh>
              {[-0.12, 0, 0.12].map((px, idx) => (
                <mesh key={idx} position={[px, -0.08, 0.17]} castShadow={castShadow}>
                  <boxGeometry args={[0.09, 0.14, 0.06]} />
                  <meshStandardMaterial color={camo.accentHex} roughness={0.6} />
                </mesh>
              ))}
            </group>
          )}

          {loadout.backpackEnabled && (
            <group position={[0, 0.26, -0.22]}>
              <mesh castShadow={castShadow}>
                <boxGeometry args={[0.34, 0.42, 0.18]} />
                <meshStandardMaterial color={camo.vestHex} roughness={0.78} />
              </mesh>
              <mesh position={[0, -0.08, -0.1]} castShadow={castShadow}>
                <boxGeometry args={[0.28, 0.18, 0.07]} />
                <meshStandardMaterial color={camo.accentHex} roughness={0.7} />
              </mesh>
              <mesh position={[-0.13, 0.42, -0.02]}>
                <cylinderGeometry args={[0.01, 0.014, 0.56, 6]} />
                <meshStandardMaterial color="#1a1d21" roughness={0.35} metalness={0.7} />
              </mesh>
            </group>
          )}

          {/* HEAD & HELMET */}
          <group ref={headRef} position={[0, 0.62, 0]}>
            <mesh position={[0, -0.06, 0]}>
              <cylinderGeometry args={[0.07, 0.08, 0.12, 8]} />
              <meshStandardMaterial color="#b98f70" roughness={0.72} />
            </mesh>
            <mesh position={[0, 0.08, 0]} castShadow={castShadow}>
              <boxGeometry args={[0.21, 0.23, 0.22]} />
              <meshStandardMaterial color="#c49a7a" roughness={0.72} />
            </mesh>
            <mesh position={[0, 0.16, -0.01]} castShadow={castShadow}>
              <sphereGeometry args={[0.155, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
              <meshStandardMaterial color={helmet.shellHex} roughness={0.42} metalness={0.32} />
            </mesh>
            {helmet.hasVisor && (
              <mesh position={[0, 0.11, 0.112]}>
                <boxGeometry args={[0.19, 0.065, 0.035]} />
                <meshStandardMaterial color={helmet.visorHex} roughness={0.14} metalness={0.85} />
              </mesh>
            )}
            {helmet.hasNvg && (
              <group position={[0, 0.2, 0.14]}>
                <mesh>
                  <boxGeometry args={[0.11, 0.05, 0.06]} />
                  <meshStandardMaterial color="#1c2026" roughness={0.3} metalness={0.8} />
                </mesh>
                <mesh position={[-0.035, -0.01, 0.04]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.022, 0.022, 0.07, 8]} />
                  <meshStandardMaterial color="#14181d" roughness={0.2} metalness={0.9} />
                </mesh>
                <mesh position={[0.035, -0.01, 0.04]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.022, 0.022, 0.07, 8]} />
                  <meshStandardMaterial color="#14181d" roughness={0.2} metalness={0.9} />
                </mesh>
              </group>
            )}
          </group>

          {/* LEFT ARM */}
          <group ref={leftArmRef} position={[-0.29, 0.46, 0]}>
            <mesh position={[0, -0.18, 0]} castShadow={castShadow}>
              <boxGeometry args={[0.13, 0.36, 0.14]} />
              <meshStandardMaterial color={camo.uniformHex} roughness={0.86} />
            </mesh>
            <mesh position={[0.06, -0.34, 0.12]} rotation={[0.55, 0, 0.25]} castShadow={castShadow}>
              <boxGeometry args={[0.11, 0.22, 0.12]} />
              <meshStandardMaterial color="#202429" roughness={0.55} />
            </mesh>
          </group>

          {/* RIGHT ARM */}
          <group ref={rightArmRef} position={[0.29, 0.46, 0]}>
            <mesh position={[0, -0.18, 0]} castShadow={castShadow}>
              <boxGeometry args={[0.13, 0.36, 0.14]} />
              <meshStandardMaterial color={camo.uniformHex} roughness={0.86} />
            </mesh>
            <mesh position={[-0.05, -0.34, 0.12]} rotation={[0.55, 0, -0.2]} castShadow={castShadow}>
              <boxGeometry args={[0.11, 0.22, 0.12]} />
              <meshStandardMaterial color="#202429" roughness={0.55} />
            </mesh>
          </group>
        </group>

        {/* EQUIPPED COMPOSITE WEAPON RIG (5 DISTINCT SILHOUETTES) */}
        <group ref={weaponRigRef} position={[0.14, 1.18, 0.34]}>
          {/* Receiver */}
          <mesh position={[0, 0, 0]} castShadow={castShadow}>
            <boxGeometry args={[0.065, isPistol ? 0.075 : 0.11, isPistol ? 0.2 : 0.36]} />
            <meshStandardMaterial color={weapon.bodyColor} roughness={0.4} metalness={0.78} />
          </mesh>
          {/* Stock (rifles/shotgun/SMG) */}
          {!isPistol && (
            <mesh position={[0, -0.01, -0.24]} castShadow={castShadow}>
              <boxGeometry args={[0.055, 0.1, 0.2]} />
              <meshStandardMaterial color="#181b1f" roughness={0.62} metalness={0.35} />
            </mesh>
          )}
          {/* Pistol Grip */}
          <mesh position={[0, -0.09, -0.05]} rotation={[-0.25, 0, 0]} castShadow={castShadow}>
            <boxGeometry args={[0.045, 0.13, 0.065]} />
            <meshStandardMaterial color="#191d22" roughness={0.7} />
          </mesh>
          {/* Barrel */}
          <mesh
            position={[0, 0.02, weapon.barrelLength * 0.45 + (isPistol ? 0.08 : 0.14)]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow={castShadow}
          >
            <cylinderGeometry
              args={[isShotgun ? 0.026 : 0.018, isShotgun ? 0.028 : 0.022, weapon.barrelLength, 8]}
            />
            <meshStandardMaterial color={weapon.accentColor} roughness={0.28} metalness={0.88} />
          </mesh>
          {/* Shotgun Underbarrel Pump Tube */}
          {isShotgun && (
            <mesh position={[0, -0.03, 0.34]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.024, 0.024, 0.38, 8]} />
              <meshStandardMaterial color={weapon.accentColor} roughness={0.65} />
            </mesh>
          )}
          {/* Magazine (non-shotgun, non-pistol) */}
          {!isShotgun && !isPistol && (
            <mesh position={[0, -0.11, 0.07]} rotation={[0.18, 0, 0]} castShadow={castShadow}>
              <boxGeometry args={[0.042, isSniper ? 0.12 : 0.16, 0.07]} />
              <meshStandardMaterial color="#2a3036" roughness={0.5} metalness={0.6} />
            </mesh>
          )}
          {/* Optic / Sniper Scope */}
          {!isPistol && (
            <mesh position={[0, 0.09, -0.02]} rotation={[Math.PI / 2, 0, 0]} castShadow={castShadow}>
              <cylinderGeometry
                args={[isSniper ? 0.036 : 0.024, isSniper ? 0.03 : 0.024, isSniper ? 0.28 : 0.1, 8]}
              />
              <meshStandardMaterial color="#14181d" roughness={0.22} metalness={0.88} />
            </mesh>
          )}
          {/* Muzzle Flash */}
          <mesh
            ref={muzzleFlashRef}
            position={[0, 0.02, weapon.barrelLength + (isPistol ? 0.12 : 0.18)]}
            visible={false}
          >
            <octahedronGeometry args={[isSniper || isShotgun ? 0.15 : 0.1, 0]} />
            <meshBasicMaterial color="#fbbf24" transparent opacity={0.92} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
