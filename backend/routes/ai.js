const express = require('express');
const router = express.Router();
const Groq = require('groq-sdk');
const Deployment = require('../models/Deployment');
const { requireAuth } = require('./repos');
require('dotenv').config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

router.post('/analyze/:deploymentId', requireAuth, async (req, res) => {
  try {
    const deployment = await Deployment.findOne({
      _id: req.params.deploymentId,
      userId: req.user._id
    });

    if (!deployment) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    // Get the logs from the request body
    // Frontend sends the logs it already has displayed
    const { logs } = req.body;

    if (!logs || logs.length === 0) {
      return res.status(400).json({ error: 'No logs to analyze' });
    }

    // Build the log text to send to Groq
    const logText = logs
      .map(l => l.message)
      .filter(Boolean)
      .join('\n');

    const prompt = `You are a DevOps expert helping a developer understand why their deployment failed.

Here are the build logs from a failed deployment:

\`\`\`
${logText}
\`\`\`

Please analyze these logs and provide:
1. **What went wrong** — explain the root cause in plain English, like you're talking to a junior developer
2. **Why it happened** — the underlying reason
3. **How to fix it** — specific actionable steps they can take

Keep your response concise, friendly, and practical. No jargon without explanation.`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama3-8b-8192',
      max_tokens: 500,
      temperature: 0.3
    });

    const explanation = completion.choices[0]?.message?.content;

    res.json({ explanation });

  } catch (err) {
    console.error('AI analysis error:', err.message);
    res.status(500).json({ error: 'AI analysis failed: ' + err.message });
  }
});

module.exports = router;