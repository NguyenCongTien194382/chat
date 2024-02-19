import mongoose from "mongoose";
const TestSchema = new mongoose.Schema(
  {
      name: {
        type: String,
        required: true,
      },
      countId: {
        type: Number,
        required: true,
      },
  },
  { collection: 'Test' }
);

export default mongoose.model("Test", TestSchema);