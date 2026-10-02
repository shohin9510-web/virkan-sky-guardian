'use strict';

// Deterministic gameplay harness. Uses the real bundled Three.js math, scene,
// geometry and ray code. DOM, audio, requestAnimationFrame and WebGL are stubs.
// These tests cannot measure GPU performance, layout, shader output or device FPS.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const THREE = require('../../web/three.min.js');
const GAME_FILE = path.resolve(__dirname, '../../web/index.html');
const noop = () => {};

function createGame({ mobile = true, initialStorage = {}, confirmResult = true } = {}) {
  let now = 0;
  let nextTimerId = 0;
  let nextElementId = 0;
  let frameQueue = [];
  let timers = [];
  let renders = 0;
  let reloadCalls = 0;
  const errors = [];
  const elements = new Map();
  const globalListeners = new Map();
  const storage = new Map(Object.entries(initialStorage));
  const audioCalls = { suspend: 0, resume: 0 };
  const html = fs.readFileSync(GAME_FILE, 'utf8');

  function eventTarget(target = {}) {
    const listeners = new Map();
    target.addEventListener = (type, listener) => {
      listeners.set(type, [...(listeners.get(type) || []), listener]);
    };
    target.removeEventListener = (type, listener) => {
      listeners.set(type, (listeners.get(type) || []).filter(fn => fn !== listener));
    };
    target.dispatchEvent = event => {
      for (const listener of listeners.get(event.type) || []) listener(event);
      if (event.type === 'click' && target.onclick) target.onclick(event);
      return true;
    };
    return target;
  }

  const drawingContext = new Proxy({
    createLinearGradient: () => ({ addColorStop: noop }),
    measureText: () => ({ width: 10 }),
  }, {
    get: (target, key) => key in target ? target[key] : noop,
    set: (target, key, value) => (target[key] = value, true),
  });

  function querySelectorAll(selector) {
    return [...elements.values()].filter(element => selector.split(',').some(part => {
      const value = part.trim();
      if (value.startsWith('#')) return element.id === value.slice(1);
      if (value.startsWith('.')) return value.slice(1).split('.').every(c => element.classList.contains(c));
      return false;
    }));
  }

  function makeElement(id, className = '') {
    const classes = new Set(className.split(/\s+/).filter(Boolean));
    const element = eventTarget({
      id, style: {}, dataset: {}, width: 150, height: 150,
      textContent: '', innerHTML: '', value: '', checked: false, disabled: false,
      classList: {
        add: c => classes.add(c),
        remove: c => classes.delete(c),
        contains: c => classes.has(c),
        toggle(c, value) {
          const enabled = value === undefined ? !classes.has(c) : value;
          enabled ? classes.add(c) : classes.delete(c);
          return enabled;
        },
      },
      // Test pointer coordinates use a known 142px joystick, independent of CSS.
      getBoundingClientRect: () => ({ left: 18, top: 226, width: 142, height: 142 }),
      setPointerCapture: noop, releasePointerCapture: noop, hasPointerCapture: () => true,
      getContext: () => drawingContext,
      appendChild: noop, prepend: noop, remove: noop,
      requestPointerLock: noop, requestFullscreen: () => Promise.resolve(),
      querySelectorAll,
    });
    elements.set(id, element);
    return element;
  }

  for (const tag of html.match(/<[^>]+>/g) || []) {
    const id = tag.match(/\bid="([^"]+)"/);
    if (id) makeElement(id[1], tag.match(/\bclass="([^"]*)"/)?.[1] || '');
    else if (/\bclass="[^"]*weaponTouchBtn/.test(tag)) {
      const el = makeElement(`weapon-${nextElementId++}`, 'weaponTouchBtn');
      el.dataset.w = tag.match(/\bdata-w="([^"]+)"/)?.[1];
    }
  }

  class RendererStub {
    constructor() {
      this.domElement = makeElement('test-renderer');
      this.shadowMap = {};
      this.info = { memory: {}, render: {}, programs: [] };
      this.capabilities = { isWebGL2: true, maxTextures: 16 };
    }
    setPixelRatio(value) { this.pixelRatio = value; }
    getPixelRatio() { return this.pixelRatio; }
    setSize() {}
    render(scene, camera) {
      renders++;
      scene.updateMatrixWorld();
      camera.updateMatrixWorld();
    }
    clearDepth() {}
    compile() {}
  }

  const audioNode = () => new Proxy({
    gain: { value: 0, setValueAtTime: noop, exponentialRampToValueAtTime: noop },
    frequency: { value: 0 },
  }, { get: (target, key) => key in target ? target[key] : noop });

  class AudioContextStub {
    constructor() { this.currentTime = 0; this.sampleRate = 44100; this.destination = {}; }
    resume() { audioCalls.resume++; return Promise.resolve(); }
    suspend() { audioCalls.suspend++; return Promise.resolve(); }
    createGain() { return audioNode(); }
    createOscillator() { return audioNode(); }
    createBufferSource() { return audioNode(); }
    createBiquadFilter() { return audioNode(); }
    createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; }
  }

  const document = eventTarget({
    hidden: false, visibilityState: 'visible',
    getElementById: id => elements.get(id) || null,
    createElement: () => makeElement(`test-created-${nextElementId++}`),
    body: { prepend: noop },
    documentElement: makeElement('test-document-element'),
    querySelectorAll, exitPointerLock: noop,
  });
  const context = {
    THREE: { ...THREE, WebGLRenderer: RendererStub },
    console: { log: noop, warn: noop, error: (...args) => errors.push(args.join(' ')) },
    document, navigator: { maxTouchPoints: mobile ? 5 : 0, vibrate: noop },
    performance: { now: () => now }, devicePixelRatio: 2, innerWidth: 844, innerHeight: 390,
    matchMedia: () => ({ matches: mobile }),
    screen: { orientation: { lock: () => Promise.resolve() } },
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key),
    },
    location: { reload: () => { reloadCalls++; } }, AudioContext: AudioContextStub, confirm: () => confirmResult,
    Event: class { constructor(type) { this.type = type; } },
    addEventListener(type, listener) {
      globalListeners.set(type, [...(globalListeners.get(type) || []), listener]);
    },
    removeEventListener: noop,
    requestAnimationFrame: callback => frameQueue.push(callback), cancelAnimationFrame: noop,
    setTimeout(callback, delay = 0) {
      timers.push({ id: ++nextTimerId, callback, at: now + delay });
      return nextTimerId;
    },
    clearTimeout: id => { timers = timers.filter(timer => timer.id !== id); },
    // Ambient audio interval is not needed by the gameplay assertions.
    setInterval: () => ++nextTimerId, clearInterval: noop,
  };
  context.window = context;
  vm.createContext(context);
  let script = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1]).join('\n');
  const end = script.lastIndexOf('})();');
  if (end < 0) throw new Error('Game IIFE entry point not found');
  // Only the executed test copy exposes its closure; production source is unchanged.
  script = script.slice(0, end) + '\nwindow.__testEvaluate = code => eval(code);\n' + script.slice(end);
  vm.runInContext(script, context, { timeout: 20000 });

  const game = {
    context, document, elements, storage, errors, audioCalls,
    run: code => context.__testEvaluate(code),
    get renders() { return renders; },
    get reloadCalls() { return reloadCalls; },
    get now() { return now; },
    dispatch(type, properties = {}) {
      const event = { type, preventDefault: noop, stopPropagation: noop, ...properties };
      for (const listener of globalListeners.get(type) || []) listener(event);
      document.dispatchEvent(event);
    },
    pointer(id, type, properties = {}) {
      const element = elements.get(id);
      if (!element) throw new Error(`Unknown test element: ${id}`);
      element.dispatchEvent({ type, pointerId: 1, clientX: 89, clientY: 297,
        preventDefault: noop, stopPropagation: noop, ...properties });
    },
    click(id) { this.pointer(id, 'click'); },
    start() { this.click('startBtn'); this.run('missionDelay=99999'); return this; },
    step(count = 1, dt = 1 / 60) {
      for (let i = 0; i < count; i++) {
        now += dt * 1000;
        const ready = timers.filter(timer => timer.at <= now);
        timers = timers.filter(timer => timer.at > now);
        for (const timer of ready) timer.callback();
        const callbacks = frameQueue;
        frameQueue = [];
        for (const callback of callbacks) callback(now);
      }
    },
    state() {
      // Serialize cross-realm objects for normal node:assert comparisons.
      return JSON.parse(JSON.stringify(this.run(`({
        pos:player.pos.toArray(),yaw:player.yaw,pitch:player.pitch,flight,hp,energy,
        menuOpen,gameEnded,missionActive,wave,projectiles:projectiles.length,
        enemies:enemies.length,fx:combatFx.length,heat:weaponHeat,
        moveY:mobile.moveY,mouseLeft:mouse.left,revives
      })`)));
    },
  };
  return game;
}

module.exports = { createGame };
