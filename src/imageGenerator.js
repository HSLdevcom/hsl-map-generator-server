import { Encoder } from 'png-stream';
import viewportMercator from 'viewport-mercator-project';
import proj4 from 'proj4';
import { promisify } from 'util';

import mbgl from '@mapbox/mapbox-gl-native';

import mbglRequest from './mbglRequest';

const MAX_TILE_SIZE = 2048;
const CHANNELS = 4;

function createWorldFile({
  width, height, viewport, viewportWidth, viewportHeight,
}) {
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
        offset: x,
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
  const bufferLength = tileInfo.width * tileInfo.tileHeight * CHANNELS;
  return Buffer.alloc(bufferLength);
}

function createOutStream(tileInfo) {
  const width = tileInfo.tileWidth * tileInfo.tileCountX;
  const height = tileInfo.tileHeight * tileInfo.tileCountY;
  return new Encoder(width, height, { colorSpace: 'rgba' });
}

async function addTile(buffer, map, mapOptions, tileInfo, tileIndex) {
  const tileParams = tileInfo.tiles[tileIndex];
  const tileOptions = Object.assign({}, mapOptions, tileParams.options);
  const data = await map.renderAsync(tileOptions);

  const bytesPerRow = tileInfo.tileWidth * CHANNELS;
  const bytesPerBufferRow = tileInfo.width * CHANNELS;
  const tileBytes = tileInfo.tileHeight * bytesPerRow;

  let position = 0;
  let bufferPosition = tileParams.offset * bytesPerRow;

  while (position < tileBytes) {
    data.copy(buffer, bufferPosition, position, position + bytesPerRow);
    bufferPosition += bytesPerBufferRow;
    position += bytesPerRow;
  }
}

async function generateRows(map, options, tileInfo, outStream) {
  for (let y = 0; y < tileInfo.tileCountY; y += 1) {
    const buffer = createBuffer(tileInfo, y);
    for (let x = 0; x < tileInfo.tileCountX; x += 1) {
      const tileIndex = (y * tileInfo.tileCountX) + x;
      // eslint-disable-next-line no-await-in-loop
      await addTile(buffer, map, options, tileInfo, tileIndex);
    }
    outStream.write(buffer);
  }
  outStream.end();
  map.release();
}

/**
 * Renders a map image
 * @param {Object} opts - Options passed to tilelive-gl
 * @param {Object} style - GL map style (optional)
 * @return {Object} - PNG map image stream
 */
export default function generate(options, style) {
  const tileInfo = createTileInfo(options);
  const worldFile = createWorldFile(tileInfo);
  const outStream = createOutStream(tileInfo);

  const map = new mbgl.Map({
    request: mbglRequest,
    ratio: options.scale || 1,
  });

  map.load(style);
  map.renderAsync = promisify(map.render);

  generateRows(map, options, tileInfo, outStream);

  return { outStream, worldFile };
}
