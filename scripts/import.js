var fs = require("fs");
var path = require("path");
var groupBy = require("lodash/groupBy");
var forEach = require("lodash/forEach");

var parseDate = require("./parseDate");
var parseFile = require("./parseFile");
var splitFile = require("./splitFile");
var parseCsv = require ("./parseCsv");
var transformGeometries = require ("./transformGeometries");

const SRC_PATH = "../data/src";
const OUTPUT_PATH = "../data";

const pysakki_fields = [
    [7, "stopId"],
    [7, null],
    [7, null],
    [8, "lon", true],
    [8, "lat", true],
    [20, "name_fi"],
    [20, "name_se"],
    [20, "address_fi"],
    [20, "address_se"],
    [3, "platform"],
    [7, null],
    [7, null],
    [20, null],
    [20, null],
    [2, null],
    [6, "shortId"],
    [8, null],
    [8, null],
    [1, null],
    [15, "heading"],
    [3, null],
    [7, "terminalId"]
];

const linjannimet2_fields = [
    [6, "lineId"],
    [60, "name_fi"],
    [60, "name_se"],
    [30, "origin_fi"],
    [30, "origin_se"],
    [30, "destination_fi"],
    [30, "destination_se"],
];

const linja3_fields = [
    [6, "routeId"],
    [8, null],
    [8, null],
    [1, "direction"],
    [60, null],
    [60, null],
    [2, "type"],
    [20, null],
    [20, null],
    [7, null],
    [5, null],
    [20, "destination_fi"],
    [20, "destination_se"],
];

const reitti_fields = [
    [7, "stopId"],
    [7, null],
    [6, "routeId"],
    [1, "direction"],
    [8, "dateBegin"],
    [8, "dateEnd"],
    [20, null],
    [3, "duration", true],
    [3, "stopNumber", true],
];

const reittimuoto_fields = [
    [6, "lineId"],
    [1, "direction"],
    [8, "beginDate"],
    [8, "endDate"],
    [7, null],
    [1, null],
    [4, null],
    [7, "coordX"],
    [7, "coordY"],
];

//CSV file fields: part index, key
const ajantasaus_fields = [
    [0, "id"],
    [1, "direction"],
    [4, "stopId"],
];

const aikat_fields = [
    [7, "stopId"],
    [6, "routeId"],
    [1, "direction"],
    [2, "dayType"],
    [4, "seqNumber", true],
    [1, "isNextDay", true],
    [2, "hours", true],
    [2, "minutes", true],
    [1, "isAccessible", true],
    [8, "dateBegin"],
    [8, "dateEnd"],
];

function segmentsToStopList(segments) {
    return segments
        .sort((a, b) => a.stopNumber - b.stopNumber)
        .map(({duration, stopId}) => ({duration, stopId}));
};

function segmentsToRoutes(segments, routeId) {
    const routes = [];
    const segmentsByGroup = groupBy(segments,
        ({dateBegin, dateEnd, direction}) => dateBegin + dateEnd + direction);

    forEach(segmentsByGroup, (groupSegments) => {
        if(groupSegments.length) {
            routes.push({
                dateBegin: parseDate(groupSegments[0].dateBegin),
                dateEnd: parseDate(groupSegments[0].dateEnd),
                direction: groupSegments[0].direction,
                stops: segmentsToStopList(groupSegments),
            });
        }
    });
    return routes;
}

function getRouteInfo(routes, routeId, direction) {
    const {destination_fi, destination_se} = routes.find(route =>
        route.routeId === routeId && route.direction == direction)
        return {destination_fi, destination_se};
}

function getRoutes(routes, routeSegments) {
    const routesById = {};
    forEach(groupBy(routeSegments, "routeId"), (segments, routeId) => {
        const routesWithInfos = segmentsToRoutes(segments).map(route =>
            ({...route, ...getRouteInfo(routes, routeId, route.direction)}));
        routesById[routeId] = routesWithInfos;
    });
    return routesById;
}

function getRouteTypes(routes, lineId) {
    const types = routes
        .filter(({routeId}) => lineId.startsWith(routeId))
        .map(({type}) => type)
        .filter(type => !!type.length);
    return [...new Set(types)];
}

const sourcePath = (filename) => path.join(__dirname, SRC_PATH, filename);
const outputPath = (filename) => path.join(__dirname, OUTPUT_PATH, filename);


const sourceFiles = [
    parseFile(sourcePath("pysakki.dat"), pysakki_fields),
    parseFile(sourcePath("linjannimet2.dat"), linjannimet2_fields),
    parseFile(sourcePath("linja3.dat"), linja3_fields),
    parseFile(sourcePath("reitti.dat"), reitti_fields),
    parseFile(sourcePath("reittimuoto.dat"), reittimuoto_fields),
    parseCsv(sourcePath("ajantasaus.csv"), ajantasaus_fields),
];

Promise.all(sourceFiles).then(([stops, lines, routes, routeSegments, geometries, timingStops]) => {
    fs.writeFileSync(outputPath("stops.json"), JSON.stringify(stops), "utf8");
    console.log(`Succesfully imported ${stops.length} stops`);

    const linesTypes = lines.map(line => ({...line, types: getRouteTypes(routes, line.lineId)}));
    fs.writeFileSync(outputPath("lines.json"), JSON.stringify(linesTypes), "utf8");
    console.log(`Succesfully imported ${linesTypes.length} lines`);

    const routesById = getRoutes(routes, routeSegments);
    fs.writeFileSync(outputPath("routes.json"), JSON.stringify(routesById, null, 2), "utf8");
    console.log(`Succesfully imported ${Object.keys(routesById).length} routes`);

    const routeGeometries = transformGeometries(geometries);
    fs.writeFileSync(outputPath("routeGeometries.geojson"), JSON.stringify(routeGeometries), "utf8");
    console.log(`Succesfully imported ${Object.keys(routeGeometries).length} route geometries`);

    fs.writeFileSync(outputPath("timingStops.json"), JSON.stringify(timingStops), "utf8");
    console.log(`Succesfully imported ${Object.keys(timingStops).length} timing stops`);

    return splitFile(sourcePath("aikat.dat"), aikat_fields, outputPath("timetables"), "stopId");
}).then((paths) => {
    console.log("Importing timetables");
    // TODO: Group timetables by dateBegin, dateEnd and dayType
});
