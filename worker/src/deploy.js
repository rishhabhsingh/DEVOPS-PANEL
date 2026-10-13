const Docker = require('dockerode');
const simpleGit = require('simple-git');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

// Connect to Docker daemon running on this machine
// The socket file is how Node talks to Docker
// Same as running docker commands in terminal but from code
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// Where we temporarily store cloned repos during build
const CLONE_BASE = '/tmp/devops-builds';

const deployProject = async (job) => {
  const {
    deploymentId,
    projectId,
    repoFullName,   // e.g. "abhimanyu/my-app"
    branch,
    githubToken,    // decrypted GitHub token
    port,           // port assigned to this deployment
    envVars         // array of {key, value} objects
  } = job.data;

  // Helper to emit logs back — we'll connect Socket.io here later
  const log = (message) => {
    console.log(`[${deploymentId}] ${message}`);
    job.log(message); // BullMQ stores logs on the job itself
  };

  // Where we'll clone this specific repo
  const buildDir = path.join(CLONE_BASE, deploymentId);

  try {
    // ── STEP 1: CLONE THE REPO ──────────────────────────────────
    log('Cloning repository...');

    // Create fresh directory for this build
    fs.mkdirSync(buildDir, { recursive: true });

    // Clone using the user's GitHub token for auth
    // The token goes in the URL — standard GitHub pattern
    const cloneUrl = `https://${githubToken}@github.com/${repoFullName}.git`;

    await simpleGit().clone(cloneUrl, buildDir, ['--branch', branch, '--depth', '1']);
    // --depth 1 means only get the latest commit, not full history
    // This makes cloning much faster

    log('Repository cloned successfully');

    // ── STEP 2: AUTO-DETECT PROJECT TYPE + GENERATE DOCKERFILE ──
    log('Detecting project type...');

    const dockerfile = generateDockerfile(buildDir);
    fs.writeFileSync(path.join(buildDir, 'Dockerfile'), dockerfile);

    log(`Dockerfile generated`);

    // ── STEP 3: BUILD DOCKER IMAGE ──────────────────────────────
    // Image tag format: projectId-version
    // We keep old images — this is what makes rollback work
    const imageTag = `devops-panel-${projectId}:${deploymentId}`;

    log(`Building Docker image: ${imageTag}`);

    // docker.buildImage returns a stream of build output
    // We listen to it line by line — this is what users see in real time
    await buildImage(docker, buildDir, imageTag, log);

    log('Image built successfully');

    // ── STEP 4: STOP OLD CONTAINER (if exists) ──────────────────
    log('Stopping previous container if running...');
    await stopOldContainer(docker, projectId, log);

    // ── STEP 5: RUN NEW CONTAINER ────────────────────────────────
    log(`Starting container on port ${port}...`);

    await runContainer(docker, imageTag, projectId, port, envVars, log);

    log(`Deployment complete — running on port ${port}`);

    return { success: true, imageTag, port };

  } catch (err) {
    log(`Deployment failed: ${err.message}`);
    throw err; // Re-throw so BullMQ marks job as failed

  } finally {
    // Always clean up the build directory to save disk space
    // The IMAGE stays (for rollback) but the source code can go
    try {
      fs.rmSync(buildDir, { recursive: true, force: true });
      log('Build directory cleaned up');
    } catch (e) {
      // Don't fail the deployment if cleanup fails
    }
  }
};

// ── DOCKERFILE GENERATOR ─────────────────────────────────────────
// This is what makes your platform smart
// It looks at the repo and decides what kind of app it is
const generateDockerfile = (buildDir) => {
  const files = fs.readdirSync(buildDir);

  // Check for package.json — it's a Node.js app
  if (files.includes('package.json')) {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(buildDir, 'package.json'), 'utf8')
    );

    // Check if it has a start script
    const startScript = pkg.scripts?.start ? 'npm start' : 'node index.js';

    return `FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["${startScript === 'npm start' ? 'npm' : 'node'}", "${startScript === 'npm start' ? 'start' : 'index.js'}"]`;
  }

  // Check for requirements.txt — it's a Python app
  if (files.includes('requirements.txt')) {
    return `FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 3000
CMD ["python", "app.py"]`;
  }

  // Check for index.html — it's a static site
  if (files.includes('index.html')) {
    return `FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]`;
  }

  // Default — try Node
  return `FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install --production
EXPOSE 3000
CMD ["node", "index.js"]`;
};

// ── BUILD IMAGE ──────────────────────────────────────────────────
const buildImage = (docker, buildDir, imageTag, log) => {
  return new Promise((resolve, reject) => {
    docker.buildImage(
      { context: buildDir, src: getAllFiles(buildDir) },
      { t: imageTag },
      (err, stream) => {
        if (err) return reject(err);

        // Listen to the build output stream line by line
        docker.modem.followProgress(stream,
          // onFinish — called when build completes
          (err, output) => {
            if (err) return reject(err);
            resolve(output);
          },
          // onProgress — called for each line of build output
          (event) => {
            if (event.stream) {
              // Strip newlines and empty lines
              const line = event.stream.trim();
              if (line) log(line);
            }
            if (event.error) {
              reject(new Error(event.error));
            }
          }
        );
      }
    );
  });
};

// ── STOP OLD CONTAINER ───────────────────────────────────────────
const stopOldContainer = async (docker, projectId, log) => {
  try {
    // Old containers are named after the projectId
    const container = docker.getContainer(`project-${projectId}`);
    const info = await container.inspect();

    if (info.State.Running) {
      await container.stop();
      log('Previous container stopped');
    }

    await container.remove();
    log('Previous container removed');

  } catch (err) {
    // Container doesn't exist yet — that's fine for first deployment
    if (err.statusCode !== 404) {
      log(`Warning: ${err.message}`);
    }
  }
};

// ── RUN CONTAINER ────────────────────────────────────────────────
const runContainer = async (docker, imageTag, projectId, port, envVars, log) => {
  // Convert env vars array to Docker format: ["KEY=value", "KEY2=value2"]
  const env = envVars.map(({ key, value }) => `${key}=${value}`);

  const container = await docker.createContainer({
    Image: imageTag,
    name: `project-${projectId}`,  // Named so we can find and stop it later
    Env: env,
    ExposedPorts: { '3000/tcp': {} },
    HostConfig: {
      PortBindings: {
        // Map container's port 3000 to host's assigned port
        // This is how "container port 3000" becomes "server port 3001"
        '3000/tcp': [{ HostPort: String(port) }]
      },
      // Memory limit — prevent one user's app from eating all RAM
      Memory: 512 * 1024 * 1024,  // 512MB max per container
      // CPU limit
      NanoCpus: 500000000,  // 0.5 CPU cores max
    }
  });

  await container.start();
  log(`Container started — listening on port ${port}`);
};

// ── HELPER: get all files for Docker build context ───────────────
const getAllFiles = (dir) => {
  // Returns list of files relative to build directory
  // Docker needs this to know what to include in the build
  const results = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    // Skip node_modules and .git — they're huge and not needed
    if (item === 'node_modules' || item === '.git') continue;
    results.push(item);
  }

  return results;
};

module.exports = { deployProject };