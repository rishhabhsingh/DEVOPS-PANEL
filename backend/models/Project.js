const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({

  // Which user owns this project
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // GitHub repo details
  repoName: { type: String, required: true },      // "my-app"
  repoFullName: { type: String, required: true },  // "abhimanyu/my-app"
  branch: { type: String, default: 'main' },

  // The live URL assigned to this project
  // e.g. "my-app-abc123.yourdomain.com"
  subdomain: { type: String, unique: true },

  // Which port on the server this project's container runs on
  // e.g. 3001, 3002, 3003...
  port: { type: Number },

  // Environment variables — stored encrypted, array of key-value pairs
  envVars: [{
    key: String,
    value: String  // Always encrypted before saving
  }],

  // Current state of the project
  status: {
    type: String,
    enum: ['idle', 'deploying', 'running', 'failed', 'stopped'],
    default: 'idle'
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }

});

module.exports = mongoose.model('Project', projectSchema);