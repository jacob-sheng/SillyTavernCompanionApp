// Deterministic local OpenAI-compatible fixture. No keys or external model calls.
import { createServer } from 'node:http';
createServer(async (req, res) => {
  if (req.url?.endsWith('/models')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ object: 'list', data: [{ id: 'fixture', object: 'model' }] }));
  }
  if (!req.url?.endsWith('/chat/completions')) { res.writeHead(404); return res.end(); }
  let body = ''; for await (const chunk of req) body += chunk;
  const input = JSON.parse(body);
  const slow = input.messages?.some(message => String(message.content).includes('STC slow stop fixture'));
  const content = 'Fixture response. The stream completed successfully.';
  if (!input.stream) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }] }));
  }
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
  for (const word of content.split(' ')) {
    if (res.destroyed) return;
    res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: word + ' ' }, finish_reason: null }] })}\n\n`);
    await new Promise(r => setTimeout(r, slow ? 1500 : 150));
  }
  res.end('data: [DONE]\n\n');
}).listen(8192, '127.0.0.1');
