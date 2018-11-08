const Koa = require('koa');
const router = require('koa-router')();
const bodyParser = require('koa-bodyparser')({ jsonLimit: '50mb' });
const cors = require('@koa/cors')();
const pCancelable = require('p-cancelable');

const app = new Koa();

const imageGenerator = require('./imageGenerator');

const PORT = 8000;

const processes = new Map();

function createRenderKey(options) {
  return JSON.stringify(options);
}

function createResponse(outStream, worldFile, ctx) {
  ctx.response.set('Access-Control-Expose-Headers', 'World-File');
  ctx.response.set('World-File', worldFile);
  ctx.status = 200;
  ctx.type = 'image/png';
  ctx.body = outStream;
}

function createGeneratePromise(options, style) {
  return pCancelable((resolve, reject, onCancel) => {
    const { outStream, worldFile } = imageGenerator.generate(options, style);

    onCancel(() => {
      const key = createRenderKey(options);
      outStream.destroy();
      processes.delete(key);
    });

    outStream.on('finish', () => resolve({ outStream, worldFile }));
    outStream.on('error', () => {
      outStream.destroy();
      reject('Error generating the map.');
    });
  });
}

router.post('/generateImage', (ctx) => {
  const { options, style } = ctx.request.body;
  const renderKey = createRenderKey(options);

  let renderInProgress = processes.get(renderKey);

  if (renderInProgress) {
    renderInProgress.then(({ outStream, worldFile }) => {
      createResponse(outStream, worldFile, ctx);
    });
  } else {
    renderInProgress = createGeneratePromise(options, style);
  }


  createResponse(outStream, worldFile, ctx);
});

app
  .use(cors)
  .use(bodyParser)
  .use(router.routes())
  .use(router.allowedMethods())
  .listen(PORT, () => console.log(`Listening at port ${PORT}`)); // eslint-disable-line no-console
