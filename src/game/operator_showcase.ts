import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

export interface OperatorShowcaseOptions {
  container: HTMLElement;
  templateGltf: { scene: THREE.Group; animations: THREE.AnimationClip[] };
  weaponModels?: Record<string, THREE.Object3D>;
}

export type OperatorCamoScheme = 'MIDNIGHT' | 'URBAN_WOLF' | 'DESERT_OPS';

export class OperatorShowcase {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private mixer: THREE.AnimationMixer;
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

  constructor(options: OperatorShowcaseOptions) {
    this.container = options.container;

    // 1. Setup Three.js Scene, Camera, Renderer
    const width = this.container.clientWidth || 360;
    const height = this.container.clientHeight || 420;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 50);
    this.camera.position.set(0, 1.25, 3.2);
    this.camera.lookAt(0, 1.05, 0);

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
    const ambient = new THREE.AmbientLight(0x1a2636, 1.2);
    this.scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xdbeafe, 2.4);
    keyLight.position.set(2.5, 4.0, 3.0);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xfacc15, 2.0); // Gold tactical rim
    rimLight.position.set(-3.0, 3.5, -2.5);
    this.scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 1.2); // Cyan ambient bounce
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

    // Outer glow ring
    const ringGeo = new THREE.RingGeometry(1.06, 1.12, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.002;
    this.turntableGroup.add(ring);

    // 4. Clone Character Rig
    this.modelRoot = SkeletonUtils.clone(options.templateGltf.scene) as THREE.Group;
    this.modelRoot.position.set(0, 0, 0);
    this.modelRoot.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    this.turntableGroup.add(this.modelRoot);

    // Mount weapon holder
    this.weaponHolder = new THREE.Group();
    const rightHand = this.modelRoot.getObjectByName('hand_r') || this.modelRoot.getObjectByName('spine_03');
    if (rightHand) {
      rightHand.add(this.weaponHolder);
    }

    if (options.weaponModels && options.weaponModels['ar7']) {
      const wep = options.weaponModels['ar7'].clone(true);
      wep.scale.setScalar(0.9);
      wep.position.set(0, 0, 0);
      this.weaponHolder.add(wep);
    }

    // 5. Animations
    this.mixer = new THREE.AnimationMixer(this.modelRoot);
    for (const clip of options.templateGltf.animations) {
      this.actions[clip.name] = this.mixer.clipAction(clip);
    }

    // Default Stance: Rifle_Aim or Idle_Loop
    const defaultClip = this.actions['Rifle_Aim'] || this.actions['Idle_Loop'];
    if (defaultClip) {
      defaultClip.play();
      this.activeAction = defaultClip;
    }

    // 6. Interactive 360-degree Drag Controls
    this.setupInteractions();

    // 7. Render Loop
    let lastTime = performance.now();
    const animate = () => {
      this.rafId = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      // Smooth turntable rotation interpolation
      this.currentRotationY += (this.targetRotationY - this.currentRotationY) * 0.12;
      this.turntableGroup.rotation.y = this.currentRotationY;

      this.mixer.update(dt);
      this.renderer.render(this.scene, this.camera);
    };
    this.rafId = requestAnimationFrame(animate);
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

    // Mouse events
    el.addEventListener('mousedown', (e) => onPointerDown(e.clientX));
    window.addEventListener('mousemove', (e) => onPointerMove(e.clientX));
    window.addEventListener('mouseup', onPointerUp);

    // Touch events
    el.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) onPointerDown(e.touches[0].clientX);
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) onPointerMove(e.touches[0].clientX);
    }, { passive: true });
    window.addEventListener('touchend', onPointerUp);
  }

  public setPose(clipName: string) {
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

  public destroy() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.renderer.dispose();
  }
}
