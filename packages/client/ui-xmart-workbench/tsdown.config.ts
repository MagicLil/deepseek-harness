import { clientBundle } from '../tsdown.client.ts'

export default clientBundle('@deepseek-ai/dsh-client-ui-xmart-workbench', ['lib/types/index.js', 'lib/types/invariant.js'], {
  // Same as ui-editor/shiki: ModuleLoader require() cannot answer sibling
  // chunk paths. Keep xterm (+ FitAddon) inside lib/client.js.
  client: { codeSplitting: false },
})
