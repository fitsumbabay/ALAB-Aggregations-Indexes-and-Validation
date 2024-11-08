import express from "express";
import db from "../db/conn.mjs";
import { ObjectId } from "mongodb";

const router = express.Router();

/**
 * It is not best practice to seperate these routes
 * like we have done here. This file was created
 * specifically for educational purposes, to contain
 * all aggregation routes in one place.
 */

/**
 * Grading Weights by Score Type:
 * - Exams: 50%
 * - Quizes: 30%
 * - Homework: 20%
 */


// GET /grades/stats
router.get("/grades/stats", async (req, res) => {
  try {
    const gradesCollection = await db.collection("grades");

    // Get all grades
    const grades = await gradesCollection.find({}).toArray();

    const totalLearners = grades.length;
    let learnersAbove70Count = 0;

    // Calculate the weighted average for each learner and count those over 70%
    const learnerAverages = {};

    grades.forEach(({ learners_id, scores }) => {
      const numScores = scores.length;

      // Assuming scores is an array of objects with `type` and `score`
      // Determine weighted averages
      const quizScores = scores.filter(s => s.type === 'quiz').map(s => s.score);
      const examScores = scores.filter(s => s.type === 'exam').map(s => s.score);
      const homeworkScores = scores.filter(s => s.type === 'homework').map(s => s.score);

      const avgQuiz = quizScores.length ? (quizScores.reduce((sum, score) => sum + score, 0) / quizScores.length) : 0;
      const avgExam = examScores.length ? (examScores.reduce((sum, score) => sum + score, 0) / examScores.length) : 0;
      const avgHomework = homeworkScores.length ? (homeworkScores.reduce((sum, score) => sum + score, 0) / homeworkScores.length) : 0;

      // Calculate the weighted average
      const weightedAverage = (avgExam * 0.5) + (avgQuiz * 0.3) + (avgHomework * 0.2);
      
      // Store the weighted average by learner ID
      learnerAverages[learners_id] = weightedAverage;

      // Count how many are above 70
      if (weightedAverage > 70) {
        learnersAbove70Count++;
      }
    });

    const percentageAbove70 = totalLearners > 0 ? (learnersAbove70Count / totalLearners) * 100 : 0;

    // Respond with statistics
    res.status(200).json({
      totalLearners,
      learnersAbove70Count,
      percentageAbove70: percentageAbove70.toFixed(2),
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});


// GET /grades/stats/:id
router.get("/grades/stats/:id", async (req, res) => {
  const classId = req.params.id;

  try {
    const gradesCollection = await db.collection("grades");

    // Retrieve all grades for learners in the specified class
    const grades = await gradesCollection.find({ class_id: classId }).toArray();
    
    const totalLearners = grades.length;
    let learnersAbove70Count = 0;

    // Compute weighted averages directly
    grades.forEach(({ learner_id, scores }) => {
      if (!scores || scores.length === 0) return; // Skip if no scores

      const quizScores = scores.filter(s => s.type === 'quiz').map(s => s.score);
      const examScores = scores.filter(s => s.type === 'exam').map(s => s.score);
      const homeworkScores = scores.filter(s => s.type === 'homework').map(s => s.score);

      // Calculate averages
      const avgQuiz = quizScores.length ? (quizScores.reduce((sum, score) => sum + score, 0) / quizScores.length) : 0;
      const avgExam = examScores.length ? (examScores.reduce((sum, score) => sum + score, 0) / examScores.length) : 0;
      const avgHomework = homeworkScores.length ? (homeworkScores.reduce((sum, score) => sum + score, 0) / homeworkScores.length) : 0;

      // Calculate the weighted average
      const weightedAverage = (avgExam * 0.5) + (avgQuiz * 0.3) + (avgHomework * 0.2);
      
      // Count learners above 70%
      if (weightedAverage > 70) {
        learnersAbove70Count++;
      }
    });

    const percentageAbove70 = totalLearners ? (learnersAbove70Count / totalLearners) * 100 : 0;
    
    res.status(200).json({
      totalLearners,
      learnersAbove70Count,
      percentageAbove70: percentageAbove70.toFixed(2),
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Get the weighted average of a specified learner's grades, per class
router.get("/learner/:id/avg-class", async (req, res) => {
  let collection = await db.collection("grades");

  let result = await collection
    .aggregate([
      {
        $match: { learner_id: Number(req.params.id) },
      },
      {
        $unwind: { path: "$scores" },
      },
      {
        $group: {
          _id: "$class_id",
          quiz: {
            $push: {
              $cond: {
                if: { $eq: ["$scores.type", "quiz"] },
                then: "$scores.score",
                else: "$$REMOVE",
              },
            },
          },
          exam: {
            $push: {
              $cond: {
                if: { $eq: ["$scores.type", "exam"] },
                then: "$scores.score",
                else: "$$REMOVE",
              },
            },
          },
          homework: {
            $push: {
              $cond: {
                if: { $eq: ["$scores.type", "homework"] },
                then: "$scores.score",
                else: "$$REMOVE",
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          class_id: "$_id",
          avg: {
            $sum: [
              { $multiply: [{ $avg: "$exam" }, 0.5] },
              { $multiply: [{ $avg: "$quiz" }, 0.3] },
              { $multiply: [{ $avg: "$homework" }, 0.2] },
            ],
          },
        },
      },
    ])
    .toArray();

  if (!result) res.send("Not found").status(404);
  else res.send(result).status(200);
});

export default router;
