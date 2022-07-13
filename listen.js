const express = require('express');
const { engine } = require('express-handlebars');
const routes = require('./routes/routes');

const app = express();

app.engine('hbs', engine({extname: 'hbs'}));
app.set('view engine', 'hbs');
app.set('views', './views');

app.use(express.json());
//app.use(express.urlencoded({ extended: false }));
//app.use(cookieParser());
app.use(express.static('public'));

//app.use(requestIp.mw())

app.use('/', routes);

app.listen(3000);