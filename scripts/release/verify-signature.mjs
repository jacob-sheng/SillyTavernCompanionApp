import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function verifySignature(output, expected) {
  if (!/^[0-9a-f]{64}$/i.test(expected ?? '')) throw new Error('Missing or invalid expected signing certificate.');
  // Newer build-tools add SDK ranges to the signer prefix. Validate every reported signer,
  // allowing multiple signing schemes to report the same certificate.
  const certificates = [...output.matchAll(/^(?:V\d+(?:\.\d+)? )?Signer[^\r\n]*certificate SHA-256 digest:\s*([0-9a-f]{64})\s*$/gim)]
    .map((match) => match[1].toLowerCase());
  if (!certificates.length || certificates.some((cert) => cert !== expected.toLowerCase())) {
    throw new Error(`APK certificate mismatch: expected ${expected}; reported ${certificates.join(', ') || 'no signer certificate'}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { verifySignature(readFileSync(0, 'utf8'), process.env.EXPECTED_CERT); console.log('Release certificate verified.'); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
