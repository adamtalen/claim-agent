const express = require('express');
const fetch = require('node-fetch');
const app = express();
const port = 3000;

// Load environment variables
require('dotenv').config();

// Basic auth middleware
const basicAuth = (req, res, next) => {
  const auth = {
    login: process.env.AUTH_USER,
    password: process.env.AUTH_PASS
  };

  // Check if auth credentials are set
  if (!auth.login || !auth.password) {
    console.error('Auth credentials not set in environment variables');
    return res.status(500).send('Server configuration error');
  }

  const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
  const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');

  if (login && password && login === auth.login && password === auth.password) {
    return next();
  }

  res.set('WWW-Authenticate', 'Basic realm="401"');
  res.status(401).send('Authentication required.');
};

// Protect all routes
app.use(basicAuth);

// Your existing routes
app.use(express.static('public'));
app.use(express.json()); // Add this to parse JSON bodies

app.post('/api/trigger-workflow', async (req, res) => {
    try {
        const webhookUrl = req.query.webhookUrl;
        
        if (!webhookUrl) {
            return res.status(400).json({ error: 'webhookUrl query parameter is required' });
        }

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req.body || {})
        });

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error triggering workflow:', error);
        res.status(500).json({ error: 'Failed to trigger workflow', details: error.message });
    }
});

app.post('/api/resume-workflow', async (req, res) => {
    try {
        const resumeUrl = req.query.resumeUrl;
        
        if (!resumeUrl) {
            return res.status(400).json({ error: 'resumeUrl query parameter is required' });
        }

        const response = await fetch(resumeUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error resuming workflow:', error);
        res.status(500).json({ error: 'Failed to resume workflow', details: error.message });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`App listening at http://0.0.0.0:${port}`);
    console.log(`Authentication enabled - User: ${process.env.AUTH_USER}`);
});