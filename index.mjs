
import express from "express";
import mongoose from "mongoose";
import grades from "./routes/grades.mjs";
import grades_agg from "./routes/grades_agg.mjs";
import db from './db/conn.mjs'


const PORT = process.env.PORT || 5050;
const app = express();

// MongoDB Connection URI
const dbUri = process.env.ATLAS_URI || db;

if (!dbUri) {
  throw new Error(
    "MongoDB connection string (ATLAS_URI) is missing in .env file."
  );
}

// Mongoose schema definition
const newGradesSchema = new mongoose.Schema({
  learner_id: {
    type: Number,
    required: true,
    min: 0,
  },
  class_id: {
    type: Number,
    required: true,
    min: 0,
    max: 300,
  },
  scores: [
    {
      type: { type: String, required: true }, // e.g., "quiz", "exam", "homework"
      score: { type: Number, required: true },
    },
  ],
});

// Index definitions
newGradesSchema.index({ class_id: 1 }); // Index on class_id
newGradesSchema.index({ learner_id: 1 }); // Index on learner_id

// Compound index on learner_id and class_id
newGradesSchema.index({ learner_id: 1, class_id: 1 }); // Compound index

// Create a model
const NewGrades = mongoose.model("NewGrades", newGradesSchema, "new_grades");

// Connect to MongoDB and start the server
async function startServer() {
  try {
    await mongoose.connect(dbUri);
    console.log("MongoDB connected");

    const db = mongoose.connection.db;

    // Check if the collection already exists
    const collections = await db
      .listCollections({ name: "new_grades" })
      .toArray();
    if (collections.length === 0) {
      // Create the new_grades collection with the specified validation rules if it doesn't exist
      await db.createCollection("new_grades", {
        validator: {
          $jsonSchema: {
            bsonType: "object",
            required: ["class_id", "learner_id"],
            properties: {
              class_id: {
                bsonType: "int",
                minimum: 0,
                maximum: 300,
                description: "must be an integer between 0 and 300, inclusive",
              },
              learner_id: {
                bsonType: "int",
                minimum: 0,
                description: "must be an integer greater than or equal to 0",
              },
            },
          },
        },
        validationAction: "warn",
      });

      console.log("Collection 'new_grades' created with validation rules");
    } else {
      console.log("Collection 'new_grades' already exists");
    }

    // Express middleware
    app.use(express.json());

    app.get("/", (req, res) => {
      res.send("Welcome to the API.");
    });

    app.use("/grades", grades);
    app.use("/grades_agg", grades_agg);

    // Global error handling
    app.use((err, _req, res, next) => {
      console.error(err);
      res.status(500).send("Seems like we messed up somewhere...");
    });

    // Start the Express server
    app.listen(PORT, () => {
      console.log(`Server is running on port: ${PORT}`);
    });
  } catch (err) {
    console.error("MongoDB connection error:", err);
  }
}

startServer();
