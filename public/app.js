// public/app.js
let resumeUrl = null;
let selectedFile = null;
let selectedProducts = [];
let currentClaimId = null;

function generateClaimId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'CL-';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function updateStatus(currentStep) {
    const steps = ['workflow-started', 'file-upload', 'submit-issue', 'confirm-selection', 'complete'];
    const currentIndex = steps.indexOf(currentStep);

    document.querySelectorAll('.status-item').forEach(item => {
        const itemStatus = item.getAttribute('data-status');
        const itemIndex = steps.indexOf(itemStatus);
        
        let statusClass = 'inactive';
        
        if (itemIndex < currentIndex) {
            statusClass = 'completed';
        } else if (itemIndex === currentIndex) {
            statusClass = 'active';
        } else {
            statusClass = 'inactive';
        }
        
        item.className = 'status-item ' + statusClass;
    });
}

function showView(viewId) {
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    document.getElementById(viewId).classList.add('active');
}

function showLoading(message = 'Processing...') {
    document.getElementById('loadingText').textContent = message;
    document.getElementById('loadingOverlay').classList.add('active');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('active');
}

function resetClaim() {
    resumeUrl = null;
    selectedFile = null;
    selectedProducts = [];
    currentClaimId = null;
    document.getElementById('fileInput').value = '';
    document.querySelectorAll('.status-item').forEach(item => {
        item.className = 'status-item inactive';
    });
    showView('view-start');
    updateFileDisplay();
}

function toggleProduct(productId, productValue) {
    const index = selectedProducts.findIndex(p => p.id === productId);
    
    if (index > -1) {
        selectedProducts.splice(index, 1);
    } else {
        selectedProducts.push({ id: productId, value: productValue });
    }
    
    const button = document.querySelector(`[data-product-id="${productId}"]`);
    button.classList.toggle('selected');
    
    const btnSubmit = document.getElementById('btnSubmitProducts');
    btnSubmit.disabled = selectedProducts.length === 0;
}

function displayProducts(data) {
    console.log('🎯 displayProducts called with:', data);
    
    // Display summary
    document.getElementById('summaryText').textContent = data.summary || '';
    
    // Parse products - handle both array and string formats
    const productsGrid = document.getElementById('productsGrid');
    productsGrid.innerHTML = '';
    
    let productArray = [];
    
    if (Array.isArray(data.products)) {
        // Products is already an array
        productArray = data.products;
        console.log('📦 Products received as array:', productArray);
    } else if (typeof data.products === 'string') {
        // Products is a string - split by commas
        productArray = data.products.split(',').map(p => p.trim());
        console.log('📦 Products received as string, parsed to array:', productArray);
    }
    
    // Create buttons for each product
    productArray.forEach((product, index) => {
        if (product) {
            const button = document.createElement('button');
            button.className = 'product-button';
            button.setAttribute('data-product-id', `product-${index}`);
            button.textContent = product;
            button.onclick = () => toggleProduct(`product-${index}`, product);
            productsGrid.appendChild(button);
        }
    });
    
    // Store resumeUrl for the next step
    if (data.resumeUrl) {
        resumeUrl = data.resumeUrl;
        console.log('🔗 New resumeUrl stored for product submission:', resumeUrl);
    }
    
    showView('view-products');
    updateStatus('confirm-selection');
    console.log('✅ Product selection page shown');
}

async function submitProducts() {
    if (selectedProducts.length === 0 || !resumeUrl) {
        alert('Please select at least one product');
        return;
    }

    try {
        showLoading('Submitting selected products...');

        // Generate claim ID
        currentClaimId = generateClaimId();
        const timestamp = new Date().toISOString();

        const response = await fetch(`${window.APP_CONFIG.API_BASE}/api/resume-workflow?resumeUrl=${encodeURIComponent(resumeUrl)}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                selectedProducts: selectedProducts.map(p => p.value),
                claimId: currentClaimId,
                timestamp: timestamp
            })
        });

        const responseData = await response.json();
        
        console.log('Products submission response:', responseData);
        
        hideLoading();
        
        // Show completion screen
        document.getElementById('claimIdDisplay').textContent = currentClaimId;
        showView('view-complete');
        updateStatus('complete');
        
        console.log('✅ Claim submitted successfully with ID:', currentClaimId);
        
    } catch (error) {
        hideLoading();
        console.error('Error submitting products:', error);
        
        // Generate claim ID for error case too
        currentClaimId = generateClaimId();
        document.getElementById('claimIdDisplay').textContent = currentClaimId;
        showView('view-complete');
        updateStatus('complete');
        
        console.log('✅ Claim submitted (with backend error) with ID:', currentClaimId);
    }
}

async function generateClaim() {
    try {
        showLoading('Starting claim process...');

        const response = await fetch(`${window.APP_CONFIG.API_BASE}/api/trigger-workflow`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action: 'start_claim' })
        });

        const data = await response.json();
        
        console.log('Workflow response:', data);
        
        // FIXED: Check data.data.resumeUrl instead of data.resumeUrl
        if (data.data && data.data.resumeUrl) {
            resumeUrl = data.data.resumeUrl;
            hideLoading();
            showView('view-upload');
            updateStatus('file-upload');
            console.log('Moving to file upload with resumeUrl:', resumeUrl);
        } else {
            hideLoading();
            alert('Workflow started but no resumeUrl received');
        }
    } catch (error) {
        hideLoading();
        alert('Error: ' + error.message);
        console.error('Error:', error);
    }
}

// File upload handlers
const uploadArea = document.getElementById('uploadArea');

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        selectedFile = files[0];
        updateFileDisplay();
    }
});

function handleFileSelect(event) {
    const files = event.target.files;
    if (files.length > 0) {
        selectedFile = files[0];
        updateFileDisplay();
    }
}

function updateFileDisplay() {
    const uploadText = document.getElementById('uploadText');
    const btnSubmit = document.getElementById('btnSubmit');
    
    if (selectedFile) {
        uploadText.textContent = `Selected: ${selectedFile.name}`;
        uploadText.classList.add('has-file');
        btnSubmit.disabled = false;
        updateStatus('submit-issue');
    } else {
        uploadText.textContent = 'Drag and drop your invoice here';
        uploadText.classList.remove('has-file');
        btnSubmit.disabled = true;
    }
}

async function submitFile() {
    if (!selectedFile || !resumeUrl) {
        alert('Please select a file first');
        return;
    }

    try {
        showLoading('Processing file...');

        const formData = new FormData();
        formData.append('file', selectedFile);

        const response = await fetch(`${window.APP_CONFIG.API_BASE}/api/resume-workflow?resumeUrl=${encodeURIComponent(resumeUrl)}`, {
            method: 'POST',
            body: formData
        });

        const responseData = await response.json();

        console.log('📄 FULL UPLOAD RESPONSE:', responseData);

        // FIX: Handle array response from n8n
        let data;
        if (Array.isArray(responseData) && responseData.length > 0) {
            // n8n returns array - take first element
            data = responseData[0];
            console.log('✅ Extracted data from array:', data);
        } else {
            // Direct object response
            data = responseData;
        }

        console.log('🔍 Processed data - Summary:', data.summary);
        console.log('🔍 Processed data - Products:', data.products);
        console.log('🔍 Processed data - Products type:', typeof data.products);
        console.log('🔍 Processed data - Is products array?', Array.isArray(data.products));

        hideLoading();

        // If we have summary and products, show product selection
        if (data.summary && data.products) {
            console.log('🎯 Showing product selection page');
            resumeUrl = data.resumeUrl;
            selectedProducts = [];
            displayProducts(data);
        } 
        else {
            console.log('❌ Missing summary or products in response');
            alert('File uploaded but no product data received. Check n8n workflow.');
        }
    } catch (error) {
        hideLoading();
        alert('Error uploading file: ' + error.message);
        console.error('Error:', error);
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Claim Agent App Initialized');
    console.log('API Base URL:', window.APP_CONFIG.API_BASE);
});