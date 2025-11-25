const express = require('express');
const fetch = require('node-fetch');
const FormData = require('form-data');
const app = express();
const port = 3001;

// Load environment variables
require('dotenv').config();

// Basic auth middleware (same as before)
const basicAuth = (req, res, next) => {
  const auth = {
    login: process.env.AUTH_USER,
    password: process.env.AUTH_PASS
  };

  if (!auth.login || !auth.password) {
    console.error('Auth credentials not set in environment variables');
    return res.status(500).send('Server configuration error');
  }

  const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
  const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');

  if (login && password && login === auth.login && password === auth.password) {
    return next();
  }

  res.set('WWW-Authenticate', 'Basic realm="CompanyAI: Submit and Claim Items"');
  res.status(401).send('Authentication required. Start a new claim request to initialize an AI augmented workflow.');
};

app.use(express.static('public'));
app.use(basicAuth);

// Regular JSON endpoint
app.post('/api/trigger-workflow', express.json(), async (req, res) => {
    // ... (keep your existing trigger-workflow code)
});

// NEW APPROACH: Use form-data package for file uploads
app.post('/api/resume-workflow', async (req, res) => {
    try {
        const resumeUrl = req.query.resumeUrl;
        
        if (!resumeUrl) {
            return res.status(400).json({ error: 'resumeUrl query parameter is required' });
        }

        console.log('CompanyAI: Resuming workflow with URL:', resumeUrl);
        console.log('Content-Type:', req.headers['content-type']);

        // Check if this is a file upload
        const isFileUpload = req.headers['content-type'] && 
                           req.headers['content-type'].includes('multipart/form-data');

        if (isFileUpload) {
            console.log('Using form-data package for file upload');
            
            // Create a new form-data instance
            const form = new FormData();
            
            // Forward all fields from the incoming form
            req.on('data', (chunk) => {
                // This is a simplified approach - in real implementation,
                // you'd need to parse the multipart boundaries properly
                console.log('Received chunk:', chunk.length, 'bytes');
            });
            
            // For now, let's try a simpler approach - direct stream
            const response = await fetch(resumeUrl, {
                method: 'POST',
                body: req,
                headers: {
                    'Content-Type': req.headers['content-type'],
                    'Content-Length': req.headers['content-length']
                }
            });

            const text = await response.text();
            console.log('Raw response length:', text.length);
            
            try {
                const data = JSON.parse(text);
                res.json(data);
            } catch (e) {
                res.json({
                    success: true,
                    message: 'File uploaded (non-JSON response)',
                    rawLength: text.length
                });
            }
        } else {
            // Handle JSON requests
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                try {
                    const jsonBody = JSON.parse(body);
                    const response = await fetch(resumeUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(jsonBody)
                    });
                    const data = await response.json();
                    res.json(data);
                } catch (error) {
                    res.status(500).json({ error: error.message });
                }
            });
        }
        
    } catch (error) {
        console.error('CompanyAI: Error resuming claim workflow:', error);
        res.status(500).json({ 
            error: 'Failed to resume claim workflow', 
            details: error.message
        });
    }
});

// ... rest of your code