const path = require("path");
const Koa = require("koa");
const app = new Koa();
const serve = require("koa-static");
const router = require("koa-router")();
const bodyParser = require("koa-bodyparser")();
const cors = require("koa-cors")();

const imageGenerator = require("./imageGenerator");

const dataPath = path.join(__dirname, "..", "data");
const publicPath = path.join(__dirname, "..", "public");

const PORT = 8000;

router.post("/generateImage", ctx => {
    const { options, style } = ctx.request.body;
    const { outStream, worldFile } = imageGenerator.generate(options, style);
    ctx.response.set("Access-Control-Expose-Headers", "World-File");
    ctx.response.set("World-File", worldFile);
    ctx.status = 200;
    ctx.type = "image/png";
    ctx.body = outStream;
});

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
