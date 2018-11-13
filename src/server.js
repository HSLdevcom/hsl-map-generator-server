const Koa = require('koa');
const router = require('koa-router')();
const bodyParser = require('koa-bodyparser')({ jsonLimit: '50mb' });
const cors = require('@koa/cors')();
const get = require('lodash/get');
const PCancelable = require('p-cancelable');

const app = new Koa();

const imageGenerator = require('./imageGenerator');

const PORT = 8000;
const RENDER_TIMEOUT = 60 * 1000;

const processes = new Map();

function createRenderKey(options) {
  return JSON.stringify(options);
}

function createRenderProcess(options, style) {
  const process = new PCancelable((resolve, reject, onCancel) => {
    let canceled = false;

    onCancel(() => {
      canceled = true;
    });

    imageGenerator.generate(options, style, () => canceled).then(resolve, reject);
  });

  return process;
}

function getRenderProcess(options, style) {
  const key = createRenderKey(options);
  let process = processes.get(key);

  if (!process) {
    process = createRenderProcess(options, style);
    processes.set(key, process);
  } else {
    console.log('Found existing process.');
  }

  return process;
}

router.post('/generateImage', async (ctx) => {
  // 5 seconds timeout
  ctx.request.socket.setTimeout(5 * RENDER_TIMEOUT);

  const { options, style } = ctx.request.body;
  // Creates a new render process or finds one that is already started on this server.
  const processPromise = getRenderProcess(options, style);

  // If the client disconnects, cancel the process.
  // TODO: Make sure that other client's weren't using the process...
  ctx.req.on('close', () => {
    processPromise.cancel();
  });

  console.log('Map render started.');

  let processResult;
  // The render key is used for looking up a process from the process map.
  const renderKey = createRenderKey(options);

  try {
    // Await the promise to get the result
    processResult = await processPromise;
  } catch (err) {
    console.log('Map render failed,', err.message);
    processResult = false;
  }

  // If the result is false, the render process failed or was cancelled.
  if (!processResult) {
    // Make sure to delete the process from the map.
    processes.delete(renderKey);

    ctx.status = 500;
    ctx.body = 'Failed or canceled.';
    return false;
  }

  const stream = get(processResult, 'outStream', null);
  const world = get(processResult, 'worldFile', null);

  // Promisify the stream state
  return new Promise((resolve, reject) => {
    stream.on('finish', () => {
      // Clean up the process from the map, we don't need these hanging around.
      processes.delete(renderKey);

      ctx.response.set('Access-Control-Expose-Headers', 'World-File');
      ctx.response.set('World-File', world);
      ctx.status = 200;
      ctx.type = 'image/png';
      ctx.body = stream; // Send the PNG stream to the client.

      console.log('Done.');
      resolve(); // Resolve to tell Koa that you're done.
    });

    stream.on('error', reject); // Notify Koa that everything isn't OK if the stream errored.
  });
});

app
  .use(cors)
  .use(bodyParser)
  .use(router.routes())
  .use(router.allowedMethods())
  .listen(PORT, () => console.log(`Listening at port ${PORT}`)); // eslint-disable-line no-console
