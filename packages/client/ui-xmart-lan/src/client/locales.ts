/** LAN settings copy. */

export type LanKey =
  | 'nav' | 'title' | 'intro' | 'enabled' | 'port' | 'loopback'
  | 'lanUrl' | 'token' | 'copy' | 'rotate' | 'bindError'
  | 'firewall' | 'warning'

export const zh: Record<LanKey, string> = {
  nav: '局域网',
  title: '局域网访问',
  intro: '打开后，同一 WiFi 的手机可用浏览器进入本机正在运行的万物智汇。有口令的人能驱动带 shell 的 agent。只在家庭或可信办公网使用，不要做端口映射或公网暴露。',
  enabled: '允许局域网访问',
  port: '端口',
  loopback: '本机窗口',
  lanUrl: '手机请打开',
  token: '口令',
  copy: '复制',
  rotate: '重新生成',
  bindError: '绑定失败',
  firewall: 'Windows 若弹防火墙，请允许专用网络。',
  warning: '关闭开关后手机立刻连不上，本机窗口不受影响。',
}

export const en: Record<LanKey, string> = {
  nav: 'LAN',
  title: 'LAN access',
  intro: 'When on, a phone on the same Wi-Fi can open this running X-Mart in a browser. Anyone with the token can drive an agent that has a shell. Use this only on a home or trusted office network. Do not port-forward or expose it publicly.',
  enabled: 'Allow LAN access',
  port: 'Port',
  loopback: 'This window',
  lanUrl: 'Open on your phone',
  token: 'Token',
  copy: 'Copy',
  rotate: 'Regenerate',
  bindError: 'Bind failed',
  firewall: 'If Windows asks about the firewall, allow Private networks.',
  warning: 'Turning the switch off drops the phone immediately. This window stays up.',
}
