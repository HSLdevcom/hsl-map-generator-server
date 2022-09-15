const tilelive = require('@mapbox/tilelive');
const sharp = require('sharp');
const { WebMercatorViewport } = require('@math.gl/web-mercator');
const proj4 = require('proj4');
const pEvery = require('p-every');
const tileliveGl = require('./tileliveMapbox');

const MAX_TILE_SIZE = 5000;
const CHANNELS = 4;

tileliveGl.registerProtocols(tilelive);

const defaultOptions = {
  center: [24.9, 60.5],
  width: 500,
  height: 500,
  zoom: 10,
  scale: 1,
  pitch: 0,
  bearing: 0,
  bufferWidth: 5,
};

/**
 * Returns TileLive source and options
 * @param {Object} options - Options passed to tilelive-gl
 * @param {Object} style - GL map style (optional)
 * @return {Promise} - TileLive source and options
 */
function createSource(options, style = null) {
  // When the generated map is small enough, repeating decimals in scale parameter create a problem when copying the data to buffer later.
  // The error occurs in the createTile function where tile.data.copy is used. A RangeError: out of range index is thrown from buffer.js.
  // The bug can be reproduced by generating a 150x150 map with generator-ui and removing the rounding below.

  const roundedScale = Math.round(options.scale * 10000) / 10000;
  const glSource = {
    protocol: 'gl:',
    style,
    query: {
      scale: roundedScale || defaultOptions.scale,
      bufferWidth: options.bufferWidth || defaultOptions.bufferWidth,
    },
  };

  const glOptions = { ...defaultOptions, ...options };

  return { source: glSource, options: glOptions };
}

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

function createWorldFile(tileInfo) {
  const { width, height, viewport } = tileInfo;

  const topLeft = viewport.unproject([0, 0]);
  const bottomRight = viewport.unproject([viewport.width, viewport.height]);

  const [left, top] = proj4('EPSG:4326', 'EPSG:3857', topLeft);
  const [right, bottom] = proj4('EPSG:4326', 'EPSG:3857', bottomRight);

  const widthOfPixel = (right - left) / width;
  const heightOfPixel = (bottom - top) / height;

  const centerOfLeftPixel = left + widthOfPixel / 2;
  const centerOfTopPixel = top - heightOfPixel / 2;

  return `${widthOfPixel}|0|0|${heightOfPixel}|${centerOfLeftPixel}|${centerOfTopPixel}|`;
}

function createTileInfo(options) {
  const maxSize = Math.round(MAX_TILE_SIZE / options.scale);
  const tileCountX = Math.ceil(options.width / maxSize);
  const tileCountY = Math.ceil(options.height / maxSize);
  // Width and height values passed to tilelive-gl
  const widthOption = Math.floor(options.width / tileCountX);
  const heightOption = Math.floor(options.height / tileCountY);
  // Actual pixel values of generated tiles
  const tileWidth = Math.floor(widthOption * options.scale);
  const tileHeight = Math.floor(heightOption * options.scale);
  // Pixel width and height of generated image
  const width = tileWidth * tileCountX;
  const height = tileHeight * tileCountY;

  const viewportWidth = widthOption * tileCountX;
  const viewportHeight = heightOption * tileCountY;
  const viewport = new WebMercatorViewport({
    longitude: options.center[0],
    latitude: options.center[1],
    zoom: options.zoom,
    width: viewportWidth,
    height: viewportHeight,
  });

  const tiles = [];
  for (let y = 0; y < tileCountY; y += 1) {
    for (let x = 0; x < tileCountX; x += 1) {
      const center = [x * widthOption + widthOption / 2, y * heightOption + heightOption / 2];
      tiles.push({
        options: {
          center: viewport.unproject(center),
          width: widthOption,
          height: heightOption,
        },
        x,
        y,
      });
    }
  }

  return {
    width,
    height,
    viewport,
    tiles,
  };
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

  const buffer = createBuffer(tileInfo);
  // The promises collected here will resolve as the tiles
  // are written to the image buffer. The resolved value
  // of the promises indicates if the tile was
  // successfully written to the buffer.
  const tilePromises = [];

  if (isCanceled()) {
    return false;
  }

  // createTile returns true if the tile was successfully rendered.
  // All promises need to be true for the image to be written, if some
  // are false it means that the process was cancelled.
  for (const tileConfig of tileInfo.tiles) {
    const tilePromise = createTile(buffer, glInstance, options, tileInfo, tileConfig, isCanceled);
    tilePromises.push(tilePromise);
  }

  let tilesSucceeded = false;

  try {
    // Wait for all tiles to be written to the buffer. Make sure all createTile calls returned true.
    tilesSucceeded = await pEvery(tilePromises, (success) => success === true);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log(err);
  }

  // Drain the mapbox-gl pool so that we don't leave zombie pools hanging around.
  await glInstance.clearPool();

  // tilesSucceeded is false if some createTile calls returned false.
  // This indicates either that the process was cancelled or some other
  // error occured when generating the tile.
  if (!tilesSucceeded || isCanceled()) {
    return false;
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
