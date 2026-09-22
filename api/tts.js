import { Communicate } from 'edge-tts-universal';

// In-memory cache for frequent chess phrases
const audioCache = new Map();
const MAX_CACHE = 200;

export default async function handler(req, res) {
  // Support CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  try {
    const host = req.headers.host || 'localhost';
    const proto = req.headers['x-forwarded-proto'] || 'http';
    const parsedUrl = new URL(req.url, `${proto}://${host}`);
    const text = (parsedUrl.searchParams.get('text') || '').trim().slice(0, 300);
    const lang = parsedUrl.searchParams.get('lang') || 'zh-Hans';

    if (!text) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.end('Missing text parameter');
    }

    // Default professional male voices:
    // zh-Hans: zh-CN-YunyangNeural (云扬 - 央视/国家级播音专业男声，象棋解说黄金音色)
    // zh-Hant: zh-TW-YunJheNeural (云哲 - 台湾专业自然男声)
    const defaultVoice = lang === 'zh-Hant' ? 'zh-TW-YunJheNeural' : 'zh-CN-YunyangNeural';
    const voice = parsedUrl.searchParams.get('voice') || defaultVoice;

    const cacheKey = `${voice}|${text}`;
    if (audioCache.has(cacheKey)) {
      const cached = audioCache.get(cacheKey);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400');
      res.setHeader('X-TTS-Cache', 'HIT');
      res.statusCode = 200;
      return res.end(cached);
    }

    const communicate = new Communicate(text, {
      voice,
      rate: '-4%',
      pitch: '-4Hz',
    });

    const chunks = [];
    for await (const chunk of communicate.stream()) {
      if (chunk.type === 'audio' && chunk.data) {
        chunks.push(chunk.data);
      }
    }

    if (!chunks.length) {
      throw new Error('No audio received from TTS service');
    }

    const audioBuffer = Buffer.concat(chunks);

    if (audioCache.size >= MAX_CACHE) {
      // Evict oldest item
      const firstKey = audioCache.keys().next().value;
      audioCache.delete(firstKey);
    }
    audioCache.set(cacheKey, audioBuffer);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400');
    res.setHeader('X-TTS-Cache', 'MISS');
    res.statusCode = 200;
    res.end(audioBuffer);
  } catch (err) {
    console.error('Serverless TTS error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('TTS Error: ' + (err.message || String(err)));
  }
}
