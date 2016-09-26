var fs = require("fs");
var path = require("path");
var groupBy = require("lodash/groupBy");
var forEach = require("lodash/forEach");
var parseFile = require("./parseFile");

const SRC_PATH = "../data/src";
const DEST_PATH = "../data";

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
  [6, "routeId"],
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

function getRoutes(segments, routeId) {
  const routes = [];
  const routeSegments = segments.filter(segment => segment.routeId === routeId);
  const segmentsByRoute = groupBy(routeSegments,
    ({dateBegin, dateEnd, direction}) => dateBegin + dateEnd + direction);

  forEach(segmentsByRoute, (segments) => {
    if(segments.length) {
      routes.push({
        dateBegin: parseDate(segments[0].dateBegin),
        dateEnd: parseDate(segments[0].dateEnd),
        isReverse: (segments[0].direction === "1"),
        stops: segmentsToStopList(segments),
      });
    }
  });
  return routes;
}

const routeFiles = [
  parseFile("linjannimet2.dat", linjannimet2_fields),
  parseFile("reitti.dat", reitti_fields)
];

Promise.all(routeFiles).then(([routes, segments]) => {
  const routesStops = routes.map(route =>
    Object.assign({}, route, {routes: getRoutes(segments, route.routeId)})
  );
  const outputPath =  path.join(__dirname, DEST_PATH, "routesStops.json");
  fs.writeFileSync(outputPath, JSON.stringify(routesStops), "utf8");
  console.log(`Succesfully wrote ${routesStops.length} routes to ${outputPath}`);
});

parseFile("pysakki.dat", pysakki_fields).then(stops => {
  const outputPath =  path.join(__dirname, DEST_PATH, "stops.json");
  fs.writeFileSync(outputPath, JSON.stringify(stops), "utf8");
  console.log(`Succesfully wrote ${stops.length} stops to ${outputPath}`);
});
