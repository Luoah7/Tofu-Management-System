import { getDeepSeekConfig } from '../config.js';
import { normalizeOrderText, parseWeChatText } from './wechat-parser.js';

type ParsedOrder = {
  merchantName: string;
  items: Array<{ name: string; amount?: number; unit?: string; weight: number; source?: 'rule' | 'model' }>;
  warnings?: string[];
  unrecognizedSegments?: string[];
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

function normalizeParsedOrders(input: unknown): ParsedOrder[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((entry): ParsedOrder | null => {
      if (!entry || typeof entry !== 'object') return null;
      const merchantName = String((entry as any).merchantName || '').trim();
      const warnings = Array.isArray((entry as any).warnings)
        ? (entry as any).warnings
            .map((item: any) => String(item || '').trim())
            .filter(Boolean)
        : [];
      const unrecognizedSegments = Array.isArray((entry as any).unrecognizedSegments)
        ? (entry as any).unrecognizedSegments
            .map((item: any) => String(item || '').trim())
            .filter(Boolean)
        : [];
      const items = Array.isArray((entry as any).items)
        ? (entry as any).items
            .map((item: any) => ({
              name: String(item?.name || '').trim(),
              amount: Number(item?.amount || item?.weight || 0),
              unit: String(item?.unit || '斤').trim(),
              weight: Number(item?.weight || 0),
              source: 'model' as const,
            }))
            .filter((item: any) => item.name && Number.isFinite(item.weight) && item.weight > 0)
        : [];

      if (!merchantName || (items.length === 0 && warnings.length === 0 && unrecognizedSegments.length === 0)) return null;
      return {
        merchantName,
        items,
        ...(warnings.length > 0 && { warnings }),
        ...(unrecognizedSegments.length > 0 && { unrecognizedSegments }),
      };
    })
    .filter((item): item is ParsedOrder => item !== null);
}

function mergeParsedOrders(localParsed: ParsedOrder[], modelParsed: ParsedOrder[]) {
  const merged: Array<ParsedOrder & { warnings: string[]; unrecognizedSegments: string[] }> = localParsed.map(order => ({
    ...order,
    items: [...order.items],
    warnings: [...(order.warnings || [])],
    unrecognizedSegments: [...(order.unrecognizedSegments || [])],
  }));

  for (const modelOrder of modelParsed) {
    const existing = merged.find(order => order.merchantName === modelOrder.merchantName);
    if (existing) {
      existing.items.push(...modelOrder.items);
      existing.warnings = existing.warnings?.filter((warning) => {
        return !modelOrder.items.some(item => warning.includes(item.name));
      });
      existing.unrecognizedSegments = existing.unrecognizedSegments?.filter((segment) => {
        return !modelOrder.items.some(item => segment.includes(item.name));
      });
      continue;
    }

    merged.push({
      ...modelOrder,
      warnings: [...(modelOrder.warnings || [])],
      unrecognizedSegments: [...(modelOrder.unrecognizedSegments || [])],
    });
  }

  return merged.map(order => ({
    merchantName: order.merchantName,
    items: order.items,
    ...((order.warnings?.length || 0) > 0 && { warnings: order.warnings }),
    ...((order.unrecognizedSegments?.length || 0) > 0 && { unrecognizedSegments: order.unrecognizedSegments }),
  }));
}

function buildFallbackText(localParsed: ParsedOrder[]) {
  return localParsed
    .map((order) => {
      const segments = [...(order.warnings || []), ...(order.unrecognizedSegments || [])];
      if (segments.length === 0) return '';
      return `${order.merchantName}: ${segments.join('，')}`;
    })
    .filter(Boolean)
    .join('\n');
}

export async function parseOrderText(text: string): Promise<ParsedOrder[]> {
  const normalizedText = normalizeOrderText(text);
  const localParsed = parseWeChatText(normalizedText);
  const fallbackText = buildFallbackText(localParsed);
  if (localParsed.length > 0 && !fallbackText) {
    return localParsed;
  }

  const config = getDeepSeekConfig();
  if (!config.enabled) {
    return localParsed;
  }

  try {
    const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content: [
              '你是豆腐配送订单整理助手。',
              '任务是把微信订单文字整理成 JSON。',
              '只返回 JSON，不要解释。',
              '格式必须是 {"orders":[{"merchantName":"商户名","items":[{"name":"商品名","amount":12.5,"unit":"斤","weight":12.5}],"warnings":["需人工确认的备注"]}]}。',
              'weight 单位固定为斤，只保留数字；amount 是客户原始数量，unit 是斤、公斤或筐。',
              '明天早上一盘、明早一盘、一筐，都按豆腐 12 斤处理。',
              '只写豆腐但没写数量时，默认按 12 斤处理。',
              '少送、多送、不要这类数量不明确的话，不要编数字，写进 warnings。',
              '如果无法识别，返回 {"orders":[] }。',
            ].join(''),
          },
          {
            role: 'user',
            content: fallbackText || normalizedText,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`deepseek ${response.status}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('empty deepseek response');
    }

    const parsed = JSON.parse(extractJsonObject(content));
    const normalized = normalizeParsedOrders(parsed.orders);
    if (localParsed.length > 0) {
      return normalized.length > 0 ? mergeParsedOrders(localParsed, normalized) : localParsed;
    }
    return normalized.length > 0 ? normalized : localParsed;
  } catch {
    return localParsed;
  }
}
