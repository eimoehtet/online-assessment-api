const nodemailer = require("nodemailer");

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_PORT === "465", // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USERNAME,
      pass: process.env.SMTP_PASSWORD,
    },
  });
};

const sendResetPasswordEmail = async (toEmail, resetToken, userName = "User") => {
  const transporter = createTransporter();
  const frontendUrl = (process.env.FRONTEND_ORIGINS || "http://localhost:5173").split(",")[0].trim();
  const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: `"Light LMS Support" <${process.env.SMTP_USERNAME}>`,
    to: toEmail,
    subject: "Reset Your Password - Light LMS",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #dc2626; margin: 0; font-size: 24px;">Light LMS</h2>
          <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Password Reset Request</p>
        </div>
        
        <p style="color: #334155; font-size: 16px; line-height: 1.5;">Hello <strong>${userName}</strong>,</p>
        
        <p style="color: #334155; font-size: 15px; line-height: 1.5;">
          We received a request to reset the password for your account associated with <strong>${toEmail}</strong>.
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetLink}" target="_blank" style="background-color: #dc2626; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(220, 38, 38, 0.2);">
            Reset Password
          </a>
        </div>

        <p style="color: #64748b; font-size: 14px; line-height: 1.5;">
          If the button above does not work, copy and paste the following URL into your web browser:
        </p>
        <p style="word-break: break-all; background-color: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 13px;">
          <a href="${resetLink}" style="color: #2563eb;">${resetLink}</a>
        </p>

        <p style="color: #94a3b8; font-size: 13px; line-height: 1.5; margin-top: 28px;">
          * This reset link will expire in <strong>1 hour</strong>.<br/>
          * If you did not request a password reset, no action is needed and your account remains safe.
        </p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
          &copy; ${new Date().getFullYear()} Light LMS. All rights reserved.
        </p>
      </div>
    `,
  };

  return await transporter.sendMail(mailOptions);
};

module.exports = {
  sendResetPasswordEmail,
};
