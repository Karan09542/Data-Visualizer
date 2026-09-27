const DEVICE_NAME_KEY = 'transfer-device-name';

export interface DeviceInfo {
  socketId: string;
  name: string;
  platform: string; // 'mobile' | 'desktop'
  connectedAt: number;
}

const detectBrowser = (ua: string) => {
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('OPR/')) return 'Opera';
  if (ua.includes('Firefox/')) return 'Firefox';
  if (ua.includes('Chrome/')) return 'Chrome';
  if (ua.includes('Safari/')) return 'Safari';
  return 'Browser';
};

const detectOs = (ua: string) => {
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iPhone') || ua.includes('iPad') || ua.includes('iPod')) return 'iOS';
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Mac OS X')) return 'macOS';
  if (ua.includes('Linux')) return 'Linux';
  return 'Device';
};

export const isMobileDevice = () => {
  const ua = navigator.userAgent;
  return ua.includes('Android') || ua.includes('iPhone') || ua.includes('iPad')
    || ua.includes('iPod') || ua.includes('Mobile');
};

/** Label shown in the device picker, e.g. "Windows - Chrome". Users can override it per browser. */
export const getDeviceLabel = () => {
  try {
    const custom = localStorage.getItem(DEVICE_NAME_KEY);
    if (custom && custom.trim()) return custom.trim().slice(0, 40);
  } catch { /* storage unavailable */ }
  const ua = navigator.userAgent;
  return detectOs(ua) + ' - ' + detectBrowser(ua);
};

export const setDeviceLabel = (name: string) => {
  try {
    localStorage.setItem(DEVICE_NAME_KEY, name.trim().slice(0, 40));
  } catch { /* storage unavailable */ }
};

/** Sent with the socket handshake so other devices of the same account can identify this one. */
export const getDeviceHandshake = () => ({
  name: getDeviceLabel(),
  platform: isMobileDevice() ? 'mobile' : 'desktop',
});
