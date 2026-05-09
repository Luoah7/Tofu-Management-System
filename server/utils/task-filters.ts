const TEST_MERCHANT_KEYWORDS = ['测试', 'test', 'demo'];

export function isTestMerchantName(name = '') {
  const normalized = name.trim().toLowerCase();
  return TEST_MERCHANT_KEYWORDS.some(keyword => normalized.includes(keyword));
}
