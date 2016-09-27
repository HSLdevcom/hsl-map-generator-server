var fs = require("fs");
var path = require("path");
var readline = require("readline");
var iconv = require("iconv-lite");

function parseFile(filename, fields) {
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

function parseLine(line, fields) {
    const stop = {};
    let index = 1;
    fields.forEach(([length, key, isNumeric]) => {
        if(key) {
            const value = line.substring(index, index + length).trim();
            stop[key] = isNumeric ? parseFloat(value) : value;
        }
        index = index + length;
    });
    return stop;
}


module.exports = parseFile;
