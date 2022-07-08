let normalizeName = function(name) {
    let splitname = name.split('.')
    let newname = splitname[0].toUpperCase();
    if(newname == '') {
        console.log(name)
    }
    return newname;
}

module.exports = {
    normalizeName: function(name) {
        return normalizeName(name);
    }
}