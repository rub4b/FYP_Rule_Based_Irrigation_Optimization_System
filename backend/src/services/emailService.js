const nodemailer = require('nodemailer');

// Configure transporter
// In a real app, use environment variables for credentials
console.log('📧 Email Service Configuration:');
console.log('EMAIL_USER from env:', process.env.EMAIL_USER);
console.log('EMAIL_PASS exists:', !!process.env.EMAIL_PASS);

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // use TLS
  auth: {
    user: process.env.EMAIL_USER || 'nerdyrumble29@gmail.com',
    pass: process.env.EMAIL_PASS || 'yhfpuszzkilqhvse'
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
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('[EmailMock] Email skipped: Credentials not set in .env');
    console.log(`[EmailMock] To: ${to}, Subject: ${subject}, Body: ${text}`);
    return;
  }

  console.log(`Attempting to send email to: ${to}`);
  console.log(`Email user: ${process.env.EMAIL_USER}`);
  console.log(`Email pass length: ${process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 0}`);

  const mailOptions = {
    from: `Aquametic <${process.env.EMAIL_USER}>`,
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
