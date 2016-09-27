const Koa = require("koa");
const app = new Koa();
const router = require("koa-router")();
const bodyParser = require("koa-bodyparser")();
const fs = require('file-system');
const path = require("path");
const imageGenerator = require("./imageGenerator");
// const stopLabelGenerator = require('./stopLabelGenerator');

const dataPath = path.join(__dirname, "..", "data");

const stops = require("../data/stops.json");
const routes = require("../data/routes.json");
const routeGeometries = JSON.parse(fs.readFileSync(`${dataPath}/shapes.geojson`, "utf8"));
const stopGeometries = JSON.parse(fs.readFileSync(`${dataPath}/stops.geojson`, "utf8"));

const routeNames = routes.map(({name_fi, name_se, routeId}) =>
  ({name_fi, name_se, routeId}));

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
    const matchedRoutes = [];

    routes.forEach(route => {
        const stopLists = route.stopLists
            .filter(stopList =>
                // Find stopLists that contain given stop id
                stopList.stops.some(({stopId}) => stopId === ctx.params.stopId)
            ).map(stopList => {
                // Replace stop ids with full stop info
                const stopInfos = stopList.stops.map(
                    ({stopId}) => stops.find(stop => stop.stopId === stopId)
                );
                return Object.assign({}, stopList, {stops: stopInfos});
            });

        if(stopLists.length) {
            matchedRoutes.push(Object.assign({}, route, {stopLists}));
        }
    });

    return successResponse(ctx, matchedRoutes);
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
