import nodemailer from 'nodemailer'
import logger from './logger.js'

const sendEmail = async (to, subject, html) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    })

    await transporter.sendMail({
      from: `"AI Study Planner" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html
    })

    logger.info('Email notification sent successfully ✅')
  } catch (error) {
    logger.error('Email sending failed ❌', { error: error.message })
  }
}

export default sendEmail