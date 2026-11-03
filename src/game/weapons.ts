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
      const mGeo = isSilencer
        ? new THREE.CylinderGeometry(0.022, 0.022, 0.22, 12)
        : new THREE.CylinderGeometry(0.025, 0.023, 0.09, 10);
      const mMat = new THREE.MeshStandardMaterial({ color: 0x181c22, roughness: 0.35, metalness: 0.85 });
      const mMesh = new THREE.Mesh(mGeo, mMat);
      mMesh.name = `Gunsmith_Attachment_${equipped.muzzle}`;
      mMesh.rotation.x = Math.PI / 2;
      mMesh.position.set(0, 0.04, -0.68);
      weaponGroup.add(mMesh);
    }

    // 2. Optic Attachment
    if (equipped.optic) {
      const oGroup = new THREE.Group();
      oGroup.name = `Gunsmith_Attachment_${equipped.optic}`;
      const baseRail = new THREE.Mesh(
        new THREE.BoxGeometry(0.038, 0.015, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x22262e, metalness: 0.8 })
      );
      const sightHood = new THREE.Mesh(
        new THREE.BoxGeometry(0.044, 0.042, 0.07),
        new THREE.MeshStandardMaterial({ color: 0x1a1e24, roughness: 0.4 })
      );
      sightHood.position.y = 0.025;
      const glassReticle = new THREE.Mesh(
        new THREE.PlaneGeometry(0.032, 0.032),
        new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
      );
      glassReticle.position.set(0, 0.025, -0.01);
      oGroup.add(baseRail, sightHood, glassReticle);
      oGroup.position.set(0, 0.095, -0.16);
      weaponGroup.add(oGroup);
    }

    // 3. Grip Attachment
    if (equipped.grip) {
      const isVertical = equipped.grip === 'grip_vertical';
      const gGeo = isVertical
        ? new THREE.CylinderGeometry(0.014, 0.016, 0.11, 8)
        : new THREE.BoxGeometry(0.025, 0.065, 0.11);
      const gMat = new THREE.MeshStandardMaterial({ color: 0x222830, roughness: 0.5 });
      const gMesh = new THREE.Mesh(gGeo, gMat);
      gMesh.name = `Gunsmith_Attachment_${equipped.grip}`;
      if (!isVertical) gMesh.rotation.x = 0.45;
      gMesh.position.set(0, -0.075, -0.36);
      weaponGroup.add(gMesh);
    }

    // 4. Mag Attachment
    if (equipped.mag) {
      const isExt = equipped.mag === 'mag_extended';
      const magGeo = new THREE.BoxGeometry(0.032, isExt ? 0.22 : 0.15, 0.065);
      const magMat = new THREE.MeshStandardMaterial({
        color: isExt ? 0x2d3436 : 0xd8a838,
        metalness: isExt ? 0.7 : 0.85,
      });
      const magMesh = new THREE.Mesh(magGeo, magMat);
      magMesh.name = `Gunsmith_Attachment_${equipped.mag}`;
      magMesh.position.set(0, -0.13, -0.08);
      weaponGroup.add(magMesh);
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
