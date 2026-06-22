import 'dotenv/config'
import express from "express"
import cors from "cors"
import connectDB from "./src/config/db.js"
import passport from "./src/config/passport.js"
import authRoutes from "./src/routes/auth.js"

connectDB()

const app = express()

// middlewares
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true
}))
app.use(express.json())
app.use(passport.initialize())

// routes
app.use('/api/auth', authRoutes)

// test route
app.get('/', (req, res) => {
  res.send('AI Study Planner API is running ✅')
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`Server running on port ${PORT} 🚀`))