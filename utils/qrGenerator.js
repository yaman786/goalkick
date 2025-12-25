/**
 * GoalKick Lite - QR Code Generator
 * Generates unique ticket codes and QR code images
 */

const QRCode = require('qrcode');

/**
 * Generate a unique ticket code
 * Format: NEP-XXXX (where X is alphanumeric)
 * @returns {string} Unique ticket code
 */
const generateTicketCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars: I, O, 0, 1
    let code = 'NEP-';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

/**
 * Generate QR code as data URL (base64 image)
 * @param {string} data - Data to encode in QR code
 * @param {object} options - QR code options
 * @returns {Promise<string>} Base64 data URL of QR code
 */
const generateQRDataURL = async (data, options = {}) => {
    const defaultOptions = {
        width: 300,
        margin: 2,
        color: {
            dark: '#1a1a2e',  // Dark blue-black
            light: '#ffffff' // White background
        },
        errorCorrectionLevel: 'H' // High error correction for reliability
    };

    const mergedOptions = { ...defaultOptions, ...options };

    try {
        const dataURL = await QRCode.toDataURL(data, mergedOptions);
        return dataURL;
    } catch (error) {
        console.error('❌ QR code generation error:', error);
        throw error;
    }
};

/**
 * Generate QR code as SVG string
 * @param {string} data - Data to encode in QR code
 * @returns {Promise<string>} SVG string
 */
const generateQRSVG = async (data) => {
    try {
        const svg = await QRCode.toString(data, { type: 'svg' });
        return svg;
    } catch (error) {
        console.error('❌ QR SVG generation error:', error);
        throw error;
    }
};

/**
 * Generate complete ticket QR with metadata
 * @param {string} ticketId - Ticket UUID
 * @param {string} ticketCode - Human-readable ticket code
 * @returns {Promise<object>} Object containing code and QR data URL
 */
const generateTicketQR = async (ticketId, ticketCode = null) => {
    const code = ticketCode || generateTicketCode();

    // QR contains the ticket code for scanning
    const qrData = code;
    const qrDataURL = await generateQRDataURL(qrData);

    return {
        code,
        qrDataURL,
        ticketId
    };
};

module.exports = {
    generateTicketCode,
    generateQRDataURL,
    generateQRSVG,
    generateTicketQR
};
