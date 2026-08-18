/** Durable settings namespace for product-wide GUI onboarding facts. */
export const WELCOME_NOTICE_SETTINGS_NAMESPACE = 'ui-onboarding'

/** Field storing the last welcome notice version the user acknowledged. */
export const WELCOME_NOTICE_ACK_FIELD = 'welcomeNoticeVersion'

/**
 * Bump only when the notice changes materially and every user should see it
 * again. The acknowledgement is compared for exact equality.
 */
export const WELCOME_NOTICE_VERSION = '2026-08-17.1'

/** The complete editable product welcome notice in both supported GUI locales. */
export const WELCOME_NOTICE_COPY = {
  zh: {
    title: '欢迎使用万物智汇',
    body: '万物智汇是装在本机上的编程助手。打开一个项目文件夹，在右侧对话里说出你想做的事；中间是编辑器，左侧是文件、搜索和 Git。\n\n当前仍在内测，功能和界面会继续改。下一步请填入 API Key，然后选一个文件夹开始。',
    continueLabel: '继续',
  },
  en: {
    title: 'Welcome to Xmart',
    body: 'Xmart is a desktop coding assistant for local projects. Open a folder, describe the work in chat on the right; the editor sits in the middle, with files, search, and Git on the left.\n\nThis build is still in preview. Add an API key next, then pick a project folder to start.',
    continueLabel: 'Continue',
  },
} as const
