import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(
  '@deepseek-ai/dsh-api-remotes',
  ['lib/types/index.js', 'lib/types/invariant.js'],
  {
    hostPhase: true,
    // Same reason as ui-editor: the client loader only answers platform seed
    // words. A sibling chunk (`require("./md")` from zod locales, etc.) throws
    // at materialize and leaves the desktop on the blank boot page.
    client: { codeSplitting: false },
  },
)
