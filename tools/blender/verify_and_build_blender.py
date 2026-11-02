"""
FireGun Realistic FPS — Blender 4.5+ Asset & Rig Verification Script
Run headless via:
  "D:\Xinba Tools\Blender\blender-4.5.13-windows-x64\blender.exe" -b --factory-startup -P tools/blender/verify_and_build_blender.py
"""
import os
import json
import bpy

MODELS_DIR = os.path.abspath("public/assets/models")
REPORT_PATH = os.path.abspath("docs/evidence/blender_asset_audit.json")


def inspect_glb(filename):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    path = os.path.join(MODELS_DIR, filename)
    bpy.ops.import_scene.gltf(filepath=path)
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    armatures = [o for o in bpy.data.objects if o.type == "ARMATURE"]
    total_tris = 0
    has_uvs = True
    materials = set()
    for m in meshes:
        mesh_data = m.data
        mesh_data.calc_loop_triangles()
        total_tris += len(mesh_data.loop_triangles)
        if len(mesh_data.uv_layers) == 0 and "Rigid" not in m.name:
            has_uvs = False
        for mat in mesh_data.materials:
            if mat:
                materials.add(mat.name)
    return {
        "file": filename,
        "mesh_count": len(meshes),
        "armature_count": len(armatures),
        "bone_count": len(armatures[0].data.bones) if armatures else 0,
        "action_count": len(bpy.data.actions),
        "triangles": total_tris,
        "has_uvs": has_uvs,
        "materials": sorted(list(materials)),
    }


def main():
    os.makedirs(os.path.dirname(REPORT_PATH), exist_ok=True)
    results = [
        inspect_glb("port_environment.glb"),
        inspect_glb("weapons_pack.glb"),
        inspect_glb("soldier_tactical_animated.glb"),
    ]
    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump({"blender_version": bpy.app.version_string, "assets": results}, f, indent=2)
    print("BLENDER_AUDIT_OK:", json.dumps(results))


if __name__ == "__main__":
    main()
