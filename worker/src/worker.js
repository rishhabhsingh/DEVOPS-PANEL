const { Worker } = require('bullmq');
const { deployProject } = require('./deploy');
const { rollbackDeployment } = require('./rollback');
const IORedis = require('ioredis');
require('dotenv').config();

const connection = {
  host: '127.0.0.1',
  port: 6379
};

const publisher = new IORedis({ host: '127.0.0.1', port: 6379 });

const publishLog = (deploymentId, message, type = 'log') => {
  if (!deploymentId) return;
  publisher.publish(`logs:${deploymentId}`, JSON.stringify({
    deploymentId,
    message,
    type,
    timestamp: new Date().toISOString()
  }));
};

console.log('Worker started — waiting for deploy jobs...');

const worker = new Worker('deployments', async (job) => {
  console.log(`Picked up job: ${job.name} — ${job.id}`);

  const log = (message, type = 'log') => {
    console.log(`[${job.data.deploymentId}] ${message}`);
    publishLog(job.data.deploymentId, message, type);
  };

  if (job.name === 'deploy') {
    await deployProject(job.data, log);
  }

  if (job.name === 'rollback') {
    await rollbackDeployment(job.data, log);
  }

}, { connection });

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
  publishLog(job.data.deploymentId, 'Deployment complete ✓', 'done');
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err.message);
  publishLog(job.data.deploymentId, `Failed: ${err.message}`, 'error');
});