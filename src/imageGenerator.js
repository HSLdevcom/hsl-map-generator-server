const tilelive = require('@mapbox/tilelive');
const tileliveGl = require('./tileliveMapbox');
const PNGEncoder = require('png-stream').Encoder;
const viewportMercator = require('viewport-mercator-project');
const proj4 = require('proj4');
const pEvery = require('p-every');

const MAX_TILE_SIZE = 2000;
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
};

/**
 * Returns TileLive source and options
 * @param {Object} options - Options passed to tilelive-gl
 * @param {Object} style - GL map style (optional)
 * @return {Promise} - TileLive source and options
 */
function createSource(options, style = null) {
  const glSource = {
    protocol: 'gl:',
    style,
    query: { scale: options.scale || defaultOptions.scale },
  };

  const glOptions = Object.assign({}, defaultOptions, options);

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

async function generateTile(glInstance, options, isCanceled) {
  const opts = Object.assign({}, options, { format: 'raw' });
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
  const {
    width, height, viewport, viewportWidth, viewportHeight,
  } = tileInfo;

  const topLeft = viewport.unproject([0, 0]);
  const bottomRight = viewport.unproject([viewportWidth, viewportHeight]);

  const [left, top] = proj4('EPSG:4326', 'EPSG:3857', topLeft);
  const [right, bottom] = proj4('EPSG:4326', 'EPSG:3857', bottomRight);

  const widthOfPixel = (right - left) / width;
  const heightOfPixel = (bottom - top) / height;

  const centerOfLeftPixel = left + (widthOfPixel / 2);
  const centerOfTopPixel = top - (heightOfPixel / 2);

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
  const viewport = viewportMercator({
    longitude: options.center[0],
    latitude: options.center[1],
    zoom: options.zoom,
    width: viewportWidth,
    height: viewportHeight,
  });

  const tiles = [];
  for (let y = 0; y < tileCountY; y += 1) {
    for (let x = 0; x < tileCountX; x += 1) {
      const center = [
        (x * widthOption) + (widthOption / 2),
        (y * heightOption) + (heightOption / 2),
      ];
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
    viewportWidth,
    viewportHeight,
    tiles,
    tileCountX,
    tileCountY,
    tileWidth,
    tileHeight,
  };
}

function createBuffer(tileInfo) {
  const bufferLength = tileInfo.width * tileInfo.height * CHANNELS;
  return Buffer.allocUnsafe(bufferLength);
}

function createOutStream(tileInfo) {
  const { width, height } = tileInfo;
  return new PNGEncoder(width, height, { colorSpace: 'rgba' });
}

async function createTile(buffer, glInstance, mapOptions, tileInfo, tileParams, isCanceled) {
  const tileOptions = Object.assign({}, mapOptions, tileParams.options);

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
    ((tileInfo.width * (tileParams.y * tile.height)) + (tileParams.x * tile.width)) * CHANNELS;

  while (tileOffset < tileLength) {
    tile.data.copy(buffer, bufferOffset, tileOffset, tileOffset + (tile.width * CHANNELS));
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
  const outStream = createOutStream(tileInfo);

  let glInstance;

  try {
    glInstance = await initGl(source);
  } catch (err) {
    console.error('Failed initializing the Mapbox GL instance.');
    throw err;
  }

  const buffer = createBuffer(tileInfo);
  const tilePromises = [];

  if (isCanceled()) {
    return false;
  }

  for (const tileConfig of tileInfo.tiles) {
    const tilePromise = createTile(buffer, glInstance, options, tileInfo, tileConfig, isCanceled);
    tilePromises.push(tilePromise);
  }

  let tilesSucceeded = false;

  try {
    // Wait for all tiles to be written to the buffer. Make sure all createTile calls returned true.
    tilesSucceeded = await pEvery(tilePromises, success => success === true);
  } catch (err) {
    console.log(err);
    return false;
  }

  if (!tilesSucceeded || isCanceled()) {
    return false;
  }

  console.log('Tiles finished.');

  // Write the buffer to the PNG stream
  outStream.write(buffer);

  // One last cancelled check...
  if (isCanceled()) {
    outStream.destroy(new Error('Cancelled.'));
    return false;
  }

  // And we're done!
  outStream.end();

  // eslint-disable-next-line consistent-return
  return { outStream, worldFile };
}

module.exports = {
  generate,
};
