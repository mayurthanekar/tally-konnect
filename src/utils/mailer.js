// src/utils/mailer.js
const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const config = require('../config');
const logger = require('./logger');

// ============================================================
// Email provider: Resend (primary) → SMTP (fallback) → Console (dev)
// ============================================================

let resendClient = null;

function getResendClient() {
  if (!config.resend.apiKey) return null;
  if (!resendClient) {
    resendClient = new Resend(config.resend.apiKey);
    logger.info('Resend email client initialized');
  }
  return resendClient;
}

function getTransporter() {
  const { host, port, user, pass } = config.smtp;
  if (!host || !user) return null;

  const transporter = nodemailer.createTransport({
    host, port: parseInt(port, 10),
    secure: parseInt(port, 10) === 465,
    auth: { user, pass },
  });
  return transporter;
}

// OTP email HTML template
function getOtpHtml(otp) {
  return `
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
  `;
}

// ============================================================
// Send via Resend API
// ============================================================
async function sendViaResend(toEmail, subject, html) {
  const client = getResendClient();
  if (!client) return null; // not configured

  const { data, error } = await client.emails.send({
    from: config.resend.from,
    to: [toEmail],
    subject,
    html,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message || JSON.stringify(error)}`);
  }

  return { id: data?.id, provider: 'resend' };
}

// ============================================================
// Send via SMTP (nodemailer)
// ============================================================
async function sendViaSmtp(toEmail, subject, html) {
  const transport = getTransporter();
  if (!transport) return null; // not configured

  const from = config.smtp.from || `"Tally Konnect" <${config.smtp.user}>`;
  const info = await transport.sendMail({ from, to: toEmail, subject, html });
  return { id: info.messageId, provider: 'smtp' };
}

// ============================================================
// Main: sendOtpEmail  (Resend → SMTP → Console fallback)
// ============================================================
async function sendOtpEmail(toEmail, otp) {
  const html = getOtpHtml(otp);
  const subject = 'Your Tally Konnect Sign-In Code';

  // 1. Try Resend
  if (config.resend.apiKey) {
    try {
      logger.debug({ to: toEmail, provider: 'resend' }, 'Attempting to send OTP email via Resend');
      const result = await sendViaResend(toEmail, subject, html);
      if (result) {
        logger.info({ email: toEmail, messageId: result.id, provider: 'resend' }, 'OTP email sent successfully');
        return { sent: true, method: 'email', provider: 'resend', messageId: result.id };
      }
    } catch (err) {
      logger.error({ err: err.message, email: toEmail, provider: 'resend' }, 'Resend email failed, trying SMTP fallback');
    }
  }

  // 2. Try SMTP fallback
  if (config.smtp.host && config.smtp.user) {
    try {
      logger.debug({ to: toEmail, provider: 'smtp', host: config.smtp.host }, 'Attempting to send OTP email via SMTP');
      const result = await sendViaSmtp(toEmail, subject, html);
      if (result) {
        logger.info({ email: toEmail, messageId: result.id, provider: 'smtp' }, 'OTP email sent successfully');
        return { sent: true, method: 'email', provider: 'smtp', messageId: result.id };
      }
    } catch (err) {
      logger.error({ err: err.message, email: toEmail, provider: 'smtp' }, 'SMTP email failed');
    }
  }

  // 3. Console fallback (development)
  logger.info({ email: toEmail, otp }, '📧 OTP CODE (no email provider configured — showing in logs)');
  return { sent: false, method: 'console' };
}

// ============================================================
// Verify connectivity
// ============================================================
async function verifySmtpConnection() {
  // Check Resend first
  if (config.resend.apiKey) {
    return { success: true, message: 'Resend API key configured', provider: 'resend' };
  }

  // Check SMTP
  const transport = getTransporter();
  if (!transport) return { success: false, message: 'No email provider configured' };

  try {
    await transport.verify();
    return { success: true, message: 'SMTP connection verified', provider: 'smtp' };
  } catch (err) {
    return { success: false, message: err.message, provider: 'smtp' };
  }
}

module.exports = { sendOtpEmail, verifySmtpConnection };
