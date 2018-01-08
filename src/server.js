const path = require("path");
const Koa = require("koa");
const app = new Koa();
const router = require("koa-router")();
const bodyParser = require("koa-bodyparser")({ jsonLimit: "50mb" });
const cors = require("koa-cors")();

const imageGenerator = require("./imageGenerator");

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
    .listen(PORT, (err) => {
        if (err) {
            console.log(err);
        }
        console.log(`Listening at port ${PORT}`);
    });
