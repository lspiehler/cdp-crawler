var table;
function httpRequest(params, callback) {
    //console.log(params);
    var request = new XMLHttpRequest();
    request.open(params.options.method, params.options.path, true);
    if(params.options.headers) {
        let headerkeys = Object.keys(params.options.headers);
        for(let i = 0; i <= headerkeys.length - 1; i++) {
            request.setRequestHeader(headerkeys[i], params.options.headers[headerkeys]);
        }
    }
    
    request.onload = function() {
        //if (request.status >= 200 && request.status < 301) {
        if(request.status == 401) {
            var resp = {
                id: params.id,
                options: params.options,
                statusCode: request.status,
                body: request.responseText
            }
            callback('401', resp);
        } else {
            try {
                var resp = {
                    statusCode: request.status,
                    body: JSON.parse(request.responseText)
                }
                callback(null, resp);
            } catch(e) {
                console.log('caught this error');
                var resp = {
                    id: params.id,
                    options: params.options,
                    statusCode: request.status,
                    body: request.responseText
                }
                callback(e, resp);
            }
        }
    };

    request.onerror = function(e) {
        callback(e, null);
        return;
        // There was a connection error of some sort
    };

    if(params.options.method=='POST') {
        request.send(JSON.stringify(params.body));
    } else {
        request.send();
    }
}

function queryDevice(e) {
    e.preventDefault();
    let div = document.getElementById('result');
    div.innerHTML = '';
    //console.log(e.target);
    var data = new FormData(e.target);
    e.submitter.disabled = true;
    const formProps = Object.fromEntries(data);

    //console.log(formProps);

    let options = {
        path: '/adhoc_scan',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    }

    let body = {
        host: formProps.host
    }

    httpRequest({options: options, body: body}, function(err, resp) {
        e.submitter.disabled = false;
        if(err) {
            if(err=='401') {
                alert('You are no longer logged in!');
            } else {
                console.log(err);
            }
            //callback(err, resp);
        } else {
            //callback(false, resp);
            //console.log(resp);
            /*let ssh;
            let snmp;
            if(resp.body.ssh.error) {
                ssh = resp.body.ssh.error.message;
            } else {
                ssh = 'Successfully connected';
            }
            if(snmp) {
                snmp = 'Successfully connected to ' + snmp
            } else {
                snmp = 'SNMP failed';
            }
            buildTable([{
                ssh: ssh,
                snmp: snmp,
                host: formProps.host
            }]);*/
            showResults({
                resp: resp,
                host: formProps.host
            });
        }
    });
}

function showResults(results) {
    console.log(results);
    let div = document.getElementById('result');
    div.innerHTML = '';

    let span = document.createElement('span'); 
    let spana = document.createElement('span'); 
    let i = document.createElement('i');
    span.style.display = 'block';
    if(results.resp.body.snmp.error===false && results.resp.body.ssh.error===false) {
        if(tacacsuser && results.resp.body.ssh.username.toLowerCase()!=tacacsuser) {
            i.className = "fa fa-exclamation-circle";
            i.style.color = 'orange';
            spana.innerHTML = "&nbsp;" + results.host + " passed all tests, but TACACS is either not set up or not working properly"
        } else { 
            i.className = "fa fa-check-circle";
            i.style.color = 'green';
            spana.innerHTML = "&nbsp;" + results.host + " passed all tests"
        }
    } else {
        i.className = "fa fa-times-circle";
        i.style.color = 'red';
        spana.innerHTML = "&nbsp;" + results.host + " failed one or more tests"
    }
    span.appendChild(i);
    span.appendChild(spana);
    div.appendChild(span);

    let span1 = document.createElement('span'); 
    let span1a = document.createElement('span'); 
    let i1 = document.createElement('i');
    span1.style.display = 'block';
    if(results.resp.body.snmp.error) { 
        i1.className = "fa fa-times-circle";
        i1.style.color = 'red';
        span1a.innerHTML = "&nbsp;" + "SNMP Failed"
    } else {
        i1.className = "fa fa-check-circle";
        i1.style.color = 'green';
        span1a.innerHTML = "&nbsp; Successful SNMP response from " + results.resp.body.snmp.hostname + " using SNMPv" + results.resp.body.snmp.version;
    }
    span1.appendChild(i1);
    span1.appendChild(span1a);
    div.appendChild(span1);

    let span2 = document.createElement('span'); 
    let span2a = document.createElement('span'); 
    let i2 = document.createElement('i');
    span2.style.display = 'block';
    if(results.resp.body.ssh.error) { 
        i2.className = "fa fa-times-circle";
        i2.style.color = 'red';
        span2a.innerHTML = "&nbsp;" + "SSH Error: " + results.resp.body.ssh.error.message
    } else {
        if(tacacsuser && results.resp.body.ssh.username.toLowerCase()!=tacacsuser) {
            i2.className = "fa fa-exclamation-circle";
            i2.style.color = 'orange';
            span2a.innerHTML = "&nbsp; Successful SSH connection using " + results.resp.body.ssh.username + " (No TACACS)";
        } else {
            i2.className = "fa fa-check-circle";
            i2.style.color = 'green';
            span2a.innerHTML = "&nbsp; Successful SSH connection using " + results.resp.body.ssh.username;
        }
    }
    span2.appendChild(i2);
    span2.appendChild(span2a);
    div.appendChild(span2);
}

function buildTable(results) {
    if(table) {
        table.innerHtml = '';
    } else {
        table = document.createElement('table');
        document.body.appendChild(table);
    }
    let headerRow = document.createElement('tr');
    //let headers = Object.keys(results[0]);
    let headers = ['host', 'snmp', 'ssh'];
    headers.forEach(headerText => {
        let header = document.createElement('th');
        let textNode = document.createTextNode(headerText);
        header.appendChild(textNode);
        headerRow.appendChild(header);
    });
    table.appendChild(headerRow);
    results.forEach(emp => {
        let row = document.createElement('tr');
        Object.values(emp).forEach(text => {
            let cell = document.createElement('td');
            let textNode = document.createTextNode(text);
            cell.appendChild(textNode);
            row.appendChild(cell);
        })
        table.appendChild(row);
    });
}