import * as THREE from 'three';

/**
 * Secondary Motion Node Configuration
 * 分類：
 * - 'HEAVY': 大幅晃動 / 懸掛式配件 (槍背帶、垂掛手套、水壺、肩帶尾端)
 * - 'MEDIUM': 中幅晃動 / 彈性配件 (無線電天線、腿掛包、飲水管、IFAK急救包)
 * - 'RIGID': 小幅晃動 / 緊固式配件 (頭盔、胸甲、彈匣袋，跟隨骨架微震)
 */
export type MotionCategory = 'HEAVY' | 'MEDIUM' | 'RIGID';

export interface SecondaryNodeConfig {
  name: string;
  category: MotionCategory;
  stiffness: number;       // 彈性係數 (越高回彈越快)
  damping: number;         // 阻尼係數 (越高擺動停止越快)
  mass: number;            // 質量/慣性權重
  maxAngleRad: number;     // 最大擺動角度限制 (弧度)
  restRotation: THREE.Euler; // 初始靜止姿態
  hasCollisionCapsule?: boolean; // 是否防止穿透身體
}

export class SecondaryMotionManager {
  private parentObject: THREE.Object3D;
  private nodes: Map<THREE.Object3D, {
    config: SecondaryNodeConfig;
    currentAngle: THREE.Vector3; // 當前歐拉角位移 (pitch, yaw, roll)
    angularVelocity: THREE.Vector3; // 角速度
    lastParentPos: THREE.Vector3;
    lastParentRotY: number;
  }> = new Map();

  private parentLinearVelocity = new THREE.Vector3();
  private parentLinearAcceleration = new THREE.Vector3();
  private parentAngularVelocityY = 0;
  private lastParentWorldPos = new THREE.Vector3();
  private lastParentWorldRotY = 0;
  private isFirstUpdate = true;

  constructor(parentObject: THREE.Object3D) {
    this.parentObject = parentObject;
  }

  /**
   * 註冊動態配件節點
   */
  public registerNode(mesh: THREE.Object3D, config: SecondaryNodeConfig) {
    mesh.rotation.copy(config.restRotation);
    this.nodes.set(mesh, {
      config,
      currentAngle: new THREE.Vector3(0, 0, 0),
      angularVelocity: new THREE.Vector3(0, 0, 0),
      lastParentPos: new THREE.Vector3(),
      lastParentRotY: 0,
    });
  }

  /**
   * 每幀物理更新
   * @param dt 幀間隔秒數
   * @param customLinearSpeed 外部傳入之線性速度（如玩家當前移動速度大小）
   * @param customIsSprinting 是否衝刺中
   */
  public update(dt: number, customLinearSpeed?: number, customIsSprinting?: boolean) {
    if (dt <= 0 || dt > 0.1) dt = 0.016; // 限制時間步長防穿模

    // 1. 計算父層世界空間線速度與加速度、角速度
    const currentWorldPos = new THREE.Vector3();
    this.parentObject.getWorldPosition(currentWorldPos);
    const currentWorldRotY = this.parentObject.rotation.y;

    if (this.isFirstUpdate) {
      this.lastParentWorldPos.copy(currentWorldPos);
      this.lastParentWorldRotY = currentWorldRotY;
      this.isFirstUpdate = false;
      return;
    }

    const currentVelocity = currentWorldPos.clone().sub(this.lastParentWorldPos).divideScalar(dt);
    this.parentLinearAcceleration.copy(currentVelocity).sub(this.parentLinearVelocity).divideScalar(dt);
    this.parentLinearVelocity.copy(currentVelocity);

    let deltaRotY = currentWorldRotY - this.lastParentWorldRotY;
    while (deltaRotY > Math.PI) deltaRotY -= Math.PI * 2;
    while (deltaRotY < -Math.PI) deltaRotY += Math.PI * 2;
    this.parentAngularVelocityY = deltaRotY / dt;

    this.lastParentWorldPos.copy(currentWorldPos);
    this.lastParentWorldRotY = currentWorldRotY;

    // 2. 針對各配件解算彈簧阻尼系統 (Spring-Damper Simulation)
    this.nodes.forEach((state, mesh) => {
      const cfg = state.config;

      // 慣性外力衝量 (Inertial Force Impulses)
      let targetPitchImpulse = 0; // 前後擺動 (X軸)
      let targetYawImpulse = 0;   // 水平旋轉擺動 (Y軸)
      let targetRollImpulse = 0;  // 左右傾斜擺動 (Z軸)

      // a. 轉身離心力延遲 (Centrifugal Yaw / Roll)
      if (cfg.category === 'HEAVY') {
        targetRollImpulse -= this.parentAngularVelocityY * 0.18 * cfg.mass;
      } else if (cfg.category === 'MEDIUM') {
        targetRollImpulse -= this.parentAngularVelocityY * 0.08 * cfg.mass;
      }

      // b. 前後線速度與急停加速度慣性 (Linear Forward / Backward / Stop)
      // 若外部有提供線性移動速度（例如奔跑與急停）
      const forwardAccel = -this.parentLinearAcceleration.z; // 前進加速度反作用力
      if (cfg.category === 'HEAVY') {
        targetPitchImpulse += forwardAccel * 0.045 * cfg.mass;
      } else if (cfg.category === 'MEDIUM') {
        targetPitchImpulse += forwardAccel * 0.018 * cfg.mass;
      }

      // c. 奔跑與步行步伐節奏上下上下起伏引起的擺動 (Stride Rhythmic Oscillation)
      const speed = customLinearSpeed !== undefined ? customLinearSpeed : this.parentLinearVelocity.length();
      if (speed > 0.1) {
        const freq = customIsSprinting ? 12.0 : 7.5;
        const time = performance.now() * 0.001;
        const bounce = Math.sin(time * freq);

        if (cfg.category === 'HEAVY') {
          targetPitchImpulse += bounce * (customIsSprinting ? 0.32 : 0.14);
          targetRollImpulse += Math.cos(time * freq * 0.5) * (customIsSprinting ? 0.18 : 0.06);
        } else if (cfg.category === 'MEDIUM') {
          targetPitchImpulse += bounce * (customIsSprinting ? 0.12 : 0.05);
          targetRollImpulse += Math.cos(time * freq * 0.5) * (customIsSprinting ? 0.05 : 0.02);
        } else {
          // RIGID 僅輕微跟隨步態起伏
          targetPitchImpulse += bounce * 0.015;
        }
      }

      // 3. 彈簧與阻尼計算: a = -k * x - c * v + F_ext
      const springAccX = -cfg.stiffness * state.currentAngle.x - cfg.damping * state.angularVelocity.x + targetPitchImpulse * 50;
      const springAccY = -cfg.stiffness * state.currentAngle.y - cfg.damping * state.angularVelocity.y + targetYawImpulse * 50;
      const springAccZ = -cfg.stiffness * state.currentAngle.z - cfg.damping * state.angularVelocity.z + targetRollImpulse * 50;

      // 數值積分 (Semi-implicit Euler)
      state.angularVelocity.x += springAccX * dt;
      state.angularVelocity.y += springAccY * dt;
      state.angularVelocity.z += springAccZ * dt;

      state.currentAngle.x += state.angularVelocity.x * dt;
      state.currentAngle.y += state.angularVelocity.y * dt;
      state.currentAngle.z += state.angularVelocity.z * dt;

      // 4. 防穿透碰撞限制與最大擺動夾角約束 (Collision Capsule & Angle Clamping)
      state.currentAngle.x = THREE.MathUtils.clamp(state.currentAngle.x, -cfg.maxAngleRad, cfg.maxAngleRad);
      state.currentAngle.y = THREE.MathUtils.clamp(state.currentAngle.y, -cfg.maxAngleRad, cfg.maxAngleRad);
      state.currentAngle.z = THREE.MathUtils.clamp(state.currentAngle.z, -cfg.maxAngleRad, cfg.maxAngleRad);

      // 若有身體防穿模碰撞約束 (例如避免槍背帶或腰包穿入胸甲內部)
      if (cfg.hasCollisionCapsule) {
        // 限制 Pitch 不能向內過度穿入身體 (X 限制不能小於 -0.05)
        if (state.currentAngle.x < -0.05) {
          state.currentAngle.x = -0.05;
          state.angularVelocity.x = -state.angularVelocity.x * 0.2; // 彈回
        }
      }

      // 5. 套用至配件網格姿態
      mesh.rotation.x = cfg.restRotation.x + state.currentAngle.x;
      mesh.rotation.y = cfg.restRotation.y + state.currentAngle.y;
      mesh.rotation.z = cfg.restRotation.z + state.currentAngle.z;
    });
  }

  /**
   * 施加衝量（例如跳躍著地震動、急停甩動、被擊中或爆炸震顫）
   */
  public applyImpulse(impulse: THREE.Vector3) {
    this.nodes.forEach((state) => {
      const mult = state.config.category === 'HEAVY' ? 1.6 : state.config.category === 'MEDIUM' ? 0.9 : 0.2;
      state.angularVelocity.x += impulse.x * mult * state.config.mass;
      state.angularVelocity.y += impulse.y * mult * state.config.mass;
      state.angularVelocity.z += impulse.z * mult * state.config.mass;
    });
  }
}
