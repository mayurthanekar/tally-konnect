// src/utils/mailer.js
// Email utility for OTP delivery
const nodemailer = require('nodemailer');
const config = require('../config');
const logger = require('./logger');

let transporter = null;

function getTransporter() {
    if (transporter) return transporter;

    const { host, port, user, pass } = config.smtp;

    if (!host || !user) {
        logger.warn('SMTP not configured — OTPs will be logged to console only');
        return null;
    }

    transporter = nodemailer.createTransport({
        host,
        port: parseInt(port, 10) || 587,
        secure: parseInt(port, 10) === 465,
        auth: { user, pass },
    });

    return transporter;
}

async function sendOtpEmail(toEmail, otp) {
    const transport = getTransporter();

    if (!transport) {
        // Development fallback: log OTP to console
        logger.info({ email: toEmail, otp }, '📧 OTP CODE (SMTP not configured — showing in logs)');
        return true;
    }

    const mailOptions = {
        from: config.smtp.from || `"Tally Konnect" <${config.smtp.user}>`,
        to: toEmail,
        subject: 'Your Tally Konnect Sign-In Code',
        html: `
      <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 420px; margin: 0 auto; padding: 32px; background: #fff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="width: 48px; height: 48px; border-radius: 10px; background: #2E31BE; display: inline-flex; align-items: center; justify-content: center;">
            <span style="color: white; font-size: 20px; font-weight: bold;">TK</span>
          </div>
        </div>
        <h2 style="text-align: center; color: #1F1F25; font-size: 20px; margin: 0 0 8px;">Your Sign-In Code</h2>
        <p style="text-align: center; color: #9B9B9B; font-size: 14px; margin: 0 0 24px;">Enter this code to sign in to Tally Konnect</p>
        <div style="text-align: center; padding: 20px; background: #F5F5F5; border-radius: 8px; margin-bottom: 20px;">
          <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #2E31BE;">${otp}</span>
        </div>
        <p style="text-align: center; color: #9B9B9B; font-size: 12px; margin: 0;">
          This code expires in 10 minutes.<br/>If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
    };

    try {
        await transport.sendMail(mailOptions);
        logger.info({ email: toEmail }, 'OTP email sent successfully');
        return true;
    } catch (err) {
        logger.error({ err, email: toEmail }, 'Failed to send OTP email');
        // Fallback: log OTP
        logger.info({ email: toEmail, otp }, '📧 OTP CODE (email send failed — showing in logs)');
        return true;
    }
}

module.exports = { sendOtpEmail };
