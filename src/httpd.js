import { createHash } from 'node:crypto';
import { readFile } from 'node:fs';
import { createServer } from 'node:http';
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


function wsHandshake(req, socket) {
  // The magic hardcoded GUID is defined in the WebSocket RFC (RFC 6455)
  // and necessary for the handshake
  const WS_MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
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

/**
 * Start the HTTP dev server with optional live-reload via WebSocket.
 *
 * @param {import('node:events').EventEmitter} [eventEmitter] - Emitter that broadcasts watch events to connected browsers.
 * @param {string} [wwwRoot='dist'] - Directory to serve static files from.
 * @param {object} [listenOptions] - Options passed to `server.listen()`, plus the extras below.
 * @param {number} [listenOptions.port=8000] - Port to listen on. Defaults to the PORT env var or 8000.
 * @param {string} [listenOptions.host='localhost'] - Host to bind to. Defaults to the HOST env var or 'localhost'.
 * @param {AbortSignal} [listenOptions.signal] - When aborted, closes the server and all open connections.
 * @returns {Promise<import('node:http').Server>} Resolves with the server instance once it is listening.
 */
export function serve(eventEmitter = null, wwwRoot = 'dist', listenOptions) {
  return new Promise((resolve) => {
    const { signal, ...restListenOptions } = listenOptions ?? {};
    const host = restListenOptions?.host ?? process.env.HOST ?? 'localhost';
    const port = restListenOptions?.port ?? parseInt(process.env.PORT ?? '8000', 10);
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
    if (signal) {
      signal.addEventListener('abort', () => {
        server.closeAllConnections();
        server.close();
      }, { once: true });
    }
    server.listen({port, host, ...restListenOptions}, () => {
      console.log(`[http]\tServer listening on http://${host}:${port}/`);
      resolve(server);
    });
  });
}
