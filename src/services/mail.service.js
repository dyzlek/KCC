const nodemailer = require('nodemailer');

/**
 * Mail Service for sending system emails
 */
async function sendResetEmail(email, resetLink) {
    // Configurable via .env if needed
    const transporter = nodemailer.createTransport({
        host: process.env.MAIL_HOST || 'smtp.mailtrap.io',
        port: process.env.MAIL_PORT || 2525,
        auth: {
            user: process.env.MAIL_USER,
            pass: process.env.MAIL_PASS
        }
    });

    const mailOptions = {
        from: '"KC Catalogue" <noreply@kccatalogue.com>',
        to: email,
        subject: 'Password Reset - KC Catalogue',
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #0d46f2;">KC CATALOGUE</h2>
                <p>Hello,</p>
                <p>We received a request to reset your password. Click the button below to set a new one:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetLink}" style="background-color: #0d46f2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Reset Password</a>
                </div>
                <p>If you did not request this, you can safely ignore this email. The link will expire in 1 hour.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin-top: 20px;">
                <p style="font-size: 12px; color: #757575;">This is an automated message, please do not reply.</p>
            </div>
        `
    };

    // Always log the link for development/debug
    console.log('--- PASSWORD RESET EMAIL ---');
    console.log(`To: ${email}`);
    console.log(`Link: ${resetLink}`);
    console.log('----------------------------');

    // Only try to send if credentials are provided
    if (process.env.MAIL_USER && process.env.MAIL_PASS) {
        try {
            await transporter.sendMail(mailOptions);
            console.log(`Reset email sent to ${email}`);
        } catch (err) {
            console.error('Error sending email:', err);
        }
    } else {
        console.log('Skipping real email send (no SMTP credentials in .env)');
    }
}

module.exports = {
    sendResetEmail
};
