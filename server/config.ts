import './env.js';

type AdminBootstrapConfig = {
  username: string;
  password: string;
  displayName: string;
  role: string;
};

const DEV_JWT_SECRET = 'development-only-change-me';

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }

  return DEV_JWT_SECRET;
}

export function getAdminBootstrapConfig(): AdminBootstrapConfig | null {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username && !password) return null;
  if (!username || !password) {
    throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD must be configured together');
  }

  return {
    username,
    password,
    displayName: process.env.ADMIN_DISPLAY_NAME || '管理员',
    role: process.env.ADMIN_ROLE || 'admin',
  };
}

export function getDeepSeekConfig() {
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.API_Key || '';
  const baseUrl = process.env.DEEPSEEK_BASE_URL || process.env['Base_URL(OpenAI)'] || '';
  const model = process.env.DEEPSEEK_MODEL || process.env.model || '';

  return {
    apiKey,
    baseUrl,
    model,
    enabled: Boolean(apiKey && baseUrl && model),
  };
}
