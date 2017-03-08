const path = require("path");
const tilelive = require("tilelive");
const tileliveGl = require("tilelive-gl");
const stream = require("stream");
const PNGEncoder = require("png-stream").Encoder;
const omit = require("lodash/omit");
const viewportMercator = require("viewport-mercator-project");
const hslMapStyle = require("hsl-map-style");

const glyphsPath = `file://${path.join(__dirname, ".." , "public")}/`;

const defaultStyle = hslMapStyle.generateStyle({
    lang: "fi",
    extensions: ["icons"],
    glyphsUrl: glyphsPath,
});

const MAX_TILE_SIZE = 1000;
const CHANNELS = 4;

tileliveGl.registerProtocols(tilelive);

const defaultOptions = {
    center: [24.9, 60.5],
    width: 500,
    height: 500,
    zoom: 10,
    scale: 1,
    pitch: 0,
    bearing: 0
};

/**
 * Returns TileLive source and options
 * @param {Object} options - Options passed to tilelive-gl
 * @param {Object} style - GL map style (optional)
 * @return {Promise} - TileLive source and options
 */
function createSource(options, style = null) {
    const glSource = {
        protocol: "gl:",
        style: style || defaultStyle,
        query: { scale: options.scale || defaultOptions.scale }
    };

    const glOptions = { ...defaultOptions, ...options };

    return { source: glSource, options: glOptions };
}

function initGl(source) {
    return new Promise((resolve, reject) => {
        tilelive.load(source, (err, instance) => {
            if(err) {
                reject(err);
            } else {
                resolve(instance);
            }
        });
    });
}

function generateTile(glInstance, options) {
    const opts = { ...options, format: "raw" };
    return new Promise((resolve, reject) => {
        const callback = (error, data, info) => error ? reject(error) : resolve({ data, ...info });
        glInstance.getStatic.bind(glInstance)(opts, callback, true);
    });
}

function createTileInfo(options) {
    const tileCountX = Math.ceil(options.width / MAX_TILE_SIZE);
    const tileCountY = Math.ceil(options.height / MAX_TILE_SIZE);
    // Width and height values passed to tilelive-gl
    const widthOption = Math.floor(options.width / tileCountX);
    const heightOption = Math.floor(options.height / tileCountY);
    // Actual pixel values of generated tiles
    const tileWidth = Math.floor(widthOption * options.scale);
    const tileHeight = Math.floor(heightOption * options.scale);

    // TODO: Expand last tiles in rows and columns to fill dimensions

    const viewport = viewportMercator({
        longitude: options.center[0],
        latitude: options.center[1],
        zoom: options.zoom,
        width: options.width,
        height: options.height,
    });

    let tiles = [];
    for (let y = 0; y < tileCountY; y++) {
        for (let x = 0; x < tileCountX; x++) {
            const center = [x * widthOption + widthOption / 2, y * heightOption + heightOption / 2];
            tiles.push({
                options: {
                    center: viewport.unproject(center),
                    width: widthOption,
                    height: heightOption,
                },
                offset: x * tileWidth,
            });
        }
    }

    return {
        tiles,
        tileCountX,
        tileCountY,
        tileWidth,
        tileHeight,
    };
}

function createBuffer(tileInfo) {
    const bufferLength = tileInfo.tileCountX * tileInfo.tileWidth * tileInfo.tileHeight * CHANNELS;

    return {
        data: Buffer.alloc(bufferLength),
        width: tileInfo.tileWidth * tileInfo.tileCountX,
        height: tileInfo.tileHeight,
        channels: CHANNELS,
    };
}

function createOutStream(tileInfo) {
    const width = tileInfo.tileWidth * tileInfo.tileCountX;
    const height = tileInfo.tileHeight * tileInfo.tileCountY;
    return new PNGEncoder(width, height, { colorSpace: "rgba" });
}

function addTile(buffer, glInstance, mapOptions, tileInfo, tileIndex) {
    const tileParams = tileInfo.tiles[tileIndex];
    const tileOptions = { ...mapOptions, ...tileParams.options };

    return generateTile(glInstance, tileOptions).then((tile) => {
        let tileIndex = 0;
        let tileLength = tile.width * tile.height * tile.channels;
        let bufferIndex = tileParams.offset * CHANNELS;

        while (tileIndex < tileLength) {
            tile.data.copy(buffer.data, bufferIndex, tileIndex, tileIndex + tile.width * CHANNELS);
            bufferIndex += buffer.width * CHANNELS;
            tileIndex += tile.width * CHANNELS;
        }
    });
}

function generateRow(glInstance, options, outStream, tileInfo, rowIndex) {
    let prev;
    const buffer = createBuffer(tileInfo, rowIndex);
    for (let x = 0; x < tileInfo.tileCountX; x++) {
        const tileIndex = (rowIndex * tileInfo.tileCountX) + x;
        const next = () => addTile(buffer, glInstance, options, tileInfo, tileIndex);
        prev = prev ? prev.then(next) : next();
    }
    prev = prev.then(() => outStream.write(buffer.data));
    return prev;
}

/**
 * Renders a map image
 * @param {Object} opts - Options passed to tilelive-gl
 * @param {Object} style - GL map style (optional)
 * @return {Readable} - PNG map image stream
 */
function generate(opts, style) {
    const { source, options } = createSource(opts, style);

    const tileInfo = createTileInfo(options);
    const outStream = createOutStream(tileInfo);

    initGl(source).then(glInstance => {
        let prev;
        for (let y = 0; y < tileInfo.tileCountY; y++) {
            const next = () => generateRow(glInstance, options, outStream, tileInfo, y);
            prev = prev ? prev.then(next) : next();
        }
        return prev.then(() => {
            outStream.end();
        });
    });
    return outStream;
}

module.exports = {
    generate,
};
