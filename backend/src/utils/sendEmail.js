import nodemailer from 'nodemailer';
import logger from './logger.js';
import { env } from '../config/env.js';

const sendEmail = async (to, subject, html) => {
  // Support mock email transport for tests or mock mode
  if (env.NODE_ENV === 'test' || process.env.EMAIL_PROVIDER === 'mock') {
    if (globalThis.mockSendEmailShouldFail) {
      throw new Error('SMTP_CONN_REFUSED');
    }
    logger.info('[MOCK SMTP] Email notification bypass', { to, subject });
    return;
  }

  try {
    let transporter;
    if (env.SMTP_HOST) {
      transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: {
          user: env.EMAIL_USER,
          pass: env.EMAIL_PASS
        }
      });
    } else {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: env.EMAIL_USER,
          pass: env.EMAIL_PASS
        }
      });
    }

    const fromAddress = env.SMTP_FROM || env.EMAIL_USER;
    await transporter.sendMail({
      from: `"AI Study Planner" <${fromAddress}>`,
      to,
      subject,
      html
    });

    logger.info('Email notification sent successfully ✅');
  } catch (error) {
    logger.error('Email sending failed ❌', { error: error.message });
    throw error;
  }
};

export default sendEmail;