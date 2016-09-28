var fs = require("fs");
var path = require("path");
var groupBy = require("lodash/groupBy");
var forEach = require("lodash/forEach");
var parseFile = require("./parseFile");

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

const linjannimet2_fields = [
    [6, "lineId"],
    [60, "name_fi"],
    [60, "name_se"],
    [30, "origin_fi"],
    [30, "origin_se"],
    [30, "destination_fi"],
    [30, "destination_se"],
];

function parseDate(dateString) {
    if(!dateString || dateString.length !== 8) return null;
    return new Date(
        dateString.substring(0, 4),
        dateString.substring(4,6),
        dateString.substring(6,8)
    );
}

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
                isReverse: (groupSegments[0].direction === "1"),
                stops: segmentsToStopList(groupSegments),
            });
        }
    });
    return routes;
}

function groupRoutes(segments) {
    const groupedRoutes = {};
    forEach(groupBy(segments, "routeId"), (segments, id) => {
        groupedRoutes[id] = segmentsToRoutes(segments);
    });
    return groupedRoutes;
}

const sourcePath = (filename) => path.join(__dirname, SRC_PATH, filename);
const outputPath = (filename) => path.join(__dirname, OUTPUT_PATH, filename);

const sourceFiles = [
    parseFile(sourcePath("pysakki.dat"), pysakki_fields),
    parseFile(sourcePath("linjannimet2.dat"), linjannimet2_fields),
    parseFile(sourcePath("reitti.dat"), reitti_fields),
];

Promise.all(sourceFiles).then(([stops, lines, segments]) => {
    fs.writeFileSync(outputPath("stops.json"), JSON.stringify(stops), "utf8");
    console.log(`Succesfully imported ${stops.length} stops`);

    fs.writeFileSync(outputPath("lines.json"), JSON.stringify(lines), "utf8");
    console.log(`Succesfully imported ${lines.length} lines`);

    const routes = groupRoutes(segments);
    const routeIds = Object.keys(routes);
    fs.writeFileSync(outputPath("routes.json"), JSON.stringify(routes, null, 2), "utf8");
    console.log(`Succesfully imported ${routeIds.length} routes`);
});
