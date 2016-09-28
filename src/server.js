const fs = require('file-system');
const path = require("path");
const forEach = require("lodash/forEach");

const Koa = require("koa");
const app = new Koa();
const router = require("koa-router")();
const bodyParser = require("koa-bodyparser")();

const imageGenerator = require("./imageGenerator");
// const stopLabelGenerator = require('./stopLabelGenerator');

const dataPath = path.join(__dirname, "..", "data");
const stops = require("../data/stops.json");
const routesById = require("../data/routes.json");
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

router.get("/stops/:stopId", (ctx) => {
    const stop = stops.find(stop => stop.stopId === ctx.params.stopId);
    return successResponse(ctx, stop);
});

router.get("/routeNames", (ctx) => {
    return successResponse(ctx, routeNames);
});

router.get("/routes/:stopId", (ctx) => {
    const stopRoutesById = {};

    forEach(routesById, (routes, routeId) => {
        const stopRoutes = routes
            .filter(route =>
                // Find routes that contain given stop id
                route.stops.some(({stopId}) => stopId === ctx.params.stopId)
            ).map(route => {
                // Replace stop ids with full stop info
                const stopInfos = route.stops.map(
                    ({stopId}) => stops.find(stop => stop.stopId === stopId)
                );
                return Object.assign({}, route, {stops: stopInfos});
            });

        if(stopRoutes.length) {
            stopRoutesById[routeId] = stopRoutes;
        }
    });

    return successResponse(ctx, stopRoutesById);
});

router.get("/stopGeometries/:routeId", (ctx) => {
    const features = stopGeometries.features.filter(feature =>
        feature.properties.route.startsWith(ctx.params.routeId));
    return successResponse(ctx, features);
});

router.get("/routeGeometries/:routeId", (ctx) => {
    const features = routeGeometries.features.filter(feature =>
        feature.properties.shape_id.startsWith(ctx.params.routeId));
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
