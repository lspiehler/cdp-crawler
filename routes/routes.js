const adhoc_scan = require('../lib/adhoc_scan');
const router = require('express').Router();
const config = require('../config');

router.get('/', (req, res, next) => {
	//res.status(200).send('You\'re logged in ' + JSON.stringify(req.user) + '<button onclick="window.location = \'/auth/logout\'">Logout</button>');
	//res.render('admin/admin-dashboard', { layout: 'admin', user: req.user });
    let tacacsuser;
    if(typeof config.tacacsuser=='string') {
        tacacsuser = "\"" + config.tacacsuser.toLowerCase() + "\""
    } else {
        tacacsuser = config.tacacsuser;
    }
	res.render('home', {tacacsuser: tacacsuser});
});

router.get('/adhoc_scan/:host', (req, res, next) => {
	//res.status(200).send('You\'re logged in ' + JSON.stringify(req.user) + '<button onclick="window.location = \'/auth/logout\'">Logout</button>');
	//res.render('admin/admin-dashboard', { layout: 'admin', user: req.user });
    let adhoc = new adhoc_scan();
    adhoc.scan({host: req.params.host}, function(err, result) {
        res.json(result);
    });
});

router.post('/adhoc_scan', (req, res, next) => {
    //console.log(req.body);
	//res.status(200).send('You\'re logged in ' + JSON.stringify(req.user) + '<button onclick="window.location = \'/auth/logout\'">Logout</button>');
	//res.render('admin/admin-dashboard', { layout: 'admin', user: req.user });
    let adhoc = new adhoc_scan();
    adhoc.scan({host: req.body.host}, function(err, result) {
        res.json(result);
    });
});

module.exports = router;