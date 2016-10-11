function parseDate(dateString) {
    if(!dateString || dateString.length !== 8) return null;
        return new Date(
            dateString.substring(0,4)+"-"+
            dateString.substring(4,6)+"-"+
            dateString.substring(6,8)
        ).toISOString();
}

module.exports = parseDate;
