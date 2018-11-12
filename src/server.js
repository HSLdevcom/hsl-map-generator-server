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

function processImage(options, style) {
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
  ctx.request.socket.setTimeout(5 * RENDER_TIMEOUT);

  const { options, style } = ctx.request.body;
  const processPromise = processImage(options, style);

  ctx.req.on('close', () => {
    processPromise.cancel();
  });

  console.log('Map render started.');

  let processResult;
  const renderKey = createRenderKey(options);

  try {
    processResult = await processPromise;
  } catch (err) {
    console.log('Map render failed,', err.message);
    processResult = false;
  }

  if (!processResult) {
    processes.delete(renderKey);

    ctx.status = 500;
    ctx.body = 'Failed or canceled.';
    return false;
  }

  const stream = get(processResult, 'outStream', null);
  const world = get(processResult, 'worldFile', null);

  return new Promise((resolve, reject) => {
    stream.on('finish', () => {
      processes.delete(renderKey);

      ctx.response.set('Access-Control-Expose-Headers', 'World-File');
      ctx.response.set('World-File', world);
      ctx.status = 200;
      ctx.type = 'image/png';
      ctx.body = stream;

      console.log('Done.');
      resolve();
    });

    stream.on('error', reject);
  });
});

app
  .use(cors)
  .use(bodyParser)
  .use(router.routes())
  .use(router.allowedMethods())
  .listen(PORT, () => console.log(`Listening at port ${PORT}`)); // eslint-disable-line no-console
