import transporter from '../config/nodemailer.js';

export const sendEmail = async ({ to, subject, html }) => {
  const mailOptions = {
    from: `"SoB Platform" <${process.env.MAIL_USER}>`,
    to,
    subject,
    html,
  };
  return transporter.sendMail(mailOptions);
};

export const sendBatchEmail = async (recipients, subject, html) => {
  const BATCH_SIZE = 50;
  const DELAY_MS = 2000;
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  console.log(`Initiating batch email delivery to ${recipients.length} users...`);

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    const sendPromises = batch.map((email) =>
      transporter
        .sendMail({ from: `"SoB Platform" <${process.env.MAIL_USER}>`, to: email, subject, html })
        .catch((err) => { console.error(`Failed to send to ${email}: ${err.message}`); return null; })
    );
    await Promise.all(sendPromises);
    console.log(`Completed batch ${Math.floor(i / BATCH_SIZE) + 1} (${i + batch.length}/${recipients.length})`);
    if (i + BATCH_SIZE < recipients.length) await delay(DELAY_MS);
  }

  console.log('Batch email sending complete.');
};
