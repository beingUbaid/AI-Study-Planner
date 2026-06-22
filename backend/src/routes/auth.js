import express from 'express'
import passport from 'passport'
import jwt from 'jsonwebtoken'
import {
  register,
  verifyEmail,
  login,
  forgotPassword,
  resetPassword
} from '../controllers/authController.js'


const router  =  express.Router()

router.post('/register', register)
router.post('/verify-email', verifyEmail)
router.post('/login', login)
router.post('/forgot-password', forgotPassword)
router.post('/reset-password', resetPassword)

router.get('/google', passport.authenticate('google', {
    scope: ['profile','email'],
    session:false
}))

router.get('/google/callback' , 
    passport.authenticate('google', { session: false, failureRedirect: `${process.env.CLIENT_URL}/login` }),
    (req,res)=> {
        const token = jwt.sign({ id: req.user._id }, process.env.JWT_SECRET, { expiresIn: '7d' })

        res.redirect(`${process.env.CLIENT_URL}/auth/success?token=${token}`)
    }
)

export default router