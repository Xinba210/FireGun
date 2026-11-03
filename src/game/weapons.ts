import * as THREE from 'three';
import { ATTACHMENTS_CATALOG } from './progression.ts';

export class WeaponsAttachmentVisualizer {
  private attachmentMeshes: Map<string, THREE.Object3D> = new Map();

  public mountAttachmentsOnWeapon(
    weaponGroup: THREE.Group,
    weaponId: string,
    equipped: { muzzle?: string; optic?: string; grip?: string; mag?: string }
  ) {
    // Clean old mounted accessories
    const toRemove: THREE.Object3D[] = [];
    weaponGroup.traverse((obj) => {
      if (obj.name.startsWith('Gunsmith_Attachment_')) {
        toRemove.push(obj);
      }
    });
    toRemove.forEach((obj) => obj.parent?.remove(obj));

    // 1. Muzzle Attachment
    if (equipped.muzzle) {
      const isSilencer = equipped.muzzle === 'muzzle_silencer';
      const mGroup = new THREE.Group();
      mGroup.name = `Gunsmith_Attachment_${equipped.muzzle}`;

      if (isSilencer) {
        const silBody = new THREE.Mesh(
          new THREE.CylinderGeometry(0.024, 0.024, 0.24, 16),
          new THREE.MeshStandardMaterial({ color: 0x14171d, roughness: 0.3, metalness: 0.85 })
        );
        silBody.rotation.x = Math.PI / 2;
        const endCap = new THREE.Mesh(
          new THREE.CylinderGeometry(0.025, 0.025, 0.02, 16),
          new THREE.MeshStandardMaterial({ color: 0x22262d, roughness: 0.4, metalness: 0.9 })
        );
        endCap.rotation.x = Math.PI / 2;
        endCap.position.z = -0.12;
        mGroup.add(silBody, endCap);
      } else {
        // Multi-port compensator
        const compBody = new THREE.Mesh(
          new THREE.CylinderGeometry(0.026, 0.024, 0.09, 12),
          new THREE.MeshStandardMaterial({ color: 0x1c2026, roughness: 0.35, metalness: 0.9 })
        );
        compBody.rotation.x = Math.PI / 2;
        const portFin = new THREE.Mesh(
          new THREE.BoxGeometry(0.038, 0.028, 0.06),
          new THREE.MeshStandardMaterial({ color: 0x282e38, roughness: 0.4, metalness: 0.8 })
        );
        mGroup.add(compBody, portFin);
      }
      mGroup.position.set(0, 0.04, -0.68);
      weaponGroup.add(mGroup);
    }

    // 2. Optic Attachment
    if (equipped.optic) {
      const oGroup = new THREE.Group();
      oGroup.name = `Gunsmith_Attachment_${equipped.optic}`;
      const baseRail = new THREE.Mesh(
        new THREE.BoxGeometry(0.038, 0.015, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x22262e, metalness: 0.8 })
      );
      oGroup.add(baseRail);

      if (equipped.optic === 'optic_reddot') {
        const sightHood = new THREE.Mesh(
          new THREE.BoxGeometry(0.042, 0.04, 0.065),
          new THREE.MeshStandardMaterial({ color: 0x1a1e24, roughness: 0.4 })
        );
        sightHood.position.y = 0.024;
        const glassReticle = new THREE.Mesh(
          new THREE.PlaneGeometry(0.028, 0.028),
          new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
        );
        glassReticle.position.set(0, 0.024, -0.01);
        oGroup.add(sightHood, glassReticle);
        oGroup.position.set(0, 0.095, -0.16);
      } else if (equipped.optic === 'optic_holo') {
        const holoBody = new THREE.Mesh(
          new THREE.BoxGeometry(0.048, 0.048, 0.095),
          new THREE.MeshStandardMaterial({ color: 0x252a32, roughness: 0.38, metalness: 0.8 })
        );
        holoBody.position.y = 0.028;
        const holoReticle = new THREE.Mesh(
          new THREE.RingGeometry(0.008, 0.014, 16),
          new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.92, side: THREE.DoubleSide })
        );
        holoReticle.position.set(0, 0.028, -0.02);
        oGroup.add(holoBody, holoReticle);
        oGroup.position.set(0, 0.095, -0.16);
      } else if (equipped.optic === 'optic_acog2x') {
        const scopeTube = new THREE.Mesh(
          new THREE.CylinderGeometry(0.022, 0.026, 0.16, 12),
          new THREE.MeshStandardMaterial({ color: 0x1f232b, roughness: 0.35, metalness: 0.75 })
        );
        scopeTube.rotation.x = Math.PI / 2;
        scopeTube.position.y = 0.035;
        const fiberRod = new THREE.Mesh(
          new THREE.CylinderGeometry(0.003, 0.003, 0.12, 6),
          new THREE.MeshBasicMaterial({ color: 0xff3b30 })
        );
        fiberRod.rotation.x = Math.PI / 2;
        fiberRod.position.set(0, 0.052, 0);
        oGroup.add(scopeTube, fiberRod);
        oGroup.position.set(0, 0.095, -0.14);
      } else if (equipped.optic === 'optic_sniper4x') {
        const sniperScope = new THREE.Mesh(
          new THREE.CylinderGeometry(0.032, 0.028, 0.28, 16),
          new THREE.MeshStandardMaterial({ color: 0x14181f, roughness: 0.28, metalness: 0.9 })
        );
        sniperScope.rotation.x = Math.PI / 2;
        sniperScope.position.y = 0.042;
        const turretH = new THREE.Mesh(
          new THREE.CylinderGeometry(0.009, 0.009, 0.024, 8),
          new THREE.MeshStandardMaterial({ color: 0xd8a838, roughness: 0.4, metalness: 0.8 })
        );
        turretH.position.set(0, 0.064, 0);
        oGroup.add(sniperScope, turretH);
        oGroup.position.set(0, 0.095, -0.12);
      } else {
        const defaultSight = new THREE.Mesh(
          new THREE.BoxGeometry(0.044, 0.042, 0.07),
          new THREE.MeshStandardMaterial({ color: 0x1a1e24, roughness: 0.4 })
        );
        defaultSight.position.y = 0.025;
        oGroup.add(defaultSight);
        oGroup.position.set(0, 0.095, -0.16);
      }

      weaponGroup.add(oGroup);
    }

    // 3. Grip Attachment
    if (equipped.grip) {
      const isVertical = equipped.grip === 'grip_vertical';
      const gGroup = new THREE.Group();
      gGroup.name = `Gunsmith_Attachment_${equipped.grip}`;

      if (isVertical) {
        const gMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.015, 0.017, 0.12, 10),
          new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.55 })
        );
        gGroup.add(gMesh);
        gGroup.position.set(0, -0.075, -0.36);
      } else {
        // Angled ergonomic grip
        const gMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.026, 0.065, 0.12),
          new THREE.MeshStandardMaterial({ color: 0x222830, roughness: 0.45 })
        );
        gMesh.rotation.x = 0.52;
        gGroup.add(gMesh);
        gGroup.position.set(0, -0.068, -0.36);
      }
      weaponGroup.add(gGroup);
    }

    // 4. Mag Attachment
    if (equipped.mag) {
      const isExt = equipped.mag === 'mag_extended';
      const mGroup = new THREE.Group();
      mGroup.name = `Gunsmith_Attachment_${equipped.mag}`;

      const magGeo = new THREE.BoxGeometry(0.032, isExt ? 0.23 : 0.16, 0.068);
      const magMat = new THREE.MeshStandardMaterial({
        color: isExt ? 0x262b33 : 0xc89832,
        metalness: isExt ? 0.75 : 0.85,
        roughness: 0.35,
      });
      const magMesh = new THREE.Mesh(magGeo, magMat);
      mGroup.add(magMesh);

      if (isExt) {
        // Ammo witness strip
        const witness = new THREE.Mesh(
          new THREE.BoxGeometry(0.008, 0.14, 0.07),
          new THREE.MeshBasicMaterial({ color: 0xf59e0b })
        );
        witness.position.set(0.014, 0, 0);
        mGroup.add(witness);
      } else {
        // Quickdraw rubber pull loop
        const loop = new THREE.Mesh(
          new THREE.BoxGeometry(0.034, 0.03, 0.074),
          new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.8 })
        );
        loop.position.set(0, -0.09, 0);
        mGroup.add(loop);
      }
      mGroup.position.set(0, -0.13, -0.08);
      weaponGroup.add(mGroup);
    }
  }
}

export class PictureInPictureScope {
  public renderTarget: THREE.WebGLRenderTarget;
  public scopeCamera: THREE.PerspectiveCamera;
  public lensMaterial: THREE.MeshBasicMaterial;

  constructor() {
    this.renderTarget = new THREE.WebGLRenderTarget(512, 512, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });
    this.scopeCamera = new THREE.PerspectiveCamera(12, 1, 0.1, 200);
    this.lensMaterial = new THREE.MeshBasicMaterial({
      map: this.renderTarget.texture,
    });
  }

  public render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, mainCamera: THREE.Camera) {
    this.scopeCamera.position.copy(mainCamera.position);
    this.scopeCamera.rotation.copy(mainCamera.rotation);

    const prevTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(this.renderTarget);
    renderer.render(scene, this.scopeCamera);
    renderer.setRenderTarget(prevTarget);
  }
}
