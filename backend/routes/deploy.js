const express = require('express');
const router = express.Router();
const { Queue } = require('bullmq');
const CryptoJS = require('crypto-js');
const Project = require('../models/Project');
const Deployment = require('../models/Deployment');
const { requireAuth } = require('./repos');
require('dotenv').config();

// Connect to the same Redis the worker is listening to
const deployQueue = new Queue('deployments', {
  connection: { host: 'localhost', port: 6379 }
});

// Decrypt helper
const decrypt = (ciphertext) => {
  const bytes = CryptoJS.AES.decrypt(ciphertext, process.env.ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};

// Port allocator — finds a free port for the new container
// Starts at 4001 and goes up
const getNextPort = async () => {
  const lastProject = await Project.findOne({ port: { $exists: true } })
    .sort({ port: -1 });
  return lastProject ? lastProject.port + 1 : 4001;
};

// POST /deploy — trigger a new deployment
router.post('/', requireAuth, async (req, res) => {
  const { repoFullName, repoName, branch = 'main' } = req.body;

  if (!repoFullName || !repoName) {
    return res.status(400).json({ error: 'repoFullName and repoName are required' });
  }

  try {
    // Find or create the project in MongoDB
    let project = await Project.findOne({
      userId: req.user._id,
      repoFullName
    });

    if (!project) {
      // First deployment — create the project
      const port = await getNextPort();
      const subdomain = `${repoName.toLowerCase()}-${Date.now()}`;

      project = await Project.create({
        userId: req.user._id,
        repoName,
        repoFullName,
        branch,
        port,
        subdomain,
        status: 'deploying'
      });
    } else {
      project.status = 'deploying';
      await project.save();
    }

    // Count existing deployments to get version number
    const deploymentCount = await Deployment.countDocuments({
      projectId: project._id
    });

    // Create deployment record in MongoDB
    const deployment = await Deployment.create({
      projectId: project._id,
      userId: req.user._id,
      version: deploymentCount + 1,
      status: 'queued'
    });

    // Decrypt GitHub token to pass to worker
    const githubToken = decrypt(req.user.githubAccessToken);

    // Add job to BullMQ queue
    // Worker picks this up automatically
    await deployQueue.add('deploy', {
      deploymentId: deployment._id.toString(),
      projectId: project._id.toString(),
      repoFullName,
      branch,
      githubToken,
      port: project.port,
      envVars: project.envVars || []
    });

    // Respond immediately — don't wait for Docker build
    res.json({
      message: 'Deployment queued',
      deploymentId: deployment._id,
      projectId: project._id,
      version: deployment.version,
      status: 'queued'
    });

  } catch (err) {
    console.error('Deploy error:', err.message);
    res.status(500).json({ error: 'Failed to queue deployment' });
  }
});

// GET /deploy/:projectId/history — get all deployments for a project
router.get('/:projectId/history', requireAuth, async (req, res) => {
  try {
    const deployments = await Deployment.find({
      projectId: req.params.projectId,
      userId: req.user._id
    }).sort({ createdAt: -1 });

    res.json({ deployments });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

module.exports = router;