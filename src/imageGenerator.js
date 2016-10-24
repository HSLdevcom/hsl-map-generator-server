const tilelive = require('tilelive');
const tileliveGl = require('tilelive-gl');
const sharp = require("sharp");
const transit = require('transit-immutable-js');
const omit = require("lodash/omit");

const geomUtils = require('hsl-map-generator-utils');
const style = require('hsl-map-style/hsl-gl-map-v9.json');

const viewportMercator = require('viewport-mercator-project');

const MAX_TILE_SIZE = 1000;

tileliveGl.registerProtocols(tilelive);

const defaultOptions = {
    center: [24.9, 60.5],
    width: 500,
    height: 500,
    zoom: 10,
    scale: 2,
    pitch: 0,
    bearing: 0
};

/**
 * Returns TileLive source and options
 * @param {Object} options - Options used to generate map image
 * @param {Object} options.sources - Sources (e.g. geojson) to merge to GL style
 * @param {Array} options.layers - Layer definitions for sources
 * @return {Promise} - TileLive source and options
 */
function sourceFromJson(options) {
    const glSource = {
        protocol: "gl:",
        style: { ...style },
        query: { scale: options.scale || defaultOptions.scale }
    };

    if (options.sources) {
        glSource.style.sources = {
            ...glSource.style.sources,
            ...options.sources
        };
    }
    if (options.layers) {
        glSource.style.layers = [
            ...glSource.style.layers,
            ...options.layers
        ];
    }

    const glOptions = { ...defaultOptions, ...omit(options, ["sources", "layers"]) };

    return { source: glSource, options: glOptions };
}

/**
 * Returns TileLive source and options
 * @param {Object} options - Options used to generate map image
 * @param {Object} options.style - Complete GL style to use
 * @param {Object} options.mapSelection - Serialized state from generator UI
 * @return {Object} - TileLive source and options
 */
function sourceFromTransit(options) {
    const mapSelection = transit.fromJSON(options.mapSelection);
    const scale = geomUtils.mapSelectionToTileScale(mapSelection);

    const glSource = {
        protocol: 'gl:',
        style: options.style,
        query: { scale: scale }
    };

    const glOptions = {
        center: mapSelection.getIn(['center', 0, 'location']).toArray(),
        width: Math.round(geomUtils.mapSelectionToPixelSize(mapSelection)[0] / scale),
        height: Math.round(geomUtils.mapSelectionToPixelSize(mapSelection)[1] / scale),
        zoom: geomUtils.mapSelectionToZoom(mapSelection) - 1,
        scale: scale,
        pitch: 0,
        bearing: 0
    };

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
    return new Promise((resolve, reject) => {
        const callback = (error, data, info) => error ? reject(error) : resolve({data, info});
        glInstance.getStatic.bind(glInstance)(options, callback, true);
    });
}

function createTileInfos(options) {
    const tileCountX = Math.ceil(options.width / MAX_TILE_SIZE);
    const tileCountY = Math.ceil(options.height / MAX_TILE_SIZE);
    const tileWidth = Math.floor(options.width / tileCountX);
    const tileHeight = Math.floor(options.height / tileCountY);

    // TODO: Expand last tiles in rows and columns to fill dimensions

    const viewport = viewportMercator({
        longitude: options.center[0],
        latitude: options.center[1],
        zoom: options.zoom,
        width: options.width,
        height: options.height
    });

    let tileInfos = [];
    for (let x = 0; x < tileCountX; x++) {
        for (let y = 0; y < tileCountY; y++) {
            const center = [x * tileWidth + tileWidth / 2, y * tileHeight + tileHeight / 2];
            tileInfos.push({
                options: {
                    center: viewport.unproject(center),
                    width: tileWidth,
                    height: tileHeight,
                },
                offsetX: x * tileWidth * options.scale,
                offsetY: y * tileHeight * options.scale,
            })
        }
    }
    return tileInfos;
}

function addTile(glInstance, options, tileInfo, canvas) {
    const tileOptions = { ...options, ...tileInfo.options };

    return generateTile(glInstance, tileOptions).then((tile) => {
        if(!canvas) {
            const opts = {
                top: 0,
                left: 0,
                bottom: options.width * options.scale - tile.info.width,
                right: options.height * options.scale - tile.info.width,
            };
            return sharp(tile.data, { raw: tile.info }).extend(opts).png().toBuffer();
        } else {
            const opts = {
                raw: tile.info,
                left: tileInfo.offsetX,
                top: tileInfo.offsetY,
            };
            return sharp(canvas).overlayWith(tile.data, opts).png().toBuffer();
        }
    });
}


/**
 * Renders a map image using map selection and complete style or json params and partial style
 * @param {Object} opts - Options used to generate map image
 * @return {Promise} - PNG map image
 */
function generate(opts) {
    const { source, options } = opts.mapSelection ? sourceFromTransit(opts): sourceFromJson(opts);

    let output;
    const tileInfos = createTileInfos(options);

    return initGl(source).then(glInstance => {
        let prev;
        for (const tileInfo of tileInfos) {
            const next = (canvas) => addTile(glInstance, options, tileInfo, canvas);
            prev = prev ? prev.then(next) : next();
        }
        return prev;
    });
}

module.exports = {
    generate,
};
