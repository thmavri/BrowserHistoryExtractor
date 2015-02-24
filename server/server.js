// server.js

// set up ======================================================================
// get all the tools we need
var express  = require('express');
var app      = express();
var appcheck = express();
var userrouter = express.Router();
var port     = process.env.PORT || 4000;
var flash    = require('connect-flash');

var morgan       = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser   = require('body-parser');
var session      = require('express-session');



// set up our express application
app.use(morgan('dev')); // log every request to the console
app.use(cookieParser()); // read cookies (needed for auth)
app.use(bodyParser.json()); // get information from html forms
app.use(bodyParser.urlencoded({ extended: true }));

app.set('view engine', 'ejs'); // set up ejs for templating

// required for passport
app.use(session({ secret: 'SCASEbringsRESTtoyou' })); // session secret
app.use(flash()); // use connect-flash for flash messages stored in session

// routes ======================================================================
require('./routes.js')(app); // load our routes and pass in our app and fully configured passport

//check user route
//app.use('/api',userrouter);

// launch ======================================================================
app.listen(port);
console.log('The magic happens on port ' + port);
