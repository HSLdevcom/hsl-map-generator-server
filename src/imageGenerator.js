const tilelive = require('tilelive');
const tileliveGl = require('tilelive-gl');
const geomUtils = require('hsl-map-generator-utils');
const transit = require('transit-immutable-js');
const style = require('hsl-map-style/hsl-gl-map-with-stops-v9.json');

// const viewportMercator = require('viewport-mercator-project');

const LIMIT = 18000;

tileliveGl.registerProtocols(tilelive);


function generate(options, callback) {

    const glSource = {
        protocol: 'gl:',
        style: style,
        query: { scale: 3 }
    };

    tilelive.load(glSource, (err, source) => {
        const defaultOptions = {
            center: [24.9, 60.5],
            width: 500,
            height: 500,
            zoom: 10,
            scale: 2,
            pitch: 0,
            bearing: 0
        };

        const opts = {...defaultOptions, ...options};

        source.getStatic.bind(source)(opts, (error, data) => {
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
};

module.exports = {
    generate,
    generateFromTransit,
};
