import * as THREE from 'three';

export interface ProceduralTextureSet {
  terrainDetail: THREE.CanvasTexture;
  asphaltRoad: THREE.CanvasTexture;
  concreteSlab: THREE.CanvasTexture;
  corrugatedMetal: THREE.CanvasTexture;
  crateWood: THREE.CanvasTexture;
  oceanBump: THREE.CanvasTexture;
  dispose: () => void;
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  repeatX: number,
  repeatY: number,
  isColor: boolean,
  anisotropy: number,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = Math.min(8, anisotropy);
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextureSet(maxAnisotropy = 4): ProceduralTextureSet {
  // 1. Grass/earth subtle micro-detail tile (grayscale multiplier blended with vertex colors)
  const grassCanvas = document.createElement('canvas');
  grassCanvas.width = 256;
  grassCanvas.height = 256;
  const gCtx = grassCanvas.getContext('2d')!;
  gCtx.fillStyle = '#dcdcdc';
  gCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4500; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const shade = 175 + Math.floor(Math.random() * 70);
    gCtx.fillStyle = `rgb(${shade}, ${shade + 4}, ${shade - 4})`;
    gCtx.fillRect(x, y, 2, 3);
  }
  const terrainDetail = finalizeTexture(grassCanvas, 52, 52, true, maxAnisotropy);

  // 2. Asphalt road texture with weathered aggregate, edge gravel, and center dashed yellow/white line
  const roadCanvas = document.createElement('canvas');
  roadCanvas.width = 256;
  roadCanvas.height = 256;
  const rCtx = roadCanvas.getContext('2d')!;
  rCtx.fillStyle = '#363b40';
  rCtx.fillRect(0, 0, 256, 256);
  // Gravel shoulders
  rCtx.fillStyle = '#5a554a';
  rCtx.fillRect(0, 0, 18, 256);
  rCtx.fillRect(238, 0, 18, 256);
  // Subtle edge stripes
  rCtx.fillStyle = '#9aa0a6';
  rCtx.fillRect(22, 0, 4, 256);
  rCtx.fillRect(230, 0, 4, 256);
  // Asphalt grain
  for (let i = 0; i < 3200; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const v = 42 + Math.floor(Math.random() * 34);
    rCtx.fillStyle = `rgb(${v}, ${v + 1}, ${v + 3})`;
    rCtx.fillRect(x, y, 2, 2);
  }
  // Dashed center line
  rCtx.fillStyle = '#d6a43a';
  rCtx.fillRect(125, 16, 6, 96);
  rCtx.fillRect(125, 144, 6, 96);
  const asphaltRoad = finalizeTexture(roadCanvas, 1, 72, true, maxAnisotropy);

  // 3. Weathered military concrete slab
  const concCanvas = document.createElement('canvas');
  concCanvas.width = 256;
  concCanvas.height = 256;
  const cCtx = concCanvas.getContext('2d')!;
  cCtx.fillStyle = '#8d908b';
  cCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2400; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const v = 118 + Math.floor(Math.random() * 36);
    cCtx.fillStyle = `rgb(${v}, ${v}, ${v - 3})`;
    cCtx.fillRect(x, y, 2, 2);
  }
  cCtx.strokeStyle = 'rgba(40, 44, 48, 0.28)';
  cCtx.lineWidth = 2;
  cCtx.strokeRect(1, 1, 254, 254);
  cCtx.beginPath();
  cCtx.moveTo(0, 128);
  cCtx.lineTo(256, 128);
  cCtx.stroke();
  const concreteSlab = finalizeTexture(concCanvas, 2, 2, true, maxAnisotropy);

  // 4. Corrugated steel roof / hangar ribs
  const metalCanvas = document.createElement('canvas');
  metalCanvas.width = 256;
  metalCanvas.height = 256;
  const mCtx = metalCanvas.getContext('2d')!;
  for (let x = 0; x < 256; x += 16) {
    const grad = mCtx.createLinearGradient(x, 0, x + 16, 0);
    grad.addColorStop(0, '#464d54');
    grad.addColorStop(0.5, '#6d7680');
    grad.addColorStop(1, '#3b4148');
    mCtx.fillStyle = grad;
    mCtx.fillRect(x, 0, 16, 256);
  }
  const corrugatedMetal = finalizeTexture(metalCanvas, 3, 2, true, maxAnisotropy);

  // 5. Military wooden supply crate texture
  const crateCanvas = document.createElement('canvas');
  crateCanvas.width = 256;
  crateCanvas.height = 256;
  const crCtx = crateCanvas.getContext('2d')!;
  crCtx.fillStyle = '#6f5a3e';
  crCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) {
    crCtx.fillStyle = y % 64 === 0 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.05)';
    crCtx.fillRect(0, y, 256, 30);
    crCtx.fillStyle = '#3b2e1e';
    crCtx.fillRect(0, y + 30, 256, 2);
  }
  crCtx.strokeStyle = '#4a3a26';
  crCtx.lineWidth = 18;
  crCtx.strokeRect(9, 9, 238, 238);
  crCtx.beginPath();
  crCtx.moveTo(16, 16);
  crCtx.lineTo(240, 240);
  crCtx.stroke();
  const crateWood = finalizeTexture(crateCanvas, 1, 1, true, maxAnisotropy);

  // 6. Ocean normal/bump wave texture (linear data map)
  const oceanCanvas = document.createElement('canvas');
  oceanCanvas.width = 256;
  oceanCanvas.height = 256;
  const oCtx = oceanCanvas.getContext('2d')!;
  oCtx.fillStyle = '#808080';
  oCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 650; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const w = 14 + Math.random() * 24;
    const h = 3 + Math.random() * 5;
    const lum = 100 + Math.floor(Math.random() * 60);
    oCtx.fillStyle = `rgba(${lum}, ${lum}, ${lum}, 0.35)`;
    oCtx.fillRect(x, y, w, h);
  }
  const oceanBump = finalizeTexture(oceanCanvas, 32, 32, false, maxAnisotropy);

  return {
    terrainDetail,
    asphaltRoad,
    concreteSlab,
    corrugatedMetal,
    crateWood,
    oceanBump,
    dispose: () => {
      terrainDetail.dispose();
      asphaltRoad.dispose();
      concreteSlab.dispose();
      corrugatedMetal.dispose();
      crateWood.dispose();
      oceanBump.dispose();
    },
  };
}
