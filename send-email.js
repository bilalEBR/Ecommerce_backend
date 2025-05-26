// async function sendEmail(to, subject, text) {
//   try {

//     // Mock email sending
//     console.log(`Sending email to ${to}`);
//     console.log(`Subject: ${subject}`);
//     console.log(`Text: ${text}`);
//     return true;
//   } catch (error) {
//     console.error('Error sending email:', error);
//     throw error;
//   }
// }

// module.exports = sendEmail;






require('dotenv').config();
const nodemailer = require('nodemailer');

async function sendEmail(to, subject, text) {
  try {
    // Log credentials for debugging (remove in production)
    console.log('Email User:', process.env.EMAIL_USER);
    console.log('Email Pass:', process.env.EMAIL_PASS ? '****' : 'Not set');

    // Create a Nodemailer transporter
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465, // Use SSL port
      secure: true, // Enable SSL
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      debug: true,
      logger: true,
      connectionTimeout: 60000,
      greetingTimeout: 60000,
      socketTimeout: 60000,
    });

    // HTML email template
    const htmlTemplate = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>OTP Verification</title>
        <style>
          body { margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; }
          .header { background-color: #007bff; padding: 20px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { padding: 20px; text-align: center; }
          .otp { font-size: 32px; font-weight: bold; color: #333333; letter-spacing: 2px; margin: 20px 0; }
          .instructions { font-size: 16px; color: #666666; line-height: 1.5; }
          .footer { background-color: #f4f4f4; padding: 10px; text-align: center; font-size: 12px; color: #999999; }
          .button { display: inline-block; padding: 10px 20px; background-color: #007bff; color: #ffffff; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          @media only screen and (max-width: 600px) {
            .container { max-width: 100%; }
            .otp { font-size: 28px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>OTP Verification</h1>
          </div>
          <div class="content">
            <p class="instructions">Hello,</p>
            <p class="instructions">You have requested a One-Time Password (OTP) to verify your account. Please use the code below:</p>
            <div class="otp">${text}</div>
            <p class="instructions">This OTP is valid for <strong>5 minutes</strong>. Do not share it with anyone.</p>
            
          </div>
          <div class="footer">
            <p>© 2025 Ethiomarket. All rights reserved.</p>
            <p>If you did not request this OTP, please ignore this email or contact support.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Define email options
    const mailOptions = {
      from: `"Ethiomarket app" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html: htmlTemplate,
    };

    // Send the email
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${to}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

module.exports = sendEmail;