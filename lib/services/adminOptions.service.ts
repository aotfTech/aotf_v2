import Subject from "@/lib/models/Subject";
import Source from "@/lib/models/Source";
import Class from "@/lib/models/Class";
import Board from "@/lib/models/Board";

export async function listSubjects() {
  return Subject.find().sort({ label: 1 }).lean();
}

export async function createSubject({ key, label }: { key: string; label: string }) {
  const doc = await Subject.create({ key, label });
  return doc.toObject();
}

export async function updateSubjectById(id: string, { key, label }: { key: string; label: string }) {
  const doc = await Subject.findByIdAndUpdate(
    id,
    { key, label },
    { new: true, runValidators: true },
  ).lean();
  return doc;
}

export async function deleteSubjectById(id: string) {
  return Subject.findByIdAndDelete(id).lean();
}

export async function listSources() {
  return Source.find().sort({ label: 1 }).lean();
}

export async function createSource({ key, label }: { key: string; label: string }) {
  const doc = await Source.create({ key, label });
  return doc.toObject();
}

export async function updateSourceById(id: string, { key, label }: { key: string; label: string }) {
  const doc = await Source.findByIdAndUpdate(
    id,
    { key, label },
    { new: true, runValidators: true },
  ).lean();
  return doc;
}

export async function deleteSourceById(id: string) {
  return Source.findByIdAndDelete(id).lean();
}

// ─── Classes ─────────────────────────────────────────────────────────────────

export async function listClasses() {
  return Class.find().sort({ label: 1 }).lean();
}

export async function createClass({ key, label }: { key: string; label: string }) {
  const doc = await Class.create({ key, label });
  return doc.toObject();
}

export async function updateClassById(id: string, { key, label }: { key: string; label: string }) {
  const doc = await Class.findByIdAndUpdate(
    id,
    { key, label },
    { new: true, runValidators: true },
  ).lean();
  return doc;
}

export async function deleteClassById(id: string) {
  return Class.findByIdAndDelete(id).lean();
}

// ─── Boards ──────────────────────────────────────────────────────────────────

export async function listBoards() {
  return Board.find().sort({ label: 1 }).lean();
}

export async function createBoard({ key, label }: { key: string; label: string }) {
  const doc = await Board.create({ key, label });
  return doc.toObject();
}

export async function updateBoardById(id: string, { key, label }: { key: string; label: string }) {
  const doc = await Board.findByIdAndUpdate(
    id,
    { key, label },
    { new: true, runValidators: true },
  ).lean();
  return doc;
}

export async function deleteBoardById(id: string) {
  return Board.findByIdAndDelete(id).lean();
}

