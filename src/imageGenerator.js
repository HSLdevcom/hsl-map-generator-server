const tilelive = require('tilelive');
const tileliveGl = require('tilelive-gl');
const transit = require('transit-immutable-js');
const omit = require("lodash/omit");

const geomUtils = require('hsl-map-generator-utils');
const style = require('hsl-map-style/hsl-gl-map-v9.json');

// const viewportMercator = require('viewport-mercator-project');

const LIMIT = 18000;

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
 * Returns a map image from given area
 * @param {Object} options - Options used to generate map image
 * @param {Object} options.sources - Sources (e.g. geojson) to merge to GL style
 * @param {Array} options.layers - Layer definitions for sources
 * @return {Promise} - PNG map image
 */
function generate(options) {
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

    const opts = { ...defaultOptions, ...omit(options, ["sources", "layers"]) };

    return new Promise((resolve, reject) => {
        tilelive.load(glSource, (err, source) => {
            source.getStatic.bind(source)(opts, (error, data) =>
                error ? reject(error) : resolve(data));
        });
    });
}

/**
* Returns a map image rendered using style specified in options
 * @param {Object} options - Options used to generate map image
 * @param {Object} options.style - Full GL style to use
 * @param {Object} options.mapSelection - Serialized state from generator UI
 * @return {Promise} - PNG map image
 */
function generateFromTransit(options) {
    const mapSelection = transit.fromJSON(options.mapSelection);
    const scale = geomUtils.mapSelectionToTileScale(mapSelection);

    const glSource = {
        protocol: 'gl:',
        style: options.style,
        query: { scale: scale }
    };

    const opts = {
        center: mapSelection.getIn(['center', 0, 'location']).toArray(),
        width: Math.round(geomUtils.mapSelectionToPixelSize(mapSelection)[0] / scale),
        height: Math.round(geomUtils.mapSelectionToPixelSize(mapSelection)[1] / scale),
        zoom: geomUtils.mapSelectionToZoom(mapSelection) - 1,
        scale: scale,
        pitch: 0,
        bearing: 0
    };

    // TODO: Generate image in parts when too large
    if (opts.width * scale > LIMIT || opts.height * scale > LIMIT) {
        return Promise.reject();
    }

    return new Promise((resolve, reject) => {
        tilelive.load(glSource, (err, source) => {
            source.getStatic.bind(source)(opts, (error, data) =>
                error ? reject(error) : resolve(data));
        });
    });
}

module.exports = {
    generate,
    generateFromTransit,
};
