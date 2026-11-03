// Isolated emulator fixture. Records only whether a credential was present, never its value.
import { createServer } from 'node:http';
const requests = [];
createServer((req, res) => {
  if (req.url === '/evidence') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(requests));
  }
  requests.push({ path: req.url, authorization: Boolean(req.headers.authorization) });
  res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="restricted"', 'Access-Control-Allow-Origin': '*' });
  res.end('Fixture authentication challenge');
}).listen(8193, '0.0.0.0');
