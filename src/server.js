import path from 'path';

import Koa from 'koa';
import KoaStatic from 'koa-static';
import KoaRouter from 'koa-router';
import KoaBodyParser from 'koa-bodyparser';
import KoaCors from 'koa-cors';

import generate from './imageGenerator';

const publicPath = path.join(__dirname, '..', 'public');

const PORT = 8000;

const app = new Koa();
const router = new KoaRouter();

router.post('/generateImage', (ctx) => {
  const { options, style } = ctx.request.body;
  const { outStream, worldFile } = generate(options, style);
  ctx.response.set('Access-Control-Expose-Headers', 'World-File');
  ctx.response.set('World-File', worldFile);
  ctx.status = 200;
  ctx.type = 'image/png';
  ctx.body = outStream;
});

app
  .use(new KoaCors())
  .use(new KoaBodyParser({ jsonLimit: '50mb' }))
  .use(router.routes())
  .use(router.allowedMethods())
  .use(new KoaStatic(publicPath))
  .listen(PORT, (err) => {
    if (err) {
      console.log(err);
    }
    console.log(`Listening at port ${PORT}`);
  });
