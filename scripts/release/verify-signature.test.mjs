import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifySignature } from './verify-signature.mjs';
const cert = 'ab'.repeat(32);
test('accepts legacy and SDK-range signer output without weakening certificate checks', () => {
  verifySignature(`Signer #1 certificate SHA-256 digest: ${cert}\n`, cert);
  verifySignature(`Signer (minSdkVersion=24, maxSdkVersion=2147483647) #1 certificate SHA-256 digest: ${cert}\n`, cert);
  verifySignature(`Signer #1 certificate SHA-256 digest: ${cert}\nSigner #1 certificate SHA-256 digest: ${cert}\n`, cert);
  assert.throws(() => verifySignature(`Signer #1 certificate SHA-256 digest: ${'cd'.repeat(32)}\n`, cert));
  assert.throws(() => verifySignature(`Signer #1 certificate SHA-256 digest: ${cert}\nSigner #2 certificate SHA-256 digest: ${'cd'.repeat(32)}`, cert));
  assert.throws(() => verifySignature('', cert));
  assert.throws(() => verifySignature(`Source Stamp Signer certificate SHA-256 digest: ${cert}`, cert));
  assert.throws(() => verifySignature('', ''));
});
