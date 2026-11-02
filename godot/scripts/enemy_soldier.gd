extends CharacterBody3D

## Enemy Tactical Soldier AI & CC0 Animation System (Godot 4.7)
## Instantiates soldier_tactical_animated.glb (65-bone UE skeleton + 43 CC0 animations)
## and drives Patrol, Alert, Combat Aim/Shoot, Hit Reaction, and Death animations.

signal soldier_eliminated(enemy_name: String, is_headshot: bool)

const SOLDIER_GLB := "res://assets/models/soldier_tactical_animated.glb"

var hp: float = 100.0
var state: String = "PATROL"
var anim_player: AnimationPlayer = null
var patrol_dir: float = 1.0
var patrol_timer: float = 0.0

func _ready() -> void:
	var col := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.38
	cap.height = 1.78
	col.shape = cap
	col.position = Vector3(0, 0.89, 0)
	add_child(col)

	if ResourceLoader.exists(SOLDIER_GLB):
		var packed: PackedScene = load(SOLDIER_GLB)
		if packed:
			var model := packed.instantiate()
			add_child(model)
			anim_player = _find_anim_player(model)
			_play_clip("Walk_Loop")

func _find_anim_player(node: Node) -> AnimationPlayer:
	if node is AnimationPlayer:
		return node
	for c in node.get_children():
		var found := _find_anim_player(c)
		if found:
			return found
	return null

func _play_clip(clip_name: String) -> void:
	if anim_player and anim_player.has_animation(clip_name):
		if anim_player.current_animation != clip_name:
			anim_player.play(clip_name)

func _physics_process(delta: float) -> void:
	if state == "DEAD":
		return
	if state == "PATROL":
		patrol_timer += delta
		if patrol_timer > 3.5:
			patrol_timer = 0.0
			patrol_dir *= -1.0
		velocity.z = patrol_dir * 1.4
		move_and_slide()

func apply_bullet_damage(amount: float, is_headshot: bool) -> void:
	if state == "DEAD":
		return
	hp -= amount
	if hp <= 0.0:
		hp = 0.0
		state = "DEAD"
		_play_clip("Death01")
		emit_signal("soldier_eliminated", name, is_headshot)
	else:
		state = "COMBAT"
		_play_clip("Hit_Head" if is_headshot else "Hit_Chest")
