// TEMPORARY CI DIAGNOSTIC - remove before merge.
// The inspector can interrupt a busy JS thread when signal reports cannot.
const fs = require('node:fs');
const path = require('node:path');
const inspector = require('node:inspector');
const directory = process.env.MF_DIAGNOSTIC_DIR;

if (
  directory &&
  process.argv[1]?.endsWith('/modern.js') &&
  process.argv[2] === 'dev'
) {
  fs.mkdirSync(directory, { recursive: true });
  inspector.open(0, '127.0.0.1');
  fs.writeFileSync(
    path.join(directory, `${process.pid}.inspector.json`),
    JSON.stringify({
      pid: process.pid,
      cwd: process.cwd(),
      url: inspector.url(),
    }),
  );
}

async function sample(target) {
  const socket = new WebSocket(target.url);
  const pending = new Map();
  let sequence = 0;
  let timer;
  const request = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++sequence;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  const operation = new Promise((resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error('Inspector did not respond within 15s')),
      15000,
    );
    socket.addEventListener('error', () =>
      reject(new Error('Inspector connection failed')),
    );
    socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(String(data));
      if (message.id && pending.has(message.id)) {
        const call = pending.get(message.id);
        pending.delete(message.id);
        if (message.error)
          call.reject(new Error(JSON.stringify(message.error)));
        else call.resolve(message.result);
      }
    });
    socket.addEventListener('open', async () => {
      try {
        const events = await request('Runtime.evaluate', {
          expression: 'JSON.stringify(globalThis.__mfWatcherEvents)',
          returnByValue: true,
        });
        console.log(
          `[mf-diagnostic EVENTS] ${target.cwd} ${events.result.value}`,
        );
        await request('Profiler.enable');
        await request('Profiler.start');
        await new Promise(done => setTimeout(done, 3000));
        const { profile } = await request('Profiler.stop');
        const nodes = new Map(profile.nodes.map(node => [node.id, node]));
        const parents = new Map();
        for (const node of profile.nodes) {
          for (const child of node.children ?? []) parents.set(child, node.id);
        }
        const counts = new Map();
        for (const id of profile.samples ?? [])
          counts.set(id, (counts.get(id) ?? 0) + 1);
        const lines = [...counts]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([id, count]) => {
            const stack = [];
            for (
              let current = id;
              current && stack.length < 24;
              current = parents.get(current)
            ) {
              const frame = nodes.get(current).callFrame;
              stack.push(
                `${frame.functionName || '<anonymous>'} ${frame.url}:${frame.lineNumber + 1}`,
              );
            }
            return `${count} samples\n    ${stack.join('\n    ')}`;
          });
        console.log(
          `[mf-diagnostic CPU] pid=${target.pid} cwd=${target.cwd}\n${lines.join('\n')}`,
        );
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
  try {
    await operation;
  } catch (error) {
    console.log(`[mf-diagnostic CPU] pid=${target.pid}: ${error.message}`);
  } finally {
    clearTimeout(timer);
    socket.close();
  }
}

if (require.main === module) {
  Promise.all(
    fs
      .readdirSync(directory)
      .filter(file => file.endsWith('.inspector.json'))
      .map(file =>
        sample(JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'))),
      ),
  ).catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
