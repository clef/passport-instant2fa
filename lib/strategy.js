var passport = require('passport-strategy');
var util = require('util');
var Instant2FA = require('instant2fa');


function Strategy(options, distinctIDGetter) {
  passport.Strategy.call(this);
  this.instant2fa = new Instant2FA({
    accessKey: options.accessKey,
    accessSecret: options.accessSecret,
    apiURL: options.apiURL
  });
  this.verificationRoute = options.verificationRoute;
  this._distinctIDGetter = distinctIDGetter;
  this.name = 'instant2fa';
}

util.inherits(Strategy, passport.Strategy);


Strategy.prototype.getDistinctID = function(req, user, callback) {
  if (req.session.instant2fa.distinctID) {
    callback(null, req.session.instant2fa.distinctID);
  } else {
    return this._distinctIDGetter(user, callback)
  }
}


Strategy.prototype.authenticate = function(req, options) {
  var user = req.user || options.user;
  if (!req.session.instant2fa) {
    req.session.instant2fa = {};
  }
  if (!req.instant2fa) {
    req.instant2fa = {};
  }

  if (req.session.instant2fa.inProgress && req.body.instant2faToken) {
    return this.confirmVerification(req, options);
  } else if (user && options.action == "settings") {
    return this.createSettings(req, options);
  } else {
    return this.createVerification(req, options);
  }
}

Strategy.prototype.confirmVerification = function(req, options) {
  if (!req.session.instant2fa.inProgress) {
    return this.fail("Please log in before doing two-factor verification.");
  }

  var token = req.body.instant2faToken;

  var self = this;
  function confirm(user) {
    self.getDistinctID(req, user, function(err, distinctID) {
      delete req.session.instant2fa;
      if (err) { return self.error(err); }

      self.instant2fa.confirmVerification({
        distinctID: distinctID, 
        token: token
      }).then(function(verificationSucceeded) {
        return self.success(user);
      }).catch(function(err) {
        return self.fail(err.message);
      });
    });
  }

  var user = req.user || options.user;
  if (!user && req.session.instant2fa.user) {
    req._passport.instance.deserializeUser(req.session.instant2fa.user, req, function(err, user) {
      confirm(user);
    });
  } else {
    confirm(user);
  }
}


Strategy.prototype.createVerification = function(req, options) {
  var self = this;

  if (req.session.instant2fa.inProgress && req.session.instant2fa.hostedPageURL) {
    return this.success(false, { url: req.session.instant2fa.hostedPageURL });
  }

  var user = req.user || options.user;
  var verificationRoute = this.verificationRoute || options.verificationRoute;


  if (!user) {
    return this.error(new Error("Please log in before doing two-factor verification"));
  }


  this.getDistinctID(req, user, function(err, distinctID) {
    if (err) { return self.error(err); }

    self.instant2fa.createVerification({
      distinctID: distinctID
    }).then(function(url) {
      if (req.user) {
          req.logout();
      }

      req._passport.instance.serializeUser(user, function(err, obj) {
        req.session.instant2fa.user = obj;
        req.session.instant2fa.inProgress = true;
        req.session.instant2fa.hostedPageURL = url;
        req.session.instant2fa.distinctID = distinctID;

        if (verificationRoute) {
            self.redirect(verificationRoute);
        } else {
            self.success(false, "User needs to do 2FA verification");
        }
      });
    }).catch(function(err) {
      if (err.name == "MFANotEnabled") {
        self.success(user);
      } else {
        self.error(err);
      }
    });
  });
}


Strategy.prototype.createSettings = function(req, options) {
  var user = req.user || options.user;

  var self = this;
  this.getDistinctID(req, user, function(err, distinctID) {
    if (err) { return self.error(err); }

    self.instant2fa.createSettings({
      distinctID: distinctID
    }).then(function(url) {
      req.instant2fa.hostedPageURL = url;
      self.success(user, { url: url });
    }).catch(function(err) {
      self.error(err);
    });
  });
}

/**
 * Expose `Strategy`.
 */ 
module.exports = Strategy;
