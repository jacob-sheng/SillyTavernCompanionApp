import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function validateRelease(versions, versionCode, previous) {
  const version = versions[0];
  if (!/^\d+\.\d+\.\d+$/.test(version) || versions.some((value) => value !== version)) {
    throw new Error('All three package versions and app.config.ts must have the same numeric X.Y.Z version.');
  }
  if (!Number.isSafeInteger(versionCode) || versionCode < 1 || versionCode > 2100000000) {
    throw new Error('Android versionCode must be a positive integer within the Android limit.');
  }
  if (previous) {
    const old = previous.version.split('.').map(Number);
    const comparison = version.split('.').map(Number).map((value, index) => value - old[index]).find((value) => value !== 0) ?? 0;
    if (comparison < 0) throw new Error('Version cannot go backwards from the latest tag.');
    if (comparison > 0 && versionCode <= previous.versionCode) throw new Error('A new version must increase android.versionCode.');
    if (comparison === 0 && versionCode !== previous.versionCode) throw new Error('Bump the version when changing android.versionCode.');
  }
  return `v${version}`;
}

export function checkRepository(root) {
  const read = (path) => readFileSync(join(root, path), 'utf8');
  const versions = ['package.json', 'packages/core/package.json', 'apps/mobile/package.json'].map((path) => JSON.parse(read(path)).version);
  const config = read('apps/mobile/app.config.ts');
  versions.push(config.match(/^\s*version: '([^']+)',/m)?.[1]);
  const versionCode = Number(config.match(/versionCode: (\d+),/)?.[1]);
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const latest = git('tag', '--list', 'v*', '--sort=-version:refname').split('\n').find((tag) => /^v\d+\.\d+\.\d+$/.test(tag));
  const previous = latest ? {
    version: latest.slice(1),
    versionCode: Number(git('show', `${latest}:apps/mobile/app.config.ts`).match(/versionCode: (\d+),/)?.[1]),
  } : undefined;
  return validateRelease(versions, versionCode, previous);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(`Validated ${checkRepository(join(dirname(fileURLToPath(import.meta.url)), '../..'))}`); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
