import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

test('Windows CRLF changelog bumps every version and Android code together', () => {
  const root = mkdtempSync(join(tmpdir(), 'st-release-'));
  try {
    for (const folder of ['scripts/release', 'apps/mobile', 'packages/core', 'packages/web-ui']) mkdirSync(join(root, folder), { recursive: true });
    copyFileSync(new URL('./prepare.mjs', import.meta.url), join(root, 'scripts/release/prepare.mjs'));
    for (const file of ['package.json', 'apps/mobile/package.json', 'packages/core/package.json', 'packages/web-ui/package.json']) {
      writeFileSync(join(root, file), '{"version": "0.17.1"}\r\n');
    }
    writeFileSync(join(root, 'apps/mobile/app.config.ts'), "export default {\r\n  version: '0.17.1',\r\n  android: { versionCode: 19, },\r\n};\r\n");
    writeFileSync(join(root, 'CHANGELOG.md'), '## [Unreleased]\r\n\r\n### Added\r\n- New feature\r\n\r\n## [0.17.1]\r\n');
    const run = (...args) => execFileSync(process.execPath, [join(root, 'scripts/release/prepare.mjs'), ...args], { encoding: 'utf8' });
    run('--dry-run');
    assert.equal(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version, '0.17.1');
    run('--date', '2026-11-03');
    for (const file of ['package.json', 'apps/mobile/package.json', 'packages/core/package.json', 'packages/web-ui/package.json']) {
      assert.equal(JSON.parse(readFileSync(join(root, file), 'utf8')).version, '0.18.0');
    }
    assert.match(readFileSync(join(root, 'apps/mobile/app.config.ts'), 'utf8'), /versionCode: 20/);
    assert.match(readFileSync(join(root, 'CHANGELOG.md'), 'utf8'), /## \[0.18.0\] - 2026-11-03/);
    assert.match(run(), /nothing to release/);
  } finally {
    if (!root.startsWith(join(tmpdir(), 'st-release-'))) throw new Error('Unexpected test workspace');
    rmSync(root, { recursive: true, force: true });
  }
});
