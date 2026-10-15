import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const url = process.argv[2] ?? 'http://127.0.0.1:4177/maple-path/';
const devUrl = process.argv[3];
const session = execFileSync('agent-browser', ['session', 'id', '--scope', 'worktree', '--prefix', 'maple-qa'], { encoding: 'utf8' }).trim();
const output = resolve('docs/qa');
mkdirSync(output, { recursive: true });
const checks = [];
const accessibility = [];
const ids = ['path', 'village', 'carriage', 'leaves'];
let cdp;
let contextPatched = false;
let expectedGraphicsMessages = [];

function browser(...args) {
  const raw = execFileSync('agent-browser', ['--session', session, '--json', ...args], {
    encoding: 'utf8', timeout: 35000, maxBuffer: 4 * 1024 * 1024,
  });
  const result = JSON.parse(raw);
  assert.equal(result.success, true, result.error ?? raw);
  return result.data;
}
const evaluate = (source) => browser('eval', source).result;
const state = () => evaluate('window.__maplePath');
const wait = (condition) => browser('wait', '--fn', `Boolean(${condition})`);
const ready = () => wait('window.__maplePath?.ready === true && document.querySelectorAll("canvas").length === 1 && !document.querySelector(".loading")');
const arrive = (id) => wait(`window.__maplePath?.view === '${id}' && !window.__maplePath.flying`);
const screenshot = (name, full = false) => {
  evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  return browser('screenshot', ...(full ? ['--full'] : []), resolve(output, `${name}.png`));
};
const frames = (count = 22) => {
  const before = state().frames;
  wait(`window.__maplePath.frames >= ${before + count}`);
};
const distance = (snapshot) => Math.hypot(...snapshot.camera.map((value, i) => value - snapshot.target[i]));
const movement = (a, b) => Math.hypot(...a.map((value, i) => value - b[i]));

function select(id) {
  const selector = id === 'overview' ? 'button[aria-label="返回全景"]' : `[data-view="${id}"]`;
  browser('scrollintoview', selector);
  browser('click', selector);
  arrive(id);
}

function layout() {
  return evaluate(`({
    viewport: [innerWidth, innerHeight],
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
    height: document.documentElement.scrollHeight,
    canvasCount: document.querySelectorAll('canvas').length,
    stage: document.querySelector('.stage').getBoundingClientRect().toJSON(),
    footer: document.querySelector('.footer').getBoundingClientRect().toJSON(),
    buttons: [...document.querySelectorAll('.verse')].map(button => button.getBoundingClientRect().toJSON())
  })`);
}

function a11y(size) {
  const report = browser('a11y', '--tags', 'wcag2a,wcag2aa');
  accessibility.push({ size, counts: report.counts, violations: report.violations, incomplete: report.incomplete });
  assert.ok(report.violations.length === 0, JSON.stringify(report.violations.map((item) => ({ id: item.id, nodes: item.nodes.map((node) => node.failureSummary) }))));
  return report.counts;
}

async function check(name, action) {
  try {
    const detail = await action();
    checks.push({ name, passed: true, detail: detail ?? null });
    console.log(`PASS ${name}`);
  } catch (error) {
    let diagnostic;
    try {
      diagnostic = {
        state: state(), layout: layout(),
        errorMessage: evaluate('document.querySelector(".error")?.textContent'),
        visibility: evaluate('document.visibilityState'),
        console: browser('console').messages,
        pageErrors: browser('errors').errors,
      };
    } catch {}
    checks.push({ name, passed: false, error: String(error), diagnostic });
    console.error(`FAIL ${name}: ${error.message}`);
    throw error;
  }
}

// agent-browser owns the browser; CDP provides touch input and failure injection.
async function connectCdp() {
  const { cdpUrl } = browser('get', 'cdp-url');
  const address = new URL(cdpUrl);
  const pages = await (await fetch(`http://${address.host}/json/list`)).json();
  const page = pages.find((item) => item.type === 'page' && item.url.replace(/\/$/, '') === url.replace(/\/$/, ''));
  assert.ok(page, 'The isolated preview page exists');
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolveOpen, reject) => {
    socket.addEventListener('open', resolveOpen, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    const waiter = pending.get(message.id);
    if (!waiter) return;
    clearTimeout(waiter.timer);
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error.message));
    else waiter.resolve(message.result);
  });
  return {
    send(method, params = {}) {
      return new Promise((resolveSend, reject) => {
        const id = ++nextId;
        const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 10000);
        pending.set(id, { resolve: resolveSend, reject, timer });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() { socket.close(); },
  };
}

try {
  browser('open', url);
  browser('set', 'viewport', '1440', '900');
  ready();
  cdp = await connectCdp();

  await check('desktop first frame, full poem, one canvas, fitted layout', () => {
    assert.deepEqual(evaluate('[...document.querySelectorAll(".verse-text")].map(e => e.textContent)'), [
      '远上寒山石径斜，', '白云生处有人家。', '停车坐爱枫林晚，', '霜叶红于二月花。',
    ]);
    assert.equal(state().view, 'overview');
    assert.equal(state().flying, false);
    assert.equal(layout().horizontalOverflow, false);
    assert.ok(layout().footer.bottom <= 901);
    assert.equal(layout().canvasCount, 1);
    screenshot('overview-desktop');
    return { state: state(), layout: layout() };
  });

  for (const id of ids) {
    await check(`desktop viewpoint: ${id}`, () => {
      select(id);
      assert.equal(evaluate(`document.querySelector('[data-view="${id}"]').getAttribute('aria-pressed')`), 'true');
      assert.equal(evaluate('document.querySelectorAll(".verse[aria-pressed=true]").length'), 1);
      assert.equal(layout().canvasCount, 1);
      screenshot(`${id}-desktop`);
      return state();
    });
  }

  await check('desktop accessibility: WCAG A/AA automated checks', () => a11y('1440 x 900'));

  await check('rapid clicks finish at the latest verse', () => {
    for (const id of [...ids, ...ids]) browser('click', `[data-view="${id}"]`);
    arrive('leaves');
    assert.equal(evaluate('document.querySelector(".verse[aria-pressed=true]").dataset.view'), 'leaves');
    return state();
  });

  await check('drag cancels flight and allows free observation', () => {
    browser('click', '[data-view="path"]');
    assert.equal(state().flying, true);
    browser('mouse', 'move', '460', '395');
    browser('mouse', 'down');
    assert.equal(state().flying, false);
    const before = state().camera;
    browser('mouse', 'move', '530', '410');
    browser('mouse', 'move', '570', '435');
    browser('mouse', 'up');
    frames();
    assert.ok(movement(before, state().camera) > 2);
    assert.equal(evaluate('document.querySelector(".scene-location").textContent.includes("自由环顾")'), true);
    return state();
  });

  await check('keyboard selection during a drag reaches its target', () => {
    browser('mouse', 'move', '460', '395');
    browser('mouse', 'down');
    browser('mouse', 'move', '485', '410');
    browser('focus', '[data-view="village"]');
    browser('press', 'Enter');
    browser('mouse', 'up');
    arrive('village');
    return state();
  });

  await check('leaving an upward angle starts smoothly', () => {
    select('leaves');
    browser('mouse', 'move', '460', '610');
    browser('mouse', 'down');
    browser('mouse', 'move', '460', '440');
    browser('mouse', 'move', '460', '280');
    browser('mouse', 'up');
    frames();
    const before = state();
    assert.ok(before.camera[1] < before.target[1], 'The test reached an upward-looking camera');
    browser('click', '[data-view="path"]');
    const after = state();
    assert.equal(after.flying, true);
    assert.ok(movement(before.camera, after.camera) < 16);
    arrive('path');
    return { before: before.camera, transitionStart: after.camera };
  });

  await check('repeat selection restores the composed camera', () => {
    select('carriage');
    const expected = state().camera;
    browser('mouse', 'move', '460', '395');
    browser('mouse', 'down');
    browser('mouse', 'move', '555', '410');
    browser('mouse', 'up');
    select('carriage');
    assert.ok(movement(expected, state().camera) < 0.02);
  });

  await check('mouse wheel changes camera distance', async () => {
    select('overview');
    const before = distance(state());
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 460, y: 395, deltaY: -240, deltaX: 0 });
    frames();
    assert.ok(distance(state()) < before - 3);
    return { before, after: distance(state()) };
  });

  await check('overview clears verse selection', () => {
    select('overview');
    assert.equal(evaluate('document.querySelectorAll(".verse[aria-pressed=true]").length'), 0);
    assert.equal(state().flying, false);
  });

  await check('keyboard Enter, arrows, Home, End and visible focus', () => {
    browser('focus', '[data-view="path"]');
    browser('press', 'Enter');
    arrive('path');
    browser('press', 'ArrowDown');
    arrive('village');
    assert.equal(evaluate('document.activeElement.dataset.view'), 'village');
    browser('press', 'End');
    arrive('leaves');
    browser('press', 'Home');
    arrive('path');
    assert.equal(evaluate('document.activeElement.matches(":focus-visible")'), true);
  });

  await check('pause freezes scenery while camera navigation works', () => {
    browser('click', 'button[aria-label="暂停动画"]');
    const before = state().animationTime;
    frames();
    assert.equal(state().animationTime, before);
    select('carriage');
    assert.equal(state().animationTime, before);
    browser('click', 'button[aria-label="继续动画"]');
    wait(`window.__maplePath.animationTime > ${before + 0.1}`);
  });

  await check('manual reduced motion freezes scenery and switches directly', () => {
    browser('check', '.motion-option input');
    const before = state().animationTime;
    browser('click', '[data-view="leaves"]');
    assert.equal(state().flying, false);
    assert.equal(state().view, 'leaves');
    frames();
    assert.equal(state().animationTime, before);
    browser('uncheck', '.motion-option input');
  });

  await check('immersive mode reuses the scene and Escape returns', () => {
    browser('click', 'button[aria-label="进入沉浸"]');
    assert.equal(evaluate('document.querySelector(".poem-panel").hidden'), true);
    assert.equal(evaluate('document.querySelectorAll(".immersive-verses button").length'), 4);
    browser('click', '.immersive-verses button:first-child');
    arrive('path');
    assert.equal(layout().canvasCount, 1);
    screenshot('immersive-desktop');
    browser('press', 'Escape');
    assert.equal(evaluate('document.querySelector(".poem-panel").hidden'), false);
  });

  await check('desktop resize keeps the scene and readable navigation', () => {
    browser('set', 'viewport', '1280', '800');
    select('overview');
    assert.equal(layout().horizontalOverflow, false);
    assert.equal(layout().canvasCount, 1);
    assert.ok(layout().footer.bottom <= 801);
    screenshot('overview-desktop-1280');
    return layout();
  });

  await check('simulated mobile layout and performance tier', () => {
    browser('set', 'device', 'iPhone 15');
    browser('set', 'viewport', '390', '844');
    browser('reload');
    ready();
    assert.equal(state().quality, 'mobile');
    assert.ok(state().treeCount < 150);
    assert.equal(layout().horizontalOverflow, false);
    for (const button of layout().buttons) assert.ok(button.height >= 44 && button.right <= 390);
    assert.equal(evaluate('[...document.querySelectorAll(".tool")].every(e=>e.getBoundingClientRect().height>=44)'), true);
    screenshot('overview-mobile', true);
    return { state: state(), layout: layout() };
  });

  for (const id of ids) {
    await check(`simulated mobile viewpoint: ${id}`, () => {
      select(id);
      evaluate('window.scrollTo(0, 0)');
      assert.equal(layout().horizontalOverflow, false);
      assert.equal(evaluate('document.querySelector(".verse[aria-pressed=true]").dataset.view'), id);
      screenshot(`${id}-mobile`, true);
      return state();
    });
  }

  await check('simulated mobile accessibility: WCAG A/AA automated checks', () => a11y('390 x 844'));

  await check('simulated single finger orbits the scene', async () => {
    select('overview');
    evaluate('window.scrollTo(0, 0)');
    const before = state().camera;
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 145, y: 315, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 172, y: 325, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 215, y: 338, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    frames();
    assert.ok(movement(before, state().camera) > 3);
    return { before, after: state().camera };
  });

  await check('simulated two finger pinch zooms', async () => {
    select('overview');
    evaluate('window.scrollTo(0, 0)');
    const before = distance(state());
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 150, y: 320, id: 1 }, { x: 210, y: 320, id: 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 132, y: 320, id: 1 }, { x: 228, y: 320, id: 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 110, y: 320, id: 1 }, { x: 250, y: 320, id: 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    frames();
    assert.ok(Math.abs(distance(state()) - before) > 3);
    return { before, after: distance(state()) };
  });

  await check('system reduced motion is honored on fresh mount', () => {
    browser('set', 'media', 'light', 'reduced-motion');
    browser('reload');
    ready();
    assert.equal(state().reducedMotion, true);
    const before = state().animationTime;
    select('village');
    assert.equal(state().flying, false);
    frames();
    assert.equal(state().animationTime, before);
    assert.equal(evaluate('document.querySelector(".motion-option input").disabled'), true);
    browser('set', 'media', 'light');
    browser('reload');
    ready();
  });

  await check('normal production console and page errors', () => {
    assert.deepEqual(browser('errors').errors ?? [], []);
    const messages = browser('console').messages ?? [];
    assert.deepEqual(messages.filter((m) => m.type === 'error' || m.level === 'error'), []);
    return messages;
  });

  await check('graphics loss preserves poetry and recovery restores one canvas', () => {
    evaluate('window.scrollTo(0, 0)');
    evaluate('document.querySelector("canvas").getContext("webgl2").getExtension("WEBGL_lose_context").loseContext()');
    wait('document.querySelector(".error") && window.__maplePath?.ready === false');
    assert.equal(evaluate('document.querySelectorAll(".verse").length'), 4);
    screenshot('graphics-recovery-mobile', true);
    browser('click', '.retry-button');
    ready();
    frames(30);
    assert.equal(state().ready, true);
    assert.equal(layout().canvasCount, 1);
    return state();
  });

  await check('WebGL unavailable preserves poem and retry can recover', () => {
    evaluate('window.scrollTo(0, 0)');
    evaluate('document.querySelector("canvas").getContext("webgl2").getExtension("WEBGL_lose_context").loseContext()');
    wait('document.querySelector(".error")');
    evaluate(`window.__qaOriginalGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...args) {
        if (['webgl2', 'webgl', 'experimental-webgl'].includes(type)) return null;
        return window.__qaOriginalGetContext.call(this, type, ...args);
      }`);
    contextPatched = true;
    browser('click', '.retry-button');
    wait('document.querySelector(".error") && !window.__maplePath && !document.querySelector("canvas")');
    assert.equal(evaluate('document.querySelector("h1").textContent'), '山行');
    assert.equal(evaluate('document.querySelectorAll(".verse").length'), 4);
    browser('scrollintoview', '[data-view="leaves"]');
    browser('click', '[data-view="leaves"]');
    assert.equal(evaluate('document.querySelector(".verse[aria-pressed=true]").dataset.view'), 'leaves');
    evaluate('window.scrollTo(0, 0)');
    screenshot('webgl-unavailable-mobile', true);
    expectedGraphicsMessages = browser('console').messages ?? [];
    for (const message of expectedGraphicsMessages.filter((m) => m.type === 'error' || m.level === 'error')) {
      assert.match(JSON.stringify(message), /Error creating WebGL context/);
    }
    assert.deepEqual(browser('errors').errors ?? [], []);
    browser('console', '--clear');
    evaluate('HTMLCanvasElement.prototype.getContext = window.__qaOriginalGetContext; delete window.__qaOriginalGetContext');
    contextPatched = false;
    browser('scrollintoview', '.retry-button');
    browser('click', '.retry-button');
    ready();
    arrive('leaves');
    assert.equal(layout().canvasCount, 1);
  });

  await check('final recovered production console and page errors', () => {
    select('overview');
    const errors = browser('errors').errors ?? [];
    const consoleMessages = browser('console').messages ?? [];
    assert.deepEqual(errors, []);
    assert.deepEqual(consoleMessages.filter((m) => m.type === 'error' || m.level === 'error'), []);
    return { errors, consoleMessages };
  });

  if (devUrl) {
    await check('development StrictMode mount keeps one canvas and one animation loop', () => {
      browser('open', devUrl);
      browser('set', 'viewport', '1440', '900');
      browser('reload');
      ready();
      const start = evaluate('({time: performance.now(), frames: window.__maplePath.frames})');
      frames(60);
      const end = evaluate('({time: performance.now(), frames: window.__maplePath.frames})');
      const rate = (end.frames - start.frames) / ((end.time - start.time) / 1000);
      assert.equal(layout().canvasCount, 1);
      assert.ok(rate < 130, `A single loop should not render at duplicate frequency: ${rate}`);
      select('village');
      assert.deepEqual(browser('errors').errors ?? [], []);
      assert.deepEqual((browser('console').messages ?? []).filter((m) => m.type === 'error' || m.level === 'error'), []);
      return { estimatedFrameRate: rate, state: state() };
    });
  }
} finally {
  if (contextPatched) {
    try { evaluate('HTMLCanvasElement.prototype.getContext = window.__qaOriginalGetContext; delete window.__qaOriginalGetContext'); } catch {}
  }
  cdp?.close();
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({
    checkedAt: new Date().toISOString(), url, devUrl: devUrl ?? null,
    browser: 'agent-browser isolated Chromium',
    mobile: 'iPhone 15 emulation, 390 x 844 viewport, CDP single and multi-touch input; not a physical device',
    passed: checks.length > 0 && checks.every((item) => item.passed),
    checks, expectedGraphicsMessages,
  }, null, 2) + '\n');
  writeFileSync(resolve(output, 'accessibility.json'), JSON.stringify(accessibility, null, 2) + '\n');
  try { browser('close'); } catch {}
}

console.log(`Completed ${checks.length} browser checks.`);
