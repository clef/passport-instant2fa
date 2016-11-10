var express = require('express')
  , flash = require('connect-flash')
  , loggedin = require('connect-ensure-login')
  , base32 = require('thirty-two')
  , utils = require('./utils')
  , passport = require('passport')
  , LocalStrategy = require('passport-local').Strategy
  , Instant2FAStrategy = require('../..').Strategy
  

var users = [
    { id: 1, username: 'bob', password: 'secret', email: 'bob@example.com' }
  , { id: 2, username: 'joe', password: 'birthday', email: 'joe@example.com' }
];

function findById(id, fn) {
  var idx = id - 1;
  if (users[idx]) {
    fn(null, users[idx]);
  } else {
    fn(new Error('User ' + id + ' does not exist'));
  }
}

function findByUsername(username, fn) {
  for (var i = 0, len = users.length; i < len; i++) {
    var user = users[i];
    if (user.username === username) {
      return fn(null, user);
    }
  }
  return fn(null, null);
}

// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.
passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  findById(id, function (err, user) {
    done(err, user);
  });
});


// Use the LocalStrategy within Passport.
//   Strategies in passport require a `verify` function, which accept
//   credentials (in this case, a username and password), and invoke a callback
//   with a user object.  In the real world, this would query a database;
//   however, in this example we are using a baked-in set of users.
passport.use(new LocalStrategy(function(username, password, done) {
    process.nextTick(function () {
      // Find the user by username.  If there is no user with the given
      // username, or the password is not correct, set the user to `false` to
      // indicate failure and set a flash message.  Otherwise, return the
      // authenticated `user`.
      findByUsername(username, function(err, user) {
        if (err) { return done(err); }
        if (!user) { return done(null, false, { message: 'Invalid username or password' }); }
        if (user.password != password) { return done(null, false, { message: 'Invalid username or password' }); }
        return done(null, user);
      })
    });
  }));

passport.use(new Instant2FAStrategy(
  {
    accessKey: process.env.INSTANT2FA_ACCESS_KEY,
    accessSecret: process.env.INSTANT2FA_ACCESS_SECRET,
  },
  function(user, done) {
    // setup function, supply distinctID to done callback
    return done(null, user.id);
  }
));



var app = express();

// configure Express
app.configure(function() {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.engine('ejs', require('ejs-locals'));
  app.use(express.static(__dirname + '/../../public'));
  app.use(express.logger());
  app.use(express.cookieParser());
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.session({ secret: 'keyboard cat' }));
  app.use(flash());
  // Initialize Passport!  Also use passport.session() middleware, to support
  // persistent login sessions (recommended).
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(app.router);
});


app.get('/', function(req, res){
  res.render('index', { user: req.user });
});

app.get('/account', loggedin.ensureLoggedIn(), function(req, res, next){
  passport.authenticate('instant2fa', { action: "settings" }, function(err, user, info) {
    if (err) { return next(err); }
    res.render('account', { user: req.user, url: info.url });
  })(req, res, next);
});

app.get('/login', function(req, res){
  res.render('login', { user: req.user, message: req.flash('error') });
});

// POST /login
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
//
//   curl -v -d "username=bob&password=secret" http://127.0.0.1:3000/login
app.post('/login', function(req, res, next) {
  passport.authenticate('local', { failureRedirect: '/login', failureFlash: true }, function(err, user, info) {
    passport.authenticate('instant2fa', { user: user }, function(err, user, info) {
      if (err) { return next(err); }
      if (user) {
        req.logIn(user, function(err) {
          if (err) { return next(err); }
          return res.redirect('/account')
        });
      } else {
        return res.redirect('/verify');
      }
    })(req, res, next);
  })(req, res, next);
});

app.get('/verify', function(req, res, next) {
  passport.authenticate('instant2fa', function(err, user, info) {
    if (err) {
      res.redirect('login');
    } else {
      res.render('verify', { url: info.url, message: req.flash('error'), user: req.user });
    }
  })(req, res, next);
});

app.post('/verify', 
  passport.authenticate('instant2fa', { failureRedirect: '/login', failureFlash: true }),
  function(req, res) {
    res.redirect('/account');
  }
);

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

app.listen(3000, function() {
  console.log('Express server listening on port 3000');
});
