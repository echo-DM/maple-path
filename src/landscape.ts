import * as THREE from 'three';
import { views } from './poem';
import { CART, MAPLE, pathPoints, seededRandom, terrainHeight, TERRAIN_STEP, VILLAGE } from './terrain';
import { VoxelBatch } from './voxel';

const mapleColors = ['#a73129', '#c64227', '#cf4b2c', '#e35b28', '#b43b32', '#dc8031', '#a33d29'];
const grassColors = ['#8b956e', '#8d976f', '#909872', '#8e976f'];
const stoneColors = ['#a0a495', '#a3a697', '#9ca293', '#a6a899'];

function pick(colors: string[], random: () => number) {
  return colors[Math.floor(random() * colors.length)];
}

function distanceToSegment(x: number, z: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - ax - t * dx, z - az - t * dz);
}

function maple(batch: VoxelBatch, x: number, z: number, scale: number, random: () => number) {
  const y = terrainHeight(x, z);
  const wood = '#625344';
  batch.add(x, y + 3.7 * scale, z, 0.8 * scale, 7.4 * scale, 0.85 * scale, wood);
  batch.add(x - 1.2 * scale, y + 5.7 * scale, z, 2.8 * scale, 0.6 * scale, 0.55 * scale, wood, 0, -0.52);
  batch.add(x + 1.2 * scale, y + 6.4 * scale, z + 0.6 * scale, 3.3 * scale, 0.6 * scale, 0.55 * scale, wood, 0.4, 0.6);
  const unit = 1.3 * scale;
  const baseColor = Math.floor(random() * mapleColors.length);
  for (let ix = -3; ix <= 3; ix++) {
    for (let iz = -3; iz <= 3; iz++) {
      for (let iy = -2; iy <= 2; iy++) {
        const radius = (ix / 3.2) ** 2 + (iz / 3.1) ** 2 + (iy / 2.65) ** 2;
        if (radius > 1.12 + random() * 0.15 || random() < 0.1) continue;
        const color = mapleColors[(baseColor + Math.floor(random() * 3)) % mapleColors.length];
        batch.add(x + ix * unit, y + 8.3 * scale + iy * unit, z + iz * unit,
          unit * (0.88 + random() * 0.2), unit * (0.88 + random() * 0.18), unit * (0.88 + random() * 0.2), color);
      }
    }
  }
  // A few little leaves continue the silhouette beyond the crown.
  for (let i = 0; i < 8; i++) {
    const angle = random() * Math.PI * 2;
    const r = 4.2 * scale;
    batch.add(x + Math.cos(angle) * r, y + (6 + random() * 3) * scale, z + Math.sin(angle) * r,
      0.7 * scale, 0.8 * scale, 0.7 * scale, pick(mapleColors, random));
  }
}

function pine(batch: VoxelBatch, x: number, z: number, scale: number) {
  const y = terrainHeight(x, z);
  batch.add(x, y + 3 * scale, z, 0.65 * scale, 6 * scale, 0.65 * scale, '#656253');
  for (let layer = 0; layer < 5; layer++) {
    const width = (5.2 - layer * 0.9) * scale;
    batch.add(x, y + (3.5 + layer * 1.15) * scale, z, width, 1.25 * scale, width,
      layer % 2 ? '#657663' : '#526a59');
  }
}

function house(batch: VoxelBatch, x: number, z: number, size = 1) {
  const y = terrainHeight(x, z);
  batch.add(x, y + 0.4, z, 6.8 * size, 0.8, 5.7 * size, '#8b8c7d');
  batch.add(x, y + 2.1 * size, z, 6 * size, 3.4 * size, 4.8 * size, '#ddd0ad');
  for (const dx of [-2.6, 0, 2.6]) {
    batch.add(x + dx * size, y + 2.1 * size, z + 2.43 * size, 0.2 * size, 3.4 * size, 0.2 * size, '#78664d');
  }
  batch.add(x - 0.6 * size, y + 1.5 * size, z + 2.46 * size, 1.3 * size, 2.2 * size, 0.15, '#6b604e');
  batch.add(x + 1.7 * size, y + 2.4 * size, z + 2.5 * size, 0.95 * size, 0.8 * size, 0.17, '#c89854');
  batch.add(x, y + 3.6 * size, z + 2.5 * size, 6.5 * size, 0.22 * size, 0.3, '#847054');
  for (let layer = 0; layer < 5; layer++) {
    const span = (6.4 - layer * 1.1) * size;
    batch.add(x, y + (3.9 + layer * 0.38) * size, z, (7.3 - layer * 0.35) * size, 0.35 * size, span,
      layer % 2 ? '#697575' : '#596768');
  }
  batch.add(x, y + 5.75 * size, z, 6.3 * size, 0.3 * size, 0.45 * size, '#667778');
  for (const dx of [-3.65, 3.65]) {
    for (const dz of [-3.2, 3.2]) {
      batch.add(x + dx * size, y + 4.12 * size, z + dz * size, 0.5 * size, 0.45 * size, 0.6 * size, '#697878');
    }
  }
}

function carriage(batch: VoxelBatch, root: THREE.Group) {
  const { x, z } = CART;
  const y = terrainHeight(x, z) + 0.25;
  batch.add(x, y + 1.3, z, 2.6, 0.45, 4.2, '#82633f');
  batch.add(x, y + 1.08, z, 2.9, 0.25, 3.6, '#5d4b36');
  for (const dx of [-1.27, 1.27]) {
    for (const dz of [-1.6, 1.6]) {
      batch.add(x + dx, y + 2.2, z + dz, 0.18, 2.4, 0.18, '#725936');
    }
    batch.add(x + dx, y + 1.9, z, 0.2, 0.18, 4.2, '#997344');
    batch.add(x + dx, y + 1.55, z, 0.18, 0.15, 4.2, '#997344');
  }
  batch.add(x, y + 3.6, z, 3.2, 0.18, 4.5, '#c2a66c');
  batch.add(x, y + 3.76, z, 2.3, 0.17, 4.2, '#d7ba7f');
  for (const dx of [-0.85, 0.85]) {
    batch.add(x + dx, y + 1.1, z - 3.8, 0.15, 0.15, 4.8, '#775a38');
  }
  const wheelGeometry = new THREE.CylinderGeometry(0.85, 0.85, 0.24, 10);
  const wheelMaterial = new THREE.MeshLambertMaterial({ color: '#534b3b' });
  for (const dx of [-1.6, 1.6]) {
    for (const dz of [-1.28, 1.28]) {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheel.position.set(x + dx, y + 0.9, z + dz);
      wheel.rotation.z = Math.PI / 2;
      wheel.castShadow = true;
      root.add(wheel);
      batch.add(x + dx * 1.1, y + 0.9, z + dz, 0.25, 0.24, 0.24, '#ad8b55');
    }
  }
  // A small waiting horse and a standing traveler are visual additions.
  const hx = x;
  const hz = z - 6.4;
  const hy = terrainHeight(hx, hz);
  batch.add(hx, hy + 1.65, hz, 1.1, 1.1, 2.4, '#665544');
  for (const dx of [-0.4, 0.4]) {
    for (const dz of [-0.8, 0.8]) batch.add(hx + dx, hy + 0.65, hz + dz, 0.25, 1.3, 0.3, '#564939');
  }
  batch.add(hx, hy + 2.5, hz - 0.85, 0.65, 1.4, 0.75, '#665544');
  batch.add(hx, hy + 2.94, hz - 1.45, 0.62, 0.65, 1.15, '#705b46');
  batch.add(hx, hy + 3.4, hz - 1.03, 0.65, 0.35, 0.22, '#473e34');
  batch.add(hx, hy + 1.4, hz + 1.5, 0.28, 0.85, 0.25, '#473e34');
  const px = x + 3;
  const pz = z + 1.7;
  const py = terrainHeight(px, pz);
  batch.add(px, py + 0.9, pz, 0.9, 1.6, 0.65, '#4e7773');
  batch.add(px, py + 1.94, pz, 0.55, 0.5, 0.55, '#d8af81');
  batch.add(px, py + 2.24, pz, 0.75, 0.2, 0.7, '#575443');
  batch.add(px + 0.52, py + 1.1, pz, 0.25, 0.9, 0.35, '#4e7773');
  batch.add(px - 0.52, py + 1.1, pz, 0.25, 0.9, 0.35, '#4e7773');
}

export function buildLandscape(mobile: boolean) {
  const root = new THREE.Group();
  const batch = new VoxelBatch();
  const random = seededRandom(10613);
  const pathCurve = new THREE.CatmullRomCurve3(pathPoints.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const route = pathCurve.getPoints(320);
  const pathDistance = (x: number, z: number) => {
    let min = Infinity;
    for (let i = 0; i < route.length - 1; i += 2) {
      const a = route[i];
      const b = route[Math.min(i + 2, route.length - 1)];
      min = Math.min(min, distanceToSegment(x, z, a.x, a.z, b.x, b.z));
    }
    return min;
  };

  for (let x = -112; x <= 112; x += TERRAIN_STEP) {
    for (let z = -124; z <= 102; z += TERRAIN_STEP) {
      const h = terrainHeight(x, z);
      const rocky = h > 33;
      const cap = rocky ? pick(stoneColors, random) : pick(grassColors, random);
      batch.add(x, (h - 1.3) / 2, z, TERRAIN_STEP + 0.01, h + 0.7, TERRAIN_STEP + 0.01, rocky ? '#8d9386' : '#82896c');
      batch.add(x, h - 0.18, z, TERRAIN_STEP + 0.01, 0.36, TERRAIN_STEP + 0.01, cap);
    }
  }

  for (let i = 0; i < route.length; i++) {
    const p = route[i];
    const next = route[Math.min(i + 1, route.length - 1)];
    const angle = Math.atan2(next.x - p.x, next.z - p.z);
    for (let j = -1; j <= 1; j++) {
      const x = p.x + Math.cos(angle) * j * 0.73;
      const z = p.z - Math.sin(angle) * j * 0.73;
      batch.add(x, terrainHeight(x, z) + 0.15, z, 0.78, 0.26, 0.84,
        pick(['#c6b89b', '#cfbea0', '#bdae90', '#d3c6ac'], random), angle);
    }
  }

  const occupied: { x: number; z: number }[] = [{ ...MAPLE }];
  const count = mobile ? 130 : 205;
  let placed = 0;
  for (let attempt = 0; placed < count && attempt < 8000; attempt++) {
    const x = -89 + random() * 178;
    const z = -88 + random() * 173;
    if (terrainHeight(x, z) > 39 || pathDistance(x, z) < 4.5) continue;
    if (Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < 17 || Math.hypot(x - CART.x, z - CART.z) < 7) continue;
    if (occupied.some((tree) => Math.hypot(tree.x - x, tree.z - z) < 6.8)) continue;
    // Reserve the actual viewing corridors before adding the forest.
    if (views.slice(1).some((view) => distanceToSegment(x, z, view.position[0], view.position[2], view.target[0], view.target[2]) < 5.6)) continue;
    occupied.push({ x, z });
    const scale = 0.65 + random() * 0.45;
    if (z < -24 && random() > 0.6) pine(batch, x, z, scale);
    else maple(batch, x, z, scale, random);
    placed++;
  }
  maple(batch, MAPLE.x, MAPLE.z, 1.55, random);
  // Clusters of fallen leaves and short dry grasses connect forest and road.
  for (let i = 0; i < (mobile ? 400 : 850); i++) {
    const x = -65 + random() * 125;
    const z = -30 + random() * 112;
    if (pathDistance(x, z) < 1.2) continue;
    if (random() < 0.7) {
      batch.add(x, terrainHeight(x, z) + 0.04, z, 0.32 + random() * 0.25, 0.08, 0.28, pick(mapleColors, random), random() * 3);
    } else {
      batch.add(x, terrainHeight(x, z) + 0.3, z, 0.13, 0.6, 0.13, '#b7aa74');
    }
  }
  house(batch, VILLAGE.x, VILLAGE.z, 1.3);
  house(batch, VILLAGE.x - 8, VILLAGE.z - 7, 0.9);
  house(batch, VILLAGE.x + 8, VILLAGE.z - 7, 0.8);
  for (let i = 0; i < 12; i++) {
    const x = VILLAGE.x - 9 + i * 1.5;
    const z = VILLAGE.z + 5;
    batch.add(x, terrainHeight(x, z) + 0.6, z, 0.3, 1.2, 0.3, '#9b8c70');
    if (i < 11) batch.add(x + 0.75, terrainHeight(x, z) + 0.8, z, 1.5, 0.18, 0.2, '#9b8c70');
  }
  carriage(batch, root);
  root.add(batch.build());

  const cloudMaterial = new THREE.MeshLambertMaterial({ color: '#fff8e8', transparent: true, opacity: 0.42, depthWrite: false });
  const cloudGeometry = new THREE.BoxGeometry(1, 1, 1);
  const clouds: { group: THREE.Group; x: number; phase: number }[] = [];
  for (let i = 0; i < 9; i++) {
    const cloud = new THREE.Group();
    cloud.position.set(-83 + i * 21, 42 + random() * 15, -50 - random() * 40);
    for (let j = 0; j < 7; j++) {
      const block = new THREE.Mesh(cloudGeometry, cloudMaterial);
      block.position.set(j * 3.3 - 10, random() * 1.5, random() * 3.4 - 1.7);
      block.scale.set(6 + random() * 7, 1.5 + random() * 2, 4 + random() * 3);
      cloud.add(block);
    }
    clouds.push({ group: cloud, x: cloud.position.x, phase: random() * 6 });
    root.add(cloud);
  }

  const leafCount = mobile ? 28 : 65;
  const fallingLeaves = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.06, 0.32), new THREE.MeshLambertMaterial(), leafCount);
  const leafSeeds = Array.from({ length: leafCount }, () => ({
    x: MAPLE.x - 19 + random() * 34,
    z: MAPLE.z - 9 + random() * 24,
    offset: random() * 18,
    speed: 0.4 + random() * 0.4,
    phase: random() * 6.28,
  }));
  leafSeeds.forEach((_, i) => fallingLeaves.setColorAt(i, new THREE.Color(pick(mapleColors, random))));
  fallingLeaves.frustumCulled = false;
  root.add(fallingLeaves);
  const leafTransform = new THREE.Object3D();

  function update(time: number) {
    for (const cloud of clouds) cloud.group.position.x = cloud.x + Math.sin(time * 0.045 + cloud.phase) * 2.8;
    leafSeeds.forEach((seed, i) => {
      const fall = (seed.offset + time * seed.speed) % 18;
      leafTransform.position.set(seed.x + Math.sin(time * 0.5 + seed.phase) * 1.3,
        terrainHeight(seed.x, seed.z) + 18 - fall, seed.z + Math.sin(time * 0.35 + seed.phase));
      leafTransform.rotation.set(time * 0.35 + seed.phase, time * 0.3, Math.sin(time * 0.7 + seed.phase));
      leafTransform.updateMatrix();
      fallingLeaves.setMatrixAt(i, leafTransform.matrix);
    });
    fallingLeaves.instanceMatrix.needsUpdate = true;
  }
  update(0);

  return { root, update, treeCount: placed + 1 };
}
