const fs = require("fs");
var path = require("path");
var readline = require("readline");
var iconv = require("iconv-lite");

function isUnique(newRecord, primaryRecords) {
    const id = newRecord.substring(0,7).trim();
    for(let primaryRecord in primaryRecords) {
        const primaryId = primaryRecords[primaryRecord];
        if (primaryId === id) {
            return false; 
        }
    };
    return true;
}

function parseLine(line, fields, srcKey) {
    const stop = {};
    let index = 1;
    fields.forEach(([length, key, isNumeric]) => {
        if(key) {
            const value = line.substring(index, index + length).trim();
            stop[key] = isNumeric ? parseFloat(value) : value;
        }
        index = index + length;
    });
    stop.source = srcKey;
    return stop;   
}

function parseFile(resolve, filename, records, fields, srcKey, primaryRecords) {
    const lineReader = readline.createInterface({
        input: fs.createReadStream(filename)
            .pipe(iconv.decodeStream("ISO-8859-15"))
    });
    lineReader.on("line", (line) => {
        // If primaryRecords is not recieved, no check for duplicates is done, and the record is always pushed
        if (!primaryRecords || isUnique(line, primaryRecords)) {
            records.push(parseLine(line, fields, srcKey));
        }
    });

    lineReader.on("close", (line) => {
        resolve(records);
    });         
}

function parse(filename, fields, srcKey) {
    const records = [];
    return new Promise((resolve) => {
        parseFile(resolve, filename, records, fields, srcKey, null);
    });
}

function parseRemoveDuplicate(filename, primaryFilename, fields, srcKey) {
    const records = [];
    const primaryRecords = [];
    return new Promise((resolve) => {
        const srcLineReader = readline.createInterface({
            input: fs.createReadStream(primaryFilename)
                .pipe(iconv.decodeStream("ISO-8859-15"))
        });

        srcLineReader.on('line', function (line) {
            primaryRecords.push(line.substring(0,7).trim());
        });

        srcLineReader.on("close", (srcLine) => {
            parseFile(resolve, filename, records, fields, srcKey, primaryRecords);
        });
    });
}

module.exports = { parse, parseRemoveDuplicate };
