'use strict';

// Run: node --test scripts/game-regressions.test.cjs
// This is gameplay/scene regression coverage, not a browser or Android benchmark.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createGame } = require('./test-support/game-harness.cjs');
const fresh = () => createGame().start();
const near = (actual, expected, tolerance = 0.05) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be within ${tolerance} of ${expected}`);
};

test('cold boot does not simulate, spawn enemies or overwrite saves before Start', () => {
  const game = createGame();
  game.step(600);
  assert.equal(game.state().missionActive, false);
  assert.equal(game.state().enemies, 0);
  assert.equal(game.storage.has('virkan_save_v20'), false);
  assert.deepEqual(game.errors, []);
});

test('touch look conserves angular input at 30, 60 and 120 simulated updates/second', () => {
  for (const hz of [30, 60, 120]) {
    const game = fresh();
    game.run('mobile.lookDX=.43');
    for (let i = 0; i < hz; i++) game.run(`updatePlayer(${1 / hz})`);
    near(game.state().yaw, -0.43, 0.00001);
  }
});

test('movement covers the same distance at 15, 30, 60 and 120 simulated frames/second', () => {
  const distances = [];
  for (const hz of [15, 30, 60, 120]) {
    const game = fresh();
    game.run('mobile.moveY=1');
    game.step(hz * 2, 1 / hz);
    distances.push(-game.state().pos[2]);
  }
  assert.ok(Math.min(...distances) > 10);
  assert.ok(Math.max(...distances) - Math.min(...distances) < 0.2);
});

test('background clears held controls, suspends audio and skips rendering until return', () => {
  const game = fresh();
  game.pointer('moveStick', 'pointerdown', { clientY: 247 });
  game.pointer('upBtn', 'pointerdown');
  game.pointer('fireBtn', 'pointerdown');
  game.document.hidden = true;
  game.document.visibilityState = 'hidden';
  game.dispatch('visibilitychange');
  const before = game.state();
  const renders = game.renders;
  game.step(600);
  assert.equal(game.renders, renders);
  assert.deepEqual(game.state(), before);
  assert.ok(game.audioCalls.suspend > 0);
  game.document.hidden = false;
  game.document.visibilityState = 'visible';
  game.dispatch('visibilitychange');
  game.step(60);
  assert.ok(game.audioCalls.resume > 0);
  assert.equal(game.state().moveY, 0);
  assert.equal(game.state().mouseLeft, false);
  assert.equal(game.run('mobile.up'), false);
  game.state().pos.forEach((value, i) => near(value, before.pos[i]));
  // Interrupted pointer ownership must not prevent a fresh gesture after return.
  game.pointer('moveStick', 'pointerdown', { pointerId: 7, clientY: 247 });
  assert.ok(game.state().moveY > 0.9);
  game.pointer('moveStick', 'lostpointercapture', { pointerId: 7 });
  assert.equal(game.state().moveY, 0);
});

test('Tech pause freezes resources and cannot resume stale movement', () => {
  const game = fresh();
  game.pointer('moveStick', 'pointerdown', { clientY: 247 });
  game.run('energy=20;weaponHeat=60;shieldActive=true;openTech()');
  const before = game.state();
  game.step(600);
  assert.equal(game.state().energy, before.energy);
  assert.equal(game.state().heat, before.heat);
  game.run('closeTech()');
  game.step(60);
  assert.equal(game.state().moveY, 0);
  near(game.state().pos[2], 0);
});

test('flight ascends and safely lands on ground and on a building roof', () => {
  const game = fresh();
  game.pointer('flightBtn', 'pointerdown');
  game.pointer('upBtn', 'pointerdown');
  game.step(120);
  assert.equal(game.state().flight, true);
  assert.ok(game.state().pos[1] > 10);
  game.pointer('upBtn', 'pointerup');
  game.pointer('flightBtn', 'pointerdown');
  game.step(300);
  assert.equal(game.state().flight, false);
  near(game.state().pos[1], 1.1);
  const roof = game.run(`(() => {
    const box = new THREE.Box3().setFromObject(buildings[0]);
    player.pos.set((box.min.x+box.max.x)/2,box.max.y+12,(box.min.z+box.max.z)/2);
    player.vy=0;return box.max.y;
  })()`);
  game.step(180);
  near(game.state().pos[1], roof + 1.1, 0.15);
});

test('swept projectile hits targets crossed between frames', () => {
  const game = fresh();
  const hp = game.run(`(() => {
    const enemy=spawnEnemy(new THREE.Vector3(0,0,-2.2),0);
    spawnShot(new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,-1),0xffffff,145,2.4,false,98,1.65,2);
    updateProjectiles(.033);return enemy.userData.hp;
  })()`);
  assert.ok(hp < 110);
});

test('sustained fire reuses preallocated shots and FX remain bounded', () => {
  const game = fresh();
  const allocated = game.run('shotsCreated');
  game.pointer('fireBtn', 'pointerdown');
  game.step(3600); // 60 seconds of simulated held fire.
  game.pointer('fireBtn', 'pointerup');
  game.step(300);
  assert.equal(game.state().projectiles, 0);
  assert.equal(game.run('shotsCreated'), allocated);
  game.run('spawnBurst(new THREE.Vector3(),0xffffff,150)');
  assert.ok(game.run('combatFx.length<=MAX_FX'));
  game.step(120);
  assert.equal(game.state().fx, 0);
});

test('dead enemies are pruned after repeated combat cycles', () => {
  const game = fresh();
  game.run(`for(let i=0;i<100;i++) {
    const enemy=spawnEnemy(new THREE.Vector3(0,0,-10),0);damageEnemy(enemy,999);
  }`);
  game.step(120);
  assert.equal(game.state().enemies, 0);
});

test('save restores zero energy, flight, weapon and progression without false defaults', () => {
  const before = fresh();
  before.run(`energy=0;flight=true;level=5;xp=24;techCredits=123;
    unlockedWeapons[1]=true;currentWeapon=1;player.pitch=0;
    player.pos.set(12,30,-22);saveGame()`);
  const after = createGame({ initialStorage: Object.fromEntries(before.storage) });
  assert.equal(after.state().energy, 0);
  assert.equal(after.state().flight, true);
  assert.equal(after.state().pitch, 0);
  assert.deepEqual(after.state().pos, [12, 30, -22]);
  assert.equal(after.run('level'), 5);
  assert.equal(after.run('xp'), 24);
  assert.equal(after.run('techCredits'), 123);
  assert.equal(after.run('currentWeapon'), 1);
  assert.equal(after.run('unlockedWeapons[1]'), true);
});

test('combat keeps the point-light shader budget fixed on mobile and desktop', () => {
  for (const mobile of [true, false]) {
    const game = createGame({ mobile }).start();
    const count = () => game.run('(()=>{let n=0;scene.traverse(o=>{if(o.isPointLight)n++});return n})()');
    const budget = mobile ? 4 : 6;
    assert.equal(count(), budget);
    game.run(`for(let i=0;i<20;i++) {
      spawnEnemy(new THREE.Vector3(0,0,-20-i),i%4);
      spawnShot(new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,-1),0xffffff,80,2,false,36);
    }`);
    assert.equal(count(), budget);
  }
});

test('a nearer wall blocks swept hits on an enemy behind it', () => {
  const game = fresh();
  const result = game.run(`(() => {
    const bounds=buildings[0].userData.bounds;
    const x=(bounds.min.x+bounds.max.x)/2;
    const y=5,startZ=bounds.min.z-2,endZ=bounds.max.z+5;
    const enemy=spawnEnemy(new THREE.Vector3(x,y-1,endZ-2),0);
    spawnShot(new THREE.Vector3(x,y,startZ),new THREE.Vector3(0,0,1),0xffffff,
      endZ-startZ,2,false,98,1.65,2);
    updateProjectiles(1);return {hp:enemy.userData.hp,shots:projectiles.length};
  })()`);
  assert.equal(result.hp, 110);
  assert.equal(result.shots, 0);
});

test('completed wave rewards advance once and story drone objective spawns three', () => {
  const game = fresh();
  game.run('startMission();for(const enemy of enemies.slice())damageEnemy(enemy,99999);updateMission(0)');
  assert.equal(game.run('wave'), 2);
  assert.equal(game.run('wavesCleared'), 1);
  assert.equal(game.state().missionActive, false);
  game.run('updateMission(0)');
  assert.equal(game.run('wavesCleared'), 1);
  game.run('spawnStoryDrones()');
  assert.equal(game.run('enemies.filter(e=>!e.userData.dead&&e.userData.storyDrone).length'), 3);
});

test('checkpoint revival, final defeat and restart execute their intended transitions', () => {
  const game = fresh();
  game.run('revives=1;hp=10;hitPlayer(10000)');
  assert.equal(game.state().revives, 0);
  assert.ok(game.state().hp > 0);
  assert.equal(game.state().gameEnded, false);
  game.run('hitPlayer(10000)');
  assert.equal(game.state().hp, 0);
  assert.equal(game.state().gameEnded, true);
  assert.equal(game.elements.get('endScreen').style.display, 'flex');
  game.click('restartBtn');
  assert.equal(game.reloadCalls, 1);
});

test('canceling New Game retains the existing save', () => {
  const game = createGame({ confirmResult: false }).start();
  game.run('saveGame()');
  const save = game.storage.get('virkan_save_v20');
  game.run('clearSave()');
  assert.equal(game.storage.get('virkan_save_v20'), save);
  assert.equal(game.reloadCalls, 0);
});

test('multi-touch held controls release only after the last owning pointer', () => {
  const game = fresh();
  game.pointer('fireBtn', 'pointerdown', { pointerId: 1 });
  game.pointer('fireBtn', 'pointerdown', { pointerId: 2 });
  game.pointer('fireBtn', 'pointerup', { pointerId: 1 });
  assert.equal(game.state().mouseLeft, true);
  game.pointer('fireBtn', 'lostpointercapture', { pointerId: 2 });
  assert.equal(game.state().mouseLeft, false);
  game.pointer('fireBtn', 'pointerdown', { pointerId: 3 });
  game.run('resetInputs()');
  game.pointer('fireBtn', 'pointerdown', { pointerId: 7 });
  game.pointer('fireBtn', 'pointerup', { pointerId: 3 });
  assert.equal(game.state().mouseLeft, true);
  game.pointer('fireBtn', 'pointerup', { pointerId: 7 });
  assert.equal(game.state().mouseLeft, false);
});
