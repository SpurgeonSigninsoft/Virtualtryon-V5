import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const root = new URL('.', import.meta.url).pathname.replace(/^\/(.:\/)/, '$1');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.md': 'text/markdown', '.json': 'application/json' };

createServer(async (request, response) => {
  const requested = request.url === '/' ? 'index.html' : decodeURIComponent(request.url.split('?')[0]).replace(/^\/+/, '');
  if (requested.includes('..')) { response.writeHead(400); return response.end('Bad request'); }
  try {
    const body = await readFile(join(root, requested));
    response.writeHead(200, { 'Content-Type': types[extname(requested)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(body);
  } catch {
    response.writeHead(404); response.end('Not found');
  }
}).listen(3000, () => console.log('FrameFlow is ready at http://localhost:3000'));
