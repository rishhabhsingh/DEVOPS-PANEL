const express = require('express');
const router = express.Router();
const { Queue } = require('bullmq');
const IORedis = require('ioredis');
const CryptoJS = require('crypto-js');
const Project = require('../models/Project');
const Deployment = require('../models/Deployment');
const { requireAuth } = require('./repos');
require('dotenv').config();

const deployQueue = new Queue('deployments', {
  connection: { host: '127.0.0.1', port: 6379 }
});

const decrypt = (ciphertext) => {
  const bytes = CryptoJS.AES.decrypt(ciphertext, process.env.ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};

const getNextPort = async () => {
  const lastProject = await Project.findOne({ port: { $exists: true } })
    .sort({ port: -1 });
  return lastProject ? lastProject.port + 1 : 4001;
};

router.post('/', requireAuth, async (req, res) => {
  const { repoFullName, repoName, branch = 'main' } = req.body;

  if (!repoFullName || !repoName) {
    return res.status(400).json({ error: 'repoFullName and repoName are required' });
  }

  try {
    let project = await Project.findOne({
      userId: req.user._id,
      repoFullName
    });

    if (!project) {
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

    const deploymentCount = await Deployment.countDocuments({
      projectId: project._id
    });

    const deployment = await Deployment.create({
      projectId: project._id,
      userId: req.user._id,
      version: deploymentCount + 1,
      status: 'queued'
    });

    const githubToken = decrypt(req.user.githubAccessToken);
    const io = req.app.get('io');
    const deploymentIdStr = deployment._id.toString();

    // Set up Redis subscriber BEFORE adding job to queue
    // So we don't miss any early log messages
    const subscriber = new IORedis({ host: '127.0.0.1', port: 6379 });

    subscriber.subscribe(`logs:${deploymentIdStr}`, (err) => {
      if (err) {
        console.error('Subscribe error:', err.message);
      } else {
        console.log(`Subscribed to logs:${deploymentIdStr}`);
      }
    });

    subscriber.on('message', (channel, message) => {
      try {
        const data = JSON.parse(message);
        console.log(`Emitting log to room: deployment:${deploymentIdStr}`);
        io.to(`deployment:${deploymentIdStr}`).emit('log', data);

        if (data.type === 'done' || data.type === 'error') {
          subscriber.unsubscribe();
          subscriber.quit();
        }
      } catch (e) {
        console.error('Log parse error:', e.message);
      }
    });

    // Add job AFTER subscriber is ready
    await deployQueue.add('deploy', {
      deploymentId: deploymentIdStr,
      projectId: project._id.toString(),
      repoFullName,
      branch,
      githubToken,
      port: project.port,
      envVars: project.envVars || []
    });

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

router.post('/rollback', requireAuth, async (req, res) => {
  const { deploymentId } = req.body;

  try {
    const deployment = await Deployment.findById(deploymentId);

    if (!deployment) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    if (deployment.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const project = await Project.findById(deployment.projectId);

    await deployQueue.add('rollback', {
      deploymentId: deployment._id.toString(),
      projectId: project._id.toString(),
      imageTag: deployment.imageTag,
      port: project.port,
      envVars: project.envVars || []
    });

    res.json({
      message: 'Rollback queued',
      targetVersion: deployment.version
    });

  } catch (err) {
    console.error('Rollback error:', err.message);
    res.status(500).json({ error: 'Failed to queue rollback' });
  }
});

module.exports = router;