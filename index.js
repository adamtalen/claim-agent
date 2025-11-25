const express = require('express');
const fetch = require('node-fetch');
const app = express();
const port = 3001;

// Load environment variables
require('dotenv').config();

console.log('🚀 Starting CompanyAI server...');

// Basic auth middleware
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

// Protect all routes
app.use(basicAuth);
app.use(express.static('public'));

// Regular JSON endpoint
app.post('/api/trigger-workflow', express.json(), async (req, res) => {
    try {
        // Use environment variable instead of query parameter
        const webhookUrl = process.env.N8N_WEBHOOK_URL;
        
        if (!webhookUrl) {
            return res.status(400).json({ error: 'N8N webhook URL not configured' });
        }

        console.log('CompanyAI: Starting new claim request - AI augmented workflow initialized');
        
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ...req.body,
                timestamp: new Date().toISOString(),
                source: 'CompanyAI Claim Agent'
            })
        });

        const data = await response.json();
        
        console.log('CompanyAI: Claim workflow triggered successfully');
        
        res.json({
            success: true,
            message: 'Claim request submitted successfully. AI workflow initialized.',
            data: data
        });
    } catch (error) {
        console.error('CompanyAI: Error triggering claim workflow:', error);
        res.status(500).json({ 
            error: 'Failed to initialize claim workflow', 
            details: error.message,
            message: 'Please try starting a new claim request again.'
        });
    }
});

// File upload endpoint with proper streaming
app.post('/api/resume-workflow', async (req, res) => {
    try {
        const resumeUrl = req.query.resumeUrl;
        
        if (!resumeUrl) {
            return res.status(400).json({ error: 'resumeUrl query parameter is required' });
        }

        console.log('CompanyAI: Resuming workflow with URL:', resumeUrl);
        console.log('Content-Type:', req.headers['content-type']);

        // Check if this is a file upload (multipart/form-data)
        const isFileUpload = req.headers['content-type'] && 
                           req.headers['content-type'].includes('multipart/form-data');

        console.log('Is file upload?', isFileUpload);

        let response;
        if (isFileUpload) {
            // STREAMING APPROACH for file uploads
            console.log('Detected file upload - using streaming method');
            
            response = await fetch(resumeUrl, {
                method: 'POST',
                body: req,
                duplex: 'half',
                headers: {
                    'Content-Type': req.headers['content-type'],
                    'Content-Length': req.headers['content-length']
                }
            });
        } else {
            console.log('Regular JSON request');
            // Handle JSON requests
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                try {
                    const jsonBody = JSON.parse(body);
                    response = await fetch(resumeUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(jsonBody)
                    });
                    
                    const data = await response.json();
                    res.json(data);
                    return;
                } catch (error) {
                    res.status(500).json({ error: error.message });
                    return;
                }
            });
            return; // Important: return here since we're handling async in the 'end' event
        }

        // Handle response for file uploads
        const contentType = response.headers.get('content-type');
        let responseData;

        if (contentType && contentType.includes('application/json')) {
            responseData = await response.json();
        } else {
            const text = await response.text();
            console.log('Raw n8n response (first 500 chars):', text.substring(0, 500));
            
            try {
                responseData = JSON.parse(text);
            } catch (e) {
                responseData = {
                    success: response.ok,
                    status: response.status,
                    message: 'Workflow resumed - non-JSON response received',
                    rawPreview: text.substring(0, 200)
                };
            }
        }

        console.log('CompanyAI: Workflow resumed successfully');
        res.json(responseData);
        
    } catch (error) {
        console.error('CompanyAI: Error resuming claim workflow:', error);
        res.status(500).json({ 
            error: 'Failed to resume claim workflow', 
            details: error.message,
            note: 'Check if n8n workflow is properly configured with Respond to Webhook nodes'
        });
    }
});

// Add a GET route for the main page info
app.get('/', (req, res) => {
    res.json({
        application: 'CompanyAI: Submit and Claim Items',
        description: 'Start a new claim request to initialize an AI augmented workflow',
        version: '1.0',
        endpoints: {
            trigger: '/api/trigger-workflow?webhookUrl=YOUR_N8N_WEBHOOK',
            resume: '/api/resume-workflow?resumeUrl=YOUR_N8N_RESUME_URL'
        }
    });
});

app.listen(port, () => {
    console.log(`✅ CompanyAI: Submit and Claim Items - App listening at http://localhost:${port}`);
    console.log('✅ Start a new claim request to initialize an AI augmented workflow');
    console.log(`✅ Authentication enabled - User: ${process.env.AUTH_USER}`);
});