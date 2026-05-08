const publicEnv = (import.meta as any).env || {};

export const businessProfile = {
  name: publicEnv.VITE_BUSINESS_NAME || '豆业配货系统',
  phone: publicEnv.VITE_BUSINESS_PHONE || '',
  address: publicEnv.VITE_BUSINESS_ADDRESS || '',
};
