import { toJSON, fromJSON } from 'transit-immutable-js';
import { fromJS } from 'immutable';
import { readFileSync, writeFileSync, createReadStream, createWriteStream } from 'fs';
import { groupBy, findIndex, find } from 'lodash';
import { DEG_LAT_PER_M, mmToM, degLonPerM, degToRad, styleFromLayers } from 'hsl-map-generator-utils';
import imageGenerator from '../src/imageGenerator';
import replacestream from 'replacestream';

const boundsReducer = (previous, current) => ({
  maxLat: previous.maxLat > current[3] ? previous.maxLat : current[3],
  minLat: previous.minLat < current[1] ? previous.minLat : current[1],
  maxLon: previous.maxLon > current[2] ? previous.maxLon : current[2],
  minLon: previous.minLon < current[0] ? previous.minLon : current[0],
});

const minExtent = {
  maxLat: -Infinity,
  minLat: Infinity,
  maxLon: -Infinity,
  minLon: Infinity,
};

const DATE = '2016-08-15';
const transform = 'transform="rotate(90) translate(85.039 0) scale(1.315) translate(0 -958.5)"';

const shapes = JSON.parse(readFileSync('./data/shapes.geojson')).features;
const stops = JSON.parse(readFileSync('./data/stops.geojson')).features.map(stop => {
  stop.properties.type = 'BUS'; // eslint-disable-line no-param-reassign
  return stop;
});
const routeData = JSON.parse(readFileSync('./data/routes.json'));

const routes = groupBy(shapes, shape => shape.properties.shape_id.split('_')[0]);
const stopsByRoute = groupBy(stops, shape => shape.properties.route);

function renderRoute(routeId) {
  return (callback) => {
    // Only render specific routes instead of all of them
    // if (!['2436N', '4313', '4434', '5510B'].includes(routeId)) { return callback(null, 'done'); }
    const baseFile = fromJSON(readFileSync('./data/map.json'));

    baseFile.sources = {};

    const routeLayers = [
      findIndex(baseFile.layers, layer => layer.text === 'Routes'),
      findIndex(baseFile.layers, layer => layer.text === 'Routes-Alternative'),
    ];

    const stopLayers = [
      findIndex(baseFile.layers, layer => layer.text === 'Stops'),
      findIndex(baseFile.layers, layer => layer.text === 'Stops-Alternative'),
    ];

    const route = routes[routeId];

    const direction1 = find(route, ['properties.shape_id', `${routeId}_1`]);
    const direction2 = find(route, ['properties.shape_id', `${routeId}_2`]);

    if (direction1) {
      baseFile.sources.direction1 = { type: 'geojson', data: direction1 };
    }

    if (direction2) {
      baseFile.sources.direction2 = { type: 'geojson', data: direction2 };
    }

    const stops1 = stopsByRoute[`${routeId}_1`];
    const stops2 = stopsByRoute[`${routeId}_2`];

    if (stops1) {
      baseFile.sources.stops1 = {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: stops1 }
      };
    }

    if (stops2) {
      baseFile.sources.stops2 = {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: stops2 }
      };
    }

    [1, 2].forEach(index => {
      if (baseFile.sources[`direction${index}`]) {
        baseFile.layers[routeLayers[index - 1]].source = `direction${index}`;
        baseFile.layers[routeLayers[index - 1]].enabled = true;
        baseFile.layers[stopLayers[index - 1]].source = `stops${index}`;
        baseFile.layers[stopLayers[index - 1]].enabled = true;
      } else {
        baseFile.layers[routeLayers[index - 1]].enabled = false;
        baseFile.layers[stopLayers[index - 1]].enabled = false;
      }
    });

    baseFile.layers[findIndex(baseFile.layers, layer => layer.text === 'POI-citybikes')]
      .enabled = false;
    baseFile.layers[findIndex(baseFile.layers, layer => layer.text === 'POI-park-and-ride')]
      .enabled = false;

    const bounds = route.map(shape => shape.bbox).reduce(boundsReducer, minExtent);
    const center = [(bounds.minLon + bounds.maxLon) / 2, (bounds.minLat + bounds.maxLat) / 2];
    const sizeDeg = [bounds.maxLon - bounds.minLon, bounds.maxLat - bounds.minLat];
    const portrait = sizeDeg[1] > sizeDeg[0] * Math.cos(degToRad(center[1]));
    const sizeMM = portrait ? [297, 390] : [390, 297];

    const mapScale = Math.max(
      sizeDeg[0] * degLonPerM(center[1]) / mmToM(sizeMM[0]),
      sizeDeg[1] * DEG_LAT_PER_M / mmToM(sizeMM[1])
    ) * 1.1;

    baseFile.mapSelection = baseFile.mapSelection.set('size', fromJS(sizeMM));
    baseFile.mapSelection = baseFile.mapSelection.setIn(['center', 0, 'location'], fromJS(center));
    baseFile.mapSelection = baseFile.mapSelection.set('pixelScale', 0.6);
    baseFile.mapSelection = baseFile.mapSelection.set('mapScale', mapScale);

    writeFileSync(`./route-maps/${routeId}_${DATE}.json`, toJSON(baseFile));
    writeFileSync(
      `./route-maps/${routeId}_${DATE}.style.json`,
      JSON.stringify(styleFromLayers(baseFile.layers, baseFile.sources).toJS())
    );
    imageGenerator(({ data }) => {
      writeFileSync(`./route-maps/${routeId}_${DATE}.png`, data);
      const svgFile = createWriteStream(`./route-maps/${routeId}_${DATE}.svg`);

      createReadStream('./data/hsl_kartta_kuljettajanohje_01.svg')
        .pipe(replacestream('_FILENAME_', `file://${process.cwd()}/route-maps/${routeId}_${DATE}.png`))
        .pipe(replacestream('_TRANSFORM_', portrait ? '' : transform))
        .pipe(replacestream('_NUMERO_',
          routeData[routeId] ? routeData[routeId].shortName : routeId.substring(1).replace(/^0*/g, '')
        ))
        .pipe(replacestream('_LINJA_',
          routeData[routeId] ? routeData[routeId].longName : ''
        ))
        .pipe(replacestream('_DATE_', DATE))
        .pipe(svgFile);

      callback(null, 'done');
    }, {
      mapSelection: toJSON(baseFile.mapSelection),
      style: styleFromLayers(baseFile.layers, baseFile.sources).toJS(),
    });
  };
}

function* renderRoutes() {
  const routeKeys = Object.keys(routes);
  for (const route of routeKeys) {
    if ({}.hasOwnProperty.call(routeKeys, route)) {
      yield;
    }
    console.log(`Rendering ${route}`);
    yield renderRoute(route);
  }
}

function runGenerator(fn) {
  const next = (err, arg) => {
    if (err) return it.throw(err);

    const result = it.next(arg);
    if (result.done) return;

    if (typeof result.value === 'function') {
      result.value(next);
    } else {
      next(null, result.value);
    }
  };

  const it = fn();
  return next();
}

runGenerator(renderRoutes);
