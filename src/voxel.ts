import * as THREE from 'three';

type Block = {
  position: THREE.Vector3;
  scale: THREE.Vector3;
  color: THREE.Color;
  rotation: THREE.Euler;
};

/** One geometry and one draw call for all opaque cuboids. */
export class VoxelBatch {
  private blocks: Block[] = [];

  add(x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string, ry = 0, rz = 0) {
    this.blocks.push({
      position: new THREE.Vector3(x, y, z),
      scale: new THREE.Vector3(sx, sy, sz),
      color: new THREE.Color(color),
      rotation: new THREE.Euler(0, ry, rz),
    });
  }

  build(): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshLambertMaterial(),
      this.blocks.length,
    );
    const transform = new THREE.Object3D();
    this.blocks.forEach((block, index) => {
      transform.position.copy(block.position);
      transform.scale.copy(block.scale);
      transform.rotation.copy(block.rotation);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
      mesh.setColorAt(index, block.color);
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    this.blocks = [];
    return mesh;
  }
}
