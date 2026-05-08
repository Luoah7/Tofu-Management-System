/**
 * 解析微信订货文本
 * 格式示例：
 *   东桥超市：豆腐 20斤，黑豆腐 10斤
 *   刘记：豆干 8斤
 */
export function parseWeChatText(text: string): Array<{
  merchantName: string;
  items: Array<{ name: string; weight: number }>;
}> {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const result: Array<{ merchantName: string; items: Array<{ name: string; weight: number }> }> = [];

  for (const line of lines) {
    // 分割商户名和商品
    const colonMatch = line.match(/^[：:]?\s*(.+?)[：:]\s*(.+)$/);
    if (!colonMatch) continue;

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
    }
  }

  return result;
}

/**
 * 匹配商品名到商品ID和规格ID
 */
export function matchProduct(
  itemName: string,
  products: Array<{ id: string; name: string; specs: Array<{ id: string; label: string; unitPrice: number }> }>,
): { productId: string; specId: string; name: string; specLabel: string; unitPrice: number } | null {
  for (const product of products) {
    if (itemName.includes(product.name)) {
      const spec = product.specs[0]; // 默认取第一个规格
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
  }
  return null;
}
