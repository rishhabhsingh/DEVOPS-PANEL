const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({

  // Basic info we get from GitHub
  githubId: {
    type: String,
    required: true,
    unique: true  // No duplicate accounts
  },
  username: String,
  email: String,
  avatarUrl: String,

  // GitHub access token — stored encrypted, NEVER plaintext
  // This token lets us clone their repos and call GitHub API
  githubAccessToken: {
    type: String,
    required: true
  },

  createdAt: {
    type: Date,
    default: Date.now
  }

});

module.exports = mongoose.model('User', userSchema);