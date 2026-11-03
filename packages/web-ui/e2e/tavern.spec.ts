import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
const generated = readFileSync(new URL('../../../apps/mobile/src/generated/tavernBundle.ts', import.meta.url), 'utf8');
const bundle: string = JSON.parse(generated.slice(generated.indexOf(' = ') + 3).trim().replace(/;$/, ''));

async function load(page: Page, original = false) {
  await page.addInitScript(() => {
    localStorage.setItem('language', 'zh-cn');
    (window as any).messages = [];
    (window as any).ReactNativeWebView = { postMessage: (raw: string) => (window as any).messages.push(JSON.parse(raw)) };
  });
  await page.goto('/');
  await page.waitForFunction(() => (window as any).SillyTavern?.getContext && !document.querySelector('#preloader'));
  const onboarding = page.locator('dialog[open] .popup-button-ok');
  if (await onboarding.isVisible()) await onboarding.click();
  await page.waitForFunction(async () => { const url = '/script.js'; return (await import(/* @vite-ignore */ url)).settingsReady; });
  await page.evaluate(({ original }) => {
    (window as any).__STC_CONFIG__ = { session: 'test', origin: location.origin, locale: 'zh-CN', theme: 'dark', original };
  }, { original });
  await page.evaluate(bundle);
  await expect.poll(() => page.evaluate(() => (window as any).messages)).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'ready' })]));
}
async function navigate(page: Page, id: string, target: object) {
  await page.evaluate(({ id, target }) => (window as any).__STC_RECEIVE__({ version: 1, session: 'test', id, type: 'navigate', target }), { id, target });
  await expect.poll(() => page.evaluate(id => (window as any).messages.find((m: any) => m.type === 'navigationResult' && m.id === id), id)).toMatchObject({ ok: true });
}
test('real 1.19.0 opens every core editor without replacing the chat DOM', async ({ page }) => {
  await load(page);
  await page.evaluate(() => { (window as any).chatNode = document.querySelector('#chat'); });
  for (const panel of ['models', 'presets', 'formatting', 'world', 'personas', 'extensions', 'characters', 'settings', 'backgrounds']) {
    await navigate(page, panel, { kind: 'panel', panel });
    await expect.poll(() => page.locator('#top-settings-holder .openDrawer').count()).toBeGreaterThan(0);
    expect(await page.evaluate(() => (window as any).chatNode === document.querySelector('#chat'))).toBe(true);
  }
  await page.screenshot({ path: '../../.cache/web-ui-settings.png' });
});
test('new chat is created once and navigation preserves an existing iframe', async ({ page }) => {
  await load(page);
  const avatar = await page.evaluate(async () => {
    const ctx = (window as any).SillyTavern.getContext();
    const data = new FormData(); data.set('ch_name', `Bridge test ${Date.now()}`); data.set('first_mes', 'Hello from the fixture');
    const headers = { ...ctx.getRequestHeaders() }; delete headers['Content-Type'];
    const response = await fetch('/api/characters/create', { method: 'POST', headers, body: data });
    if (!response.ok) throw new Error('create failed');
    const avatar = await response.text();
    const url = '/script.js'; const script = await import(/* @vite-ignore */ url); await script.getCharacters();
    return avatar;
  });
  await navigate(page, 'new-once', { kind: 'character', avatar, action: 'new' });
  const first = await page.evaluate(() => (window as any).SillyTavern.getContext().getCurrentChatId());
  await navigate(page, 'new-once', { kind: 'character', avatar, action: 'new' });
  expect(await page.evaluate(() => (window as any).SillyTavern.getContext().getCurrentChatId())).toBe(first);
  await page.evaluate(() => {
    const frame = document.createElement('iframe'); frame.srcdoc = '<button>State</button>'; frame.id = 'test-frame';
    document.querySelector('#chat .mes_text')!.append(frame); (window as any).retainedFrame = frame;
  });
  await navigate(page, 'world', { kind: 'panel', panel: 'world' });
  expect(await page.evaluate(() => document.getElementById('test-frame') === (window as any).retainedFrame)).toBe(true);
  await page.getByRole('button', { name: '关闭', exact: true }).first().click({ timeout: 5000 });
  await expect(page.locator('#WorldInfo')).toBeHidden();
  await page.screenshot({ path: '../../.cache/web-ui-chat.png' });
});
test('original mode keeps the original page and still offers the bridge', async ({ page }) => {
  await load(page, true);
  await expect(page.locator('#stc-root')).toHaveCount(0);
  await navigate(page, 'extensions', { kind: 'panel', panel: 'extensions' });
});

test('real streaming generation saves before returning home', async ({ page }) => {
  await load(page);
  const avatar = await page.evaluate(() => (window as any).SillyTavern.getContext().characters[0].avatar);
  await navigate(page, 'generation-new', { kind: 'character', avatar, action: 'new' });
  await page.evaluate(async () => {
    const path = '/script.js'; const st = await import(/* @vite-ignore */ path);
    st.changeMainAPI('openai');
    const openaiPath = '/scripts/openai.js'; const api = await import(/* @vite-ignore */ openaiPath);
    Object.assign(api.oai_settings, { chat_completion_source: 'custom', custom_url: 'http://127.0.0.1:8192/v1', custom_model: 'fixture', stream_openai: true });
    (window as any).$('#chat_completion_source').val('custom').trigger('change');
    (window as any).$('#custom_api_url_text').val('http://127.0.0.1:8192/v1').trigger('input');
    (window as any).$('#custom_model_id').val('fixture').trigger('input');
    (document.querySelector('#api_button_openai') as HTMLElement).click();
  });
  await page.waitForFunction(async () => { const path = '/script.js'; return (await import(/* @vite-ignore */ path)).online_status !== 'no_connection'; });
  await page.locator('#send_textarea').fill('Hello fixture');
  await page.locator('#send_but').click();
  await expect(page.locator('#chat .mes_text').last()).toContainText('stream completed successfully', { timeout: 30000 });
  await page.waitForFunction(async () => { const path = '/script.js'; return !(await import(/* @vite-ignore */ path)).isGenerating(); });
  await page.evaluate(() => (window as any).__STC_RECEIVE__({ version: 1, session: 'test', id: 'save-home', type: 'leave' }));
  await expect.poll(() => page.evaluate(() => (window as any).messages)).toContainEqual(expect.objectContaining({ type: 'openNativeHome' }));
});
test('unknown modern versions fail closed without hiding the original page', async ({ page }) => {

  await page.addInitScript(() => { (window as any).messages = []; (window as any).ReactNativeWebView = { postMessage: (s: string) => (window as any).messages.push(JSON.parse(s)) }; });
  await page.goto('/');
  await page.waitForFunction(() => (window as any).SillyTavern?.getContext && !document.querySelector('#preloader'));
  await page.route('**/version', route => route.fulfill({ json: { pkgVersion: '99.0.0' } }));
  await page.evaluate(() => { (window as any).__STC_CONFIG__ = { session: 'test', origin: location.origin, locale: 'en', theme: 'light', original: false }; });
  await page.evaluate(bundle);
  await expect.poll(() => page.evaluate(() => (window as any).messages)).toContainEqual(expect.objectContaining({ type: 'error', code: 'unsupported' }));
  await expect(page.locator('html')).not.toHaveClass(/stc-modern/);
});
