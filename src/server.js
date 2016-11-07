const fs = require("fs");
const path = require("path");
const forEach = require("lodash/forEach");

const Koa = require("koa");
const app = new Koa();
const router = require("koa-router")();
const bodyParser = require("koa-bodyparser")();
const cors = require("koa-cors")();

const imageGenerator = require("./imageGenerator");
// const stopLabelGenerator = require('./stopLabelGenerator');

const dataPath = path.join(__dirname, "..", "data");
const stops = require(`${dataPath}/stops.json`);
const terminals = require(`${dataPath}/terminals.json`);
const stopAreas = require(`${dataPath}/stopAreas.json`);
const lines = require(`${dataPath}/lines.json`);
const routesById = require(`${dataPath}/routes.json`);
const timingStops = require(`${dataPath}/timingStops.json`);
const routeGeometries = JSON.parse(fs.readFileSync(`${dataPath}/routeGeometries.geojson`, "utf8"));

const PORT = 8000;

function successResponse(ctx, body, type = "application/json") {
    ctx.status = 200;
    ctx.type = type;
    ctx.body = body;
};

function errorResponse(ctx, error) {
    ctx.status = error.status || 500;
    ctx.body = {error: error.message};
    // TODO: Properly handle and log errors
    console.log(error);
    console.log(error.stack);
}

function getTimingStops(route) {
    const routeTimingStops = [];
    forEach(timingStops, (timingStop) => {
        if (route === `${timingStop.id}_${timingStop.direction}`) {
            routeTimingStops.push(timingStop.stopId);
        }
    });
    return routeTimingStops;
}

function addStopInfos(routes, routeId) {
    return routes.map(route => {
        const routeTimingStops = getTimingStops(`${routeId}_${route.direction}`);
        // Replace stop ids with full stop info
        const stopInfos = route.stops.map(({stopId, duration}) =>
            ({...stops.find(stop => {
                if (routeTimingStops.length && routeTimingStops.find((timingStop) => timingStop === stop.stopId)) stop.isTiming = true;
                return stop.stopId === stopId;
            }), duration}));

        return {...route, stops: stopInfos};
    });
}

router.post("/generateImage", ctx => {
    return imageGenerator.generate(ctx.request.body)
        .then(data => successResponse(ctx, data, "image/png"))
        .catch(error => errorResponse(ctx, error));
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

router.get("/routesByLine/:lineId", (ctx) => {
    const lineId = ctx.params.lineId;
    const lineRoutesById = {};

    forEach(routesById, (routes, routeId) => {
        if(routeId === lineId || routeId.slice(0, -1) === lineId) {
            lineRoutesById[routeId] = addStopInfos(routes, routeId);
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
    .listen(PORT, (err) => {
        if (err) {
            console.log(err);
        }
        console.log(`Listening at port ${PORT}`);
    });
