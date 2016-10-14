const fs = require('file-system');
var path = require("path");
var readline = require("readline");
var iconv = require("iconv-lite");
const parseLine = require("./parseLine");

function parseDat(filename, fields) {
    const records = [];

    return new Promise((resolve) => {
        const lineReader = readline.createInterface({
            input: fs.createReadStream(filename)
                .pipe(iconv.decodeStream("ISO-8859-15"))
        });

        lineReader.on("line", (line) => {
            records.push(parseLine(line, fields));
        });

        lineReader.on("close", (line) => {
            resolve(records);
        });
    });
}

module.exports = parseDat;
