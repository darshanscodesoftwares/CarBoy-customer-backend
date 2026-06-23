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

/**
 * Numeric max of Model[field] (format PREFIX-000123), computed in the DB so a
 * string sort can never misorder different-length numbers. Returns 0 if none.
 */
export async function currentMax(Model, field, prefixLen) {
  const rows = await Model.aggregate([
    { $match: { [field]: new RegExp('^.+-\\d+$') } },
    { $project: { n: { $toInt: { $substr: [`$${field}`, prefixLen, -1] } } } },
    { $sort: { n: -1 } },
    { $limit: 1 },
  ]);
  return rows.length ? rows[0].n : 0;
}

/**
 * SELF-HEALING sequence allocator. Reserves the next seq atomically; if that
 * value is <= the true max already present in the collection (i.e. the shared
 * counter drifted behind the admin-BE's own counter), it bumps the counter to
 * max+1 and reserves again. Guarantees the returned number is always strictly
 * greater than every existing one, so a drifted counter can never hard-block a
 * booking with an E11000 duplicate-key (manual-assign REQ-000577 incident,
 * 2026-06-23). Mirrors admin-BE counter.model.js.
 */
export async function nextSequenceSafe(name, Model, field, prefixLen) {
  await ensureSeeded(name, Model, field, prefixLen);
  let seq = await nextSequence(name);
  const max = await currentMax(Model, field, prefixLen);
  if (seq <= max) {
    const doc = await Counter.findByIdAndUpdate(
      name,
      { $max: { seq: max + 1 } },
      { new: true, upsert: true }
    );
    seq = doc.seq <= max ? await nextSequence(name) : doc.seq;
  }
  return seq;
}

export default Counter;
