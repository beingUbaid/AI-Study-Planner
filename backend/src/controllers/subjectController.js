import Subject from "../models/Subject.js";

// add subject

export const addSubject = async (req, res) => {
  try {
    const { name, examDate, difficulty, color } = req.body;
    if (!name || !examDate) {
      return res
        .status(400)
        .json({ message: "Name and exam date are required" });
    }

    const existing = await Subject.findOne({
      user: req.user.id,
      name: name.trim(),
    });

    if (existing) {
      return res.status(400).json({ message: "subject already exists" });
    }

    const subject = await Subject.create({
      user: req.user.id,
      name,
      examDate,
      difficulty: difficulty || "Medium",
      color: color || "667eea",
    });
    res.status(201).json({
      message: "Subject added successfully ✅",
      subject,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// get all subject

export const getSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find({ user: req.user.id }).sort({
      examDate: 1,
    });

    const subjectsWithDays = subjects.map((subject) => {
      const today = new Date();
      const exam = new Date(subject.examDate);
      const daysRemaining = Math.ceil((exam - today) / (1000 * 60 * 60 * 24));
      return {
        ...subject.toObject(),
        daysRemaining,
      };
    });

    res.status(200).json({
      message: "Subjects fetched ✅",
      count: subjects.length,
      subjects: subjectsWithDays,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

//update subject

export const updateSubject = async (req, res) => {
  try {
    const { name, examDate, difficulty, color } = req.body;

    const subject = await Subject.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!subject) {
      return res.status(404).json({ message: "Subject not found" });
    }

    if (name) subject.name = name;
    if (examDate) subject.examDate = examDate;
    if (difficulty) subject.difficulty = difficulty;
    if (color) subject.color = color;

    await subject.save();

    res.status(200).json({
      message: "Subject updated ✅",
      subject,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


//delete subject
export const deleteSubject = async (req,res) => {
     try {
    const subject = await Subject.findOne({ 
      _id: req.params.id, 
      user: req.user.id 
    })

    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' })
    }

    await subject.deleteOne()

    res.status(200).json({ message: 'Subject deleted ✅' })

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}