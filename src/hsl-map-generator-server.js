const Koa = require("koa");
const app = new Koa();
const router = require("koa-router")();
const bodyParser = require("koa-bodyparser")();
const fs = require('file-system');
const path = require("path");
const dataPath = path.join(__dirname, "..", "data");

const imageGenerator = require("./imageGenerator");
// const stopLabelGenerator = require('./stopLabelGenerator');
const Routes = require("../data/routes.json");
const Shapes = JSON.parse(fs.readFileSync(`${dataPath}/shapes.geojson`, "utf8"));
const Stops = JSON.parse(fs.readFileSync(`${dataPath}/stops.geojson`, "utf8"));
const PORT = 8000;


router.post("/generateImage", ctx =>
    new Promise(resolve =>
    imageGenerator(
        (data) => {
            ctx.status = 200; // eslint-disable-line no-param-reassign
            ctx.type = "image/png"; // eslint-disable-line no-param-reassign
            ctx.body = data; // eslint-disable-line no-param-reassign
            resolve();
        },
        ctx.request.body
    )
  )
);

router.get("/routes", ctx =>
    new Promise((resolve) => {
        ctx.response.set("Access-Control-Allow-Origin", "*");
        ctx.status = 200; // eslint-disable-line no-param-reassign
        ctx.body = Routes; // eslint-disable-line no-param-reassign
        resolve();
    })
);

router.get("/routeInfo/:id", ctx =>
    new Promise((resolve) => {
        ctx.response.set("Access-Control-Allow-Origin", "*");
        ctx.status = 200; // eslint-disable-line no-param-reassign
        ctx.body = Shapes.features.filter(feature => // eslint-disable-line no-param-reassign
            feature.properties.shape_id.startsWith(ctx.params.id)
        );
        resolve();
    })
);

router.get("/stopInfo/:routeId", ctx =>
    new Promise((resolve) => {
        ctx.response.set("Access-Control-Allow-Origin", "*");
        ctx.status = 200; // eslint-disable-line no-param-reassign
        ctx.body = Stops.features.filter(feature => // eslint-disable-line no-param-reassign
            feature.properties.route.startsWith(ctx.params.routeId)
        );
        resolve();
    })
);

router.get("/stops", ctx =>
    new Promise((resolve) => {
        ctx.response.set("Access-Control-Allow-Origin", "*"); // eslint-disable-line no-param-reassign
        ctx.status = 200; // eslint-disable-line no-param-reassign
        ctx.body = Stops; // eslint-disable-line no-param-reassign
        resolve();
    })
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
    .listen(PORT, (err) => {
        if (err) {
            console.log(err);
        }
        console.log(`Listening at port ${PORT}`);
    });
