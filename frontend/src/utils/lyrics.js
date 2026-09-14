export const parseLrc = (lrcString) => {
  if (!lrcString) return [];
  const lines = lrcString.split('\n');
  const parsed = [];
  const regex = /\[(\d{1,3}):(\d{2}(?:\.\d{1,3})?)\](.*)/;
  for (const line of lines) {
    const match = line.match(regex);
    if (match) {
      const m = parseInt(match[1]);
      const s = parseFloat(match[2]);
      let text = match[3].trim();
      let gender = null;
      let part = null;
      
      // Handle AI generated angle brackets <M>, <F>, <B> and M:, F:
      const tagRegex = /^(?:<([MFB])>|([MFB])\s*:|BOTH\s*:)/i;
      const tagMatch = text.match(tagRegex);
      if (tagMatch) {
         const g = (tagMatch[1] || tagMatch[2] || '').toUpperCase();
         if (g === 'M' || g === 'F') gender = g;
         if (g === 'B' || text.toUpperCase().startsWith('BOTH')) part = 'BOTH';
         text = text.replace(tagRegex, '').trim();
      }

      if (text) {
        parsed.push({ timeMs: (m * 60 + s) * 1000, text, gender, part });
      }
    }
  }
  return parsed;
};
