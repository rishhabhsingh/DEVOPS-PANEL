const express = require('express');
const router = express.Router();
const CryptoJS = require('crypto-js');
const Project = require('../models/Project');
const { requireAuth } = require('./repos');
require('dotenv').config();

const encrypt = (text) =>
  CryptoJS.AES.encrypt(text, process.env.ENCRYPTION_KEY).toString();

const decrypt = (ciphertext) => {
  const bytes = CryptoJS.AES.decrypt(ciphertext, process.env.ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};

// GET /envvars/:projectId — get all env vars (keys only, values masked)
router.get('/:projectId', requireAuth, async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.projectId,
      userId: req.user._id
    });

    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Send keys visible, values masked — like GitHub secrets
    const masked = project.envVars.map(ev => ({
      key: ev.key,
      value: '••••••••',
      id: ev._id
    }));

    res.json({ envVars: masked });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /envvars/:projectId — add or update env var
router.post('/:projectId', requireAuth, async (req, res) => {
  const { key, value } = req.body;

  if (!key || !value) {
    return res.status(400).json({ error: 'Key and value required' });
  }

  try {
    const project = await Project.findOne({
      _id: req.params.projectId,
      userId: req.user._id
    });

    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Check if key already exists — update it
    const existing = project.envVars.find(ev => ev.key === key);
    if (existing) {
      existing.value = encrypt(value);
    } else {
      project.envVars.push({ key, value: encrypt(value) });
    }

    await project.save();
    res.json({ message: 'Env var saved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /envvars/:projectId/:key — remove an env var
router.delete('/:projectId/:key', requireAuth, async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.projectId,
      userId: req.user._id
    });

    if (!project) return res.status(404).json({ error: 'Project not found' });

    project.envVars = project.envVars.filter(
      ev => ev.key !== req.params.key
    );

    await project.save();
    res.json({ message: 'Env var deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;