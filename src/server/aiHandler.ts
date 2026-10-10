import { GoogleGenAI } from '@google/genai';
import type { IncomingMessage, ServerResponse } from 'http';

function readJsonBody<T = any>(req: IncomingMessage): Promise<T> {
  // If already parsed by upstream middleware
  if ((req as any).body && typeof (req as any).body === 'object') {
    return Promise.resolve((req as any).body as T);
  }

  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      // Allow up to 10MB
      if (body.length > 10 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Request entity too large'));
      }
    });
    req.on('end', () => {
      if (!body) {
        resolve({} as T);
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({} as T);
      }
    });
    req.on('error', reject);
  });
}

function sendJsonResponse(res: ServerResponse, statusCode: number, data: any) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function getGenAiClient(customApiKey?: string): GoogleGenAI {
  const apiKey =
    customApiKey ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    '';
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Candidate models in priority order: start with fast, highly available models
const CANDIDATE_MODELS = ['gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-3.8-flash'];

function timeoutPromise<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    ),
  ]);
}

async function generateWithFallback(ai: GoogleGenAI, contents: any): Promise<string> {
  let lastError: any = null;

  for (const model of CANDIDATE_MODELS) {
    try {
      const response = await timeoutPromise(
        ai.models.generateContent({
          model,
          contents,
        }),
        15000
      );
      if (response && response.text && response.text.trim()) {
        return response.text;
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[CogniNote AI] Attempt with model "${model}" failed:`, err?.message || err);
      // Gracefully continue to fallback model without locking or breaking!
    }
  }

  throw lastError || new Error('AI service temporarily unavailable.');
}

// Resilient, high-quality local NLP synthesis fallbacks (handles spoken transcripts without punctuation)
function localSynthesizeSummary(content: string, title?: string): string {
  const cleanContent = content
    .replace(/^#+\s+/gm, '')
    .replace(/[*_`]/g, '')
    .trim();

  if (!cleanContent) return 'Empty note.';

  // Split into sentences or thought-clauses (support run-on voice transcripts)
  let clauses = cleanContent
    .split(/(?<=[.!?\n])\s+|(?<=\s)(?:so that's why|that's why|in my opinion|especially why|I mean|also)\s+/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 25);

  if (clauses.length === 0) {
    const words = cleanContent.split(/\s+/);
    if (words.length > 30) {
      clauses = [
        words.slice(0, 25).join(' ') + '...',
        words.slice(Math.floor(words.length / 2), Math.floor(words.length / 2) + 25).join(' ') + '...',
      ];
    } else {
      return cleanContent;
    }
  }

  // Format into 2 crisp synthesized takeaways
  const first = clauses[0].replace(/^(hi|hello|hey)\s+(my\s+name\s+is\s+[^,.]+[,.]?\s*)?/i, '');
  const keyInsight = clauses.length > 1 ? clauses[Math.min(clauses.length - 1, Math.floor(clauses.length / 2))] : '';

  const bullet1 = first.charAt(0).toUpperCase() + first.slice(1);
  const bullet2 = keyInsight ? keyInsight.charAt(0).toUpperCase() + keyInsight.slice(1) : '';

  if (bullet2 && bullet2 !== bullet1) {
    return `${bullet1}.\n\nKey Focus: ${bullet2}.`;
  }
  return bullet1.endsWith('.') ? bullet1 : `${bullet1}.`;
}

function localExtractTags(content: string, title?: string): string[] {
  const stopWords = new Set([
    'the', 'and', 'with', 'from', 'this', 'that', 'have', 'were', 'which', 'your', 'about', 'there',
    'into', 'some', 'could', 'them', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its',
    'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well',
    'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us', 'are', 'for',
    'what', 'when', 'where', 'who', 'why', 'been', 'each', 'make', 'just', 'more', 'note', 'notes',
    'name', 'facing', 'know', 'learn', 'things', 'mean', 'easily', 'going', 'around', 'interested',
    'especially', 'understand', 'develop', 'normal', 'little', 'different', 'protect', 'making', 'important'
  ]);

  const domainKeywords = [
    { pattern: /\b(?:computer|software|developer|development|programming|code|coding)\b/i, tag: 'Software Development' },
    { pattern: /\b(?:ai|artificial intelligence|intelligence|model|neural|llm)\b/i, tag: 'AI & Intelligence' },
    { pattern: /\b(?:math|mathematics|problem solving|aptitude)\b/i, tag: 'Mathematics' },
    { pattern: /\b(?:java|python|javascript|typescript|c\+\+|rust)\b/i, tag: 'Programming' },
    { pattern: /\b(?:college|student|degree|b\.sc|study|learning)\b/i, tag: 'Academics' },
    { pattern: /\b(?:hardware|system|product|tech|technology)\b/i, tag: 'Technology' },
  ];

  const matched: string[] = [];
  const text = `${title || ''} ${content}`;

  for (const { pattern, tag } of domainKeywords) {
    if (pattern.test(text) && !matched.includes(tag)) {
      matched.push(tag);
    }
  }

  // Also collect non-stop capital words
  const words = text.match(/[A-Za-z][A-Za-z0-9_+#-]{2,18}/g) || [];
  for (const w of words) {
    const lower = w.toLowerCase();
    if (!stopWords.has(lower) && !matched.includes(w) && w.length >= 4 && /^[A-Z]/.test(w)) {
      matched.push(w);
      if (matched.length >= 5) break;
    }
  }

  return matched.length > 0 ? matched.slice(0, 5) : ['Notes', 'Ideas', 'Productivity'];
}

function localGenerateTitle(content: string): string {
  const clean = content.replace(/^#+\s*/, '').replace(/[*_`]/g, '').trim();

  // If starts with introduction, extract the core topic
  if (/^hi my name is\s+/i.test(clean)) {
    const afterIntro = clean.replace(/^hi my name is\s+[^,.]+[.,\s]*/i, '').trim();
    if (afterIntro) {
      if (/computer|software|ai|programming/i.test(afterIntro)) {
        return 'Career & Tech Exploration';
      }
      const words = afterIntro.split(/\s+/).slice(0, 5).join(' ');
      return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Personal Note';
    }
  }

  const firstLine = clean.split('\n')[0].trim();
  if (firstLine.length > 5 && firstLine.length < 50 && !/^(hi|hello)/i.test(firstLine)) {
    return firstLine;
  }

  const words = clean.split(/\s+/).filter((w) => w.length > 2).slice(0, 5);
  const candidate = words.join(' ');
  return candidate ? candidate.charAt(0).toUpperCase() + candidate.slice(1) : 'Thought Canvas Note';
}

function localImproveNote(content: string, title?: string): string {
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
  const formattedBullets = lines.map((line) => {
    if (line.startsWith('#') || line.startsWith('•') || line.startsWith('-')) return line;
    return `• ${line.charAt(0).toUpperCase() + line.slice(1)}`;
  });

  return `${title ? `### ${title}\n\n` : ''}${formattedBullets.join('\n')}`;
}

function localAnswerQuestion(content: string, title: string, question: string): string {
  const cleanQ = question.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const qWords = cleanQ.split(/\s+/).filter((w) => w.length > 2);
  const sentences = content.split(/(?<=[.!?\n])\s+/).filter(Boolean);

  const scored = sentences
    .map((s) => {
      const lower = s.toLowerCase();
      const score = qWords.reduce((acc, word) => acc + (lower.includes(word) ? 1 : 0), 0);
      return { sentence: s.trim(), score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length > 0) {
    return scored.slice(0, 3).map((s) => s.sentence).join(' ');
  }

  return `Based on "${title || 'your note'}":\n${content.slice(0, 200)}...`;
}

export async function handleAiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  urlPath: string,
  requestBody?: any
): Promise<boolean> {
  if (!urlPath.startsWith('/api/ai/')) {
    return false;
  }

  if (req.method !== 'POST') {
    sendJsonResponse(res, 405, { error: 'Method not allowed. Use POST.' });
    return true;
  }

  try {
    let body: any = requestBody;
    if (!body || (typeof body === 'object' && Object.keys(body).length === 0)) {
      if ((req as any).body && typeof (req as any).body === 'object') {
        body = (req as any).body;
      } else {
        body = await readJsonBody(req);
      }
    }

    // Extract API key from headers or request body or environment variable
    const headerKey =
      (req.headers['x-goog-api-key'] as string) ||
      (req.headers['x-api-key'] as string) ||
      (req.headers['authorization']?.replace(/^Bearer\s+/i, '') as string) ||
      body?.apiKey;

    const apiKey = headerKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    const ai = getGenAiClient(apiKey);

    if (urlPath === '/api/ai/summarize') {
      const { title, content } = body;
      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        sendJsonResponse(res, 400, { error: 'Please enter some content before summarizing.' });
        return true;
      }

      const prompt = `You are CogniNote AI, a high-precision intelligent note assistant.
Generate a concise, clear, and insightful summary (2 to 4 sentences or crisp bullet takeaways) of the following note.
Do not use conversational filler, greetings, or meta-commentary. Provide only the clear summary text.

Note Title: ${title || 'Untitled'}
Note Content:
${content}`;

      try {
        const rawText = await generateWithFallback(ai, prompt);
        sendJsonResponse(res, 200, { summary: rawText.trim() });
      } catch {
        sendJsonResponse(res, 200, { summary: localSynthesizeSummary(content, title) });
      }
      return true;
    }

    if (urlPath === '/api/ai/tags') {
      const { title, content, existingTags } = body;
      if (!content || typeof content !== 'string') {
        sendJsonResponse(res, 400, { error: 'Note content is required.' });
        return true;
      }

      const prompt = `You are CogniNote AI. Analyze the note below and suggest 3 to 6 high-relevance, concise category tags for organizing it.
Existing tags to avoid duplicating: ${Array.isArray(existingTags) ? existingTags.join(', ') : 'none'}.
Rules:
- Return ONLY a valid JSON array of strings (e.g. ["Python", "Django", "Backend", "API"]).
- No '#' symbols in the strings.
- 1 to 2 words per tag.
- Strictly JSON output with no markdown code blocks or additional commentary.

Note Title: ${title || 'Untitled'}
Note Content:
${content}`;

      try {
        const rawText = await generateWithFallback(ai, prompt);
        let cleaned = rawText.trim()
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/\s*```$/, '')
          .trim();

        let tags: string[] = [];
        try {
          tags = JSON.parse(cleaned);
          if (!Array.isArray(tags)) tags = [];
        } catch {
          tags = cleaned
            .split(/[\n,]/)
            .map((t) => t.replace(/^[#"\s*]+|[#"\s*]+$/g, '').trim())
            .filter((t) => t.length > 0 && t.length < 25)
            .slice(0, 6);
        }

        if (tags.length === 0) tags = localExtractTags(content, title);
        sendJsonResponse(res, 200, { tags });
      } catch {
        sendJsonResponse(res, 200, { tags: localExtractTags(content, title) });
      }
      return true;
    }

    if (urlPath === '/api/ai/title') {
      const { content } = body;
      if (!content || typeof content !== 'string') {
        sendJsonResponse(res, 400, { error: 'Note content is required.' });
        return true;
      }

      const prompt = `You are CogniNote AI. Read the following note content and generate a single concise, punchy, and descriptive title (3 to 6 words).
Capture the core subject, ambition, or topic of the note. Do not use generic phrases or echo introduction greetings like "Hi my name is".
Return ONLY the title text, with no quotes, markdown formatting, or preamble.

Note Content:
${content}`;

      try {
        const rawText = await generateWithFallback(ai, prompt);
        const title = (rawText || 'Untitled Note')
          .replace(/^["'`#\s]+|["'`\s]+$/g, '')
          .trim();
        sendJsonResponse(res, 200, { title });
      } catch {
        sendJsonResponse(res, 200, { title: localGenerateTitle(content) });
      }
      return true;
    }

    if (urlPath === '/api/ai/improve') {
      const { title, content } = body;
      if (!content || typeof content !== 'string') {
        sendJsonResponse(res, 400, { error: 'Note content is required.' });
        return true;
      }

      const prompt = `You are an expert technical editor and notebook organizer for CogniNote AI.
Restructure and polish the following rough note to make it clear, well-structured, and easy to read.
Use clean markdown (such as clean headings, organized bullet points, and code formatting where suitable) while strictly preserving all original information, facts, terminology, and meaning.
Do not add conversational preamble, pleasantries, or explanations. Return only the improved note content.

Title: ${title || 'Untitled'}
Rough Content:
${content}`;

      try {
        const rawText = await generateWithFallback(ai, prompt);
        sendJsonResponse(res, 200, {
          improvedContent: rawText.trim() || content,
        });
      } catch {
        sendJsonResponse(res, 200, { improvedContent: localImproveNote(content, title) });
      }
      return true;
    }

    if (urlPath === '/api/ai/ask') {
      const { title, content, question } = body;
      if (!content || !question) {
        sendJsonResponse(res, 400, { error: 'Content and question are required.' });
        return true;
      }

      const prompt = `You are CogniNote AI, answering a question based strictly on this user's note.
Be concise, accurate, and direct.

Note Title: ${title || 'Untitled'}
Note Content:
${content}

User Question: ${question}`;

      try {
        const rawText = await generateWithFallback(ai, prompt);
        sendJsonResponse(res, 200, {
          answer: rawText.trim() || localAnswerQuestion(content, title, question),
        });
      } catch {
        sendJsonResponse(res, 200, {
          answer: localAnswerQuestion(content, title, question),
        });
      }
      return true;
    }

    if (urlPath === '/api/ai/transcribe') {
      const { audioBase64, mimeType } = body;
      if (!audioBase64) {
        sendJsonResponse(res, 400, { error: 'Audio data is required' });
        return true;
      }

      const prompt = [
        {
          inlineData: {
            mimeType: mimeType || 'audio/webm',
            data: audioBase64,
          },
        },
        {
          text: 'Transcribe this spoken speech accurately into plain text. Do not add intro/outro comments, timestamps, or quotes. Output only the spoken words.',
        },
      ];

      try {
        const rawText = await generateWithFallback(ai, prompt);
        sendJsonResponse(res, 200, {
          transcript: rawText.trim(),
        });
      } catch {
        sendJsonResponse(res, 200, {
          transcript: '',
        });
      }
      return true;
    }

    sendJsonResponse(res, 404, { error: 'Unknown AI endpoint' });
    return true;
  } catch (error: any) {
    sendJsonResponse(res, 200, {
      error: 'AI service temporarily unavailable.',
    });
    return true;
  }
}
