import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
const generated = readFileSync(new URL('../../../apps/mobile/src/generated/tavernBundle.ts', import.meta.url), 'utf8');
const bundle: string = JSON.parse(generated.slice(generated.indexOf(' = ') + 3).trim().replace(/;$/, ''));

async function load(page: Page, original = false, theme = 'dark') {
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
  await page.evaluate(({ original, theme }) => {
    (window as any).__STC_CONFIG__ = { session: 'test', origin: location.origin, locale: 'zh-CN', theme, original };
  }, { original, theme });
  await page.evaluate(bundle);
  await expect.poll(() => page.evaluate(() => (window as any).messages)).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'ready' })]));
}
test('light editors have readable helper text and acknowledge their first panel title', async ({ page }) => {
  await load(page, false, 'light');
  await navigate(page, 'first-panel', { kind: 'panel', panel: 'models' });
  await expect(page.locator('#stc-root .stc-heading strong')).toHaveText('模型与连接');
  const helper = page.locator('#rm_api_block small').first();
  await expect(helper).toHaveCSS('color', 'rgb(99, 99, 116)');
  await expect(helper).toHaveCSS('opacity', '1');
  await page.screenshot({ path: '../../.cache/web-ui-light-models.png' });
});
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
  await page.evaluate(() => {
    const ctx = (window as any).SillyTavern.getContext();
    (window as any).createdChats = 0;
    ctx.eventSource.on(ctx.eventTypes.CHAT_CREATED, () => { (window as any).createdChats++; });
  });
  await navigate(page, 'new-once', { kind: 'character', avatar, action: 'new' });
  const first = await page.evaluate(() => (window as any).SillyTavern.getContext().getCurrentChatId());
  await navigate(page, 'new-once', { kind: 'character', avatar, action: 'new' });
  expect(await page.evaluate(() => (window as any).SillyTavern.getContext().getCurrentChatId())).toBe(first);
  expect(await page.evaluate(() => (window as any).createdChats)).toBe(1);
  await page.evaluate(() => {
    const frame = document.createElement('iframe'); frame.srcdoc = '<button>State</button>'; frame.id = 'test-frame';
    document.querySelector('#chat .mes_text')!.append(frame); (window as any).retainedFrame = frame;
  });
  await navigate(page, 'world', { kind: 'panel', panel: 'world' });
  expect(await page.evaluate(() => document.getElementById('test-frame') === (window as any).retainedFrame)).toBe(true);
  await page.getByRole('button', { name: '关闭', exact: true }).first().click({ timeout: 5000 });
  await expect(page.locator('#WorldInfo')).toBeHidden();
  await navigate(page, 'settings-before-return', { kind: 'panel', panel: 'settings' });
  await navigate(page, 'retained-return', { kind: 'character', avatar, action: 'continue' });
  const name = await page.evaluate(() => { const ctx = (window as any).SillyTavern.getContext(); return ctx.characters[Number(ctx.characterId)].name; });
  await expect(page.locator('#stc-root .stc-heading strong')).toHaveText(name);
  expect(await page.evaluate(() => document.getElementById('test-frame') === (window as any).retainedFrame)).toBe(true);
  await page.screenshot({ path: '../../.cache/web-ui-chat.png' });
});
test('settings section navigation keeps bound controls and existing values', async ({ page }) => {
  await load(page);
  await navigate(page, 'settings-sections', { kind: 'panel', panel: 'settings' });
  await page.evaluate(() => { (window as any).settingsField = document.querySelector('#customCSS'); });
  const jump = page.getByLabel('跳转到设置章节');
  await expect(jump.locator('option')).not.toHaveCount(1);
  const last = await jump.locator('option').last().getAttribute('value');
  await jump.selectOption(last!);
  expect(await page.evaluate(() => (window as any).settingsField === document.querySelector('#customCSS'))).toBe(true);
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('H4');
  await page.screenshot({ path: '../../.cache/web-ui-settings-navigation.png' });
});
test('original mode keeps the original page and still offers the bridge', async ({ page }) => {
  await load(page, true);
  await expect(page.locator('#stc-root')).toHaveCount(0);
  await navigate(page, 'extensions', { kind: 'panel', panel: 'extensions' });
});
test('character edits and JSON exports use the original bound form', async ({ page }) => {
  await load(page);
  const avatar = await page.evaluate(() => (window as any).SillyTavern.getContext().characters[0].avatar);
  await navigate(page, 'edit-export', { kind: 'character', avatar, action: 'edit' });
  const description = `中文 description # ${Date.now()}`;
  await page.locator('#description_textarea').fill(description);
  await page.locator('div#export_button').click();
  await page.locator('.export_format[data-format="json"]').click();
  await expect.poll(() => page.evaluate(() => (window as any).messages.find((message: any) => message.type === 'exportFile'))).toMatchObject({ name: expect.stringMatching(/\.json$/) });
  const exported = await page.evaluate(() => (window as any).messages.find((message: any) => message.type === 'exportFile'));
  const card = JSON.parse(Buffer.from(exported.base64, 'base64').toString('utf8'));
  expect(card.data.description).toBe(description);
  const persisted = await page.evaluate(async avatar => {
    const ctx = (window as any).SillyTavern.getContext();
    const result = await fetch('/api/characters/get', { method: 'POST', headers: ctx.getRequestHeaders(), body: JSON.stringify({ avatar_url: avatar }) });
    if (!result.ok) throw new Error('readback failed');
    return result.json();
  }, avatar);
  expect(persisted.description).toBe(description);
  const importedName = `导入 fixture ${Date.now()}`;
  card.name = importedName; card.data.name = importedName;
  await page.locator('#character_import_file').setInputFiles({ name: `${importedName}.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(card)) });
  await expect.poll(() => page.evaluate(name => (window as any).SillyTavern.getContext().characters.find((character: any) => character.name === name)?.description, importedName)).toBe(description);
});
test('extension navigation opens upstream manager and installer', async ({ page }) => {
  await load(page);
  await navigate(page, 'extensions-center', { kind: 'panel', panel: 'extensions' });
  await page.getByRole('button', { name: '管理已安装的扩展', exact: true }).click();
  await expect(page.locator('dialog[open] .extensions_info')).toBeVisible();
  await page.evaluate(() => { (window as any).regexControl = document.querySelector('.extension_block[data-name="regex"]'); });
  await page.getByRole('searchbox', { name: '搜索扩展' }).fill('Regex');
  await expect(page.locator('.extensions_info .extension_block:visible')).toHaveCount(1);
  expect(await page.evaluate(() => document.querySelector('.extension_block[data-name="regex"]') === (window as any).regexControl)).toBe(true);
  await page.getByRole('searchbox', { name: '搜索扩展' }).fill('');
  await page.screenshot({ path: '../../.cache/web-ui-extensions-manager.png' });
  await page.locator('dialog[open] .popup-button-ok').click();
  await page.getByRole('button', { name: '通过网址安装', exact: true }).click();
  await expect(page.locator('dialog[open] #extension_branch_name')).toBeVisible();
  await page.locator('dialog[open] .popup-button-cancel').click();
});
test('world book creation, entry editing and export retain upstream persistence', async ({ page }) => {
  await load(page);
  await navigate(page, 'world-editor', { kind: 'panel', panel: 'world' });
  const name = `世界书 fixture ${Date.now()}`;
  await page.locator('#world_create_button').click();
  await page.locator('dialog[open] .popup-input').fill(name);
  await page.locator('dialog[open] .popup-button-ok').click();
  await expect(page.locator('#world_editor_select option:checked')).toHaveText(name);
  await page.locator('#world_popup_new').click();
  await page.locator('#world_popup_entries_list .inline-drawer-toggle').first().click();
  const content = '城市位于海边。Fixture world entry.';
  await page.locator('#world_popup_entries_list textarea[name="content"]').fill(content);
  await expect.poll(() => page.evaluate(async name => {
    const ctx = (window as any).SillyTavern.getContext();
    const result = await fetch('/api/worldinfo/get', { method: 'POST', headers: ctx.getRequestHeaders(), body: JSON.stringify({ name }) });
    if (!result.ok) return null;
    const data = await result.json();
    return Object.values(data.entries).map((entry: any) => entry.content);
  }, name)).toContain(content);
  await page.locator('#world_popup_export').click();
  await expect.poll(() => page.evaluate(() => (window as any).messages.find((message: any) => message.type === 'exportFile'))).toMatchObject({ name: `${name}.json` });
  const exported = await page.evaluate(() => (window as any).messages.find((message: any) => message.type === 'exportFile'));
  expect(Object.values(JSON.parse(Buffer.from(exported.base64, 'base64').toString('utf8')).entries).map((entry: any) => entry.content)).toContain(content);
});
test('sampling preset changes survive save-as and JSON export', async ({ page }) => {
  await load(page);
  await page.evaluate(async () => { const path = '/script.js'; (await import(/* @vite-ignore */ path)).changeMainAPI('openai'); });
  await navigate(page, 'preset-editor', { kind: 'panel', panel: 'presets' });
  await page.locator('#temp_counter_openai').fill('0.73');
  await page.locator('#temp_counter_openai').press('Tab');
  const name = `采样 fixture ${Date.now()}`;
  await page.locator('#new_oai_preset').click();
  await page.locator('dialog[open] .popup-input').fill(name);
  await page.locator('dialog[open] .popup-button-ok').click();
  await expect(page.locator('#settings_preset_openai option:checked')).toHaveText(name);
  await page.locator('#export_oai_preset').click();
  // Upstream asks whether to remove endpoint data, then which fields to export.
  for (let attempt = 0; attempt < 20; attempt++) {
    if (await page.evaluate(() => (window as any).messages.some((message: any) => message.type === 'exportFile'))) break;
    const confirm = page.locator('dialog[open] .popup-button-ok');
    if (await confirm.isVisible()) await confirm.click();
    await page.waitForTimeout(200);
  }
  await expect.poll(() => page.evaluate(() => (window as any).messages.find((message: any) => message.type === 'exportFile'))).toMatchObject({ name: `${name}.json` });
  const exported = await page.evaluate(() => (window as any).messages.find((message: any) => message.type === 'exportFile'));
  expect(JSON.parse(Buffer.from(exported.base64, 'base64').toString('utf8')).temperature).toBe(0.73);
});
test('persona description edits persist through the original settings handler', async ({ page }) => {
  await load(page);
  await navigate(page, 'persona-editor', { kind: 'panel', panel: 'personas' });
  const description = `用户身份 fixture ${Date.now()}`;
  await page.locator('#persona_description').fill(description);
  await expect.poll(() => page.evaluate(async () => {
    const ctx = (window as any).SillyTavern.getContext();
    const response = await fetch('/api/settings/get', { method: 'POST', headers: ctx.getRequestHeaders(), body: '{}' });
    if (!response.ok) return null;
    return JSON.parse((await response.json()).settings).power_user.persona_description;
  })).toBe(description);
});
test('retained group navigation discovers new groups and rejects deleted groups', async ({ page }) => {
  await load(page);
  const groupId = await page.evaluate(async () => {
    const ctx = (window as any).SillyTavern.getContext();
    const response = await fetch('/api/groups/create', { method: 'POST', headers: ctx.getRequestHeaders(), body: JSON.stringify({ name: '群聊 # fixture', members: [ctx.characters[0].avatar] }) });
    if (!response.ok) throw new Error('create group failed');
    return (await response.json()).id;
  });
  await navigate(page, 'new-group', { kind: 'group', groupId });
  await page.route('**/api/groups/all', route => route.fulfill({ status: 403, body: 'Forbidden' }));
  await page.evaluate(groupId => (window as any).__STC_RECEIVE__({ version: 1, session: 'test', id: 'offline-group', type: 'navigate', target: { kind: 'group', groupId } }), groupId);
  await expect.poll(() => page.evaluate(() => (window as any).messages.find((m: any) => m.id === 'offline-group'))).toMatchObject({ ok: false, code: 'network' });
  await page.unroute('**/api/groups/all');
  await page.evaluate(async groupId => {
    const ctx = (window as any).SillyTavern.getContext();
    const response = await fetch('/api/groups/delete', { method: 'POST', headers: ctx.getRequestHeaders(), body: JSON.stringify({ id: groupId }) });
    if (!response.ok) throw new Error('delete group failed');
    (window as any).__STC_RECEIVE__({ version: 1, session: 'test', id: 'deleted-group', type: 'navigate', target: { kind: 'group', groupId } });
  }, groupId);
  await expect.poll(() => page.evaluate(() => (window as any).messages.find((m: any) => m.id === 'deleted-group'))).toMatchObject({ ok: false, code: 'missing' });
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
  await expect.poll(() => page.evaluate(() => (window as any).messages.find((m: any) => m.type === 'navigationResult' && m.id === 'save-home'))).toMatchObject({ ok: true });
  await expect.poll(() => page.evaluate(() => (window as any).messages)).toContainEqual(expect.objectContaining({ type: 'openNativeHome' }));
  // Continue in the same retained page, with a plugin that finishes asynchronously.
  await page.evaluate(() => {
    const ctx = (window as any).SillyTavern.getContext();
    ctx.eventSource.on(ctx.eventTypes.GENERATION_STOPPED, async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
      ctx.chatMetadata.stcStopFinished = true;
    });
  });
  await page.locator('#send_textarea').fill('STC slow stop fixture');
  await page.locator('#send_but').click();
  await expect(page.locator('#chat .mes_text').last()).toContainText('Fixture', { timeout: 30000 });
  await page.evaluate(() => (window as any).__STC_RECEIVE__({ version: 1, session: 'test', id: 'stop-save-home', type: 'stopAndLeave' }));
  await expect.poll(() => page.evaluate(() => (window as any).messages.find((m: any) => m.type === 'navigationResult' && m.id === 'stop-save-home'))).toMatchObject({ ok: true });
  expect(await page.evaluate(() => (window as any).SillyTavern.getContext().chatMetadata.stcStopFinished)).toBe(true);
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
