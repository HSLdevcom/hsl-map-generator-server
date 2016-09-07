const Koa = require('koa');
const app = new Koa();
const router = require('koa-router')();
const bodyParser = require('koa-bodyparser')();
const imageGenerator = require('./imageGenerator');
// const stopLabelGenerator = require('./stopLabelGenerator');

router.post('/generateImage', ctx =>
  new Promise((resolve) =>
    imageGenerator(
      ({ data }) => {
        ctx.status = 200; // eslint-disable-line no-param-reassign
        ctx.type = 'image/png'; // eslint-disable-line no-param-reassign
        ctx.body = data; // eslint-disable-line no-param-reassign
        resolve();
      },
      ctx.request.body
    )
  )
);

// router.post('/generateStopLabels', ctx =>
//   new Promise((resolve) =>
//     stopLabelGenerator(
//       ({ data }) => {
//         ctx.status = 200; // eslint-disable-line no-param-reassign
//         ctx.type = 'application/html'; // eslint-disable-line no-param-reassign
//         ctx.body = data; // eslint-disable-line no-param-reassign
//         resolve();
//       },
//       ctx.request.body
//     )
//   )
// );

app
  .use(bodyParser)
  .use(router.routes())
  .use(router.allowedMethods())
  .listen(4000);
