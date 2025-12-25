/**
 * GoalKick Lite - eSewa Payment Helper
 * Handles eSewa payment integration and verification
 */

const axios = require('axios');
require('dotenv').config();

// eSewa configuration
const config = {
    merchantCode: process.env.ESEWA_MERCHANT_CODE || 'EPAYTEST',
    paymentUrl: process.env.ESEWA_PAYMENT_URL || 'https://uat.esewa.com.np/epay/main',
    verifyUrl: process.env.ESEWA_VERIFY_URL || 'https://uat.esewa.com.np/epay/transrec',
    successUrl: process.env.ESEWA_SUCCESS_URL || 'http://localhost:3000/payment_success',
    failureUrl: process.env.ESEWA_FAILURE_URL || 'http://localhost:3000/payment_failure'
};

/**
 * Build eSewa payment form data
 * @param {object} params - Payment parameters
 * @param {number} params.amount - Total amount
 * @param {string} params.productId - Product/Order ID (ticket ID)
 * @param {number} params.taxAmount - Tax amount (default 0)
 * @param {number} params.serviceCharge - Service charge (default 0)
 * @param {number} params.deliveryCharge - Delivery charge (default 0)
 * @returns {object} Form data for eSewa payment
 */
const buildPaymentFormData = ({
    amount,
    productId,
    taxAmount = 0,
    serviceCharge = 0,
    deliveryCharge = 0
}) => {
    return {
        amt: amount,
        psc: serviceCharge,
        pdc: deliveryCharge,
        txAmt: taxAmount,
        tAmt: amount + taxAmount + serviceCharge + deliveryCharge,
        pid: productId,
        scd: config.merchantCode,
        su: config.successUrl,
        fu: config.failureUrl
    };
};

/**
 * Get eSewa payment URL with form data
 * @param {object} formData - Payment form data
 * @returns {object} Payment URL and form data
 */
const getPaymentDetails = (formData) => {
    return {
        url: config.paymentUrl,
        formData: buildPaymentFormData(formData)
    };
};

/**
 * CRITICAL: Server-to-Server (SEP) verification with eSewa
 * This verifies that the payment was actually received by eSewa
 * NEVER trust URL callback parameters alone!
 * 
 * @param {object} params - Verification parameters
 * @param {number} params.amount - Transaction amount
 * @param {string} params.referenceId - eSewa reference ID (refId from callback)
 * @param {string} params.productId - Product/Order ID (same as pid)
 * @returns {Promise<object>} Verification result
 */
const verifyPayment = async ({ amount, referenceId, productId }) => {
    try {
        console.log('🔐 Initiating SEP verification with eSewa...');
        console.log('   Amount:', amount);
        console.log('   Reference ID:', referenceId);
        console.log('   Product ID:', productId);

        // Build verification request
        const params = new URLSearchParams();
        params.append('amt', amount);
        params.append('rid', referenceId);
        params.append('pid', productId);
        params.append('scd', config.merchantCode);

        // Make server-to-server verification request
        const response = await axios.post(config.verifyUrl, params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 10000 // 10 second timeout
        });

        // eSewa returns XML response
        const responseText = response.data;
        console.log('📨 eSewa verification response:', responseText);

        // Check if response contains "Success"
        const isSuccess = responseText.includes('<response_code>Success</response_code>');

        return {
            success: isSuccess,
            verified: isSuccess,
            rawResponse: responseText,
            referenceId,
            productId,
            amount
        };

    } catch (error) {
        console.error('❌ eSewa verification error:', error.message);

        // Handle specific error cases
        if (error.code === 'ECONNREFUSED') {
            return {
                success: false,
                verified: false,
                error: 'Could not connect to eSewa verification server',
                rawResponse: null
            };
        }

        if (error.code === 'ETIMEDOUT') {
            return {
                success: false,
                verified: false,
                error: 'eSewa verification request timed out',
                rawResponse: null
            };
        }

        return {
            success: false,
            verified: false,
            error: error.message,
            rawResponse: null
        };
    }
};

/**
 * Parse eSewa callback parameters
 * @param {object} query - URL query parameters from callback
 * @returns {object} Parsed parameters
 */
const parseCallback = (query) => {
    return {
        orderId: query.oid || query.pid,
        amount: parseFloat(query.amt) || 0,
        referenceId: query.refId,
        // Additional fields that may be present
        productDeliveryCharge: parseFloat(query.pdc) || 0,
        productServiceCharge: parseFloat(query.psc) || 0,
        taxAmount: parseFloat(query.txAmt) || 0,
        totalAmount: parseFloat(query.tAmt) || 0
    };
};

module.exports = {
    config,
    buildPaymentFormData,
    getPaymentDetails,
    verifyPayment,
    parseCallback
};
