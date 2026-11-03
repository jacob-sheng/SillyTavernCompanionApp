import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Optional network-dependent smoke test against the isolated fixture. Never uses user servers.
test('Tavern Helper and pinned MVU update per-message variables under the modern shell', async ({ page }) => {
  test.skip(!process.env.ST_TEST_MVU, 'Set ST_TEST_MVU to the pinned MVU bundle and install the pinned helper in the fixture.');
  test.setTimeout(120000);
  const mvu = readFileSync(process.env.ST_TEST_MVU!, 'utf8');
  const source = readFileSync(new URL('../../../apps/mobile/src/generated/tavernBundle.ts', import.meta.url), 'utf8');
  const bundle = JSON.parse(source.slice(source.indexOf(' = ') + 3).trim().replace(/;$/, ''));
  await page.addInitScript(() => {
    localStorage.setItem('language', 'zh-cn');
    (window as any).messages = [];
    (window as any).ReactNativeWebView = { postMessage: (raw: string) => (window as any).messages.push(JSON.parse(raw)) };
  });
  page.on('pageerror', error => console.log('PLUGIN PAGE ERROR', error.message));
  await page.goto('/');
  await page.waitForFunction(() => !!(window as any).TavernHelper?.replaceScriptTrees);
  await page.evaluate(() => { (window as any).__STC_CONFIG__ = { session: 'plugins', origin: location.origin, locale: 'zh-CN', theme: 'dark', original: false }; });
  await page.evaluate(bundle);
  await expect.poll(() => page.evaluate(() => (window as any).messages), { timeout: 30000 }).toContainEqual(expect.objectContaining({ type: 'ready' }));
  await page.evaluate(async mvu => {
    const ctx = (window as any).SillyTavern.getContext();
    if (!ctx.characters.length) throw new Error('Run the base fixture tests first to create a test character.');
    (window as any).__STC_RECEIVE__({ version: 1, session: 'plugins', id: 'plugin-chat', type: 'navigate', target: { kind: 'character', avatar: ctx.characters[0].avatar, action: 'new' } });
    (window as any).TavernHelper.replaceScriptTrees([{ type: 'script', id: 'stc-mvu-fixture', enabled: true, name: 'MVU fixture', content: mvu }], { type: 'global' });
  }, mvu);
  await page.waitForFunction(() => !!(window as any).Mvu?.parseMessage, { timeout: 60000 });
  const result = await page.evaluate(async () => {
    const Mvu = (window as any).Mvu;
    const initial = { stat_data: { health: 10 }, initialized_lorebooks: {} };
    await Mvu.replaceMvuData(initial, { type: 'message', message_id: 0 });
    const next = await Mvu.parseMessage("<UpdateVariable>_.set('health', 10, 12);</UpdateVariable>", initial);
    if (!next) throw new Error('MVU did not parse the fixture update');
    await Mvu.replaceMvuData(next, { type: 'message', message_id: 0 });
    return Mvu.getMvuData({ type: 'message', message_id: 0 }).stat_data.health;
  });
  expect(result).toBe(12);
  await page.evaluate(async () => {
    const html = '<html><body><button id="heal">Heal</button><output id="health"></output><script>const read=()=>document.querySelector("#health").textContent=parent.Mvu.getMvuData({type:"message",message_id:0}).stat_data.health;read();document.querySelector("#heal").onclick=async()=>{const d=structuredClone(parent.Mvu.getMvuData({type:"message",message_id:0}));d.stat_data.health++;await parent.Mvu.replaceMvuData(d,{type:"message",message_id:0});read();};</script></body></html>';
    await (window as any).TavernHelper.setChatMessages([{ message_id: 0, message: '```html\n' + html + '\n```' }], { refresh: 'affected' });
  });
  const frame = page.frameLocator('#chat iframe');
  await frame.getByRole('button', { name: 'Heal' }).click();
  await expect(frame.locator('#health')).toHaveText('13');
  await page.evaluate(() => (window as any).__STC_RECEIVE__({ version: 1, session: 'plugins', id: 'plugin-home', type: 'leave' }));
  await expect.poll(() => page.evaluate(() => (window as any).messages)).toContainEqual(expect.objectContaining({ type: 'openNativeHome' }));
  expect(await page.evaluate(() => (window as any).Mvu.getMvuData({ type: 'message', message_id: 0 }).stat_data.health)).toBe(13);
});
