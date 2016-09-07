const tilelive = require('tilelive');
const tileliveGl = require('tilelive-gl');
const geomUtils = require('hsl-map-generator-utils');
const transit = require('transit-immutable-js');
// const viewportMercator = require('viewport-mercator-project');

const LIMIT = 18000;

tileliveGl.registerProtocols(tilelive);

module.exports = (callback, opts) => {
  const mapSelection = transit.fromJSON(opts.mapSelection);

  const glSource = { protocol: 'gl:', style: opts.style, query: { scale: geomUtils.mapSelectionToTileScale(mapSelection) } };

  tilelive.load(glSource, (err, source) => {
    const scale = geomUtils.mapSelectionToTileScale(mapSelection);
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
    //   longitude: options.center[0],
    //   latitude: options.center[1],
    //   zoom: options.zoom,
    //   width: options.width,
    //   height: options.height,
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
