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

function generate(options, callback) {
    const glSource = {
        protocol: "gl:",
        style: {...style},
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

    const opts = {...defaultOptions, ...omit(options, ["sources", "layers"])};

    tilelive.load(glSource, (err, source) => {
        source.getStatic.bind(source)(opts, (error, data) => {
            if (error) console.error(error);
            callback({ data: data, options: options });
        });
    });
}

function generateFromTransit(callback, opts) {
    const mapSelection = transit.fromJSON(opts.mapSelection);
    const scale = geomUtils.mapSelectionToTileScale(mapSelection);

    const glSource = {
        protocol: 'gl:',
        style: opts.style,
        query: { scale: scale }
    };

    tilelive.load(glSource, (err, source) => {
        const options = {
            center: mapSelection.getIn(['center', 0, 'location']).toArray(),
            width: Math.round(geomUtils.mapSelectionToPixelSize(mapSelection)[0] / scale),
            height: Math.round(geomUtils.mapSelectionToPixelSize(mapSelection)[1] / scale),
            zoom: geomUtils.mapSelectionToZoom(mapSelection) - 1,
            scale: scale,
            pitch: 0,
            bearing: 0
        };

        // const viewport = viewportMercator({
        //     longitude: options.center[0],
        //     latitude: options.center[1],
        //     zoom: options.zoom,
        //     width: options.width,
        //     height: options.height,
        // });

        if (options.width * scale > LIMIT) {
            return;
        }

        if (options.height * scale > LIMIT) {
            return;
        }

        source.getStatic.bind(source)(options, (error, data) => {
            callback({ data: data, options: options });
        });
    });
}

module.exports = {
    generate,
    generateFromTransit,
};
