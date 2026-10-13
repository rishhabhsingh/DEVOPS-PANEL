const mongoose = require('mongoose');

const deploymentSchema = new mongoose.Schema({

  // Which project this deployment belongs to
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },

  // Which user triggered this deployment
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // The Docker image tag for this specific deployment
  // e.g. "devops-panel-my-app-abc123:v3"
  // THIS is what makes rollback possible
  // We keep old images so we can re-run them anytime
  imageTag: { type: String },

  // Which git commit was deployed
  commitHash: { type: String },

  // Deployment number — v1, v2, v3...
  version: { type: Number, required: true },

  // What happened during this deployment
  status: {
    type: String,
    enum: ['queued', 'building', 'running', 'failed', 'rolled_back'],
    default: 'queued'
  },

  // Build logs saved for later viewing
  logs: [{ type: String }],

  // If this deployment failed, store the error
  errorMessage: { type: String },

  // Port this deployment's container is running on
  port: { type: Number },

  createdAt: { type: Date, default: Date.now },

});

module.exports = mongoose.model('Deployment', deploymentSchema);