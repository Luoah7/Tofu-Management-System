import { normalizeTaskItemInput, normalizeTaskItemUnit, type TaskItemUnit } from '../../src/shared/task-item.js';

export type ParsedOrderItem = {
  name: string;
  amount: number;
  unit: TaskItemUnit;
  weight: number;
  source?: 'rule' | 'model';
};

export type ParsedOrder = {
  merchantName: string;
  items: ParsedOrderItem[];
  warnings?: string[];
  unrecognizedSegments?: string[];
};

/**
 * 解析微信订货文本
 * 格式示例：
 *   东桥超市：豆腐 20斤，黑豆腐 10斤
 *   刘记：豆干 8斤
 */
export function normalizeOrderText(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[０-９Ａ-Ｚａ-ｚ]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/[：]/g, ':')
    .replace(/[，]/g, ',')
    .replace(/[；;]+/g, '\n')
    .replace(/[；;]+/g, '\n')
    .replace(/斤\s*(?=[^\n:]{2,20}:)/g, '斤\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

const CHINESE_DIGITS: Record<string, number> = {
  零: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

const AMOUNT_PATTERN = String.raw`(?:\d+(?:\.\d+)?|[一二两三四五六七八九十半]+)`;
const UNIT_PATTERN = String.raw`(?:斤|公斤|千克|kg|KG|筐|盘)`;
const UNCLEAR_AMOUNT_PATTERN = /(少送|多送|不要|别送|先别送|少来点|少来|来点|照旧)/;
const TIME_WORD_PATTERN = /(明天早上|今天早上|后天早上|明早|今早|明晚|明天|今天|后天|早上|上午|中午|下午|晚上|今晚)/g;

function parseChineseAmount(value: string) {
  if (/^\d+(?:\.\d+)?$/.test(value)) return Number(value);
  if (value === '半') return 0.5;

  if (value.includes('十')) {
    const [left, right] = value.split('十');
    const tens = left ? CHINESE_DIGITS[left] ?? 0 : 1;
    const ones = right ? CHINESE_DIGITS[right] ?? 0 : 0;
    return tens * 10 + ones;
  }

  if (value.length === 1 && value in CHINESE_DIGITS) {
    return CHINESE_DIGITS[value];
  }

  return 0;
}

function normalizeMeasuredUnit(unitValue: string) {
  if (/^(公斤|千克|kg|KG)$/i.test(unitValue)) return '公斤';
  if (/^(筐|盘)$/.test(unitValue)) return '筐';
  return '斤';
}

function cleanOrderItemName(value: string) {
  return value
    .replace(TIME_WORD_PATTERN, '')
    .replace(/^(送|配送|来|要)\s*/, '')
    .replace(/\s+/g, '')
    .trim();
}

function splitItemParts(textValue: string) {
  return textValue
    .replace(/[。！!]/g, ',')
    .split(/[\n,、]\s*/)
    .map(item => item.trim())
    .filter(Boolean);
}

export function parseWeChatText(text: string): ParsedOrder[] {
  const normalizedText = normalizeOrderText(text);
  const lines = normalizedText.split('\n').map(l => l.trim()).filter(Boolean);
  const result: ParsedOrder[] = [];

  const createMeasuredItem = (name: string, amount: number, unit: TaskItemUnit) => {
    const normalized = normalizeTaskItemInput({ displayAmount: amount, displayUnit: unit });
    return {
      name: name.trim(),
      amount: normalized.displayAmount,
      unit: normalized.displayUnit,
      weight: normalized.plannedWeight,
    };
  };

  const parseMeasuredItem = (textValue: string) => {
    const measuredMatch = textValue.trim().match(new RegExp(`^(.+?)\\s*(${AMOUNT_PATTERN})\\s*(${UNIT_PATTERN})$`));
    if (!measuredMatch) return null;

    const amount = parseChineseAmount(measuredMatch[2]);
    if (!amount) return null;

    return createMeasuredItem(
      cleanOrderItemName(measuredMatch[1]),
      amount,
      normalizeTaskItemUnit(normalizeMeasuredUnit(measuredMatch[3])),
    );
  };

  const parseMeasuredItems = (textValue: string) => {
    const items: ParsedOrderItem[] = [];
    const measuredPattern = new RegExp(`([^\\s,、]+?)\\s*(${AMOUNT_PATTERN})\\s*(${UNIT_PATTERN})`, 'g');
    let match: RegExpExecArray | null;

    while ((match = measuredPattern.exec(textValue)) !== null) {
      const amount = parseChineseAmount(match[2]);
      const name = cleanOrderItemName(match[1]);
      if (!amount || !name) continue;
      items.push(createMeasuredItem(name, amount, normalizeTaskItemUnit(normalizeMeasuredUnit(match[3]))));
    }

    return items;
  };

  const parseColloquialItems = (merchantName: string, textValue: string): ParsedOrder | null => {
    const cleaned = textValue
      .replace(TIME_WORD_PATTERN, '')
      .replace(/^(送|配送)\s*/g, '')
      .replace(/[。！!]/g, '')
      .trim();

    const parts = splitItemParts(cleaned);

    const items: ParsedOrderItem[] = [];
    const warnings: string[] = [];
    const unrecognizedSegments: string[] = [];

    for (const part of parts) {
      const normalizedPart = part.replace(/\s+/g, '');
      if (UNCLEAR_AMOUNT_PATTERN.test(normalizedPart)) {
        warnings.push(`${part.replace(/\s+/g, '')}，数量不明确，需人工确认`);
        continue;
      }

      if (new RegExp(`^(${AMOUNT_PATTERN})\\s*(盘|筐)$`).test(normalizedPart)) {
        const match = normalizedPart.match(new RegExp(`^(${AMOUNT_PATTERN})\\s*(盘|筐)$`));
        items.push(createMeasuredItem('豆腐', parseChineseAmount(match?.[1] || '1') || 1, '筐'));
        continue;
      }

      const measuredItems = parseMeasuredItems(part);
      if (measuredItems.length > 0) {
        items.push(...measuredItems);
        continue;
      }

      const measuredItem = parseMeasuredItem(part);
      if (measuredItem) {
        items.push(measuredItem);
        continue;
      }

      const defaultTofuMatch = part.match(/^(?:送)?(黑豆腐|脆皮豆腐|精品豆腐|豆腐)$/);
      if (defaultTofuMatch) {
        items.push(createMeasuredItem(defaultTofuMatch[1].trim(), 1, '筐'));
        continue;
      }

      unrecognizedSegments.push(part.replace(/\s+/g, ''));
    }

    if (items.length === 0 && warnings.length === 0 && unrecognizedSegments.length === 0) return null;
    return {
      merchantName,
      items,
      ...(warnings.length > 0 && { warnings }),
      ...(unrecognizedSegments.length > 0 && { unrecognizedSegments }),
    };
  };

  for (const line of lines) {
    // 分割商户名和商品
    const colonMatch = line.match(/^[：:]?\s*(.+?)[：:]\s*(.+)$/);
    if (!colonMatch) {
      const merchantMatch = line.match(/^([\u4e00-\u9fa5A-Za-z0-9]{2,20})\s+(.+)$/);
      if (!merchantMatch) continue;

      const colloquialOrder = parseColloquialItems(merchantMatch[1].trim(), merchantMatch[2].trim());
      if (colloquialOrder && (colloquialOrder.items.length > 0 || (colloquialOrder.warnings?.length || 0) > 0 || (colloquialOrder.unrecognizedSegments?.length || 0) > 0)) {
        result.push(colloquialOrder);
      }
      continue;
    }

    const merchantName = colonMatch[1].trim();
    const itemsStr = colonMatch[2];

    const colloquialOrder = parseColloquialItems(merchantName, itemsStr);
    if (colloquialOrder && (colloquialOrder.items.length > 0 || (colloquialOrder.warnings?.length || 0) > 0 || (colloquialOrder.unrecognizedSegments?.length || 0) > 0)) {
      result.push(colloquialOrder);
    }
  }

  return result;
}

/**
 * 匹配商品名到商品ID和规格ID
 */
function normalizeSpecText(text: string) {
  return text
    .replace(/\s+/g, '')
    .replace(/[（）()]/g, '')
    .replace(/¥?\d+(?:\.\d+)?\/?斤/g, '')
    .replace(/[0-9.]/g, '')
    .replace(/[价元]/g, '')
    .trim();
}

function normalizeProductAlias(itemName: string) {
  return normalizeSpecText(itemName)
    .replace(/干子/g, '豆干')
    .replace(/香干/g, '豆干');
}

function extractSpecDescriptor(itemName: string, productName: string) {
  return normalizeSpecText(itemName).replace(normalizeSpecText(productName), '').trim();
}

function chooseSpecByKeywords(
  itemName: string,
  product: { name: string; specs: Array<{ id: string; label: string; unitPrice: number }> },
) {
  const itemText = normalizeProductAlias(itemName);
  const normalizedProductName = normalizeSpecText(product.name);

  if (normalizedProductName.includes('豆腐') && /(精品|好豆腐)/.test(itemText)) {
    return product.specs.find(spec => /精品|好/.test(normalizeSpecText(spec.label))) || null;
  }

  if (normalizedProductName.includes('豆干')) {
    if (/(未调味|不调味|原味|白豆干)/.test(itemText)) {
      return product.specs.find(spec => /(未调味|不调味|原味|白)/.test(normalizeSpecText(spec.label))) || null;
    }

    if (/(五香|调味)/.test(itemText)) {
      return product.specs.find((spec) => {
        const label = normalizeSpecText(spec.label);
        return /(五香|调味)/.test(label) && !/(未调味|不调味)/.test(label);
      }) || null;
    }
  }

  return null;
}

export function matchProduct(
  itemName: string,
  products: Array<{ id: string; name: string; specs: Array<{ id: string; label: string; unitPrice: number }> }>,
): { productId: string; specId: string; name: string; specLabel: string; unitPrice: number } | null {
  const normalizedItemName = normalizeProductAlias(itemName);
  const matchedProducts = products
    .filter(product => normalizedItemName.includes(normalizeSpecText(product.name)))
    .sort((a, b) => b.name.length - a.name.length);

  for (const product of matchedProducts) {
    const keywordSpec = chooseSpecByKeywords(normalizedItemName, product);
    if (keywordSpec) {
      return {
        productId: product.id,
        specId: keywordSpec.id,
        name: product.name,
        specLabel: keywordSpec.label,
        unitPrice: keywordSpec.unitPrice,
      };
    }

    const itemDescriptor = extractSpecDescriptor(normalizedItemName, product.name);
    if (!itemDescriptor) {
      const defaultSpec = product.specs[0];
      if (defaultSpec) {
        return {
          productId: product.id,
          specId: defaultSpec.id,
          name: product.name,
          specLabel: defaultSpec.label,
          unitPrice: defaultSpec.unitPrice,
        };
      }
      continue;
    }

    const scoredSpecs = product.specs
      .map((spec) => {
        const specDescriptor = normalizeSpecText(spec.label);
        let score = 0;

        if (!specDescriptor) {
          return { spec, score };
        }

        if (itemDescriptor === specDescriptor) {
          score += 1000;
        }

        if (itemDescriptor.includes(specDescriptor) || specDescriptor.includes(itemDescriptor)) {
          score += 200;
        }

        const descriptorKeywords = specDescriptor.match(/[\u4e00-\u9fa5]{1,}/g) || [];
        for (const keyword of descriptorKeywords) {
          if (keyword && itemDescriptor.includes(keyword)) {
            score += keyword.length * 10;
          }
        }

        return { spec, score };
      })
      .sort((a, b) => b.score - a.score);

    const spec = scoredSpecs[0]?.spec || product.specs[0];
    if (spec) {
      return {
        productId: product.id,
        specId: spec.id,
        name: product.name,
        specLabel: spec.label,
        unitPrice: spec.unitPrice,
      };
    }
  }

  return null;
}
