const fs = require('file-system');
var path = require("path");
var readline = require("readline");
var iconv = require("iconv-lite");
const parseLine = require("./parseLine");

/**
 * Parses each row in DAT file to JSON file named after value of given field
 * @param {string} filename
 * @param {Array} fields
 * @param {string} outdir
 * @param {string} splitField
 * @returns {boolean}
 */
function splitDat(filename, fields, outdir, splitField) {
    let paths = [];

    return new Promise((resolve) => {
        const lineReader = readline.createInterface({
            input: fs.createReadStream(filename)
                .pipe(iconv.decodeStream("ISO-8859-15"))
        });

        lineReader.on("line", (line) => {
            const valuesByField = parseLine(line, fields);
            const outpath = path.join(outdir, `${valuesByField[splitField]}.json`);
            fs.appendFileSync(outpath, JSON.stringify(valuesByField));
            paths = [...new Set([...paths, outpath])];
        });

        lineReader.on("close", (line) => {
            resolve(paths);
        });
    });
}

module.exports = splitDat;
