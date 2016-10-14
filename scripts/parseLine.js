
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

module.exports = parseLine;
