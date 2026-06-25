import mongoose from "mongoose";

const ChapterSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subject",
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  isCompleted: {
    type: Boolean,
    default: false,
  },
  estimatedHours: {
    type: Number,
    default: 1,
  },
},{timestamps:true});

export default mongoose.model("Chapter",ChapterSchema)
