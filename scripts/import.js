var fs = require("fs");
var path = require("path");
var groupBy = require("lodash/groupBy");
var forEach = require("lodash/forEach");
const isEqual = require("lodash/isEqual");
const pick = require("lodash/pick");
const omit = require("lodash/omit");
const differenceWith = require("lodash/differenceWith");

var parseDate = require("./parseDate");
var parseDat = require("./parseDat");
var splitDat = require("./splitDat");
var parseCsv = require ("./parseCsv");
var transformGeometries = require ("./transformGeometries");

const SRC_PATH = "../data/src";
const OUTPUT_PATH = "../data";

const pysakki_fields = [
    [7, "stopId"],
    [7, null],
    [7, null],
    [8, "lat", true],
    [8, "lon", true],
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
    [7, "terminalId"],
    [7, "stopAreaId"],
];

const terminaali_fields = [
    [7, "terminalId"],
    [40, "name_fi"],
    [40, "name_se"],
    [14, null],
    [8, "lat", true],
    [8, "lon", true],
];

const pysakkialue_fields = [
    [6, "stopAreaId"],
    [40, "name_fi"],
    [40, "name_se"],
    [14, null],
    [8, "lat", true],
    [8, "lon", true],
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
    [94, null],
    [1, "timingStopType", true],
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

const aikat_fields = [
    [7, "stopId"],
    [6, "routeId"],
    [1, "direction"],
    [2, "dayType"],
    [4, null],
    [1, null],
    [2, "hours", true],
    [2, "minutes", true],
    [1, "isAccessible", true],
    [8, "dateBegin"],
    [8, "dateEnd"],
];

function segmentsToStopList(segments) {
    return segments
        .sort((a, b) => a.stopNumber - b.stopNumber)
        .map(({duration, stopId, timingStopType}) =>
            timingStopType > 0 ? ({duration, stopId, timingStopType}) : ({duration, stopId})
        );

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

function isEqualDeparture(departure, other) {
    const identifyFields = ["routeId", "direction", "hours", "minutes"];
    return isEqual(pick(departure, ...identifyFields), pick(other, ...identifyFields));
}

function getDepartureList(departures) {
    const omittedFields = ["stopId", "dateBegin", "dateEnd", "dayType"];
    return departures ? departures.map(departure => omit(departure, omittedFields)) : [];
}

function getTimetables(departures) {
    const timetables = [];
    const departuresByDate = groupBy(departures, ({dateBegin, dateEnd}) => dateBegin + dateEnd);

    forEach(departuresByDate, (departuresForDate) => {
        const departuresByType = groupBy(departuresForDate, ({dayType}) => dayType);

        if (departuresByType["Pe"] && departuresByType["Ma"]) {
            const fridayOnlyDepartures = differenceWith(
                departuresByType["Pe"],
                departuresByType["Ma"],
                isEqualDeparture
            );
            for (const departure of fridayOnlyDepartures) {
                departure.isFridayOnly = true;
            }
        }

        timetables.push({
            dateBegin: departuresForDate[0].dateBegin,
            dateEnd: departuresForDate[0].dateEnd,
            departures: {
                weekdays: getDepartureList(departuresByType["Pe"]),
                saturdays: getDepartureList(departuresByType["La"]),
                sundays: getDepartureList(departuresByType["Su"]),
            }
        });
    });

    return timetables;
}

function parseDepartures(filepath) {
    return new Promise(resolve => {
        parseDat(filepath, aikat_fields).then(departures => {
            console.log(`Writing timetable (stop id: ${departures[0].stopId})`);
            const timetables = getTimetables(departures);
            fs.writeFileSync(filepath, JSON.stringify(timetables));
            resolve();
        });
    });
}

const sourcePath = (filename) => path.join(__dirname, SRC_PATH, filename);
const outputPath = (filename) => path.join(__dirname, OUTPUT_PATH, filename);

const sourceFiles = [
    parseDat(sourcePath("pysakki.dat"), pysakki_fields),
    parseDat(sourcePath("terminaali.dat"), terminaali_fields),
    parseDat(sourcePath("pysakkialue.dat"), pysakkialue_fields),
    parseDat(sourcePath("linjannimet2.dat"), linjannimet2_fields),
    parseDat(sourcePath("linja3.dat"), linja3_fields),
    parseDat(sourcePath("reitti.dat"), reitti_fields),
    parseDat(sourcePath("reittimuoto.dat"), reittimuoto_fields),
];

Promise.all(sourceFiles)
    .then(([stops, terminals, stopAreas, lines, routes, routeSegments, geometries]) => {
    fs.writeFileSync(outputPath("stops.json"), JSON.stringify(stops), "utf8");
    console.log(`Succesfully imported ${stops.length} stops`);

    fs.writeFileSync(outputPath("terminals.json"), JSON.stringify(terminals), "utf8");
    console.log(`Succesfully imported ${terminals.length} terminals`);

    fs.writeFileSync(outputPath("stopAreas.json"), JSON.stringify(stopAreas), "utf8");
    console.log(`Succesfully imported ${stopAreas.length} stop areas`);

    const linesTypes = lines.map(line => ({...line, types: getRouteTypes(routes, line.lineId)}));
    fs.writeFileSync(outputPath("lines.json"), JSON.stringify(linesTypes), "utf8");
    console.log(`Succesfully imported ${linesTypes.length} lines`);

    const routesById = getRoutes(routes, routeSegments);
    fs.writeFileSync(outputPath("routes.json"), JSON.stringify(routesById, null, 2), "utf8");
    console.log(`Succesfully imported ${Object.keys(routesById).length} routes`);

    const routeGeometries = transformGeometries(geometries);
    fs.writeFileSync(outputPath("routeGeometries.geojson"), JSON.stringify(routeGeometries), "utf8");
    console.log(`Succesfully imported ${routeGeometries.features.length} route geometries`);

    return splitDat(sourcePath("aikat.dat"), outputPath("timetables"), 1, 8);
}).then((paths) => {
    let prev;
    for (const filepath of paths) {
        if (prev) {
            prev = prev.then(() => parseDepartures(filepath));
        } else {
            prev = parseDepartures(filepath);
        }
    }
    prev.then(() => {
        console.log(`Succesfully imported timetables for ${paths.length} stops`);
    });
}).catch(error => {
    console.error(error);
});
