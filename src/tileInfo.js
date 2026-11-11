const { WebMercatorViewport } = require('@math.gl/web-mercator');
const proj4 = require('proj4');

// Pure layout and georeferencing helpers. Kept free of native modules so they can be unit tested
// without loading maplibre-gl-native.

const MAX_TILE_SIZE = 5000;
const CHANNELS = 4;

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

module.exports = {
  MAX_TILE_SIZE,
  CHANNELS,
  defaultOptions,
  createSource,
  createTileInfo,
  createWorldFile,
};
