const fs = require("fs");
const path = require("path");
const forEach = require("lodash/forEach");

const Koa = require("koa");
const app = new Koa();
const serve = require("koa-static");
const router = require("koa-router")();
const bodyParser = require("koa-bodyparser")();
const cors = require("koa-cors")();

const imageGenerator = require("./imageGenerator");
// const stopLabelGenerator = require('./stopLabelGenerator');

const dataPath = path.join(__dirname, "..", "data");
const publicPath = path.join(__dirname, "..", "public");

const stops = require(`${dataPath}/stops.json`);
const terminals = require(`${dataPath}/terminals.json`);
const stopAreas = require(`${dataPath}/stopAreas.json`);
const lines = require(`${dataPath}/lines.json`);
const routesById = require(`${dataPath}/routes.json`);
const routeGeometries = JSON.parse(fs.readFileSync(`${dataPath}/routeGeometries.geojson`, "utf8"));

const PORT = 8000;

function successResponse(ctx, body, type = "application/json") {
    ctx.status = 200;
    ctx.type = type;
    ctx.body = body;
}

function errorResponse(ctx, error) {
    ctx.status = error.status || 500;
    ctx.body = { error: error.message };
    // TODO: Properly handle and log errors
    console.log(error);
    console.log(error.stack);
}

function addStopInfos(routes) {
    return routes.map(route => {
        // Replace stop ids with full stop info
        const stopInfos = route.stops.map(({ stopId, duration, timingStopType }) =>
            ({ ...stops.find(stop => stop.stopId === stopId), duration, timingStopType }));
        return { ...route, stops: stopInfos };
    });
}

router.post("/generateImage", ctx => {
    const { options, style } = ctx.request.body;
    const { outStream, worldFile } = imageGenerator.generate(options, style);
    ctx.response.set("Access-Control-Expose-Headers", "World-File");
    ctx.response.set("World-File", worldFile);
    successResponse(ctx, outStream, "image/png");
});

router.get("/stopIds", (ctx) => {
    const stopIds = stops.map(({ stopId }) => stopId);
    return successResponse(ctx, stopIds);
});

router.get("/stops/:stopId?", (ctx) => {
    if(ctx.params.stopId) {
        const stop = stops.find(stop => stop.stopId === ctx.params.stopId);
        successResponse(ctx, stop);
    } else {
        successResponse(ctx, stops);
    }
});

router.get("/terminals", (ctx) => {
    return successResponse(ctx, terminals);
});

router.get("/stopAreas", (ctx) => {
    return successResponse(ctx, stopAreas);
});

router.get("/timetables/:stopId", (ctx) => {
    return new Promise((resolve) => {
        const sanitizedId = ctx.params.stopId.replace(/\D/g, "");
        fs.readFile(`${dataPath}/timetables/${sanitizedId}.json`, "utf8", (error, data) => {
            if (error) {
                errorResponse(ctx, error);
            } else {
                successResponse(ctx, data);
            }
            resolve();
        });
    });
});

router.get("/lines", (ctx) => {
    return successResponse(ctx, lines);
});

router.get("/routesById/:routeId", (ctx) => {
    const routeId = ctx.params.routeId;
    const route = routesById[routeId];

    if (route) {
        const routes = addStopInfos(route);
        return successResponse(ctx, routes);
    }
    return errorResponse(ctx, new Error(`Route ${routeId} not found`));
});

router.get("/routesByLine/:lineId", (ctx) => {
    const lineId = ctx.params.lineId;
    const lineRoutesById = {};

    forEach(routesById, (routes, routeId) => {
        if (routeId === lineId || routeId.slice(0, -1) === lineId) {
            lineRoutesById[routeId] = addStopInfos(routes);
        }
    });
    return successResponse(ctx, lineRoutesById);
});

router.get("/routesByStop/:stopId", (ctx) => {
    const stopRoutesById = {};

    forEach(routesById, (routes, routeId) => {
        // Find routes that contain given stop id
        const stopRoutes = routes.filter(({stops}) =>
            stops.some(({stopId}) => stopId === ctx.params.stopId))

        if(stopRoutes.length) {
            stopRoutesById[routeId] = addStopInfos(stopRoutes);
        }
    });

    return successResponse(ctx, stopRoutesById);
});

router.get("/routeGeometries/:routeId", (ctx) => {
    const features = routeGeometries.features.filter(feature =>
        feature.properties.lineId.startsWith(ctx.params.routeId));
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
    .use(cors)
    .use(bodyParser)
    .use(router.routes())
    .use(router.allowedMethods())
    .use(serve(publicPath))
    .listen(PORT, (err) => {
        if (err) {
            console.log(err);
        }
        console.log(`Listening at port ${PORT}`);
    });
