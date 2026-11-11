const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  MAX_TILE_SIZE,
  defaultOptions,
  createSource,
  createTileInfo,
  createWorldFile,
} = require('../src/tileInfo');

test('createSource fills defaults and rounds the scale', () => {
  const style = { version: 8, sources: {}, layers: [] };
  const { source, options } = createSource({ scale: 1 / 3, width: 150 }, style);

  assert.equal(source.protocol, 'gl:');
  assert.equal(source.style, style);
  assert.equal(source.query.scale, 0.3333);
  assert.equal(source.query.bufferWidth, defaultOptions.bufferWidth);
  assert.equal(options.width, 150);
  assert.equal(options.height, defaultOptions.height);
  assert.deepEqual(options.center, defaultOptions.center);
});

test('createSource falls back to scale 1', () => {
  const { source } = createSource({ bufferWidth: 2 });
  assert.equal(source.query.scale, 1);
  assert.equal(source.query.bufferWidth, 2);
  assert.equal(source.style, null);
});

test('a small image is a single tile centred on the requested center', () => {
  const info = createTileInfo({ ...defaultOptions, width: 500, height: 300 });

  assert.equal(info.width, 500);
  assert.equal(info.height, 300);
  assert.equal(info.tiles.length, 1);

  const [tile] = info.tiles;
  assert.equal(tile.x, 0);
  assert.equal(tile.y, 0);
  assert.equal(tile.options.width, 500);
  assert.equal(tile.options.height, 300);
  assert.ok(Math.abs(tile.options.center[0] - defaultOptions.center[0]) < 1e-9);
  assert.ok(Math.abs(tile.options.center[1] - defaultOptions.center[1]) < 1e-9);
});

test('a large image is split into a grid of tiles no bigger than MAX_TILE_SIZE', () => {
  const scale = 2;
  const info = createTileInfo({ ...defaultOptions, width: 6000, height: 2000, scale });

  // 5000 px / scale 2 = 2500 CSS px per tile at most
  assert.equal(info.tiles.length, 3 * 1);
  for (const tile of info.tiles) {
    assert.ok(tile.options.width * scale <= MAX_TILE_SIZE);
    assert.ok(tile.options.height * scale <= MAX_TILE_SIZE);
  }
  assert.equal(info.width, 2000 * scale * 3);
  assert.equal(info.height, 2000 * scale);
  assert.deepEqual(
    info.tiles.map(({ x, y }) => [x, y]),
    [
      [0, 0],
      [1, 0],
      [2, 0],
    ],
  );
  // Tiles run west to east
  assert.ok(info.tiles[0].options.center[0] < info.tiles[2].options.center[0]);
});

test('createWorldFile describes square EPSG:3857 pixels from the top-left corner', () => {
  const info = createTileInfo({ ...defaultOptions, width: 400, height: 400 });
  const parts = createWorldFile(info).split('|');

  assert.equal(parts.length, 7);
  assert.equal(parts[6], '');
  const [pixelWidth, rotY, rotX, pixelHeight, left, top] = parts.slice(0, 6).map(Number);

  assert.equal(rotX, 0);
  assert.equal(rotY, 0);
  assert.ok(pixelWidth > 0);
  assert.ok(pixelHeight < 0, 'y axis points south');
  assert.ok(Math.abs(pixelWidth + pixelHeight) / pixelWidth < 1e-6, 'pixels are square');
  // Helsinki region in web mercator metres
  assert.ok(left > 2.6e6 && left < 2.9e6, `left=${left}`);
  assert.ok(top > 8.4e6 && top < 8.7e6, `top=${top}`);
});
