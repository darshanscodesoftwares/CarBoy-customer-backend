// Parse the start time from a slot string like "11:00 AM – 01:00 PM".
// Returns { hh, mm } in 24h or null if it can't parse.
export function parseSlotStartTime(slot) {
  const startStr = (slot || '').split(/[–-]/)[0].trim();
  const match = startStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hh = parseInt(match[1], 10);
  const mm = parseInt(match[2], 10);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && hh !== 12) hh += 12;
  if (ampm === 'AM' && hh === 12) hh = 0;
  return { hh, mm };
}

// Returns the slot's start as a Date in IST. The schedule.date is stored as a
// UTC midnight (IST midnight normalized) so we add the slot's hours/minutes in IST.
export function slotStartDateIST(scheduleDate, slot) {
  const parsed = parseSlotStartTime(slot);
  if (!parsed || !scheduleDate) return null;
  const date = new Date(scheduleDate);
  if (isNaN(date.getTime())) return null;
  // Convert to IST date, set hours, convert back to UTC.
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(date.getTime() + istOffsetMs);
  istDate.setUTCHours(parsed.hh, parsed.mm, 0, 0);
  return new Date(istDate.getTime() - istOffsetMs);
}

// Defense-in-depth check: a slot is valid only when its start time is at least
// `bufferMinutes` in the future. Frontend uses 180min, backend uses 60min so
// timing edge cases between client+server clocks don't reject legit bookings.
export function isScheduleInFuture(scheduleDate, slot, bufferMinutes = 60) {
  const slotStart = slotStartDateIST(scheduleDate, slot);
  if (!slotStart) return true; // can't parse — let other validation handle it
  const cutoff = new Date(Date.now() + bufferMinutes * 60_000);
  return slotStart > cutoff;
}
