import mongoose from 'mongoose';

/**
 * Atomic sequence counter shared across BOTH backends (customer-BE + admin-BE
 * point at the same MongoDB, so this single collection is the one source of
 * truth for REQ/JOB numbering).
 *
 * Usage:
 *   const seq = await nextRequestNumberSeq(); // handles seeding + atomic inc
 *   const requestNumber = `REQ-${String(seq).padStart(6, '0')}`;
 *
 * findOneAndUpdate with $inc is atomic at the document level — MongoDB
 * guarantees no two concurrent callers ever receive the same seq, which the
 * old read-max-then-+1 pre-save hooks could NOT guarantee. That race caused
 * two customers to share REQ-000533 and cross-link their payments.
 */
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // e.g. "requestNumber"
  seq: { type: Number, default: 0 },
});

const Counter =
  mongoose.models.Counter || mongoose.model('Counter', counterSchema);

/**
 * Atomically reserve and return the next sequence value for `name`.
 * Plain atomic inc — assumes the counter has already been seeded to at least
 * the current max (see ensureSeeded).
 */
export async function nextSequence(name) {
  const doc = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return doc.seq;
}

/**
 * Seed the counter from the current max numeric value found in `collection`
 * field `field` (format PREFIX-000123), but ONLY if the counter doc doesn't
 * exist yet. Safe to call repeatedly — it no-ops once seeded.
 *
 * Run this once at startup so the very first atomic inc continues from the
 * existing data instead of restarting at 1 (which would collide).
 */
export async function ensureSeeded(name, Model, field, prefixLen) {
  const existing = await Counter.findById(name).lean();
  if (existing) return; // already seeded

  // find current max from existing documents
  const last = await Model.findOne({ [field]: new RegExp(`^.+-\\d+$`) })
    .sort({ [field]: -1 })
    .select(field)
    .lean();
  let maxNum = 0;
  if (last && last[field]) {
    const n = parseInt(String(last[field]).slice(prefixLen), 10);
    if (!Number.isNaN(n)) maxNum = n;
  }

  // Insert seeded value only if still absent (guards against a race between
  // two startups). $setOnInsert ensures we never clobber an existing seq.
  await Counter.updateOne(
    { _id: name },
    { $setOnInsert: { seq: maxNum } },
    { upsert: true }
  );
}

export default Counter;
