/** Resolve Learning course document id from API payloads. */
export function learningCourseId(courseOrId) {
  if (courseOrId == null) return '';
  if (typeof courseOrId === 'string' || typeof courseOrId === 'number') {
    const s = String(courseOrId).trim();
    return s && s !== 'undefined' && s !== 'null' ? s : '';
  }
  const raw = courseOrId._id ?? courseOrId.id;
  if (raw == null) return '';
  const s = String(raw).trim();
  return s && s !== 'undefined' && s !== 'null' ? s : '';
}

export function isLearningCourseId(value) {
  const s = learningCourseId(value);
  return /^[a-fA-F0-9]{24}$/.test(s);
}
