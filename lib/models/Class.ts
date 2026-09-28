import mongoose, { Schema, Document, Model } from "mongoose";

export interface IClass extends Document {
  key: string;
  label: string;
  createdAt: Date;
  updatedAt: Date;
}

const ClassSchema = new Schema<IClass>(
  {
    key: { type: String, required: true, unique: true },
    label: { type: String, required: true },
  },
  { timestamps: true }
);

const Class: Model<IClass> =
  mongoose.models.Class || mongoose.model<IClass>("Class", ClassSchema);

export default Class;
