const Koa = require('koa');
const router = require('koa-router')();
const bodyParser = require('koa-bodyparser')({ jsonLimit: '50mb' });
const cors = require('@koa/cors')();

const app = new Koa();

const imageGenerator = require('./imageGenerator');

const PORT = 8000;

const processes = new WeakMap();
const keys = new Map();

function createRenderKeyStr(options) {
  return JSON.stringify(options);
}

function createRenderKey(options) {
  return { key: createRenderKeyStr(options) };
}

function getRenderKey(options) {
  const search = createRenderKeyStr(options);
  return keys.get(search);
}

function getOrCreateRenderKey(options) {
  const existingKey = getRenderKey(options);

  if (!existingKey) {
    return createRenderKey(options);
  }

  return existingKey;
}

function getRenderProcess(key) {
  if (!key) {
    return false;
  }

  return processes.get(key);
}

function createGeneratePromise(options, style) {
  const generatePromise = new Promise((resolve, reject) => {
    console.log(options);
    const { outStream, worldFile } = imageGenerator.generate(options, style);

    outStream.on('finish', () => resolve({ outStream, worldFile }));
    outStream.on('error', (err) => {
      reject(err);
    });
  });

  return generatePromise;
}

router.post('/generateImage', ctx => new Promise((resolve, reject) => {
  ctx.request.socket.setTimeout(60 * 60 * 1000);

  const { options, style } = ctx.request.body;
  const renderKey = getOrCreateRenderKey(options);

  let renderInProgress = getRenderProcess(renderKey);

  if (!renderInProgress) {
    renderInProgress = createGeneratePromise(options, style);
    keys.set(renderKey.key, renderKey);
    processes.set(renderKey, renderInProgress);
  }

  renderInProgress.then(({ outStream, worldFile }) => {
    keys.delete(renderKey.key);

    ctx.response.set('Access-Control-Expose-Headers', 'World-File');
    ctx.response.set('World-File', worldFile);
    ctx.status = 200;
    ctx.type = 'image/png';
    ctx.body = outStream;

    console.log('Done.');

    resolve();
  }).catch((err) => {
    keys.delete(renderKey.key);
    reject(err);
  });

  ctx.req.on('close', () => {
    keys.delete(renderKey.key);
    reject(new Error('Request closed.'));
  });
}));

app
  .use(cors)
  .use(bodyParser)
  .use(router.routes())
  .use(router.allowedMethods())
  .listen(PORT, () => console.log(`Listening at port ${PORT}`)); // eslint-disable-line no-console
