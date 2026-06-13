import transporter from '../config/nodemailer.js';

export const sendEmail = async ({ to, subject, html }) => {
  await transporter.sendMail({
    from: `"SoB" <${process.env.MAIL_USER}>`,
    to,
    subject,
    html
  });
};

export const sendBatchEmail = async (recipients, subject, html) => {
  const BATCH_SIZE = 50;
  const DELAY_MS = 2000;
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map((to) =>
        transporter.sendMail({
          from: `"SoB" <${process.env.MAIL_USER}>`,
          to,
          subject,
          html,
        })
      )
    );
    console.log(`Completed batch ${Math.floor(i / BATCH_SIZE) + 1} (${i + batch.length}/${recipients.length})`);
    if (i + BATCH_SIZE < recipients.length) await delay(DELAY_MS);
  }

  console.log('Batch email sending complete.');
};
