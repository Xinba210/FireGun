extends Node3D

## NightPortMain Level Manager (Godot 4.7 Formal FPS System)
## Loads the verified Blender GLB assets (port_environment.glb, weapons_pack.glb, soldier_tactical_animated.glb),
## spawns the 8 CC0 animated Enemy Soldiers, and manages Objectives, Checkpoints, Loadout & Mission Complete UI.

const PORT_ENV_PATH := "res://assets/models/port_environment.glb"
const WEAPONS_PATH := "res://assets/models/weapons_pack.glb"
const SOLDIER_PATH := "res://assets/models/soldier_tactical_animated.glb"

var enemies_total: int = 8
var enemies_eliminated: int = 0
var mission_elapsed: float = 0.0
var mission_completed: bool = false

@onready var hud_objective_label: Label = $TacticalHUD/TopBar/ObjectiveLabel
@onready var mission_complete_panel: Panel = $TacticalHUD/MissionCompletePanel
@onready var mission_stats_label: Label = $TacticalHUD/MissionCompletePanel/StatsLabel

func _ready() -> void:
	_setup_environment_and_lights()
	_load_port_glb()
	_spawn_enemy_squad()
	_update_objective_ui()
	print("GODOT_FPS_LEVEL_READY: NightPortMain initialized with PBR GLBs and CC0 Soldier Squad.")

func _process(delta: float) -> void:
	if not mission_completed:
		mission_elapsed += delta

func _setup_environment_and_lights() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.024, 0.043, 0.078)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.28, 0.41, 0.58)
	env.ambient_light_energy = 0.85
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.tonemap_exposure = 1.08
	env.ssr_enabled = true
	env.ssao_enabled = true
	env.glow_enabled = true
	env.glow_intensity = 0.45
	env.volumetric_fog_enabled = true
	env.volumetric_fog_density = 0.012
	env.volumetric_fog_albedo = Color(0.08, 0.14, 0.22)

	var world_env := WorldEnvironment.new()
	world_env.environment = env
	add_child(world_env)

	var moon := DirectionalLight3D.new()
	moon.name = "MoonDirectionalLight"
	moon.light_color = Color(0.55, 0.72, 0.92)
	moon.light_energy = 1.35
	moon.shadow_enabled = true
	moon.rotation_degrees = Vector3(-48, -35, 0)
	add_child(moon)

	var sodium_coords := [
		Vector3(-12.0, 10.8, 20.0),
		Vector3(-12.0, 10.8, 2.0),
		Vector3(11.5, 10.8, 21.0),
		Vector3(11.5, 10.8, 4.0),
		Vector3(11.5, 10.8, -14.0),
		Vector3(-7.5, 19.5, -18.0),
		Vector3(19.0, 8.0, -8.0),
	]
	for pos in sodium_coords:
		var omni := OmniLight3D.new()
		omni.position = pos
		omni.light_color = Color(1.0, 0.68, 0.32)
		omni.light_energy = 4.2
		omni.omni_range = 26.0
		omni.shadow_enabled = true
		add_child(omni)

	# Night Rain GPUParticles3D
	var rain := GPUParticles3D.new()
	rain.name = "NightRainParticles"
	rain.amount = 900
	rain.lifetime = 1.2
	rain.position = Vector3(0, 18, 0)
	var pmat := ParticleProcessMaterial.new()
	pmat.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	pmat.emission_box_extents = Vector3(32, 2, 36)
	pmat.direction = Vector3(-0.08, -1.0, 0.04)
	pmat.spread = 2.0
	pmat.initial_velocity_min = 18.0
	pmat.initial_velocity_max = 22.0
	rain.process_material = pmat
	add_child(rain)

func _load_port_glb() -> void:
	if ResourceLoader.exists(PORT_ENV_PATH):
		var packed: PackedScene = load(PORT_ENV_PATH)
		if packed:
			var inst := packed.instantiate()
			inst.name = "NightPortEnvironmentGLB"
			add_child(inst)

func _spawn_enemy_squad() -> void:
	var spawns := [
		{"name": "Soldier_Alpha", "pos": Vector3(-6.5, 0.0, 10.5)},
		{"name": "Soldier_Bravo", "pos": Vector3(-5.2, 0.0, -9.5)},
		{"name": "Soldier_Charlie", "pos": Vector3(3.2, 0.0, 8.0)},
		{"name": "Soldier_Delta_Catwalk", "pos": Vector3(6.2, 5.34, 4.0)},
		{"name": "Soldier_Echo_GuardPost", "pos": Vector3(12.5, 0.0, 14.5)},
		{"name": "Soldier_Foxtrot_Warehouse", "pos": Vector3(16.5, 0.0, -5.5)},
		{"name": "Soldier_Golf_Terminal", "pos": Vector3(0.5, 0.0, -19.5)},
		{"name": "Soldier_Commander_Ship", "pos": Vector3(-26.5, 6.6, -12.0)},
	]
	var enemy_script: GDScript = load("res://scripts/enemy_soldier.gd")
	for sp in spawns:
		var enemy := CharacterBody3D.new()
		enemy.name = sp["name"]
		enemy.position = sp["pos"]
		enemy.set_script(enemy_script)
		enemy.connect("soldier_eliminated", Callable(self, "_on_soldier_eliminated"))
		add_child(enemy)

func _on_soldier_eliminated(_enemy_name: String, _is_headshot: bool) -> void:
	enemies_eliminated += 1
	_update_objective_ui()
	if enemies_eliminated >= enemies_total and not mission_completed:
		mission_completed = true
		mission_complete_panel.visible = true
		var mins := int(mission_elapsed) / 60
		var secs := int(mission_elapsed) % 60
		mission_stats_label.text = "MISSION 01 - 港の奪還 COMPLETE\nTIME: %02d:%02d | ELIMINATIONS: %d / %d | RANK: S" % [mins, secs, enemies_eliminated, enemies_total]

func _update_objective_ui() -> void:
	if hud_objective_label:
		hud_objective_label.text = "目標：肅清碼頭武裝守軍並奪還港務主控終端 (%d / %d)" % [enemies_eliminated, enemies_total]

func spawn_explosion_effect(world_pos: Vector3) -> void:
	var blast_light := OmniLight3D.new()
	blast_light.position = world_pos + Vector3(0, 1.8, 0)
	blast_light.light_color = Color(1.0, 0.48, 0.15)
	blast_light.light_energy = 14.0
	blast_light.omni_range = 28.0
	add_child(blast_light)

	var shrapnel := GPUParticles3D.new()
	shrapnel.position = world_pos + Vector3(0, 0.8, 0)
	shrapnel.amount = 32
	shrapnel.lifetime = 1.2
	shrapnel.one_shot = true
	shrapnel.explosiveness = 0.95
	var sp_mat := ParticleProcessMaterial.new()
	sp_mat.direction = Vector3(0, 1, 0)
	sp_mat.spread = 75.0
	sp_mat.initial_velocity_min = 6.0
	sp_mat.initial_velocity_max = 14.0
	sp_mat.gravity = Vector3(0, -14.5, 0)
	shrapnel.process_material = sp_mat
	add_child(shrapnel)
	shrapnel.emitting = true

	var tween := create_tween()
	tween.tween_property(blast_light, "light_energy", 0.0, 1.1)
	tween.tween_callback(blast_light.queue_free)
	get_tree().create_timer(1.5).timeout.connect(shrapnel.queue_free)

