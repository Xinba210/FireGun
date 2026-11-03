import * as THREE from 'three';

export type RainIntensity = 'LIGHT' | 'HEAVY' | 'STORM';

export interface BreakableLight {
  mesh: THREE.Mesh;
  light: THREE.Light;
  position: THREE.Vector3;
  broken: boolean;
}

export class WorldDetailsManager {
  public rainIntensity: RainIntensity = 'HEAVY';
  public stormTimer = 0;
  public breakableLights: BreakableLight[] = [];
  public lightningActive = false;
  private rainLines: THREE.LineSegments | null = null;
  private fogRef: THREE.FogExp2 | null = null;

  constructor(scene: THREE.Scene, rainLines: THREE.LineSegments | null, fog: THREE.FogExp2 | null) {
    this.rainLines = rainLines;
    this.fogRef = fog;
    this.initBreakableLamps(scene);
  }

  private initBreakableLamps(scene: THREE.Scene) {
    // Register 4 breakable street lamp globes at harbor key points
    const lampCoords: [number, number, number][] = [
      [-14.0, 7.8, 14.0],
      [12.0, 7.8, -10.0],
      [0.0, 9.5, 18.0],
      [-24.0, 11.5, -18.0],
    ];

    lampCoords.forEach((coord, idx) => {
      const bulbGeo = new THREE.SphereGeometry(0.24, 10, 8);
      const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe088 });
      const bulbMesh = new THREE.Mesh(bulbGeo, bulbMat);
      bulbMesh.position.set(coord[0], coord[1], coord[2]);
      bulbMesh.name = `Breakable_Lamp_${idx + 1}`;

      const pointLight = new THREE.PointLight(0xffaa44, 28, 22, 1.4);
      pointLight.position.set(coord[0], coord[1], coord[2]);

      scene.add(bulbMesh, pointLight);
      this.breakableLights.push({
        mesh: bulbMesh,
        light: pointLight,
        position: new THREE.Vector3(...coord),
        broken: false,
      });
    });
  }

  public checkBulletHitLamp(hitPoint: THREE.Vector3, scene: THREE.Scene): boolean {
    for (const lamp of this.breakableLights) {
      if (lamp.broken) continue;
      if (lamp.position.distanceTo(hitPoint) < 0.65) {
        lamp.broken = true;
        lamp.light.intensity = 0;
        lamp.light.visible = false;
        (lamp.mesh.material as THREE.MeshBasicMaterial).color.setHex(0x1e242d);

        // Glass shatter & electric spark burst
        const sparkGeo = new THREE.SphereGeometry(0.04, 6, 6);
        for (let s = 0; s < 8; s++) {
          const sMesh = new THREE.Mesh(
            sparkGeo,
            new THREE.MeshBasicMaterial({ color: 0x38bdf8, blending: THREE.AdditiveBlending })
          );
          sMesh.position.copy(lamp.position);
          scene.add(sMesh);
          setTimeout(() => scene.remove(sMesh), 250);
        }
        return true;
      }
    }
    return false;
  }

  public update(dt: number, elapsedSec: number, renderer: THREE.WebGLRenderer) {
    this.stormTimer += dt;

    // Cycle Rain Intensity: Light (30s) -> Heavy (40s) -> Storm (25s)
    const cycle = (elapsedSec * 0.02) % 3;
    if (cycle < 1.0) {
      this.rainIntensity = 'LIGHT';
      if (this.fogRef) this.fogRef.density = 0.0055;
    } else if (cycle < 2.2) {
      this.rainIntensity = 'HEAVY';
      if (this.fogRef) this.fogRef.density = 0.0075;
    } else {
      this.rainIntensity = 'STORM';
      if (this.fogRef) this.fogRef.density = 0.012;
    }

    // Dynamic Lightning Strike in Storm Mode
    const stormPhase = elapsedSec % 22.0;
    this.lightningActive =
      (stormPhase > 19.1 && stormPhase < 19.24) || (stormPhase > 19.34 && stormPhase < 19.42);

    if (this.lightningActive) {
      renderer.toneMappingExposure = 2.45;
    }
  }
}
