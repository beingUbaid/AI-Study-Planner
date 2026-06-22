import User from "../models/User.js";
import sendEmail from "../utils/sendEmail.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// 6 digits code gen
const generateCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};
//token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

// REGISTER SEction
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: "Email Already register " });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const verifyCode = generateCode();
    const verifyCodeExpiry = new Date(Date.now() + 10 * 60 * 1000);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      verifyCode,
      verifyCodeExpiry,
    });
    await sendEmail(
      email,
      "Verify Your Email - AI Study Planner",
      `
        <h2>Hello ${name}! 👋</h2>
        <p>Your verification code is:</p>
        <h1 style="color: #4F46E5; letter-spacing: 5px;">${verifyCode}</h1>
        <p>This code expires in <strong>10 minutes</strong></p>
        <p>If you didn't create this account, ignore this email.</p>
        <h3> Don't share this password to anyone <h3>
      `,
    );
    res.status(201).json({
      message:
        "Registration successful! Check your email for verification code ✅",
      email,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// email verifiction

export const verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "Email already varified" });
    }

    if (user.verifyCode !== code) {
      return res.status(400).json({ message: "Plz enter the rigth code" });
    }

    if (user.verifyCodeExpiry < new Date()) {
      return res
        .status(400)
        .json({ message: "Code expired, please register again" });
    }

    user.isVerified = true;
    user.verifyCode = null;
    user.verifyCodeExpiry = null;

    await user.save();

    const token = generateToken(user._id);

    res.status(200).json({
      message: "Email verified!",
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    if (!user.isVerified) {
      return res.status(400).json({ message: "plz verify first " });
    }

    const isMatch = await bcrypt.compare(password,user.password)
    if(!isMatch){
      return res.status(400).json({ message: 'Invalid credentials' })
    }

    const token = generateToken(user._id)

    res.status(200).json({
      message:"login successfully",
      token,
      user:{id:user._id,name:user.name,email:user.email}
    })
  } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message })
  }
};


// foget password
export const forgotPassword = async (req,res) => {
 try{
  const {email} =  req.body

  const user = await User.findOne({email})
  if (!user) {
      return res.status(400).json({ message: "No acc with this email" });
    }

        const resetCode = generateCode()
        const resetCodeExpiry = new Date(Date.now()+10*60*1000)

        user.resetCode = resetCode
        user.resetCodeExpiry = resetCodeExpiry
        await user.save()
await sendEmail(
      email,
      'Password Reset Code - AI Study Planner',
      `
        <h2>Password Reset Request 🔐</h2>
        <p>Your password reset code is:</p>
        <h1 style="color: #4F46E5; letter-spacing: 5px;">${resetCode}</h1>
        <p>This code expires in <strong>10 minutes</strong></p>
        <p>If you didn't request this, ignore this email.</p>
      `
    )

    res.status(200).json({ message: 'Reset code sent to your email ✅' })

  }catch(error){
    res.status(500).json({ message: 'Server error', error: error.message })
  }
} 



// reset pass 

export const resetPassword = async (req,res) => {
  try {
    const {email,code,newPassword} = req.body

     const user = await User.findOne({ email })
    if (!user) {
      return res.status(400).json({ message: 'User not found' })
    }

    if(user.resetCode !== code){
            return res.status(400).json({ message: 'Invalid reset code' })
    }

   if (user.resetCodeExpiry < new Date()) {
      return res.status(400).json({ message: 'Reset code expired' })
    }

      const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(newPassword, salt)

    user.password = hashedPassword
    user.resetCode = null
    user.resetCodeExpiry = null
    await user.save()

    res.status(200).json({ message: 'Password reset successful ✅' })

  } catch (error) {
     res.status(500).json({ message: 'Server error', error: error.message })
  }
}