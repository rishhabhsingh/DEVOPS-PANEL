const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const { router: repoRoutes } = require('./routes/repos');
const deployRoutes = require('./routes/deploy');

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

app.use('/auth', authRoutes);
app.use('/repos', repoRoutes);
app.use('/deploy', deployRoutes);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

const start = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');
    app.listen(process.env.PORT || 4000, () => {
      console.log(`Backend running on port ${process.env.PORT || 4000}`);
    });
  } catch (err) {
    console.error('Startup failed:', err.message);
    process.exit(1);
  }
};

start();