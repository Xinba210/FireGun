import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

export type SoldierTeam = 'PLAYER_SQUAD' | 'ENEMY_MERC';
export type SquadOrder = 'FOLLOW' | 'HOLD' | 'MOVE_TO' | 'ATTACK_TARGET' | 'REGROUP';

export interface SoldierActor {
  id: string;
  name: string;
  team: SoldierTeam;
  archetype: 'ASSAULT' | 'SNIPER' | 'BREACHER';
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
  actions: Record<string, THREE.AnimationAction>;
  activeClip: string;
  hp: number;
  maxHp: number;
  downed: boolean;
  downedTimer: number;
  order: SquadOrder;
  targetPos: THREE.Vector3;
  targetEnemy: SoldierActor | null;
  fireCooldown: number;
  muzzleFlash: THREE.Mesh;
  laserLine?: THREE.Line;
  statusSprite?: THREE.Sprite;
  baseY: number;
}

export class SquadManager {
  public squadMembers: SoldierActor[] = [];
  public wheelOpen = false;
  public timeScale = 1.0;
  private radioSubtitleTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.createSquadHud();
  }

  private createSquadHud() {
    if (typeof document === 'undefined') return;
    let sWrap = document.getElementById('squad-hud-widget');
    if (!sWrap) {
      sWrap = document.createElement('div');
      sWrap.id = 'squad-hud-widget';
      sWrap.className = 'squad-hud-widget';
      sWrap.innerHTML = `
        <div class="squad-title-tag">SQUAD // 戰術小隊 (2)</div>
        <div id="squad-mate-1" class="squad-mate-card">
          <div class="sm-info-col">
            <span class="sm-callsign">B-1 · GHOST</span>
            <span id="sm-1-order" class="sm-order-tag">FOLLOW</span>
          </div>
          <div class="sm-bar-bg"><div id="sm-1-hp" class="sm-bar-fill" style="width:100%"></div></div>
        </div>
        <div id="squad-mate-2" class="squad-mate-card">
          <div class="sm-info-col">
            <span class="sm-callsign">B-2 · ROACH</span>
            <span id="sm-2-order" class="sm-order-tag">FOLLOW</span>
          </div>
          <div class="sm-bar-bg"><div id="sm-2-hp" class="sm-bar-fill" style="width:100%"></div></div>
        </div>
        <div id="squad-radio-sub" class="squad-radio-sub hidden">
          <span class="radio-icon">📻</span>
          <span id="squad-radio-text"></span>
        </div>
      `;
      document.body.appendChild(sWrap);
    }

    // Command Wheel Modal (Hold Z or Tap Squad Button)
    let wModal = document.getElementById('command-wheel-modal');
    if (!wModal) {
      wModal = document.createElement('div');
      wModal.id = 'command-wheel-modal';
      wModal.className = 'command-wheel-modal hidden';
      wModal.innerHTML = `
        <div class="command-wheel-center">
          <div class="cw-center-icon">⚡</div>
          <div id="cw-center-label" class="cw-center-label">SQUAD ORDERS</div>
        </div>
        <div class="command-wheel-ring">
          <button data-order="FOLLOW" class="cw-slice cw-top">▲ 跟隨我 (FOLLOW)</button>
          <button data-order="HOLD" class="cw-slice cw-top-right">🛡 就地防守 (HOLD)</button>
          <button data-order="MOVE_TO" class="cw-slice cw-bottom-right">📍 前往標記 (MOVE)</button>
          <button data-order="ATTACK_TARGET" class="cw-slice cw-bottom">🔥 集火目標 (FOCUS)</button>
          <button data-order="REGROUP" class="cw-slice cw-top-left">🔄 重整歸隊 (REGROUP)</button>
        </div>
      `;
      document.body.appendChild(wModal);
    }
  }

  public initSquadMembers(templateGltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }, scene: THREE.Scene, playerPos: THREE.Vector3) {
    // Clear existing
    for (const m of this.squadMembers) {
      scene.remove(m.root);
    }
    this.squadMembers = [];

    const offsets = [
      { name: 'B-1 · GHOST', dx: -2.4, dz: 3.5, role: 'ASSAULT' as const },
      { name: 'B-2 · ROACH', dx: 2.4, dz: 4.2, role: 'BREACHER' as const },
    ];

    offsets.forEach((cfg, idx) => {
      const cloned = SkeletonUtils.clone(templateGltf.scene) as THREE.Group;
      cloned.position.set(playerPos.x + cfg.dx, playerPos.y, playerPos.z + cfg.dz);

      // Add Glowing Blue Armband for Allied Squad
      const armband = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 0.07, 10),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
      );
      armband.position.set(0.24, 1.34, 0);
      cloned.add(armband);

      cloned.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      });

      const mixer = new THREE.AnimationMixer(cloned);
      const actions: Record<string, THREE.AnimationAction> = {};
      for (const clip of templateGltf.animations) {
        actions[clip.name] = mixer.clipAction(clip);
      }

      const mf = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xffcc33, transparent: true, opacity: 0 })
      );
      mf.position.set(-0.1, 1.36, 0.7);
      cloned.add(mf);

      const actor: SoldierActor = {
        id: `squad_${idx + 1}`,
        name: cfg.name,
        team: 'PLAYER_SQUAD',
        archetype: cfg.role,
        root: cloned,
        mixer,
        actions,
        activeClip: '',
        hp: 120,
        maxHp: 120,
        downed: false,
        downedTimer: 0,
        order: 'FOLLOW',
        targetPos: cloned.position.clone(),
        targetEnemy: null,
        fireCooldown: 1.0 + idx * 0.4,
        muzzleFlash: mf,
        baseY: playerPos.y,
      };

      scene.add(cloned);
      this.playClip(actor, 'Idle_Loop', true);
      this.squadMembers.push(actor);
    });

    this.updateHud();
    this.broadcastRadio('Alpha Team boots on the ground. Standing by for orders!');
  }

  public playClip(actor: SoldierActor, clipName: string, loop = true) {
    if (actor.activeClip === clipName) return;
    const next = actor.actions[clipName] || actor.actions['Idle_Loop'];
    if (!next) return;
    const prev = actor.actions[actor.activeClip];
    if (prev && prev !== next) {
      prev.fadeOut(0.18);
    }
    next.reset();
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    next.clampWhenFinished = !loop;
    next.fadeIn(0.18).play();
    actor.activeClip = clipName;
  }

  public broadcastRadio(text: string) {
    const sub = document.getElementById('squad-radio-sub');
    const txt = document.getElementById('squad-radio-text');
    if (sub && txt) {
      txt.textContent = text;
      sub.classList.remove('hidden');
      if (this.radioSubtitleTimeout) clearTimeout(this.radioSubtitleTimeout);
      this.radioSubtitleTimeout = setTimeout(() => sub.classList.add('hidden'), 3500);
    }
  }

  public setOrder(order: SquadOrder, dest?: THREE.Vector3, targetEnemy?: SoldierActor) {
    for (const m of this.squadMembers) {
      if (m.downed) continue;
      m.order = order;
      if (dest) m.targetPos.copy(dest);
      if (targetEnemy) m.targetEnemy = targetEnemy;
    }
    const orderMessages: Record<SquadOrder, string> = {
      FOLLOW: 'Copy, regrouping on you!',
      HOLD: 'Holding position, setting security.',
      MOVE_TO: 'Moving to marked location, covering angles!',
      ATTACK_TARGET: 'Focusing fire on target!',
      REGROUP: 'All squad members, on your six!',
    };
    this.broadcastRadio(orderMessages[order] || 'Roger that!');
    this.updateHud();
  }

  public openCommandWheel(open = true) {
    this.wheelOpen = open;
    this.timeScale = open ? 0.3 : 1.0;
    const modal = document.getElementById('command-wheel-modal');
    modal?.classList.toggle('hidden', !open);
  }

  public update(dt: number, playerPos: THREE.Vector3, enemies: { state: string; root: THREE.Group; hp: number }[]) {
    this.squadMembers.forEach((m, idx) => {
      m.mixer.update(dt * this.timeScale);

      // Downed Logic
      if (m.downed) {
        m.downedTimer += dt;
        if (m.downedTimer > 30) {
          m.hp = 0;
          this.playClip(m, 'Death01', false);
        } else {
          this.playClip(m, 'Hit_Chest', true);
        }
        return;
      }

      // Calculate desired destination
      const dest = new THREE.Vector3();
      if (m.order === 'FOLLOW' || m.order === 'REGROUP') {
        const offsetAngle = idx === 0 ? -0.85 : 0.85;
        dest.set(
          playerPos.x + Math.sin(offsetAngle) * 3.6,
          playerPos.y,
          playerPos.z + Math.cos(offsetAngle) * 3.6
        );
      } else if (m.order === 'MOVE_TO') {
        dest.copy(m.targetPos);
      } else {
        dest.copy(m.root.position);
      }

      // Movement to destination
      const toDest = dest.clone().sub(m.root.position);
      toDest.y = 0;
      const dist = toDest.length();
      if (dist > 0.8) {
        toDest.normalize();
        const moveSpeed = dist > 4.5 ? 5.2 : 3.4;
        m.root.position.addScaledVector(toDest, moveSpeed * dt * this.timeScale);
        m.root.rotation.y = Math.atan2(toDest.x, toDest.z);
        this.playClip(m, dist > 4.5 ? 'Sprint_Loop' : 'Jog_Fwd_Loop', true);
      } else {
        this.playClip(m, 'Idle_Loop', true);
      }

      // Combat Behavior: Target Alive Enemy
      m.fireCooldown -= dt * this.timeScale;
      const aliveEnemies = enemies.filter((e) => e.state !== 'DEAD');
      if (aliveEnemies.length > 0) {
        const nearest = aliveEnemies.sort(
          (a, b) => a.root.position.distanceTo(m.root.position) - b.root.position.distanceTo(m.root.position)
        )[0];

        if (nearest && nearest.root.position.distanceTo(m.root.position) < 28) {
          m.root.lookAt(nearest.root.position.x, m.root.position.y, nearest.root.position.z);
          if (m.fireCooldown <= 0) {
            m.fireCooldown = 1.3 + Math.random() * 0.6;
            (m.muzzleFlash.material as THREE.MeshBasicMaterial).opacity = 0.95;
            nearest.hp -= 22;
            if (nearest.hp <= 0) {
              this.broadcastRadio(`Hostile down! Good kill, ${m.name}.`);
            }
          }
        }
      }

      if ((m.muzzleFlash.material as THREE.MeshBasicMaterial).opacity > 0) {
        (m.muzzleFlash.material as THREE.MeshBasicMaterial).opacity = Math.max(
          0,
          (m.muzzleFlash.material as THREE.MeshBasicMaterial).opacity - dt * 10
        );
      }
    });

    this.updateHud();
  }

  public reviveMember(memberId: string): boolean {
    const m = this.squadMembers.find((s) => s.id === memberId);
    if (m && m.downed) {
      m.downed = false;
      m.hp = 75;
      m.downedTimer = 0;
      this.playClip(m, 'Idle_Loop', true);
      this.broadcastRadio(`Thanks for the revive! Back in the fight.`);
      this.updateHud();
      return true;
    }
    return false;
  }

  public updateHud() {
    this.squadMembers.forEach((m, idx) => {
      const card = document.getElementById(`squad-mate-${idx + 1}`);
      const hpEl = document.getElementById(`sm-${idx + 1}-hp`);
      const ordEl = document.getElementById(`sm-${idx + 1}-order`);
      if (card) card.classList.toggle('sm-downed', m.downed);
      if (hpEl) hpEl.style.width = `${Math.max(0, (m.hp / m.maxHp) * 100)}%`;
      if (ordEl) ordEl.textContent = m.downed ? 'DOWNED ⚠️' : m.order;
    });
  }
}
