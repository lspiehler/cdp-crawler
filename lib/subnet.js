var Netmask = require('netmask').Netmask

module.exports = function(snmp) {
    let network;
    var block = new Netmask(snmp.ipAdEntAddr + '/' + snmp.ipAdEntNetMask);
    //console.log(snmp[i]);
    network = {
        ip: snmp.ipAdEntAddr,
        subnet: snmp.ipAdEntNetMask,
        ifIndex: snmp.ipAdEntIfIndex,
        bitmask: block.bitmask,
        network: block.base
    }
    return network;
}