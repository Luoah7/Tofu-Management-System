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
    .replace(/[；;]+/g, '\n')
    .replace(/斤\s*(?=[^\n：:]{2,20}[：:])/g, '斤\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

export function parseWeChatText(text: string): Array<{
  merchantName: string;
  items: Array<{ name: string; weight: number }>;
  warnings?: string[];
}> {
  const normalizedText = normalizeOrderText(text);
  const lines = normalizedText.split('\n').map(l => l.trim()).filter(Boolean);
  const result: Array<{ merchantName: string; items: Array<{ name: string; weight: number }>; warnings?: string[] }> = [];

  const parseColloquialItems = (merchantName: string, textValue: string): {
    merchantName: string;
    items: Array<{ name: string; weight: number }>;
    warnings?: string[];
  } | null => {
    const cleaned = textValue
      .replace(/^(明天早上|今天早上|后天早上|明早|今早|明晚|下午|晚上|明天|今天|后天)\s*/g, '')
      .replace(/^(送|配送)\s*/g, '')
      .replace(/[。！!]/g, '')
      .trim();

    const parts = cleaned
      .split(/[\n，,、]\s*/)
      .map(item => item.trim())
      .filter(Boolean);

    const items: Array<{ name: string; weight: number }> = [];
    const warnings: string[] = [];

    for (const part of parts) {
      if (/(少送|多送|不要|别送|先别送)/.test(part)) {
        warnings.push(`${part.replace(/\s+/g, '')}，数量不明确，需人工确认`);
        continue;
      }

      if ((/(一盘|1盘|一筐|1筐)/.test(part) && part.includes('豆腐')) || /^(一盘|1盘|一筐|1筐)$/.test(part)) {
        items.push({ name: '豆腐', weight: 12 });
        continue;
      }

      const weightedMatch = part.match(/^(.+?)\s*(\d+(?:\.\d+)?)\s*斤$/);
      if (weightedMatch) {
        items.push({
          name: weightedMatch[1].replace(/^(送|来|要)/, '').trim(),
          weight: parseFloat(weightedMatch[2]),
        });
        continue;
      }

      const defaultTofuMatch = part.match(/^(?:送)?(黑豆腐|脆皮豆腐|精品豆腐|豆腐|豆干)$/);
      if (defaultTofuMatch) {
        items.push({
          name: defaultTofuMatch[1].trim(),
          weight: 12,
        });
        continue;
      }
    }

    if (items.length === 0 && warnings.length === 0) return null;
    return {
      merchantName,
      items,
      warnings,
    };
  };

  for (const line of lines) {
    // 分割商户名和商品
    const colonMatch = line.match(/^[：:]?\s*(.+?)[：:]\s*(.+)$/);
    if (!colonMatch) {
      const merchantMatch = line.match(/^([\u4e00-\u9fa5A-Za-z0-9]{2,20})\s+(.+)$/);
      if (!merchantMatch) continue;

      const colloquialOrder = parseColloquialItems(merchantMatch[1].trim(), merchantMatch[2].trim());
      if (colloquialOrder && (colloquialOrder.items.length > 0 || (colloquialOrder.warnings?.length || 0) > 0)) {
        result.push(colloquialOrder);
      }
      continue;
    }

    const merchantName = colonMatch[1].trim();
    const itemsStr = colonMatch[2];

    // 解析商品：支持中文逗号、英文逗号、顿号分隔
    const itemParts = itemsStr.split(/[,，、]\s*/);
    const items: Array<{ name: string; weight: number }> = [];

    for (const part of itemParts) {
      // 匹配：商品名 + 数字 + 斤
      const itemMatch = part.trim().match(/^(.+?)\s*(\d+(?:\.\d+)?)\s*斤?$/);
      if (itemMatch) {
        items.push({
          name: itemMatch[1].trim(),
          weight: parseFloat(itemMatch[2]),
        });
      }
    }

    if (items.length > 0) {
      result.push({ merchantName, items });
      continue;
    }

    const colloquialOrder = parseColloquialItems(merchantName, itemsStr);
    if (colloquialOrder && (colloquialOrder.items.length > 0 || (colloquialOrder.warnings?.length || 0) > 0)) {
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

function extractSpecDescriptor(itemName: string, productName: string) {
  return normalizeSpecText(itemName).replace(normalizeSpecText(productName), '').trim();
}

export function matchProduct(
  itemName: string,
  products: Array<{ id: string; name: string; specs: Array<{ id: string; label: string; unitPrice: number }> }>,
): { productId: string; specId: string; name: string; specLabel: string; unitPrice: number } | null {
  const matchedProducts = products
    .filter(product => itemName.includes(product.name))
    .sort((a, b) => b.name.length - a.name.length);

  for (const product of matchedProducts) {
    const itemDescriptor = extractSpecDescriptor(itemName, product.name);
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
