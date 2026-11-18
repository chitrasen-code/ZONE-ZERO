import * as THREE from 'three';

let cachedSoftwareGl: boolean | null = null;

/**
 * Probes the GPU renderer string (never the user agent) to detect
 * software WebGL rasterizers (SwiftShader, llvmpipe, WARP) for rendering-cost tuning.
 */
export function detectSoftwareWebGL(): boolean {
  if (cachedSoftwareGl !== null) {
    return cachedSoftwareGl;
  }
  if (typeof document === 'undefined') {
    cachedSoftwareGl = false;
    return false;
  }
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) {
      cachedSoftwareGl = true;
      return true;
    }
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    cachedSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    cachedSoftwareGl = false;
  }
  return cachedSoftwareGl;
}

export function clampDelta(rawDelta: number): number {
  return Math.min(Math.max(rawDelta, 0.0001), 0.05);
}

export function dampValue(current: number, target: number, lambda: number, dt: number): number {
  return THREE.MathUtils.damp(current, target, lambda, dt);
}
