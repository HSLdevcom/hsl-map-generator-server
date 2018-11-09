const Koa = require('koa');
const router = require('koa-router')();
const bodyParser = require('koa-bodyparser')({ jsonLimit: '50mb' });
const cors = require('@koa/cors')();
const PCancelable = require('p-cancelable');
const PQueue = require('p-queue');
const pTimeout = require('p-timeout');
const pFinally = require('p-finally');

const app = new Koa();

const imageGenerator = require('./imageGenerator');

const PORT = 8000;
const RENDER_TIMEOUT = 10 * 60 * 1000;

const processes = new Map();

function createRenderKey(options) {
  return JSON.stringify(options);
}

function createRenderProcess(options, style) {
  const renderPromise = new PCancelable(async (resolve, reject, onCancel) => {
    let isCancelled = false;

    onCancel(() => {
      isCancelled = true;
    });

    try {
      const generated = await imageGenerator.generate(options, style, () => isCancelled);
      resolve(generated);
    } catch (err) {
      reject(err);
    }
  });

  return pTimeout(
    renderPromise,
    RENDER_TIMEOUT,
    new pTimeout.TimeoutError(`Render timed out after ${RENDER_TIMEOUT / 1000} seconds`)
  );
}

async function processImage(options, style) {
  const key = createRenderKey(options);
  let process = processes.get(key);

  if (!process) {
    process = createRenderProcess(options, style);
    processes.set(key, process);
  }

  pFinally(process, () => {
    processes.delete(key);
  });

  return process;
}

router.post('/generateImage', async (ctx) => {
  ctx.request.socket.setTimeout(RENDER_TIMEOUT);

  const { options, style } = ctx.request.body;
  const { outStream, worldFile } = await processImage(options, style);

  ctx.response.set('Access-Control-Expose-Headers', 'World-File');
  ctx.response.set('World-File', worldFile);
  ctx.status = 200;
  ctx.type = 'image/png';
  ctx.body = outStream;

  outStream.on('finish', () => console.log('Done.'));
});

app
  .use(cors)
  .use(bodyParser)
  .use(router.routes())
  .use(router.allowedMethods())
  .listen(PORT, () => console.log(`Listening at port ${PORT}`)); // eslint-disable-line no-console
