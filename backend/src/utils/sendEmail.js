import nodemailer from 'nodemailer'
import logger from './logger.js'
import { env } from '../config/env.js'

const sendEmail = async (to, subject, html) => {
  if (env.NODE_ENV === 'test') {
    if (globalThis.mockSendEmailShouldFail) {
      throw new Error('SMTP_CONN_REFUSED');
    }
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: env.EMAIL_USER,
        pass: env.EMAIL_PASS
      }
    })

    await transporter.sendMail({
      from: `"AI Study Planner" <${env.EMAIL_USER}>`,
      to,
      subject,
      html
    })

    logger.info('Email notification sent successfully ✅')
  } catch (error) {
    logger.error('Email sending failed ❌', { error: error.message })
    throw error;
  }
}

export default sendEmail