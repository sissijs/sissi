import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import EventEmitter from 'node:events';
import { serve } from '../src/httpd.js';



describe('httpd tests', () => {

  let counter = 0;

  function getListenOptions() {
    const port = 11551 + counter++; // rolled a dice.
    const host = 'localhost';
    const killSwitch = new AbortController();
    return [killSwitch, {host, port, signal: killSwitch.signal}]
  }

  test('websocket live-reload events', async () => {
    const emitter = new EventEmitter();
    const [killSwitch, options] = getListenOptions();
    await serve(emitter, 'tests/fixtures/httpd', options);

    const received = await new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://${options.host}:${options.port}/_dev-events`);
      ws.addEventListener('open', () => {
        emitter.emit('watch-event', { filename: 'style.css', page: { url: 'http://localhost/' } });
      });
      ws.addEventListener('message', (e) => { ws.close(); resolve(JSON.parse(e.data)); });
      ws.addEventListener('error', reject);
    });

    killSwitch.abort();

    assert.equal(received[0].filename, 'style.css');
  });

  test('basic functionality', async () => {
    const [killSwitch, options] = getListenOptions();
    await serve(null, 'tests/fixtures/httpd', options);

    const requestTests = [
      { 
        url: '/',
        expected: [200, 'text/html', '<h1>It works!</h1>\n'],
      },
      {
        url: '/favicon.svg',
        expected: [200, 'image/svg+xml', '<svg></svg>\n'],
      },
      {
        url: '/../../../../etc/passwd',
        expected: [404, 'text/html', '404 Not Found'],
      }, 
      {
        url: '/_dev-events.js',
        expected: [200, 'text/javascript'],
      },
      {
        url: '/_dev-events',
        expected: [404, 'text/html', '404 Not Found'],
      }
    ];

    for (const reqTest of requestTests) {
      const response = await fetch(`http://${options.host}:${options.port}${reqTest.url}`);
      const text = await response.text();
      reqTest.actual = [response.status, response.headers.get('content-type'), text];
    }
    
    killSwitch.abort();

    for (const reqTest of requestTests) {
      const [actualCode, actualType, actualBody] = reqTest.actual;
      const [expectedCode, expectedType, expectedBody] = reqTest.expected;

      assert.equal(actualCode, expectedCode, new Error(`request ${reqTest.url} should return ${expectedCode}, is ${actualCode}`));
      assert.equal(actualType, expectedType);
      if (expectedBody) {
        assert.equal(actualBody, expectedBody);
      }
    }
  });
});
