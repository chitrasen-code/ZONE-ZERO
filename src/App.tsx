import { useCallback, useEffect, useRef, useState } from 'react';
import { soundEngine } from './audio/soundEngine';
import { GameCanvas } from './components/scene/GameCanvas';
import { CharacterModal } from './components/ui/CharacterModal';
import { GameHud } from './components/ui/GameHud';
import { InventoryModal } from './components/ui/InventoryModal';
import { LoadingScreen } from './components/ui/LoadingScreen';
import { MainMenu } from './components/ui/MainMenu';
import { MultiplayerLobbyModal } from './components/ui/MultiplayerLobbyModal';
import { PauseModal } from './components/ui/PauseModal';
import { SettingsModal } from './components/ui/SettingsModal';
import { DEFAULT_LOADOUT, DEFAULT_SETTINGS } from './data/gameCatalog';
import { INITIAL_BLUE_RADIUS, TOTAL_MATCH_COMBATANTS, ZONE_PHASES } from './data/matchConfig';
import {
  AuthUser,
  ConnectionStatus,
  multiplayerClient,
  RoomSummary,
} from './network/multiplayerClient';
import {
  CharacterLoadout,
  GameScreen,
  GameSettings,
  MatchMode,
  MenuModal,
  MutableInputState,
  PlayerHudState,
  RemotePlayerSnapshot,
} from './types/game';

const INITIAL_HUD_STATE: PlayerHudState = {
  matchPhase: 'countdown',
  matchTimeSec: 0,
  countdownSec: 3.5,
  aliveCount: TOTAL_MATCH_COMBATANTS,
  totalPlayers: TOTAL_MATCH_COMBATANTS,
  kills: 0,
  damageDealt: 0,
  headshots: 0,
  placement: 1,
  eliminationCause: '',
  health: 100,
  maxHealth: 100,
  armor: 60,
  maxArmor: 100,
  stamina: 100,
  maxStamina: 100,
  altitudeM: 0,
  headingDeg: 0,
  activeSlot: 1,
  activeWeaponId: 'vx47',
  slotWeapons: { 1: 'vx47', 2: 'sg12', 3: 'p45' },
  ammoInMag: 30,
  reserveAmmo: 90,
  isReloading: false,
  reloadProgress: 0,
  isAiming: false,
  isCrouching: false,
  isSprinting: false,
  isGrounded: true,
  speedMps: 0,
  playerX: 0,
  playerZ: -26,
  hitMarkerTick: 0,
  lastHitHeadshot: false,
  lastDamage: null,
  targetedEnemy: null,
  targetsHitCount: 0,
  nearbyLoot: null,
  backpackUsedKg: 8.2,
  backpackMaxKg: 22,
  backpackItems: [],
  zone: {
    phaseIndex: 1,
    phaseStatus: 'waiting',
    phaseTimerSec: ZONE_PHASES[0].waitSec,
    blueCenterX: 0,
    blueCenterZ: 0,
    blueRadius: INITIAL_BLUE_RADIUS,
    safeCenterX: 0,
    safeCenterZ: 0,
    safeRadius: ZONE_PHASES[0].targetRadius,
    damagePerSec: ZONE_PHASES[0].damagePerSec,
    playerOutsideZone: false,
  },
  flight: {
    startX: -195,
    startZ: 175,
    endX: 195,
    endZ: -175,
    planeX: -195,
    planeY: 138,
    planeZ: 175,
    planeYaw: 0,
    canDrop: false,
    progress: 0,
  },
  killFeed: [],
  pointerLocked: false,
  surfaceLabel: 'VX-47 Carbine',
  lastDamagedByTick: 0,
};

function createEmptyInput(): MutableInputState {
  return {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    jumpPressed: false,
    crouchTogglePressed: false,
    aimHeld: false,
    fireHeld: false,
    reloadPressed: false,
    interactPressed: false,
    healPressed: false,
    switchSlot1Pressed: false,
    switchSlot2Pressed: false,
    switchSlot3Pressed: false,
    lookDeltaX: 0,
    lookDeltaY: 0,
    zoomDelta: 0,
    joyX: 0,
    joyY: 0,
  };
}

export default function App() {
  const [sceneReady, setSceneReady] = useState(false);
  const [screen, setScreen] = useState<GameScreen>('loading');
  const [activeModal, setActiveModal] = useState<MenuModal>('none');
  const [showMultiplayerModal, setShowMultiplayerModal] = useState(false);

  const [matchMode, setMatchMode] = useState<MatchMode>('solo');
  const [matchSessionId, setMatchSessionId] = useState(0);

  const [loadout, setLoadout] = useState<CharacterLoadout>(DEFAULT_LOADOUT);
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [activeSlot, setActiveSlot] = useState<1 | 2 | 3>(1);
  const [hudState, setHudState] = useState<PlayerHudState>(INITIAL_HUD_STATE);

  const [showFullMap, setShowFullMap] = useState(false);
  const [showBackpack, setShowBackpack] = useState(false);

  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [room, setRoom] = useState<RoomSummary | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [remotePlayers, setRemotePlayers] = useState<RemotePlayerSnapshot[]>([]);

  const inputRef = useRef<MutableInputState>(createEmptyInput());

  // Sync audio volume & mute
  useEffect(() => {
    soundEngine.configure(settings.masterVolume, settings.muted);
  }, [settings.masterVolume, settings.muted]);

  // Restore saved multiplayer session & wire room/match lifecycle callbacks
  useEffect(() => {
    multiplayerClient.onStatusChange = (st) => setConnectionStatus(st);
    multiplayerClient.onRoomUpdate = (rm) => setRoom(rm);
    multiplayerClient.onMatchStarted = (rm) => {
      setRoom(rm);
      setShowMultiplayerModal(false);
      setActiveModal('none');
      setShowFullMap(false);
      setShowBackpack(false);
      setMatchMode('multiplayer');
      setActiveSlot(3);
      setMatchSessionId((prev) => prev + 1);
      setScreen('playing');
    };

    multiplayerClient.restoreSession().then((user) => {
      if (user) {
        setAuthUser(user);
        setLoadout((prev) => ({ ...prev, callsign: user.username.toUpperCase() }));
        multiplayerClient.connectSocket();
      }
    });

    return () => {
      multiplayerClient.onStatusChange = undefined;
      multiplayerClient.onRoomUpdate = undefined;
      multiplayerClient.onMatchStarted = undefined;
    };
  }, []);

  const handleSceneReady = useCallback(() => {
    setSceneReady(true);
    setScreen((prev) => (prev === 'loading' ? 'menu' : prev));
  }, []);

  // Fallback readiness guard if WebGL takes too long on low-end devices
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSceneReady(true);
      setScreen((prev) => (prev === 'loading' ? 'menu' : prev));
    }, 2800);
    return () => window.clearTimeout(timer);
  }, []);

  const clearInputs = useCallback(() => {
    inputRef.current = createEmptyInput();
  }, []);

  // Desktop keyboard & focus handling
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      if (e.code === 'Escape') {
        if (screen === 'playing') {
          if (showFullMap) {
            setShowFullMap(false);
            return;
          }
          if (showBackpack) {
            setShowBackpack(false);
            return;
          }
          clearInputs();
          document.exitPointerLock?.();
          setScreen('paused');
        } else if (screen === 'paused') {
          if (activeModal !== 'none') setActiveModal('none');
          else setScreen('playing');
        }
        return;
      }

      if (screen !== 'playing') return;

      const inp = inputRef.current;
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          inp.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          inp.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          inp.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          inp.right = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          inp.sprint = true;
          break;
        case 'Space':
          e.preventDefault();
          inp.jumpPressed = true;
          break;
        case 'KeyC':
          inp.crouchTogglePressed = true;
          break;
        case 'KeyR':
          inp.reloadPressed = true;
          break;
        case 'KeyE':
        case 'KeyF':
          inp.interactPressed = true;
          break;
        case 'KeyH':
          inp.healPressed = true;
          break;
        case 'Digit1':
          inp.switchSlot1Pressed = true;
          break;
        case 'Digit2':
          inp.switchSlot2Pressed = true;
          break;
        case 'Digit3':
          inp.switchSlot3Pressed = true;
          break;
        case 'KeyM':
          document.exitPointerLock?.();
          setShowFullMap((prev) => !prev);
          setShowBackpack(false);
          break;
        case 'Tab':
        case 'KeyI':
          e.preventDefault();
          document.exitPointerLock?.();
          setShowBackpack((prev) => !prev);
          setShowFullMap(false);
          break;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const inp = inputRef.current;
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          inp.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          inp.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          inp.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          inp.right = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          inp.sprint = false;
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearInputs);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearInputs);
    };
  }, [screen, showFullMap, showBackpack, activeModal, clearInputs]);

  const startSoloMatch = () => {
    clearInputs();
    setShowMultiplayerModal(false);
    setActiveModal('none');
    setShowFullMap(false);
    setShowBackpack(false);
    setMatchMode('solo');
    setActiveSlot(1);
    setMatchSessionId((prev) => prev + 1);
    setScreen('playing');
  };

  const returnToMenu = () => {
    clearInputs();
    document.exitPointerLock?.();
    if (matchMode === 'multiplayer') {
      multiplayerClient.leaveRoom();
      setRemotePlayers([]);
    }
    setShowFullMap(false);
    setShowBackpack(false);
    setActiveModal('none');
    setMatchMode('solo');
    setMatchSessionId(0);
    setScreen('menu');
  };

  return (
    <main className="fixed inset-0 w-full h-full overflow-hidden bg-[#0b0e12]">
      <GameCanvas
        screen={screen}
        matchMode={matchMode}
        matchSessionId={matchSessionId}
        loadout={loadout}
        settings={settings}
        inputRef={inputRef}
        activeSlot={activeSlot}
        onActiveSlotChange={setActiveSlot}
        onHudUpdate={setHudState}
        onSceneReady={handleSceneReady}
        remotePlayers={remotePlayers}
        onRemotePlayersUpdate={setRemotePlayers}
      />

      <LoadingScreen ready={sceneReady} />

      {screen === 'menu' && sceneReady && (
        <MainMenu
          loadout={loadout}
          settings={settings}
          authUser={authUser}
          onPlaySolo={startSoloMatch}
          onOpenMultiplayer={() => setShowMultiplayerModal(true)}
          onOpenModal={(m) => setActiveModal(m)}
          onToggleMute={() => setSettings((s) => ({ ...s, muted: !s.muted }))}
          onDifficultyChange={(difficulty) => setSettings((s) => ({ ...s, difficulty }))}
        />
      )}

      {screen === 'playing' && (
        <GameHud
          hud={hudState}
          settings={settings}
          matchMode={matchMode}
          connectionStatus={connectionStatus}
          inputRef={inputRef}
          activeSlot={activeSlot}
          onActiveSlotChange={setActiveSlot}
          showFullMap={showFullMap}
          onToggleFullMap={() => {
            document.exitPointerLock?.();
            setShowFullMap((v) => !v);
            setShowBackpack(false);
          }}
          showBackpack={showBackpack}
          onToggleBackpack={() => {
            document.exitPointerLock?.();
            setShowBackpack((v) => !v);
            setShowFullMap(false);
          }}
          onPause={() => {
            clearInputs();
            document.exitPointerLock?.();
            setScreen('paused');
          }}
          onPlayAgain={startSoloMatch}
          onReturnToMenu={returnToMenu}
        />
      )}

      {screen === 'paused' && activeModal === 'none' && (
        <PauseModal
          onResume={() => setScreen('playing')}
          onOpenSettings={() => setActiveModal('settings')}
          onReturnToMenu={returnToMenu}
        />
      )}

      {activeModal === 'character' && (
        <CharacterModal
          loadout={loadout}
          onChange={setLoadout}
          onClose={() => setActiveModal('none')}
        />
      )}

      {activeModal === 'inventory' && (
        <InventoryModal
          loadout={loadout}
          onChange={setLoadout}
          onClose={() => setActiveModal('none')}
        />
      )}

      {activeModal === 'settings' && (
        <SettingsModal
          settings={settings}
          onChange={setSettings}
          onClose={() => setActiveModal('none')}
        />
      )}

      {showMultiplayerModal && (
        <MultiplayerLobbyModal
          authUser={authUser}
          onAuthChange={(user) => {
            setAuthUser(user);
            if (user) {
              setLoadout((prev) => ({ ...prev, callsign: user.username.toUpperCase() }));
            }
          }}
          room={room}
          connectionStatus={connectionStatus}
          loadout={loadout}
          onClose={() => setShowMultiplayerModal(false)}
        />
      )}
    </main>
  );
}
