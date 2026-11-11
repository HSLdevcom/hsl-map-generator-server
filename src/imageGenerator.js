const tilelive = require('@mapbox/tilelive');
const sharp = require('sharp');
const pEvery = require('p-every');
const tileliveGl = require('./tileliveMapbox');
const { CHANNELS, createSource, createTileInfo, createWorldFile } = require('./tileInfo');

tileliveGl.registerProtocols(tilelive);

function initGl(source) {
  return new Promise((resolve, reject) => {
    tilelive.load(source, (err, instance) => {
      if (err) {
        reject(err);
      } else {
        resolve(instance);
      }
    });
  });
}

// Generates the tile and returns the image buffer (along with info) on completion,
// or false if there was an issue like process cancellation,
async function generateTile(glInstance, options, isCanceled) {
  const opts = { ...options, format: 'raw' };
  let generated;

  try {
    generated = await glInstance.getStatic.call(glInstance, opts, isCanceled);
  } catch (err) {
    return false;
  }

  if (generated) {
    return {
      ...generated.info,
      data: generated.data,
    };
  }

  return false;
}

// Creates a buffer with space for the pixels of the requested image size.
function createBuffer(tileInfo) {
  const bufferLength = tileInfo.width * tileInfo.height * CHANNELS;
  return Buffer.allocUnsafe(bufferLength);
}

// Generate the map tile and write it to the buffer.
// Return true when the tile was written to the buffer successfully, false if cancelled.
async function createTile(buffer, glInstance, mapOptions, tileInfo, tileParams, isCanceled) {
  const tileOptions = { ...mapOptions, ...tileParams.options };

  if (isCanceled()) {
    return false;
  }

  const tile = await generateTile(glInstance, tileOptions, isCanceled);

  if (!tile) {
    return false;
  }

  const tileLength = tile.width * tile.height * CHANNELS;
  let tileOffset = 0;
  let bufferOffset =
    (tileInfo.width * (tileParams.y * tile.height) + tileParams.x * tile.width) * CHANNELS;

  while (tileOffset < tileLength) {
    tile.data.copy(buffer, bufferOffset, tileOffset, tileOffset + tile.width * CHANNELS);
    bufferOffset += tileInfo.width * CHANNELS;
    tileOffset += tile.width * CHANNELS;
  }

  return true;
}

/**
 * Renders a map image
 * @param {Object} opts - Options passed to tilelive-gl
 * @param {Object} style - GL map style (optional)
 * @return {Object} - PNG map image stream
 */
async function generate(opts, style, isCanceled) {
  const { source, options } = createSource(opts, style);

  const tileInfo = createTileInfo(options);
  const worldFile = createWorldFile(tileInfo);

  let glInstance;

  try {
    glInstance = await initGl(source);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed initializing the Mapbox GL instance.');
    throw err;
  }

  // The promises collected here will resolve as the tiles
  // are written to the image buffer. The resolved value
  // of the promises indicates if the tile was
  // successfully written to the buffer.
  const tilePromises = [];

  let tilesSucceeded = false;
  let buffer;

  try {
    if (isCanceled()) {
      return false;
    }

    buffer = createBuffer(tileInfo);

    // createTile returns true if the tile was successfully rendered.
    // All promises need to be true for the image to be written, if some
    // are false it means that the process was cancelled.
    for (const tileConfig of tileInfo.tiles) {
      const tilePromise = createTile(buffer, glInstance, options, tileInfo, tileConfig, isCanceled);
      tilePromises.push(tilePromise);
    }

    try {
      // Wait for all tiles to be written to the buffer. Make sure all createTile calls returned true.
      tilesSucceeded = await pEvery(tilePromises, (success) => success === true);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(err);
    }

    // tilesSucceeded is false if some createTile calls returned false.
    // This indicates either that the process was cancelled or some other
    // error occured when generating the tile.
    if (!tilesSucceeded || isCanceled()) {
      return false;
    }
  } finally {
    // Drain the mapbox-gl pool so that we don't leave zombie pools hanging around,
    // even if something above threw (e.g. buffer allocation failing for large images).
    await glInstance.clearPool();
  }

  // eslint-disable-next-line no-console
  console.log('Tiles finished.');

  // Write the buffer to the PNG stream

  const outStream = sharp(buffer, {
    raw: { width: tileInfo.width, height: tileInfo.height, channels: 4 },
    limitInputPixels: false,
  })
    .png()
    .toBuffer();

  // One last cancelled check...
  if (isCanceled()) {
    outStream.destroy(new Error('Cancelled.'));
    return false;
  }

  return { outStream, worldFile };
}

module.exports = {
  generate,
};
