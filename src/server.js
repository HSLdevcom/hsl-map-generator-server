const Koa = require('koa');
const Router = require('@koa/router');
const bodyParser = require('koa-bodyparser');
const cors = require('@koa/cors');
const get = require('lodash/get');
const PCancelable = require('p-cancelable');
const stringHash = require('string-hash');

const app = new Koa();
const router = new Router();

const imageGenerator = require('./imageGenerator');

const PORT = 8000;
const RENDER_TIMEOUT = 60 * 1000;

// Record all render processes in this map.
const processes = new Map();
// Key is the hash of the string representation of options and style.
// If they'll be the same, it's safe to use the same rendering process.
// Earlier this was just the stringified options, but there were problems
// if the area was the same but the styles were different.
function createRenderKey(options, style) {
  return stringHash(JSON.stringify(options) + JSON.stringify(style));
}

function createRenderProcess(options, style) {
  // Create a cancelable promise.
  const process = new PCancelable((resolve, reject, onCancel) => {
    let canceled = false;

    // The cancellation works with a simple flag. The render process will check the status during
    // every iteration of it's loop using the isCanceled callback argument.
    onCancel(() => {
      canceled = true;
    });

    // Kick off the render process and integrate the promise into the cancelable promise.
    imageGenerator.generate(options, style, () => canceled).then(resolve, reject);
  });

  return process;
}

function getRenderProcess(options, style) {
  // Create a key with which we can find an ongoing render process.
  const key = createRenderKey(options, style);
  let process = processes.get(key);

  if (!process) {
    // Create a new process if none was found. This should happen in the vast majority of cases.
    process = { promise: createRenderProcess(options, style), clients: 1 };
    // Remember this process under this key.
    processes.set(key, process);
  } else {
    // Bump the client count on the existing process and update the record.
    process.clients += 1;
    processes.set(key, process);
  }

  return process.promise;
}

function removeRenderProcess(options, style) {
  // The key identifies the render process.
  const key = createRenderKey(options, style);
  const process = processes.get(key);

  if (process) {
    // Decrease the client count
    process.clients -= 1;

    // If this was the last client, just delete the process.
    if (process.clients <= 0) {
      processes.delete(key);
    } else {
      // Else, update the process record.
      processes.set(key, process);
    }
  }
}

router.post('/generateImage', async (ctx) => {
  // 5 minutes timeout
  ctx.request.socket.setTimeout(5 * RENDER_TIMEOUT);
  let requestClosed = false;

  const { options, style } = ctx.request.body;
  // Creates a new render process or finds one that is already started on this server.
  const processPromise = getRenderProcess(options, style);

  // If the client disconnects, cancel the process.
  ctx.req.on('close', () => {
    requestClosed = true;

    /*const key = createRenderKey(options);
    const process = processes.get(key);

    if (get(process, 'clients', 1) === 1) {
      console.log('Only client, cancelling.');
      process.promise.cancel();
    }*/
  });

  // eslint-disable-next-line no-console
  console.log('Map render started.');

  let processResult;

  try {
    // Await the promise to get the result
    processResult = await processPromise;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log('Map render failed,', err.message);
    processResult = false;
  }

  // If the result is false, the render process failed or was cancelled.
  if (!processResult || requestClosed) {
    // Make sure to delete the process from the map.
    removeRenderProcess(options, style);

    // If the request was cancelled, it doesn't really matter what we respond with.
    // Just make it something sensible in case it failed for other reasons.
    ctx.status = 500;
    ctx.body = 'Failed or canceled.';
    return false;
  }

  const stream = get(processResult, 'outStream', null);
  const world = get(processResult, 'worldFile', null);

  // Promisify the stream state
  return new Promise((resolve, reject) => {
    stream
      .then((res) => {
        // Clean up the process from the map, we don't need these hanging around.
        removeRenderProcess(options, style);

        if (!requestClosed) {
          ctx.response.set('Access-Control-Expose-Headers', 'World-File');
          ctx.response.set('World-File', world);
          ctx.status = 200;
          ctx.type = 'image/png';
          ctx.body = res; // Send the PNG stream to the client.

          // eslint-disable-next-line no-console
          console.log('Done.');
        } else {
          // eslint-disable-next-line no-console
          console.log('Render finished but request was closed.');
        }

        resolve(); // Resolve to tell Koa that you're done.
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.log('Could not send the request:', err);
        reject();
      });
  });
});

router.get('/health', async (ctx) => {
  ctx.status = 200;
});

app
  .use(cors({ origin: '*' }))
  .use(bodyParser({ jsonLimit: '50mb' }))
  .use(router.routes())
  .use(router.allowedMethods())
  .listen(PORT, () => console.log(`Listening at port ${PORT}`)); // eslint-disable-line no-console
