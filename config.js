require('dotenv').config()

var parseArray = function(str) {
    if(str) {
        let parr = str.split(',');
        for(let i = 0; i < parr.length; i++) {
            parr[i] = parr[i].trim();
        }
        return parr;
    } else {
        return [];
    }
}

module.exports = {
    seeds: parseArray(process.env.SEEDS) || [],
    exclusions: parseArray(process.env.PLATFORMEXCLUSIONS) || []
}