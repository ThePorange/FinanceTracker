export const parseLocalDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return null;
  // If it's already a full ISO string with time, we might still want to parse it as UTC or local
  // but for YYYY-MM-DD strings, we must parse as local to avoid timezone rollovers.
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  // Fallback for other formats
  return new Date(dateStr);
};

export const formatLocalDate = (dateStr: string | null | undefined) => {
  const date = parseLocalDate(dateStr);
  if (!date || isNaN(date.getTime())) return '-';
  return date.toLocaleDateString();
};
