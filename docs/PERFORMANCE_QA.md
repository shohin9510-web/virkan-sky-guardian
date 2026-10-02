# v2.1 performance and regression notes

## What changed

- Fixed startup initialization order: audio state exists before save restoration, weather, and settings callbacks.
- Simulation and automatic saves begin only after Start. The tech screen and app background pause gameplay and clear held input.
- Touch-look smoothing consumes deltas once, independent of display refresh rate. Slow frames are split into bounded simulation steps.
- Cached static building AABBs replace repeated object-bound reconstruction. Swept projectile collision checks prevent fast shots skipping targets and walls.
- Shots and trails reuse a fixed pool; impact effects reuse bounded pools. Removed dynamic enemies and loot release owned geometry and materials.
- Static city detail is combined by material and spatial tile. City landmarks, roads, traffic, pedestrians, and weather remain.
- Lighting uses four mobile point lights (six desktop), with emissive markers for scenery and combat. Adding/removing a shot no longer changes the light shader layout.
- HUD/minimap work is throttled to 10 Hz; unchanged mission/story HTML is not rewritten. Automatic graphics selection uses real elapsed frame time.
- Wrist-local pivots and finger articulation improve recoil; armor keeps correct depth occlusion.
- Android uses the checked-in offline payload, pauses/resumes WebView timers and audio, and falls back to reloading if saved WebView state cannot restore.

## Automated validation

Run:

```sh
node scripts/check_web.js
node --test scripts/*.test.cjs
python3 scripts/test_android_assets.py
```

The game regression harness runs the actual inline game script and the checked-in Three.js library with a minimal DOM and renderer stub. It checks gameplay state and resource inventories; it does **not** exercise WebGL drivers, render screenshots, measure GPU memory, or measure real FPS.

A baseline mobile scene contained 1,549 meshes and 137 PointLights. After batching and light budgeting the scene contains 809 meshes and 4 PointLights. The renderer still draws fewer visible objects through normal frustum culling; these inventory counts are not draw-call or frame-rate measurements.

The GitHub APK job runs source and asset checks, `assembleDebug`, `lintDebug`, and compares the APK's entire assets payload byte-for-byte with the canonical web files. It does not deploy the web demo or merge the PR.

## Device acceptance still required

A real Android device / emulator and GPU-enabled browser were unavailable in the editing environment. Do not treat passing logic tests as proof of device smoothness or visual quality.

On a representative Android 8+ phone:

1. Install the debug APK and launch in airplane mode. Confirm Start and Continue both work.
2. Walk, strafe, jump, fly/boost, land on several roofs, and slide along walls.
3. Test all four weapons plus pulse, aim assist, shield, and heat cooldown. Fire for at least ten minutes while moving and turning.
4. Repeat in rain/night and each graphics preset. Record device model, Android/WebView versions, FPS badge and visible stutters.
5. Open/close the tech screen while holding movement/fire. Background and resume the app, lock/unlock the screen, and test canceled multitouch contacts.
6. Save at zero energy and in flight, relaunch, and confirm position, progress, weapon and flight restore.
7. Verify pickups, death/checkpoint respawn, story drones, commander shield/HP and free-patrol events.
8. Inspect fingers/armor/weapon occlusion and the city at close range and from flight altitude.

The APK is debug-signed, not a Play Store release. An existing install signed with another key cannot be updated in-place; uninstalling it can erase local progress. Keep the old install until a compatible signing/backup path is available.
