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

function getBoolean(str) {
	if(str) {
		if(str.toUpperCase()=='TRUE') {
			return true;
		} else if(str.toUpperCase()=='FALSE') {
			return false;
		} else {
			return str;
		}
	} else {
		return false;
	}
}

module.exports = {
    seeds: parseArray(process.env.SEEDS) || [],
    exclusions: parseArray(process.env.PLATFORMEXCLUSIONS) || [],
    getexcluded: getBoolean(process.env.GETEXCLUDED) || false,
    tacacsuser: process.env.TACACSUSER || false
}