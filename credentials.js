var snmp = require ("net-snmp");

var credentials = [
    {
        version: 3,
        options: {
            port: 161,
            retries: 1,
            timeout: 5000,
            transport: "udp4",
            trapPort: 162,
            version: snmp.Version3,
            engineID: "8000B98380XXXXXXXXXXXXXXXXXXXXXXXX", // where the X's are random hex digits
            backwardsGetNexts: true,
            reportOidMismatchErrors: false,
            idBitsSize: 32,
            context: ""
        },
        user: {
            name: "mysnmpuser",
            level: snmp.SecurityLevel.authPriv,
            authProtocol: snmp.AuthProtocols.sha,
            authKey: "myauthkey",
            privProtocol: snmp.PrivProtocols.aes256r,
            privKey: "myprivkey"
        }
    },
    {
        version: 2,
        community: "public"
    }
]

module.exports = credentials;