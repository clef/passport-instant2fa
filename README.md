# Passport-Instant2FA

[Passport](http://passportjs.org/) strategy for two-factor authentication using
Instant2FA.

This module lets you add two-factor authentication using Instant2FA.  
By plugging into Passport, TOTP two-factor authentication can be
easily and unobtrusively integrated into any application or framework that
supports [Connect](http://www.senchalabs.org/connect/)-style middleware,
including [Express](http://expressjs.com/).  


## Install

    $ npm install passport-instant2fa

## Usage

#### Configure Strategy

```javascript
passport.use(new Instant2FAStrategy({
    accessKey: process.env.INSTANT2FA_ACCESS_KEY,
    accessSecret: process.env.INSTANT2FA_ACCESS_SECRET,
  },
  function(user, done) {
    // function that supplies distinctID to done callback
    return done(null, user.id);
  }
));
```

You need to provide options with `accessKey` and `accessSecret`. You also need to provide a function that takes a user and callback and provides the callback with a `distinct ID`. For more information about distinct ID, see our [docs](http://docs.instant2fa.com/docs#section-embedding-the-settings-page).


#### Authenticate Requests

Unlike many passport strategies, two-factor must be supplied on top of an existing strategy. Here's what that looks like: 

```javacript
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
```

First we authenticate using another strategy (local). Then, we authenticate using the `instant2fa` strategy, passing in the `user` as an option. 

If a user is returned, then the user does not have 2FA enabled and should be logged in as normal. 

If a user is *not* returned, then we need to redirect and finish the two-factor flow.

Now, let's look at `/verify`: 

```javascript
app.get('/verify', function(req, res, next) {
  passport.authenticate('instant2fa', function(err, user, info) {
    if (err) {
      res.redirect('login');
    } else {
      res.render('verify', { url: info.url });
    }
  })(req, res, next);
});
```

We call the `instant2fa` strategy and then render a template. You'll note that we pass the `info.url` parameter into the template. `info.url` points to a hosted 2FA verification page that lets the user enter two-factor codes.

To load that page, add this to the `verify` template: 

```
<form action="/verify" method="POST">
    <script
        class="instant2fa-page"
        src="https://js.instant2fa.com/hosted.js"
        data-uri="<%= url %>"
    ></script>
</form>
```

When the user completes two-factor, this form will be submitted automatically. Let's handle it on the backend:

```javascript
app.post('/verify', 
  passport.authenticate('instant2fa', { failureRedirect: '/login', failureFlash: true }),
  function(req, res) {
    res.redirect('/account');
  });
```

With that, we've established a valid session for a user with two-factor enabled.

#### Show 2FA Settings

Let's embed Instant2FA's hosted settings into a user settings page: 

```javascript
app.get('/account', ensureLoggedIn(), function(req, res, next){
  passport.authenticate('instant2fa', { action: "settings" }, function(err, user, info) {
    if (err) { return next(err); }
    res.render('account', { user: req.user, url: info.url });
  })(req, res, next);
});
```

We call the `instant2fa` strategy with `{ action: "settings"}` and then pass the URL that it gives us into a template to render. 

In the template, we can render the hosted settings like so: 

```
<h3>2FA settings</h3>
<script
    class="instant2fa-page"
    src="https://js.instant2fa.com/hosted.js"
    data-uri="<%= url %>"
></script>
```

## Examples

For a complete, working example, refer to the [instant2fa example](https://github.com/clef/passport-instant2fa/tree/master/examples/instant2fa).

## Tests

    $ npm install
    $ make test
