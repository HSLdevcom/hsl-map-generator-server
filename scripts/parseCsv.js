var fs = require('fs')

function parseLine(line, fields) {
    const parts = line.split(";")
    let stop = {};

    fields.forEach(([index, key]) => stop[key] = parts[index])
  
    return stop;
}

function parseCsv(file, fields) {
    const records = [];

    return new Promise((resolve) => { 
        fs.readFileSync(file).toString().split("\n").forEach(line => {
          records.push(parseLine(line, fields));
        });
        resolve(records);
    })
}

module.exports = parseCsv;
