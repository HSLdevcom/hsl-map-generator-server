const fs = require("fs-extra");
var path = require("path");
var readline = require("readline");
var iconv = require("iconv-lite");
const omit = require("lodash/omit");
const forEach = require("lodash/forEach");

// Max no of lines to collect before writing to files
const BUFFER_SIZE = 500000;

function appendToFiles(contentByPath) {
    forEach(contentByPath, (content, path) => {
        fs.appendFileSync(path, content);
    });
}

/**
 * Splits DAT file into multiple files
 * @param {string} filename
 * @param {string} outdir
 * @param {number} startIndex
 * @param {number} endIndex
 * @returns {Array} - Paths of files written
 */
function splitDat(filename, outdir, startIndex, endIndex) {
    let paths = new Set();
    let lineCounter = 0;
    let linesByPath = {};

    return new Promise((resolve) => {
        fs.emptyDirSync(outdir);

        const lineReader = readline.createInterface({
            input: fs.createReadStream(filename).pipe(iconv.decodeStream("ISO-8859-15"))
        });

        lineReader.on("line", (line) => {
            const splitId = line.substring(startIndex, endIndex);
            const outpath = path.join(outdir, `${splitId}.json`);
            linesByPath[outpath] =`${linesByPath[outpath] || ""}${line}\n`;

            if(lineCounter > BUFFER_SIZE) {
                appendToFiles(linesByPath);
                Object.keys(linesByPath).forEach(filepath => paths.add(filepath));
                linesByPath = {};
                lineCounter = 0;
            } else {
                lineCounter++;
            }
        });

        lineReader.on("close", (line) => {
            appendToFiles(linesByPath);
            Object.keys(linesByPath).forEach(filepath => paths.add(filepath));
            resolve([...paths]);
        });
    });
}

module.exports = splitDat;
