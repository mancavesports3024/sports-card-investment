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
  
  // Generate access token (7 days) and refresh token (30 days)
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' });
  const refreshToken = jwt.sign(payload, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '30d' });

  // Redirect to frontend with both tokens as query params
  const redirectUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  res.redirect(`${redirectUrl}/auth-success?token=${accessToken}&refreshToken=${refreshToken}`);
});

// Token refresh endpoint
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token is required'
      });
    }

    // Verify the refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET || 'dev_secret');
    
    // Generate new access token
    const payload = {
      id: decoded.id,
      displayName: decoded.displayName,
      email: decoded.email,
      provider: decoded.provider,
    };
    
    const newAccessToken = jwt.sign(payload, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' });
    
    res.json({
      success: true,
      accessToken: newAccessToken,
      refreshToken: refreshToken, // Return the same refresh token (it's still valid for 30 days)
      message: 'Token refreshed successfully'
    });
    
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid or expired refresh token'
    });
  }
});

// Token validation endpoint (for frontend to check token status)
router.get('/validate', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    
    res.json({
      success: true,
      user: decoded,
      message: 'Token is valid'
    });
    
  } catch (error) {
    console.error('Token validation error:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
});

module.exports = router; 