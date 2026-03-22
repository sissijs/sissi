import { createHash } from 'node:crypto';
import EventEmitter from 'events';
import { readFile } from 'fs';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';

import { getMime } from './mimes.js'

const DEVSERVER_JS = `
(function() {
  function connect() {
    const ws = new WebSocket('ws://' + location.host + '/_dev-events');
    ws.addEventListener('message', (e) => {
      const events = JSON.parse(e.data);
      for (const event of events) {
        if (event.filename.endsWith('.html') || document.location.href === event.page.url) {
          document.location.reload();
        }
        if (event.filename.endsWith('.css')) {
          document.querySelectorAll('link[rel="stylesheet"]:not([data-remove])').forEach(link => {
            const [href, query] = link.getAttribute('href').split('?')
            const params = new URLSearchParams(query);
            params.set('time', new Date().getTime().toString());
            const newLink = link.cloneNode();
            newLink.setAttribute('href', href + '?' + params.toString());
            link.setAttribute('data-remove', '1');
            document.head.insertBefore(newLink, link);
            window.setTimeout(() => link.remove(), 50);
          });
        }
      }
    });
    ws.addEventListener('close', () => setTimeout(connect, 1000));
  }
  connect();
})();
`

const WS_MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function wsHandshake(req, socket) {
  const key = req.headers['sec-websocket-key'];
  const accept = createHash('sha1').update(key + WS_MAGIC).digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n` +
    '\r\n'
  );
}

function wsSend(socket, data) {
  const payload = Buffer.from(data, 'utf8');
  const len = payload.length;
  let header;
  if (len <= 125) {
    header = Buffer.from([0x81, len]);
  } else if (len <= 65535) {
    header = Buffer.from([0x81, 0x7e, (len >> 8) & 0xff, len & 0xff]);
  } else {
    const lenBuf = Buffer.alloc(8);
    lenBuf.writeBigUInt64BE(BigInt(len));
    header = Buffer.concat([Buffer.from([0x81, 0x7f]), lenBuf]);
  }
  socket.write(Buffer.concat([header, payload]));
}

function parseFrame(buf) {
  if (buf.length < 2) return null;
  const opcode = buf[0] & 0x0f;
  const masked = (buf[1] & 0x80) !== 0;
  let len = buf[1] & 0x7f;
  let offset = 2;
  if (len === 126) {
    if (buf.length < 4) return null;
    len = buf.readUInt16BE(2);
    offset = 4;
  } else if (len === 127) {
    if (buf.length < 10) return null;
    len = Number(buf.readBigUInt64BE(2));
    offset = 10;
  }
  if (masked) offset += 4;
  return { opcode, data: buf.slice(offset, offset + len) };
}

function setupWebSockets(server, eventEmitter) {
  const sockets = new Set();

  server.on('upgrade', (req, socket) => {
    if (req.url !== '/_dev-events') {
      socket.destroy();
      return;
    }
    wsHandshake(req, socket);
    sockets.add(socket);

    socket.on('data', (buf) => {
      const frame = parseFrame(buf);
      if (frame?.opcode === 0x8) {
        socket.write(Buffer.from([0x88, 0x00]));
        socket.destroy();
      }
    });
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => { sockets.delete(socket); socket.destroy(); });
  });

  eventEmitter.on('watch-event', (...payload) => {
    const data = JSON.stringify(payload);
    for (const socket of sockets) {
      try { wsSend(socket, data); } catch { sockets.delete(socket); }
    }
  });
}

function sendFactory(req, res) {
  const send = (code, content, mimetype = 'text/html') => {
    console.log(`[http]\t (${code}) ${req.method} ${req.url}`);
    res.writeHead(code, { 'Content-Type': mimetype, 'Cache-Control': 'no-cache' });
    res.end(content);
  }
  const sendError = (code, message) => send(code, `${code} ${message}`);
  return { send, sendError };
}

export function serve(eventEmitter = null, wwwRoot = 'dist', listenOptions) {
  return new Promise((resolve) => {
    const host = listenOptions?.host ?? process.env.HOST ?? 'localhost';
    const port = listenOptions?.port ?? parseInt(process.env.PORT ?? '8000', 10);
    const server = createServer((req, res) => {
      const url = new URL(`http://${host}${port !== 80?`:${port}`:''}${req.url}`);
      const { send, sendError } = sendFactory(req, res);
      if (url.pathname === '/_dev-events.js') {
        send(200, DEVSERVER_JS, 'text/javascript');
        return;
      }
      const dir = path.resolve(process.cwd(), wwwRoot);
      const resourcePath = path.normalize(url.pathname + (url.pathname.endsWith('/') ? 'index.html' : ''));
      if (resourcePath.split('/').includes('..')) {
        sendError(404, 'Not Found');
        return;
      }
      const filePath = path.join(dir, path.normalize(resourcePath));
      if (! filePath.startsWith(dir)) {
        sendError(404, 'Not Found');
        return;
      }
      readFile(filePath, (err, data) => {
        if (err) {
          sendError(404, 'Not Found');
          return;
        }
        const mime = getMime(resourcePath);
        if (data && mime === 'text/html') {
          send(200, data.toString().replace('</body>', '<script src="/_dev-events.js"></script></body>'), mime);
          return;
        }
        send(200, data, mime);
      });
    });
    if (eventEmitter) setupWebSockets(server, eventEmitter);
    server.listen({port, host, ...(listenOptions ?? {})}, () => {
      console.log(`[http]\tServer listening on http://${host}:${port}/`);
      resolve(server);
    });
  });
}
