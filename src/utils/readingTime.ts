/**
 * Calculates estimated reading time based on word count.
 * Average reading speed: 200 words per minute.
 */
export function calculateReadingTime(content: string): {
  minutes: number;
  label: string;
  wordCount: number;
} {
  if (!content || !content.trim()) {
    return { minutes: 0, label: '< 1 min read', wordCount: 0 };
  }

  // Strip markdown formatting symbols for accurate word count
  const cleanText = content
    .replace(/^#+\s+/gm, '')
    .replace(/[*_`~[\]()]/g, ' ')
    .trim();

  const words = cleanText ? cleanText.split(/\s+/).filter(Boolean) : [];
  const wordCount = words.length;

  if (wordCount === 0) {
    return { minutes: 0, label: '< 1 min read', wordCount: 0 };
  }

  const rawMinutes = wordCount / 200;
  if (rawMinutes < 1) {
    return { minutes: 1, label: '< 1 min read', wordCount };
  }

  const minutes = Math.ceil(rawMinutes);
  return {
    minutes,
    label: `${minutes} min read`,
    wordCount,
  };
}
