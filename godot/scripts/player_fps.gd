extends CharacterBody3D

## First-Person Player Controller & Multi-Weapon Combat System (Godot 4.7)
## Supports WASD Movement, Sprint, Crouch, Jump, Mouse Look, ADS, Recoil, Reload,
## 3 Weapons (AR-7 Carbine, SR-9 Sniper, RL-7 Rocket Launcher), and 3D Spatial Audio.

const WALK_SPEED := 4.3
const SPRINT_SPEED := 6.4
const CROUCH_SPEED := 2.8
const JUMP_VELOCITY := 6.2
const GRAVITY := 16.5

var hp: float = 100.0
var armor: float = 150.0
var is_crouching: bool = false
var is_ads: bool = false
var is_reloading: bool = false
var gyro_enabled: bool = false
var gyro_sensitivity: float = 0.85
var lean_target: float = 0.0
var lean_amount: float = 0.0
var active_weapon_idx: int = 0

var weapons := [
	{"id": "ar7", "name": "AR-7 カービン", "dmg": 34.0, "hs_mult": 2.2, "mag": 36, "mag_max": 36, "res": 144, "rate": 0.105, "ads_fov": 44.0, "sfx": "res://assets/audio/ar7_shot.wav"},
	{"id": "smg9", "name": "SMG-9 タクティカル", "dmg": 25.0, "hs_mult": 2.0, "mag": 45, "mag_max": 45, "res": 180, "rate": 0.068, "ads_fov": 48.0, "sfx": "res://assets/audio/smg9_shot.wav"},
	{"id": "sg12", "name": "SG-12 ブリーチャー", "dmg": 152.0, "hs_mult": 1.75, "mag": 8, "mag_max": 8, "res": 40, "rate": 0.42, "ads_fov": 50.0, "sfx": "res://assets/audio/sg12_shot.wav"},
	{"id": "sr9", "name": "SR-9 スナイパー", "dmg": 115.0, "hs_mult": 2.5, "mag": 5, "mag_max": 5, "res": 25, "rate": 1.05, "ads_fov": 16.0, "sfx": "res://assets/audio/sr9_shot.wav"},
	{"id": "rl7", "name": "RL-7 ロケット", "dmg": 180.0, "hs_mult": 1.2, "mag": 1, "mag_max": 1, "res": 5, "rate": 1.35, "ads_fov": 48.0, "sfx": "res://assets/audio/rl7_shot.wav"},
]

var fire_cooldown: float = 0.0
@onready var camera: Camera3D = $Head/Camera3D
@onready var raycast: RayCast3D = $Head/Camera3D/WeaponRayCast
@onready var audio_shot: AudioStreamPlayer3D = $Head/Camera3D/WeaponAudio3D
@onready var hud_ammo_label: Label = get_node_or_null("../TacticalHUD/BottomRight/AmmoLabel")
@onready var hud_hp_label: Label = get_node_or_null("../TacticalHUD/BottomLeft/HpArmorLabel")

func _ready() -> void:
	_update_hud()

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.get_mouse_mode() == Input.MOUSE_MODE_CAPTURED:
		var sens := 0.0011 if is_ads else 0.0022
		rotate_y(-event.relative.x * sens)
		camera.rotate_x(-event.relative.y * sens)
		camera.rotation.x = clamp(camera.rotation.x, -1.35, 1.35)
	elif event is InputEventKey and event.pressed:
		if event.keycode == KEY_1:
			_switch_weapon(0)
		elif event.keycode == KEY_2:
			_switch_weapon(1)
		elif event.keycode == KEY_3:
			_switch_weapon(2)
		elif event.keycode == KEY_4:
			_switch_weapon(3)
		elif event.keycode == KEY_5:
			_switch_weapon(4)
		elif event.keycode == KEY_Y:
			gyro_enabled = not gyro_enabled
		elif event.keycode == KEY_Q:
			lean_target = -1.0 if lean_target >= 0.0 else 0.0
		elif event.keycode == KEY_E:
			lean_target = 1.0 if lean_target <= 0.0 else 0.0
		elif event.keycode == KEY_R:
			_reload_weapon()
		elif event.keycode == KEY_C:
			is_crouching = not is_crouching
			$Head.position.y = 1.15 if is_crouching else 1.72

func _physics_process(delta: float) -> void:
	fire_cooldown = max(0.0, fire_cooldown - delta)
	if gyro_enabled:
		var gyro_rate := Input.get_gyroscope()
		var sens_mult := 0.58 if is_ads else 1.0
		rotate_y(gyro_rate.y * delta * gyro_sensitivity * sens_mult)
		camera.rotate_x(gyro_rate.x * delta * gyro_sensitivity * sens_mult)
		camera.rotation.x = clamp(camera.rotation.x, -1.35, 1.35)
	lean_amount = lerpf(lean_amount, lean_target, min(1.0, delta * 11.5))
	camera.rotation.z = -lean_amount * 0.21
	$Head.position.x = lean_amount * 0.38
	if not is_on_floor():
		velocity.y -= GRAVITY * delta
	elif Input.is_key_pressed(KEY_SPACE):
		velocity.y = JUMP_VELOCITY

	var input_dir := Vector2.ZERO
	if Input.is_key_pressed(KEY_W): input_dir.y -= 1.0
	if Input.is_key_pressed(KEY_S): input_dir.y += 1.0
	if Input.is_key_pressed(KEY_A): input_dir.x -= 1.0
	if Input.is_key_pressed(KEY_D): input_dir.x += 1.0
	input_dir = input_dir.normalized()

	var spd := CROUCH_SPEED if is_crouching else (SPRINT_SPEED if Input.is_key_pressed(KEY_SHIFT) else WALK_SPEED)
	var dir := (transform.basis * Vector3(input_dir.x, 0, input_dir.y)).normalized()
	if dir != Vector3.ZERO:
		velocity.x = dir.x * spd
		velocity.z = dir.z * spd
	else:
		velocity.x = move_toward(velocity.x, 0, spd)
		velocity.z = move_toward(velocity.z, 0, spd)

	move_and_slide()

	is_ads = Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT)
	var target_fov: float = weapons[active_weapon_idx]["ads_fov"] if is_ads else 60.0
	camera.fov = lerpf(camera.fov, target_fov, min(1.0, delta * 14.0))

	if Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT) and fire_cooldown <= 0.0 and not is_reloading:
		_fire_weapon()

func _switch_weapon(idx: int) -> void:
	active_weapon_idx = clampi(idx, 0, weapons.size() - 1)
	is_reloading = false
	_update_hud()

func _fire_weapon() -> void:
	var w: Dictionary = weapons[active_weapon_idx]
	if int(w["mag"]) <= 0:
		_reload_weapon()
		return
	w["mag"] = int(w["mag"]) - 1
	fire_cooldown = float(w["rate"])
	if ResourceLoader.exists(w["sfx"]):
		audio_shot.stream = load(w["sfx"])
		audio_shot.play()

	if raycast.is_colliding():
		var col := raycast.get_collider()
		var pt := raycast.get_collision_point()
		if col and col.has_method("apply_bullet_damage"):
			var is_hs: bool = (pt.y - col.global_position.y) > 1.48
			var dmg: float = float(w["dmg"]) * (float(w["hs_mult"]) if is_hs else 1.0)
			col.apply_bullet_damage(dmg, is_hs)
	_update_hud()

func _reload_weapon() -> void:
	var w: Dictionary = weapons[active_weapon_idx]
	if is_reloading or int(w["mag"]) >= int(w["mag_max"]) or int(w["res"]) <= 0:
		return
	is_reloading = true
	await get_tree().create_timer(1.5).timeout
	var needed := int(w["mag_max"]) - int(w["mag"])
	var take := mini(needed, int(w["res"]))
	w["mag"] = int(w["mag"]) + take
	w["res"] = int(w["res"]) - take
	is_reloading = false
	_update_hud()

func _update_hud() -> void:
	var w: Dictionary = weapons[active_weapon_idx]
	if hud_ammo_label:
		hud_ammo_label.text = "%s  |  %02d / %d" % [w["name"], int(w["mag"]), int(w["res"])]
	if hud_hp_label:
		hud_hp_label.text = "+ HP %d   |   ARMOR %d" % [int(hp), int(armor)]
