const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const router = express.Router();

// Configure Passport with Google OAuth (only if credentials are provided)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
  }, (accessToken, refreshToken, profile, done) => {
    // Here you would look up or create the user in your DB
    // For now, just pass the profile
    return done(null, profile);
  }));
  console.log('🔐 Google OAuth strategy configured');
} else {
  console.log('⚠️  Google OAuth credentials not found - authentication will not work');
}

// Serialize/deserialize user (not used for JWT, but required by passport)
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// Start Google OAuth login
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
}));

// Google OAuth callback
router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => {
  // Issue a JWT
  const user = req.user;
  const payload = {
    id: user.id,
    displayName: user.displayName,
    email: user.emails && user.emails[0] ? user.emails[0].value : undefined,
    provider: user.provider,
  };
  const token = jwt.sign(payload, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' });

  // Redirect to frontend with token as query param (or send as JSON for API clients)
  const redirectUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  res.redirect(`${redirectUrl}/auth-success?token=${token}`);
});

module.exports = router; 