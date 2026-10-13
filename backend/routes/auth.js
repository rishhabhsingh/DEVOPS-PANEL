const express = require('express');
const router = express.Router();
const axios = require('axios');
const jwt = require('jsonwebtoken');
const CryptoJS = require('crypto-js');
const User = require('../models/User');
require('dotenv').config();

// Helper: encrypt GitHub token before saving to MongoDB
// Never store sensitive tokens in plaintext
const encrypt = (text) => {
  return CryptoJS.AES.encrypt(text, process.env.ENCRYPTION_KEY).toString();
};

// Helper: decrypt when we need to use the token
const decrypt = (ciphertext) => {
  const bytes = CryptoJS.AES.decrypt(ciphertext, process.env.ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};

// STEP 1: User clicks "Login with GitHub"
// We redirect them to GitHub's authorization page
router.get('/github', (req, res) => {
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&scope=repo,user`;
  // scope=repo means we can see and clone their repos
  // scope=user means we can read their profile
  res.redirect(githubAuthUrl);
});

// STEP 2: GitHub redirects back here after user clicks "Allow"
// GitHub attaches a temporary code in the URL: /auth/github/callback?code=xyz
router.get('/github/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'No code received from GitHub' });
  }

  try {
    // STEP 3: Exchange the temporary code for a real access token
    // This happens server-to-server — browser never sees this request
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code
      },
      { headers: { Accept: 'application/json' } }
    );

    const githubAccessToken = tokenResponse.data.access_token;

    if (!githubAccessToken) {
      return res.status(400).json({ error: 'Failed to get access token from GitHub' });
    }

    // STEP 4: Use the access token to fetch the user's GitHub profile
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${githubAccessToken}` }
    });

    const githubUser = userResponse.data;

    // STEP 5: Find or create user in our MongoDB
    // If they've logged in before, update their token
    // If they're new, create a new record
    let user = await User.findOne({ githubId: String(githubUser.id) });

    if (user) {
      // Existing user — update their token in case it changed
      user.githubAccessToken = encrypt(githubAccessToken);
      await user.save();
    } else {
      // New user — create record with encrypted token
      user = await User.create({
        githubId: String(githubUser.id),
        username: githubUser.login,
        email: githubUser.email,
        avatarUrl: githubUser.avatar_url,
        githubAccessToken: encrypt(githubAccessToken)
      });
    }

    // STEP 6: Create OUR OWN JWT with just the user's MongoDB ID
    // This is what the frontend will use for all future requests
    const jwtToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // STEP 7: Send JWT as httpOnly cookie — JavaScript cannot read this
    // This protects against XSS attacks
    res.cookie('token', jwtToken, {
      httpOnly: true,    // JS cannot access this cookie
      secure: false,     // Set to true in production with HTTPS
      sameSite: 'lax',  // Protects against CSRF
      maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days in milliseconds
    });

    // Redirect to frontend dashboard
    res.redirect(process.env.FRONTEND_URL + '/dashboard');

  } catch (err) {
    console.error('OAuth error:', err.message);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Get currently logged in user
// Frontend calls this to check if the user is authenticated
router.get('/me', async (req, res) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-githubAccessToken');
    // .select('-githubAccessToken') means don't send the token to frontend

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Logout — just clear the cookie
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;