const Docker = require('dockerode');
const { simpleGit } = require('simple-git');
const path = require('path');
const fs = require('fs');
const os = require('os');
require('dotenv').config();

const docker = process.platform === 'win32'
  ? new Docker({ socketPath: '//./pipe/docker_engine' })
  : new Docker({ socketPath: '/var/run/docker.sock' });

const CLONE_BASE = path.join(os.tmpdir(), 'devops-builds');

const deployProject = async (data, log) => {
  const { deploymentId, projectId, repoFullName, branch, githubToken, port, envVars } = data;

  const buildDir = path.join(CLONE_BASE, deploymentId);

  try {
    log('Cloning repository...');
    if (fs.existsSync(buildDir)) {
      fs.rmSync(buildDir, { recursive: true, force: true });
    }
    fs.mkdirSync(buildDir, { recursive: true });

    const cloneUrl = `https://${githubToken}@github.com/${repoFullName}.git`;
    await simpleGit().clone(cloneUrl, buildDir, ['--branch', branch, '--depth', '1']);
    log('Repository cloned successfully');

    log('Detecting project type...');
    const dockerfile = generateDockerfile(buildDir);
    fs.writeFileSync(path.join(buildDir, 'Dockerfile'), dockerfile);
    log('Dockerfile generated');

    const imageTag = `devops-panel-${projectId}:${deploymentId}`;
    log(`Building Docker image: ${imageTag}`);
    await buildImage(docker, buildDir, imageTag, log);
    log('Image built successfully');

    log('Stopping previous container if running...');
    await stopOldContainer(docker, projectId, log);

    log(`Starting container on port ${port}...`);
    await runContainer(docker, imageTag, projectId, port, envVars, log);
    log(`Deployment complete — running on port ${port}`);

    return { success: true, imageTag, port };

  } catch (err) {
    log(`Deployment failed: ${err.message}`, 'error');
    throw err;
  } finally {
    try {
      fs.rmSync(buildDir, { recursive: true, force: true });
      log('Build directory cleaned up');
    } catch (e) {}
  }
};

const generateDockerfile = (buildDir) => {
  const files = fs.readdirSync(buildDir);

  if (files.includes('package.json')) {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(buildDir, 'package.json'), 'utf8')
    );
    const hasStart = pkg.scripts?.start;

    return `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 3000
CMD [${hasStart ? '"npm", "start"' : '"node", "index.js"'}]`;
  }

  if (files.includes('requirements.txt')) {
    return `FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 3000
CMD ["python", "app.py"]`;
  }

  if (files.includes('index.html')) {
    return `FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]`;
  }

  return `FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install --omit=dev
EXPOSE 3000
CMD ["node", "index.js"]`;
};

const buildImage = (docker, buildDir, imageTag, log) => {
  return new Promise((resolve, reject) => {
    docker.buildImage(
      { context: buildDir, src: getAllFiles(buildDir) },
      { t: imageTag },
      (err, stream) => {
        if (err) return reject(err);

        docker.modem.followProgress(stream,
          (err, output) => {
            if (err) return reject(err);
            resolve(output);
          },
          (event) => {
            if (event.stream) {
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

const stopOldContainer = async (docker, projectId, log) => {
  try {
    const container = docker.getContainer(`project-${projectId}`);
    const info = await container.inspect();
    if (info.State.Running) {
      await container.stop();
      log('Previous container stopped');
    }
    await container.remove();
    log('Previous container removed');
  } catch (err) {
    if (err.statusCode !== 404) {
      log(`Warning: ${err.message}`);
    }
  }
};

const runContainer = async (docker, imageTag, projectId, port, envVars, log) => {
  const env = (envVars || []).map(({ key, value }) => `${key}=${value}`);

  const container = await docker.createContainer({
    Image: imageTag,
    name: `project-${projectId}`,
    Env: env,
    ExposedPorts: { '3000/tcp': {} },
    HostConfig: {
      PortBindings: {
        '3000/tcp': [{ HostPort: String(port) }]
      },
      Memory: 512 * 1024 * 1024,
      NanoCpus: 500000000,
    }
  });

  await container.start();
  log(`Container started — listening on port ${port}`);
};

const getAllFiles = (dir) => {
  const results = [];
  const items = fs.readdirSync(dir);
  for (const item of items) {
    if (item === 'node_modules' || item === '.git') continue;
    results.push(item);
  }
  return results;
};

module.exports = { deployProject };