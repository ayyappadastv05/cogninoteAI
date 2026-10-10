function getAiHeaders(): Record<string, string> {
  const apiKey =
    import.meta.env.VITE_GEMINI_API_KEY ||
    (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : '') ||
    '';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers['x-goog-api-key'] = apiKey;
    headers['x-api-key'] = apiKey;
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  return headers;
}

export async function summarizeNote(content: string, title?: string): Promise<string> {
  const res = await fetch('/api/ai/summarize', {
    method: 'POST',
    headers: getAiHeaders(),
    body: JSON.stringify({ content, title }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(data.error || 'AI service is currently unavailable. Please try again.');
  }

  return data.summary || '';
}

export async function suggestTags(
  content: string,
  title?: string,
  existingTags: string[] = []
): Promise<string[]> {
  const res = await fetch('/api/ai/tags', {
    method: 'POST',
    headers: getAiHeaders(),
    body: JSON.stringify({ content, title, existingTags }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(data.error || 'AI service is currently unavailable. Please try again.');
  }

  return Array.isArray(data.tags) ? data.tags : [];
}

export async function generateTitle(content: string): Promise<string> {
  const res = await fetch('/api/ai/title', {
    method: 'POST',
    headers: getAiHeaders(),
    body: JSON.stringify({ content }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(data.error || 'AI service is currently unavailable. Please try again.');
  }

  return data.title || 'Thought Canvas Note';
}

export async function improveNote(content: string, title?: string): Promise<string> {
  const res = await fetch('/api/ai/improve', {
    method: 'POST',
    headers: getAiHeaders(),
    body: JSON.stringify({ content, title }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(data.error || 'AI service is currently unavailable. Please try again.');
  }

  return data.improvedContent || content;
}

export async function askNote(title: string, content: string, question: string): Promise<string> {
  const res = await fetch('/api/ai/ask', {
    method: 'POST',
    headers: getAiHeaders(),
    body: JSON.stringify({ title, content, question }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(data.error || 'AI service is currently unavailable. Please try again.');
  }

  return data.answer || '';
}

export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const buffer = await audioBlob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.byteLength; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk as any);
  }
  const audioBase64 = btoa(binary);

  const res = await fetch('/api/ai/transcribe', {
    method: 'POST',
    headers: getAiHeaders(),
    body: JSON.stringify({
      audioBase64,
      mimeType: audioBlob.type || 'audio/webm',
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(data.error || 'AI transcription failed. Please try again.');
  }

  return data.transcript || '';
}
