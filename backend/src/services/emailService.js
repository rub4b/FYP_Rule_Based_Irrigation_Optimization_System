const nodemailer = require('nodemailer');
const { EMAIL } = require('../config/env');

// Configure transporter
console.log('📧 Email Service Configuration:');
console.log('EMAIL_USER from env:', EMAIL.USER);
console.log('EMAIL_PASS exists:', !!EMAIL.PASS);

const transporter = nodemailer.createTransport({
  host: EMAIL.HOST,
  port: EMAIL.PORT,
  secure: EMAIL.SECURE, // use TLS
  auth: {
    user: EMAIL.USER,
    pass: EMAIL.PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

/**
 * Send an email alert to a user
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} text - Email body text
 */
exports.sendEmail = async (to, subject, text) => {
  if (!EMAIL.USER || !EMAIL.PASS) {
    console.warn('[EmailMock] Email skipped: Credentials not set in .env');
    console.log(`[EmailMock] To: ${to}, Subject: ${subject}, Body: ${text}`);
    return;
  }

  console.log(`Attempting to send email to: ${to}`);
  console.log(`Email user: ${EMAIL.USER}`);
  console.log(`Email pass length: ${EMAIL.PASS ? EMAIL.PASS.length : 0}`);

  const mailOptions = {
    from: EMAIL.FROM,
    to,
    subject,
    text,
    html: `<div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2 style="color: #2E7D32;">Aquametic Smart Farming</h2>
      <p style="white-space: pre-line;">${text}</p>
      <br>
      <p style="color: #78909C; font-size: 12px;">This is an automated message from Aquametic. Please do not reply to this email.</p>
    </div>`
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully: ' + info.response);
    console.log('Message ID: ' + info.messageId);
    return info;
  } catch (error) {
    console.error('❌ Error sending email:', error);
    console.error('Error details:', {
      code: error.code,
      command: error.command,
      response: error.response
    });
    // Don't throw error to avoid crashing the background job
    throw error; // Actually throw to see the error in the API response
  }
};
