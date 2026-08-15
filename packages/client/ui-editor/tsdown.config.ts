import { clientBundle } from '../tsdown.client.ts'

export default clientBundle('@deepseek-ai/dsh-client-ui-editor', ['lib/types/index.js', 'lib/types/invariant.js'], {
  // The module loader's require() only answers platform table words. Shiki
  // grammars otherwise emit sibling `require("./lang-*.cjs")` chunks that
  // throw at materialize and leave the desktop shell on the blank boot page.
  client: { codeSplitting: false },
})
