import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { createMatchLootItems } from '../../data/lootSpawns';
import {
  CharacterLoadout,
  GameScreen,
  GameSettings,
  MatchMode,
  MutableInputState,
  PlayerHudState,
  RemotePlayerSnapshot,
  WorldLootItem,
} from '../../types/game';
import { detectSoftwareWebGL } from '../../utils/webgl';
import { Buildings, TargetHitState } from './Buildings';
import { EnvironmentRig } from './EnvironmentRig';
import { IslandWorld } from './IslandWorld';
import { ThirdPersonController } from './ThirdPersonController';

interface GameCanvasProps {
  screen: GameScreen;
  matchMode: MatchMode;
  matchSessionId: number;
  loadout: CharacterLoadout;
  settings: GameSettings;
  inputRef: React.MutableRefObject<MutableInputState>;
  activeSlot: 1 | 2 | 3;
  onActiveSlotChange: (slot: 1 | 2 | 3) => void;
  onHudUpdate: (hud: PlayerHudState) => void;
  onSceneReady: () => void;
  remotePlayers: RemotePlayerSnapshot[];
  onRemotePlayersUpdate: (players: RemotePlayerSnapshot[]) => void;
}

function SoftwareGlPacer({ isSoftwareGl }: { isSoftwareGl: boolean }) {
  const { gl, invalidate } = useThree();
  const timerRef = useRef<number>(0);

  useEffect(() => {
    if (!isSoftwareGl) return;
    invalidate();
    return () => {
      window.clearTimeout(timerRef.current);
    };
  }, [isSoftwareGl, invalidate]);

  useFrame(() => {
    if (!isSoftwareGl) return;
    const context = gl.getContext() as WebGL2RenderingContext;
    const sync = context.fenceSync?.(context.SYNC_GPU_COMMANDS_COMPLETE, 0);
    context.flush();
    window.clearTimeout(timerRef.current);
    const poll = () => {
      const status = sync ? context.getSyncParameter(sync, context.SYNC_STATUS) : context.SIGNALED;
      if (status === context.UNSIGNALED) {
        timerRef.current = window.setTimeout(poll, 6);
      } else {
        if (sync) context.deleteSync(sync);
        timerRef.current = window.setTimeout(() => invalidate(), 80);
      }
    };
    timerRef.current = window.setTimeout(poll, 6);
  });

  return null;
}

export function GameCanvas({
  screen,
  matchMode,
  matchSessionId,
  loadout,
  settings,
  inputRef,
  activeSlot,
  onActiveSlotChange,
  onHudUpdate,
  onSceneReady,
  remotePlayers,
  onRemotePlayersUpdate,
}: GameCanvasProps) {
  const isSoftwareGl = useMemo(() => detectSoftwareWebGL(), []);
  const playerPosRef = useRef(new THREE.Vector3(0, 11.2, -26));
  const lootItemsRef = useRef<WorldLootItem[]>(createMatchLootItems());
  const targetHitStatesRef = useRef<Record<string, TargetHitState>>({});
  const targetHitMeshesRef = useRef<THREE.Object3D[]>([]);
  const [contextLost, setContextLost] = useState(false);

  // Apply Low / Medium / High / Ultra graphics preset & Battery Saver DPR scaling
  const effectiveDpr: number | [number, number] = useMemo(() => {
    if (isSoftwareGl) return 1;
    if (settings.batterySaver || settings.graphicsQuality === 'low') return 0.9;
    if (settings.graphicsQuality === 'medium') return 1.0;
    if (settings.graphicsQuality === 'high') return [1, 1.5];
    return [1, 2];
  }, [isSoftwareGl, settings.batterySaver, settings.graphicsQuality]);

  const effectiveShadows =
    !isSoftwareGl &&
    !settings.batterySaver &&
    settings.shadowsEnabled &&
    (settings.graphicsQuality === 'high' || settings.graphicsQuality === 'ultra');

  const effectiveFoliage: 'high' | 'medium' =
    settings.graphicsQuality === 'low' || settings.graphicsQuality === 'medium' || settings.batterySaver
      ? 'medium'
      : settings.foliageDensity;

  const handleCreated = useCallback(({ gl }: { gl: THREE.WebGLRenderer }) => {
    const canvas = gl.domElement;
    const onLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onRestored = () => {
      setContextLost(false);
    };
    canvas.addEventListener('webglcontextlost', onLost, false);
    canvas.addEventListener('webglcontextrestored', onRestored, false);
  }, []);

  const isDraggingRef = useRef(false);
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (screen !== 'playing') return;
    if (e.pointerType === 'mouse') {
      if (e.button === 0) inputRef.current.fireHeld = true;
      else if (e.button === 2) inputRef.current.aimHeld = true;
      isDraggingRef.current = true;
      if (document.pointerLockElement !== e.currentTarget && e.currentTarget.requestPointerLock) {
        try {
          const maybePromise = e.currentTarget.requestPointerLock() as unknown as Promise<void> | undefined;
          if (maybePromise && typeof maybePromise.catch === 'function') {
            maybePromise.catch(() => {});
          }
        } catch {
          // Ignore pointer lock rejection inside iframes
        }
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse') {
      if (e.button === 0) inputRef.current.fireHeld = false;
      if (e.button === 2) inputRef.current.aimHeld = false;
      isDraggingRef.current = false;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (screen !== 'playing' || e.pointerType !== 'mouse') return;
    if (document.pointerLockElement || isDraggingRef.current) {
      inputRef.current.lookDeltaX += e.movementX;
      inputRef.current.lookDeltaY += e.movementY;
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (screen !== 'playing') return;
    inputRef.current.zoomDelta += e.deltaY;
  };

  return (
    <div
      className="fixed inset-0 w-full h-full bg-[#0b0e12]"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      {contextLost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0e12] text-slate-200">
          <div className="text-center space-y-2 px-6">
            <p className="font-display text-2xl tracking-wide uppercase">Graphics Context Interrupted</p>
            <p className="text-sm text-slate-400">Restoring 3D island viewport...</p>
          </div>
        </div>
      )}

      <Canvas
        frameloop={isSoftwareGl ? 'demand' : 'always'}
        dpr={effectiveDpr}
        shadows={effectiveShadows ? 'soft' : false}
        camera={{ fov: settings.cameraFov, near: 0.15, far: 1200, position: [0, 14, -18] }}
        gl={{
          antialias: !isSoftwareGl && settings.graphicsQuality !== 'low',
          powerPreference: settings.batterySaver ? 'default' : 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.08,
        }}
        onCreated={handleCreated}
      >
        <SoftwareGlPacer isSoftwareGl={isSoftwareGl} />
        <EnvironmentRig
          shadowsEnabled={effectiveShadows}
          isSoftwareGl={isSoftwareGl}
          playerPosRef={playerPosRef}
          onReady={onSceneReady}
        />
        <IslandWorld
          foliageDensity={effectiveFoliage}
          shadowsEnabled={effectiveShadows}
          isSoftwareGl={isSoftwareGl}
        />
        <Buildings
          shadowsEnabled={effectiveShadows}
          isSoftwareGl={isSoftwareGl}
          targetHitStatesRef={targetHitStatesRef}
          targetHitMeshesRef={targetHitMeshesRef}
          lootItemsRef={lootItemsRef}
        />
        <ThirdPersonController
          screen={screen}
          matchMode={matchMode}
          matchSessionId={matchSessionId}
          loadout={loadout}
          settings={settings}
          inputRef={inputRef}
          playerPosRef={playerPosRef}
          lootItemsRef={lootItemsRef}
          activeSlot={activeSlot}
          onActiveSlotChange={onActiveSlotChange}
          onHudUpdate={onHudUpdate}
          targetHitStatesRef={targetHitStatesRef}
          targetHitMeshesRef={targetHitMeshesRef}
          remotePlayers={remotePlayers}
          onRemotePlayersUpdate={onRemotePlayersUpdate}
          isSoftwareGl={isSoftwareGl}
        />
      </Canvas>
    </div>
  );
}
