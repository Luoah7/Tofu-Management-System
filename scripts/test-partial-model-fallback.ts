import assert from 'node:assert/strict';

process.env.DEEPSEEK_API_KEY = 'test-key';
process.env.DEEPSEEK_BASE_URL = 'https://deepseek.test';
process.env.DEEPSEEK_MODEL = 'test-model';

let requestedContent = '';
const originalFetch = globalThis.fetch;

globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
  const body = JSON.parse(String(init?.body || '{}'));
  requestedContent = body.messages?.[1]?.content || '';

  return new Response(JSON.stringify({
    choices: [
      {
        message: {
          content: JSON.stringify({
            orders: [
              {
                merchantName: '东桥',
                items: [
                  { name: '豆干', amount: 2, unit: '斤', weight: 2 },
                ],
              },
            ],
          }),
        },
      },
    ],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}) as typeof fetch;

const { parseOrderText } = await import('../server/utils/order-parser.js');

const parsed = await parseOrderText('东桥：豆腐一筐，豆干照旧');

globalThis.fetch = originalFetch;

assert.equal(parsed.length, 1, '本地和模型结果应该合并到同一个商户');
assert.deepEqual(
  parsed[0].items,
  [
    { name: '豆腐', amount: 1, unit: '筐', weight: 12 },
    { name: '豆干', amount: 2, unit: '斤', weight: 2, source: 'model' },
  ],
  '模型只补未识别片段，本地识别结果应该保留',
);
assert.ok(requestedContent.includes('豆干照旧'), '模型请求应该包含未识别片段');
assert.ok(!requestedContent.includes('豆腐一筐'), '模型请求不应该包含已经本地识别的片段');

console.log('partial model fallback regression test passed');
