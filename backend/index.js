const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const { router: repoRoutes } = require('./routes/repos');
const deployRoutes = require('./routes/deploy');

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling']
});

app.set('io', io);

app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
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

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('watch:deployment', (deploymentId) => {
    socket.join(`deployment:${deploymentId}`);
    console.log(`Client watching deployment: ${deploymentId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const start = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');
    httpServer.listen(process.env.PORT || 4000, () => {
      console.log(`Backend running on port ${process.env.PORT || 4000}`);
    });
  } catch (err) {
    console.error('Startup failed:', err.message);
    process.exit(1);
  }
};

start();