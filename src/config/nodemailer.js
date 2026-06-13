import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  family: 4,
  secure: true,
  auth: {
    user: process.env.MAIL_USER || '',
    pass: process.env.MAIL_PASS || '',
  },
});

transporter.verify((error) => {
  if (error) {
    console.warn(`Nodemailer setup warning: SMTP connection could not be established. Error: ${error.message}`);
  } else {
    console.log('Nodemailer SMTP Transporter ready to send emails');
  }
});

export default transporter;
