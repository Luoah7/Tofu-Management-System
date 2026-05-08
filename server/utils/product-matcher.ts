import { getDeepSeekConfig } from '../config.js';
import { matchProduct } from './wechat-parser.js';

type ProductSpec = {
  id: string;
  label: string;
  unitPrice: number;
};

type ProductCandidate = {
  id: string;
  name: string;
  specs: ProductSpec[];
};

type ProductMatchResult = {
  productId: string;
  specId: string;
  name: string;
  specLabel: string;
  unitPrice: number;
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

function buildLocalResult(itemName: string, products: ProductCandidate[]): ProductMatchResult | null {
  const matched = matchProduct(itemName, products);
  if (!matched) return null;

  return {
    productId: matched.productId,
    specId: matched.specId,
    name: matched.name,
    specLabel: matched.specLabel,
    unitPrice: matched.unitPrice,
  };
}

export async function matchProductWithModel(itemName: string, products: ProductCandidate[]): Promise<ProductMatchResult | null> {
  const localMatched = buildLocalResult(itemName, products);
  const config = getDeepSeekConfig();

  if (!config.enabled || products.length === 0) {
    return localMatched;
  }

  const candidateProducts = products
    .filter(product => itemName.includes(product.name) || product.name.includes(itemName) || itemName.replace(/\s+/g, '').includes(product.name.replace(/\s+/g, '')))
    .slice(0, 3);

  if (candidateProducts.length !== 1 || candidateProducts[0].specs.length <= 1) {
    return localMatched;
  }

  const product = candidateProducts[0];

  try {
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
              '你是商品规格匹配助手。',
              '根据订单商品描述，从候选规格中选最准确的一项。',
              '只返回 JSON，不要解释。',
              '格式必须是 {"specId":"规格ID"}。',
              '如果无法确认，就返回 {"specId":""}。',
            ].join(''),
          },
          {
            role: 'user',
            content: JSON.stringify({
              itemName,
              productName: product.name,
              specs: product.specs.map(spec => ({
                specId: spec.id,
                label: spec.label,
                unitPrice: spec.unitPrice,
              })),
            }),
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
    const specId = String(parsed?.specId || '').trim();
    const matchedSpec = product.specs.find(spec => spec.id === specId);

    if (!matchedSpec) {
      return localMatched;
    }

    return {
      productId: product.id,
      specId: matchedSpec.id,
      name: product.name,
      specLabel: matchedSpec.label,
      unitPrice: matchedSpec.unitPrice,
    };
  } catch {
    return localMatched;
  }
}
