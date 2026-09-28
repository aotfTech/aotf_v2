import mongoose, { Schema, Document, Model } from "mongoose";

export interface IBoard extends Document {
  key: string;
  label: string;
  createdAt: Date;
  updatedAt: Date;
}

const BoardSchema = new Schema<IBoard>(
  {
    key: { type: String, required: true, unique: true },
    label: { type: String, required: true },
  },
  { timestamps: true }
);

const Board: Model<IBoard> =
  mongoose.models.Board || mongoose.model<IBoard>("Board", BoardSchema);

export default Board;
