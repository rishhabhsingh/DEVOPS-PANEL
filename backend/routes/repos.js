const express = require('express');
const router = express.Router();
const axios = require('axios');
const jwt = require('jsonwebtoken');
const CryptoJS = require('crypto-js');
const User = require('../models/User');
require('dotenv').config();

// Decrypt helper — same as in auth.js
const decrypt = (ciphertext) => {
  const bytes = CryptoJS.AES.decrypt(ciphertext, process.env.ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};

// Middleware — protect routes that need login
// This runs BEFORE the route handler
// Think of it like a security guard at the door
const requireAuth = async (req, res, next) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({ error: 'Login required' });
    }

    // Verify the JWT is valid and not expired
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user to request so route handlers can use it
    req.user = await User.findById(decoded.userId);

    if (!req.user) {
      return res.status(401).json({ error: 'User not found' });
    }

    next(); // User is authenticated, continue to route handler

  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// GET /repos — fetch all repos for logged in user
router.get('/', requireAuth, async (req, res) => {
  try {
    // Decrypt the GitHub token stored in MongoDB
    const githubToken = decrypt(req.user.githubAccessToken);

    // Call GitHub API to get user's repos
    // GitHub returns max 100 per page — enough for now
    const response = await axios.get('https://api.github.com/user/repos', {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github.v3+json'
      },
      params: {
        sort: 'updated',     // Most recently updated first
        per_page: 100,
        visibility: 'all'    // Public AND private repos
      }
    });

    // Only send what the frontend needs
    // Never send the full GitHub response — it has 50+ fields
    const repos = response.data.map(repo => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,        // e.g. "abhimanyu/my-app"
      description: repo.description,
      language: repo.language,          // "JavaScript", "Python" etc
      isPrivate: repo.private,
      defaultBranch: repo.default_branch, // usually "main" or "master"
      updatedAt: repo.updated_at,
      url: repo.html_url
    }));

    res.json({ repos });

  } catch (err) {
    console.error('Repo fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch repositories' });
  }
});

module.exports = { router, requireAuth };