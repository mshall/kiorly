import http from 'node:http'; import { readFile } from 'node:fs/promises'; import { join, extname } from 'node:path';
const root = process.argv[2], port = Number(process.argv[3]);
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.map': 'application/json' };
http.createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  for (const f of [join(root, p), join(root, 'index.html')]) {
    try { const b = await readFile(f); res.writeHead(200, { 'content-type': types[extname(f)] ?? 'application/octet-stream' }); return res.end(b); } catch {}
  }
  res.writeHead(404); res.end();
}).listen(port, () => console.log('serving', root, port));
