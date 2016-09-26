const Koa = require("koa");
const app = new Koa();
const router = require("koa-router")();
const bodyParser = require("koa-bodyparser")();
const fs = require('file-system');
const path = require("path");
const imageGenerator = require("./imageGenerator");
// const stopLabelGenerator = require('./stopLabelGenerator');

const dataPath = path.join(__dirname, "..", "data");

const routes = require("../data/routes.json");
const routesWithStops
const routeGeometries = JSON.parse(fs.readFileSync(`${dataPath}/shapes.geojson`, "utf8"));
const stopGeometries = JSON.parse(fs.readFileSync(`${dataPath}/stops.geojson`, "utf8"));

const PORT = 8000;

function successResponse(ctx, body) {
    ctx.response.set("Access-Control-Allow-Origin", "*");
    ctx.status = 200;
    ctx.body = body;
};

router.post("/generateImage", ctx =>
    new Promise(resolve =>
    imageGenerator(
        (data) => {
            ctx.status = 200;
            ctx.type = "image/png";
            ctx.body = data;
            resolve();
        },
        ctx.request.body
    )
  )
);

router.get("/routes", (ctx) => {
    return successResponse(ctx, routes);
});

router.get("/routeGeometries/:routeId", (ctx) => {
    const features = routeGeometries.features.filter(feature =>
        feature.properties.shape_id.startsWith(ctx.params.routeId));
    return successResponse(ctx, features);
});

router.get("/stopGeometries/:routeId", (ctx) => {
    const features = stopGeometries.features.filter(feature =>
        feature.properties.route.startsWith(ctx.params.routeId));
    return successResponse(ctx, features);
});

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
    .listen(PORT, (err) => {
        if (err) {
            console.log(err);
        }
        console.log(`Listening at port ${PORT}`);
    });
