/**
 * GoalKick Lite - QR Scanner
 * Mobile-friendly QR code scanning using HTML5 Camera API
 */

let videoStream = null;
let scannerActive = false;
let lastScannedCode = null;
let scanCooldown = false;

// DOM Elements
const video = document.getElementById('video');
const statusText = document.getElementById('statusText');
const permissionPrompt = document.getElementById('permissionPrompt');
const scannerArea = document.getElementById('scannerArea');
const resultOverlay = document.getElementById('resultOverlay');
const resultIcon = document.getElementById('resultIcon');
const resultTitle = document.getElementById('resultTitle');
const resultMessage = document.getElementById('resultMessage');
const resultDetails = document.getElementById('resultDetails');

// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
    // Check if camera API is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showPermissionPrompt();
        statusText.textContent = '❌ Camera not supported on this device';
        return;
    }

    // Auto-start scanner
    startScanner();
});

/**
 * Show permission prompt
 */
function showPermissionPrompt() {
    permissionPrompt.style.display = 'block';
    scannerArea.style.display = 'none';
}

/**
 * Start the camera and scanner
 */
async function startScanner() {
    try {
        permissionPrompt.style.display = 'none';
        scannerArea.style.display = 'block';
        statusText.textContent = '📷 Starting camera...';

        // Request camera access with rear camera preference for mobile
        const constraints = {
            video: {
                facingMode: { ideal: 'environment' }, // Prefer rear camera
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };

        videoStream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = videoStream;

        await video.play();

        scannerActive = true;
        statusText.textContent = '📷 Point camera at QR code';
        statusText.classList.add('scanning');

        // Start scanning loop
        requestAnimationFrame(scanFrame);

    } catch (error) {
        console.error('Camera error:', error);
        showPermissionPrompt();

        if (error.name === 'NotAllowedError') {
            statusText.textContent = '❌ Camera permission denied';
        } else if (error.name === 'NotFoundError') {
            statusText.textContent = '❌ No camera found';
        } else {
            statusText.textContent = '❌ Camera error: ' + error.message;
        }
    }
}

/**
 * Stop the camera
 */
function stopScanner() {
    scannerActive = false;

    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
}

/**
 * Scan frame using canvas and jsQR library
 */
let canvas = null;
let ctx = null;

function scanFrame() {
    if (!scannerActive || scanCooldown) {
        if (scannerActive) {
            requestAnimationFrame(scanFrame);
        }
        return;
    }

    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        requestAnimationFrame(scanFrame);
        return;
    }

    // Create canvas for frame capture if not exists
    if (!canvas) {
        canvas = document.createElement('canvas');
        ctx = canvas.getContext('2d', { willReadFrequently: true });
    }

    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Try to detect QR code using simple pattern matching
    // For production, use a proper QR library like jsQR

    // For now we'll use the BarcodeDetector API if available (Chrome, Edge)
    if ('BarcodeDetector' in window) {
        detectWithBarcodeAPI(video);
    }

    requestAnimationFrame(scanFrame);
}

/**
 * Detect QR code using BarcodeDetector API
 */
let barcodeDetector = null;

async function detectWithBarcodeAPI(source) {
    try {
        if (!barcodeDetector) {
            barcodeDetector = new BarcodeDetector({ formats: ['qr_code'] });
        }

        const barcodes = await barcodeDetector.detect(source);

        if (barcodes.length > 0) {
            const code = barcodes[0].rawValue;

            // Avoid processing the same code repeatedly
            if (code !== lastScannedCode) {
                lastScannedCode = code;
                validateTicket(code);
            }
        }
    } catch (error) {
        // BarcodeDetector not supported or failed - fall back to manual input
        console.log('BarcodeDetector error:', error);
    }
}

/**
 * Validate ticket via API
 */
async function validateTicket(code) {
    if (scanCooldown) return;

    scanCooldown = true;
    statusText.textContent = '🔍 Validating ticket...';

    try {
        const response = await fetch('/validate_ticket', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code })
        });

        const result = await response.json();
        console.log('Validation result:', result);

        showResult(result);

    } catch (error) {
        console.error('Validation error:', error);
        showResult({
            valid: false,
            status: 'ERROR',
            message: 'Network error. Please try again.'
        });
    }
}

/**
 * Show validation result overlay
 */
function showResult(result) {
    resultOverlay.classList.add('show');

    if (result.valid && result.status === 'ENTER') {
        // Valid ticket - GREEN
        resultOverlay.classList.remove('invalid');
        resultOverlay.classList.add('valid');
        resultIcon.textContent = '✅';
        resultTitle.textContent = 'ENTER';
        resultMessage.textContent = result.message;

        // Show ticket details
        if (result.ticket) {
            resultDetails.innerHTML = `
                <p>🎫 <strong>${result.ticket.code}</strong></p>
                <p>⚽ ${result.ticket.match}</p>
                <p>👤 ${result.ticket.userName}</p>
                <p>🎟️ ${result.ticket.quantity} ticket(s)</p>
            `;
            resultDetails.style.display = 'block';
        } else {
            resultDetails.style.display = 'none';
        }

        // Play success sound (if available)
        playSound('success');

    } else {
        // Invalid ticket - RED
        resultOverlay.classList.remove('valid');
        resultOverlay.classList.add('invalid');
        resultIcon.textContent = '❌';

        let soundType = 'error';

        switch (result.status) {
            case 'ALREADY_USED':
                resultTitle.textContent = 'ALREADY USED';
                soundType = 'used';
                break;
            case 'INVALID':
                resultTitle.textContent = 'INVALID';
                break;
            case 'UNPAID':
                resultTitle.textContent = 'UNPAID';
                break;
            default:
                resultTitle.textContent = 'DENIED';
        }

        resultMessage.textContent = result.message;

        if (result.ticket) {
            resultDetails.innerHTML = `
                <p>🎫 ${result.ticket.code}</p>
                <p>⚽ ${result.ticket.match}</p>
                ${result.ticket.usedAt ? `<p>⏰ Used at: ${new Date(result.ticket.usedAt).toLocaleString()}</p>` : ''}
            `;
            resultDetails.style.display = 'block';
        } else {
            resultDetails.style.display = 'none';
        }

        // Play error/used sound
        playSound(soundType);
    }
}

/**
 * Close result overlay and resume scanning
 */
function closeResult() {
    resultOverlay.classList.remove('show');
    lastScannedCode = null;
    scanCooldown = false;
    statusText.textContent = '📷 Point camera at QR code';
}

/**
 * Manual code validation
 */
function validateManual() {
    const input = document.getElementById('manualCode');
    const code = input.value.trim().toUpperCase();

    if (!code) {
        alert('Please enter a ticket code');
        return;
    }

    validateTicket(code);
    input.value = '';
}

/**
 * Play feedback sound and vibration
 */
function playSound(type) {
    // Stop any currently playing sounds
    ['sound-success', 'sound-fail', 'sound-used'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.pause();
            el.currentTime = 0;
        }
    });

    try {
        if (type === 'success') {
            // SUCCESS: Crisp Chime + Short Vibration
            const audio = document.getElementById('sound-success');
            if (audio) audio.play().catch(e => console.log('Audio blocked:', e));

            if (navigator.vibrate) {
                navigator.vibrate(200); // Single sharp buzz
            }
        }
        else if (type === 'used') {
            // USED: Double Beep + Double Vibration
            const audio = document.getElementById('sound-used');
            if (audio) audio.play().catch(e => console.log('Audio blocked:', e));

            if (navigator.vibrate) {
                navigator.vibrate([200, 100, 200]); // Buzz-pause-Buzz
            }
        }
        else {
            // FAIL: Low Error + Long Vibration
            const audio = document.getElementById('sound-fail');
            if (audio) audio.play().catch(e => console.log('Audio blocked:', e));

            if (navigator.vibrate) {
                navigator.vibrate(500); // Long error buzz
            }
        }
    } catch (e) {
        console.error('Feedback error:', e);
    }
}

// Handle visibility change (pause when tab is hidden)
document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
        stopScanner();
    } else if (!resultOverlay.classList.contains('show')) {
        startScanner();
    }
});

// Handle Enter key for manual input
document.getElementById('manualCode')?.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        validateManual();
    }
});
