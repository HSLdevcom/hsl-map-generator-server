var fs = require("fs");
var path = require("path");
var readline = require("readline");

const SRC_PATH = "../data/src";
const DEST_PATH = "../data";

const stopFields = [
  [7, "stopId"],
  [7, null],
  [7, null],
  [8, "lon"],
  [8, "lat"],
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
];

function parseLine(line, fields) {
  const stop = {};
  let index = 1;
  fields.forEach(([length, key]) => {
    if(key) stop[key] = line.substring(index, index + length).trim();
    index = index + length;
  });
  return stop;
}

const lineReader = readline.createInterface({
  input: fs.createReadStream(path.join(__dirname, SRC_PATH, "pysakki.dat"))
});

const stops = [];

lineReader.on("line", (line) => {
  stops.push(parseLine(line, stopFields));
});

lineReader.on("close", (line) => {
  const outputPath =  path.join(__dirname, DEST_PATH, "stops.json");
  fs.writeFileSync(outputPath, JSON.stringify(stops), "utf8");
  console.log(`${stops.length} features succesfully imported to ${outputPath}`);
});
