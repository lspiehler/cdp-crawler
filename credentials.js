var snmp = require ("net-snmp");

var credentials = {
    snmp: [
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
                authKey: "mysnmpauthkey",
                privProtocol: snmp.PrivProtocols.aes256r,
                privKey: "mysnmpprivkey"
            }
        },
        {
            version: 2,
            community: "public"
        }
    ],
    ssh: [
        {
            username: 'mysshusername',
            password: 'mysshpassword'
        }
    ]
}

module.exports = credentials;