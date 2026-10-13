const { Worker } = require('bullmq');
const { deployProject } = require('./deploy');
require('dotenv').config();

// Connect worker to Redis — same Redis that Express pushes jobs into
const connection = {
  host: 'localhost',
  port: 6379
};

console.log('Worker started — waiting for deploy jobs...');

// This worker listens to the 'deployments' queue
// Every time Express adds a job, this fires automatically
const worker = new Worker('deployments', async (job) => {

  console.log(`Picked up job: ${job.id}`);
  console.log(`Deploying project: ${job.data.repoFullName}`);

  // Hand off to the actual deploy logic
  await deployProject(job);

}, { connection });

// These are lifecycle hooks — they fire when jobs complete or fail
worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err.message);
});