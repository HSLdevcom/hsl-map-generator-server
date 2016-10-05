var fs = require('fs')

function parseLine(line, fields) {
    const parts = line.split(";")
    let stop = {};

    fields.forEach(([ids, key, separator]) => {
        if(typeof(ids) === "object") {
            stop[key] = ids.map((id) => {
                return parts[id];
            })
            .reduce((pre,cur) => {
                return pre+separator+cur;
            })
        } else stop[key] = parts[ids];
    })
    
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
