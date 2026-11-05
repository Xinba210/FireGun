import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { attachTacticalGear, TacticalGearNodes } from './tactical_gear.ts';
import { createGrenadeMesh, GrenadeType } from './grenades.ts';

export interface OperatorShowcaseOptions {
  container: HTMLElement;
  templateGltf: { scene: THREE.Group; animations: THREE.AnimationClip[] };
  topgunGltf?: { scene: THREE.Group; animations: THREE.AnimationClip[] } | null;
  weaponModels?: Record<string, THREE.Object3D>;
}

export type OperatorId = 'ROACH' | 'MAVERICK';
export type OperatorCamoScheme = 'MIDNIGHT' | 'URBAN_WOLF' | 'DESERT_OPS';
export type TourFocusTarget = 'full' | 'helmet' | 'chest' | 'waist' | 'legs';

export class OperatorShowcase {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private mixer!: THREE.AnimationMixer;
  private actions: Record<string, THREE.AnimationAction> = {};
  private activeAction: THREE.AnimationAction | null = null;
  private modelRoot: THREE.Group;
  private turntableGroup: THREE.Group;
  private weaponHolder: THREE.Group;
  private rafId: number | null = null;
  private isDragging = false;
  private previousMouseX = 0;
  private rotationSpeed = 0.008;
  private targetRotationY = 0;
  private currentRotationY = 0;

  // 戰術裝備與次級動態
  private gearNodes: TacticalGearNodes | null = null;
  private grenadeSlot: THREE.Group;
  private currentGrenadeType: GrenadeType = 'FRAG';
  private currentActiveClipName = 'Idle_Loop';

  // 3D 導覽相機平滑過渡
  private camTargetPos = new THREE.Vector3(0, 1.25, 3.2);
  private camTargetLook = new THREE.Vector3(0, 1.05, 0);
  private camCurrentLook = new THREE.Vector3(0, 1.05, 0);

  // 雙主角模板
  private options: OperatorShowcaseOptions;
  public currentOperator: OperatorId = 'ROACH';

  constructor(options: OperatorShowcaseOptions) {
    this.options = options;
    this.container = options.container;

    // 1. Setup Three.js Scene, Camera, Renderer
    const width = this.container.clientWidth || 360;
    const height = this.container.clientHeight || 420;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 50);
    this.camera.position.copy(this.camTargetPos);
    this.camera.lookAt(this.camTargetLook);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    // 2. Lighting & Tactical Spotlight Rig
    const ambient = new THREE.AmbientLight(0x1a2636, 1.4);
    this.scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xdbeafe, 2.6);
    keyLight.position.set(2.5, 4.0, 3.0);
    keyLight.castShadow = true;
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xfacc15, 2.2);
    rimLight.position.set(-3.0, 3.5, -2.5);
    this.scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 1.3);
    fillLight.position.set(0, -1.0, 2.0);
    this.scene.add(fillLight);

    // 3. Turntable Floor Disc
    this.turntableGroup = new THREE.Group();
    this.scene.add(this.turntableGroup);

    const discGeo = new THREE.CylinderGeometry(1.05, 1.1, 0.06, 32);
    const discMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.85,
      roughness: 0.25,
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.position.y = -0.03;
    disc.receiveShadow = true;
    this.turntableGroup.add(disc);

    const ringGeo = new THREE.RingGeometry(1.06, 1.12, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.002;
    this.turntableGroup.add(ring);

    this.turntableGroup.add(this.modelRoot = new THREE.Group());
    this.weaponHolder = new THREE.Group();
    this.grenadeSlot = new THREE.Group();
    this.grenadeSlot.name = 'grenade_slot_carrier';

    // 4. 加載主角模型與裝備
    this.loadCharacter('ROACH');

    // 5. 互動
    this.setupInteractions();

    // 6. Render Loop with Secondary Motion
    let lastTime = performance.now();
    const animate = () => {
      this.rafId = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      // 平滑轉盤旋轉
      this.currentRotationY += (this.targetRotationY - this.currentRotationY) * 0.14;
      this.turntableGroup.rotation.y = this.currentRotationY;

      // 相機平滑聚焦過渡 (3D 導覽特寫)
      this.camera.position.lerp(this.camTargetPos, 0.08);
      this.camCurrentLook.lerp(this.camTargetLook, 0.08);
      this.camera.lookAt(this.camCurrentLook);

      // 動畫更新
      if (this.mixer) {
        this.mixer.update(dt);
      }

      // 次級動態物理更新 (Secondary Motion)
      if (this.gearNodes) {
        const isSprinting = this.currentActiveClipName === 'Sprint_Loop';
        const isMoving = this.currentActiveClipName === 'Walk_Loop' || this.currentActiveClipName === 'Sprint_Loop';
        const simulatedSpeed = isSprinting ? 6.8 : isMoving ? 2.8 : 0.0;
        this.gearNodes.secondaryMotionMgr.update(dt, simulatedSpeed, isSprinting);
      }

      this.renderer.render(this.scene, this.camera);
    };
    this.rafId = requestAnimationFrame(animate);
  }

  /**
   * 切換特戰主角 (ROACH 鬼影 vs MAVERICK 遊俠)
   */
  public loadCharacter(opId: OperatorId) {
    this.currentOperator = opId;
    this.turntableGroup.remove(this.modelRoot);

    const sourceGltf = (opId === 'MAVERICK' && this.options.topgunGltf)
      ? this.options.topgunGltf
      : this.options.templateGltf;

    this.modelRoot = SkeletonUtils.clone(sourceGltf.scene) as THREE.Group;
    this.modelRoot.position.set(0, 0, 0);

    // 依據主角微調縮放 (TopGun 骨架標準化)
    if (opId === 'MAVERICK') {
      this.modelRoot.scale.setScalar(1.0);
    }

    this.modelRoot.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    this.turntableGroup.add(this.modelRoot);

    // 裝配細緻化戰術配件與次級動態 (Tactical Gear & Secondary Motion)
    this.gearNodes = attachTacticalGear(this.modelRoot, this.turntableGroup);

    // 掛載武器
    const rightHand = this.modelRoot.getObjectByName('hand_r') || this.modelRoot.getObjectByName('RightHand') || this.modelRoot.getObjectByName('spine_03');
    if (rightHand) {
      this.weaponHolder.clear();
      rightHand.add(this.weaponHolder);
      if (this.options.weaponModels && this.options.weaponModels['ar7']) {
        const wep = this.options.weaponModels['ar7'].clone(true);
        wep.scale.setScalar(0.9);
        this.weaponHolder.add(wep);
      }
    }

    // 掛載手榴彈在戰術背心側袋
    this.gearNodes.vestGroup.add(this.grenadeSlot);
    this.grenadeSlot.position.set(-0.14, -0.04, 0.13);
    this.setGrenadeAttachment(this.currentGrenadeType);

    // 動畫綁定
    this.mixer = new THREE.AnimationMixer(this.modelRoot);
    this.actions = {};
    for (const clip of sourceGltf.animations) {
      this.actions[clip.name] = this.mixer.clipAction(clip);
    }

    // 若為 Maverick 且缺少部分動畫，借用主模板動畫
    if (sourceGltf.animations.length < 5 && this.options.templateGltf.animations.length > 0) {
      for (const clip of this.options.templateGltf.animations) {
        if (!this.actions[clip.name]) {
          try {
            this.actions[clip.name] = this.mixer.clipAction(clip);
          } catch (e) {
            // ignore non-matching track errors
          }
        }
      }
    }

    const defaultClip = this.actions['Rifle_Aim'] || this.actions['Idle_Loop'];
    if (defaultClip) {
      defaultClip.play();
      this.activeAction = defaultClip;
      this.currentActiveClipName = 'Idle_Loop';
    }
  }

  /**
   * 3D 導覽相機視角特寫切換
   */
  public focusTourTarget(target: TourFocusTarget) {
    if (target === 'full') {
      this.camTargetPos.set(0, 1.25, 3.2);
      this.camTargetLook.set(0, 1.05, 0);
    } else if (target === 'helmet') {
      this.camTargetPos.set(0, 1.72, 1.15);
      this.camTargetLook.set(0, 1.68, 0);
    } else if (target === 'chest') {
      this.camTargetPos.set(0, 1.25, 1.25);
      this.camTargetLook.set(0, 1.2, 0);
    } else if (target === 'waist') {
      this.camTargetPos.set(0.1, 0.95, 1.2);
      this.camTargetLook.set(0, 0.92, 0);
    } else if (target === 'legs') {
      this.camTargetPos.set(0.25, 0.55, 1.35);
      this.camTargetLook.set(0.1, 0.5, 0);
    }
  }

  /**
   * 切換配件上的手榴彈 3D 模型外觀
   */
  public setGrenadeAttachment(type: GrenadeType) {
    this.currentGrenadeType = type;
    this.grenadeSlot.clear();
    const gMesh = createGrenadeMesh(type);
    gMesh.scale.setScalar(0.85);
    gMesh.rotation.z = 0.25;
    this.grenadeSlot.add(gMesh);
  }

  /**
   * 觸發急停或跳躍落地次級動態衝量 (Secondary Motion Impulse)
   */
  public triggerImpulse(type: 'stop' | 'jump_land') {
    if (!this.gearNodes) return;
    if (type === 'stop') {
      // 急停：向前甩動衝量
      this.gearNodes.secondaryMotionMgr.applyImpulse(new THREE.Vector3(14.0, 0, 0));
    } else {
      // 落地：向下衝壓震動
      this.gearNodes.secondaryMotionMgr.applyImpulse(new THREE.Vector3(8.0, 0, 8.0));
    }
  }

  private setupInteractions() {
    const el = this.renderer.domElement;

    const onPointerDown = (clientX: number) => {
      this.isDragging = true;
      this.previousMouseX = clientX;
    };

    const onPointerMove = (clientX: number) => {
      if (!this.isDragging) return;
      const deltaX = clientX - this.previousMouseX;
      this.targetRotationY += deltaX * this.rotationSpeed;
      this.previousMouseX = clientX;
    };

    const onPointerUp = () => {
      this.isDragging = false;
    };

    el.addEventListener('mousedown', (e) => onPointerDown(e.clientX));
    window.addEventListener('mousemove', (e) => onPointerMove(e.clientX));
    window.addEventListener('mouseup', onPointerUp);

    el.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) onPointerDown(e.touches[0].clientX);
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) onPointerMove(e.touches[0].clientX);
    }, { passive: true });
    window.addEventListener('touchend', onPointerUp);
  }

  public setPose(clipName: string) {
    this.currentActiveClipName = clipName;
    const next = this.actions[clipName];
    if (!next || next === this.activeAction) return;

    if (this.activeAction) {
      this.activeAction.fadeOut(0.2);
    }
    next.reset().fadeIn(0.2).play();
    this.activeAction = next;
  }

  public setCamo(scheme: OperatorCamoScheme) {
    const colors: Record<OperatorCamoScheme, number> = {
      MIDNIGHT: 0x1e293b,
      URBAN_WOLF: 0x475569,
      DESERT_OPS: 0x785338,
    };
    const targetColor = new THREE.Color(colors[scheme] || 0x1e293b);

    this.modelRoot.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        if (mesh.material && (mesh.material as THREE.MeshStandardMaterial).color) {
          (mesh.material as THREE.MeshStandardMaterial).color.copy(targetColor);
        }
      }
    });
  }

  public resize() {
    const width = this.container.clientWidth || 360;
    const height = this.container.clientHeight || 420;
    if (width > 0 && height > 0) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    }
  }

  public destroy() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.renderer.dispose();
  }
}
