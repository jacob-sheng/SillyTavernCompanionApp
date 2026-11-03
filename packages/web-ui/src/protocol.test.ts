import { describe, expect, it } from 'vitest';
import { parseCommand, parseWebMessage, plainPreview, validTarget } from './protocol';
describe('bridge boundary', () => {
  it('accepts file identities without conflating same-named characters', () => {
    expect(validTarget({ kind: 'character', avatar: '角色 甲.png', action: 'continue', file: '故事 #1 & 2' })).toBe(true);
    expect(validTarget({ kind: 'character', avatar: 0, action: 'new' })).toBe(false);
    expect(validTarget({ kind: 'panel', panel: '__proto__' })).toBe(false);
  });
  it('rejects old sessions, unknown commands and invalid payloads', () => {
    const command = { version: 1, session: 'current', id: '1', type: 'navigate', target: { kind: 'panel', panel: 'world' } };
    expect(parseCommand(command, 'current')).toEqual(command);
    expect(parseCommand(command, 'old')).toBeNull();
    expect(parseCommand({ ...command, type: 'execute' }, 'current')).toBeNull();
  });
  it('rejects foreign origins, ports and malformed messages', () => {
    const raw = JSON.stringify({ version: 1, session: 's', type: 'ready' });
    expect(parseWebMessage(raw, 's', 'https://st.example/page', 'https://st.example')).not.toBeNull();
    for (const url of ['http://st.example', 'https://st.example:444', 'https://evil.example']) expect(parseWebMessage(raw, 's', url, 'https://st.example')).toBeNull();
    expect(parseWebMessage('{', 's', 'https://st.example', 'https://st.example')).toBeNull();
  });
  it('strips active content from native previews', () => {
    expect(plainPreview('<script>alert(1)</script><b>Hello</b>\n &amp; world')).toBe('Hello & world');
  });
});
