import { getDeepSeekConfig } from '../config.js';

export type RecognizedWeight = {
  weight: number;
  unit: '斤' | '公斤';
  rawText: string;
};

function extractJsonObject(content: string) {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const raw = fenced?.[1]?.trim() || trimmed;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');

  if (start === -1 || end === -1 || end < start) {
    throw new Error('no json object found');
  }

  return raw.slice(start, end + 1);
}

function normalizeWeight(weight: number, unit: string) {
  const normalizedUnit = /^(kg|KG|公斤|千克)$/i.test(unit) ? '公斤' : '斤';
  const normalizedWeight = normalizedUnit === '公斤'
    ? Number((weight * 2).toFixed(1))
    : Number(weight.toFixed(1));

  return {
    weight: normalizedWeight,
    unit: normalizedUnit as '斤' | '公斤',
  };
}

export function extractWeightFromText(text: string): RecognizedWeight | null {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;

  try {
    const parsed = JSON.parse(extractJsonObject(normalized));
    const weight = Number(parsed?.weight || 0);
    const unit = String(parsed?.unit || '斤').trim();
    if (Number.isFinite(weight) && weight > 0) {
      const normalizedWeight = normalizeWeight(weight, unit);
      return {
        weight: normalizedWeight.weight,
        unit: normalizedWeight.unit,
        rawText: normalized,
      };
    }
  } catch {
    // ignore json parsing failure and continue with text matching
  }

  const explicitMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(斤|公斤|千克|kg|KG)\b/);
  if (explicitMatch) {
    const normalizedWeight = normalizeWeight(Number(explicitMatch[1]), explicitMatch[2]);
    return {
      weight: normalizedWeight.weight,
      unit: normalizedWeight.unit,
      rawText: normalized,
    };
  }

  const fallbackMatches = Array.from(normalized.matchAll(/\d+(?:\.\d+)?/g))
    .map(match => Number(match[0]))
    .filter(value => Number.isFinite(value) && value > 0 && value < 500);

  const best = fallbackMatches.sort((a, b) => b - a)[0];
  if (!best) return null;

  return {
    weight: Number(best.toFixed(1)),
    unit: '斤',
    rawText: normalized,
  };
}

export async function recognizeWeightFromImage(file: File): Promise<RecognizedWeight> {
  const config = getDeepSeekConfig();
  if (!config.enabled) {
    throw new Error('未配置识别模型');
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString('base64');
  const mimeType = file.type || 'image/jpeg';

  const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: [
            '你是电子秤识别助手。',
            '任务是识别图片里最主要的重量数字。',
            '只返回 JSON，不要解释。',
            '格式必须是 {"weight":12.3,"unit":"斤","rawText":"识别到的原文"}。',
            '如果图里单位是 kg、公斤、千克，就按原单位返回，不要换算。',
            '如果看不清或没有把握，返回 {"weight":0,"unit":"斤","rawText":""}。',
          ].join(''),
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: '识别这张秤面照片里的重量数字。' },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`识别失败 ${response.status}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('识别结果为空');
  }

  const recognized = extractWeightFromText(String(content));
  if (!recognized) {
    throw new Error('没识别出重量');
  }

  return recognized;
}
