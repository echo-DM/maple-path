export type Point3 = readonly [number, number, number];

export const TERRAIN_STEP = 2.4;
export const VILLAGE = { x: 23, z: -43, y: 34.4 };
export const CART = { x: -23, z: 43, y: 10.4 };
export const MAPLE = { x: 14, z: 29 };

function peak(x: number, z: number, cx: number, cz: number, height: number, width: number, depth: number) {
  return height * Math.exp(-(((x - cx) / width) ** 2 + ((z - cz) / depth) ** 2));
}

export function terrainHeight(x: number, z: number): number {
  const ridge = Math.max(
    peak(x, z, -28, -20, 38, 36, 47),
    peak(x, z, 32, -59, 54, 33, 37),
    peak(x, z, -75, -63, 46, 25, 34),
    peak(x, z, 72, -30, 30, 28, 43),
  );
  let height = 3.2 + ridge + 1.1 * Math.sin(x / 12) * Math.cos(z / 14) + 0.6 * Math.sin(x / 4 + z / 8);
  const cartDistance = Math.hypot(x - CART.x, z - CART.z);
  const cartBlend = Math.max(0, Math.min(1, (13 - cartDistance) / 5));
  height = height * (1 - cartBlend) + CART.y * cartBlend;
  const villageDistance = Math.hypot(x - VILLAGE.x, z - VILLAGE.z);
  const blend = Math.max(0, Math.min(1, (18 - villageDistance) / 7));
  height = height * (1 - blend) + VILLAGE.y * blend;
  const edge = Math.max(Math.abs(x) / 117, Math.abs(z + 10) / 125);
  height *= Math.max(0.15, Math.min(1, (1.05 - edge) / 0.15));
  return Math.max(1.6, Math.round(height / 0.8) * 0.8);
}

export const pathPoints: readonly (readonly [number, number])[] = [
  [9, 88], [-10, 70], [-25, 57], [-23, 43], [-30, 27], [-24, 12],
  [-6, 6], [1, -6], [-13, -18], [-7, -30], [10, -35], [23, -43],
];

export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
