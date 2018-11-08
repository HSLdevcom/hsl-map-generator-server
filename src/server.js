const Koa = require('koa');
const router = require('koa-router')();
const bodyParser = require('koa-bodyparser')({ jsonLimit: '50mb' });
const cors = require('@koa/cors')();

const app = new Koa();

const imageGenerator = require('./imageGenerator');

const PORT = 8000;

router.post('/generateImage', (ctx) => {
  ctx.request.socket.setTimeout(10 * 60 * 1000);

  const { options, style } = ctx.request.body;
  const { outStream, worldFile } = imageGenerator.generate(options, style);

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
