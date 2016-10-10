var proj4 = require('proj4')
var transform = proj4("+proj=tmerc +lat_0=0 +lon_0=24 +k=1 +x_0=2500000 +y_0=0 +ellps=intl +towgs84=-96.062,-82.428,-121.753,4.801,0.345,-1.376,1.496 +units=m +no_defs", 'EPSG:4326');
var groupBy = require("lodash/groupBy");
var forEach = require("lodash/forEach");
var parseDate = require("../utils/parseDate")

function transformGeometries(geometries) {
    let features = [];

    forEach(groupBy(geometries, "lineId"), (line) => {
        forEach(groupBy(line, "direction"), (direction) => {
            forEach(groupBy(direction, "beginDate"), (date) => {
                let coords = [];
                forEach(date, geometry => coords.push(transform.forward([geometry.coordY, geometry.coordX])));
                const data = {
                    lineId: date[0].lineId,
                    direction: date[0].direction,
                    beginDate: parseDate(date[0].beginDate),
                    endDate: parseDate(date[0].endDate),
                }
                const feature = {
                    "type": "Feature",
                    "properties": data,
                    "geometry": {
                        "type": "LineString",
                        "coordinates": coords,
                    },
                }
                features.push(feature);
            })
        })
    });
    return {
        "type": "FeatureCollection",
        "features": features,
    }
}

module.exports = transformGeometries;


