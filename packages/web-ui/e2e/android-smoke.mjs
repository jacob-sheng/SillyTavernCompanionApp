// Runs against an isolated Android emulator and local test servers only.
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const app = 'io.github.jacobsheng.stcompanion';
const output = '../../.cache/android-smoke';
mkdirSync(output, { recursive: true });
const adb = (...args) => execFileSync('adb', args, { encoding: 'utf8', timeout: 30000 });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(action, label, timeout = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const result = await action();
    if (result) return result;
    await delay(500);
  }
  throw new Error(`Timed out: ${label}`);
}
function nodes() {
  adb('shell', 'uiautomator', 'dump', '/sdcard/stc-window.xml');
  const xml = adb('shell', 'cat', '/sdcard/stc-window.xml');
  writeFileSync(`${output}/last-window.xml`, xml);
  return [...xml.matchAll(/<node\s+([^>]+)>/g)].map(match => Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]])));
}
async function tapId(id) {
  const node = await until(() => nodes().find(n => n['resource-id'] === id || n['resource-id']?.endsWith(`:id/${id}`)), id);
  const [x1, y1, x2, y2] = node.bounds.match(/\d+/g).map(Number);
  adb('shell', 'input', 'tap', String(Math.round((x1 + x2) / 2)), String(Math.round((y1 + y2) / 2)));
}
async function fill(id, text) {
  await tapId(id);
  adb('shell', 'input', 'keycombination', '113', '29');
  adb('shell', 'input', 'keyevent', '67');
  adb('shell', 'input', 'text', text);
  adb('shell', 'input', 'keyevent', '4');
}
function openRoute(route) {
  adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', `stcompanion:///${route}`, app);
}
async function connectWebView() {
  const socket = await until(() => {
    const pid = adb('shell', 'pidof', app).trim();
    return adb('shell', 'cat', '/proc/net/unix').match(new RegExp(`@([\\w.-]*webview_devtools_remote_${pid})`))?.[1];
  }, 'debuggable WebView');
  adb('forward', 'tcp:9222', `localabstract:${socket}`);
  return await chromium.connectOverCDP('http://127.0.0.1:9222');
}
async function ready(page) {
  await until(async () => {
    const popup = page.locator('dialog[open] .popup-button-ok');
    if (await popup.isVisible()) await popup.click();
    return page.evaluate(() => Boolean(window.__STC_RECEIVE__ && document.querySelector('#stc-root'))).catch(() => false);
  }, 'injected adapter and onboarding', 120000);
}

let browser;
try {
  // Create an isolated card through the real server; no production data is involved.
  const setup = await chromium.launch();
  const setupPage = await setup.newPage();
  await setupPage.goto('http://127.0.0.1:8190');
  await setupPage.waitForFunction(() => window.SillyTavern?.getContext);
  const avatar = await setupPage.evaluate(async () => {
    const ctx = window.SillyTavern.getContext();
    const headers = { ...ctx.getRequestHeaders() }; delete headers['Content-Type'];
    const data = new FormData(); data.set('ch_name', 'Android fixture'); data.set('first_mes', 'Android greeting');
    const result = await fetch('/api/characters/create', { method: 'POST', headers, body: data });
    if (!result.ok) throw new Error('Fixture creation failed');
    return result.text();
  });
  await setup.close();
  for (const port of [8081, 8191, 8193]) adb('reverse', `tcp:${port}`, `tcp:${port}`);
  adb('shell', 'am', 'start', '-W', '-n', `${app}/.MainActivity`);
  await delay(3000);
  openRoute('onboarding/manual');
  await fill('server-url', 'http://127.0.0.1:8191');
  await fill('server-username', 'fixture');
  await fill('server-password', 'wrong-password');
  await tapId('connect-server');
  await until(() => nodes().some(n => /credentials|authentication|username|password/i.test(n.text) && /invalid|failed|incorrect|check/i.test(n.text)), 'invalid credentials message');
  await fill('server-password', 'stc-fixture-password');
  await tapId('connect-server');
  await until(() => !nodes().some(n => n['resource-id'] === 'connect-server'), 'native connection');
  openRoute(`character/${encodeURIComponent(avatar)}`);
  await tapId('new-chat');
  browser = await connectWebView();
  const page = await until(() => browser.contexts()[0]?.pages()[0], 'WebView page');
  page.on('console', msg => { if (msg.type() === 'error') console.log('WEB:', msg.text()); });
  await ready(page);
  await page.waitForFunction(avatar => {
    const ctx = window.SillyTavern.getContext();
    return ctx.characters[Number(ctx.characterId)]?.avatar === avatar && ctx.chat.length > 0;
  }, avatar);
  const first = await page.evaluate(() => window.SillyTavern.getContext().getCurrentChatId());
  await page.evaluate(async () => {
    const st = await import('/script.js');
    const api = await import('/scripts/openai.js');
    st.changeMainAPI('openai');
    Object.assign(api.oai_settings, { chat_completion_source: 'custom', custom_url: 'http://127.0.0.1:8192/v1', custom_model: 'fixture', stream_openai: true });
    window.$('#chat_completion_source').val('custom').trigger('change');
    window.$('#custom_api_url_text').val('http://127.0.0.1:8192/v1').trigger('input');
    window.$('#custom_model_id').val('fixture').trigger('input');
    document.querySelector('#api_button_openai').click();
  });
  await page.waitForFunction(async () => (await import('/script.js')).online_status !== 'no_connection');
  await page.locator('#send_textarea').fill('Hello Android');
  await page.locator('#send_but').click();
  await page.waitForFunction(() => document.querySelector('#chat .mes:last-child .mes_text')?.textContent.includes('stream completed successfully'));
  await page.waitForFunction(async () => !(await import('/script.js')).isGenerating());
  await page.evaluate(() => { window.stcRetainedChatNode = document.querySelector('#chat'); });
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await tapId('continue-chat');
  await page.waitForFunction(() => document.querySelector('#chat') === window.stcRetainedChatNode);
  assert.equal(await page.evaluate(() => window.SillyTavern.getContext().getCurrentChatId()), first);

  // Every attack runs in the actual Android WebView with its authenticated session.
  await page.evaluate(async () => {
    for (const url of ['http://127.0.0.1:8193/challenge?same-port-attack', 'http://10.0.2.2:8193/challenge?external', '/stc-test/redirect']) {
      await fetch(url, { signal: AbortSignal.timeout(5000) }).catch(() => {});
    }
    const frame = document.createElement('iframe');
    frame.src = 'http://10.0.2.2:8193/challenge?iframe'; document.body.append(frame);
  });
  await until(async () => (await fetch('http://127.0.0.1:8193/evidence').then(r => r.json())).some(r => r.path.includes('iframe')), 'external iframe challenge');
  const evidence = await fetch('http://127.0.0.1:8193/evidence').then(r => r.json());
  assert(evidence.some(r => r.path.includes('external')), 'External challenge was reached');
  assert(!evidence.some(r => r.path.includes('same-port-attack')), 'Different-port resource must be intercepted');
  assert(!evidence.some(r => r.authorization), 'Server credentials must never reach another origin');
  await page.screenshot({ path: `${output}/chat.png` });
  writeFileSync(`${output}/result.json`, JSON.stringify({ passed: true, avatar, file: first, evidence }, null, 2));
  console.log('Android native connection, streaming, retained WebView and auth isolation passed.');
} catch (error) {
  try { writeFileSync(`${output}/failure.png`, execFileSync('adb', ['exec-out', 'screencap', '-p'])); } catch {}
  throw error;
} finally {
  try { writeFileSync(`${output}/logcat.txt`, adb('logcat', '-d', '-t', '2000')); } catch {}
  await browser?.close();
}
