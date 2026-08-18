import { spawn } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { Readable as NodeReadable, Writable as NodeWritable } from 'node:stream'
import {
  ClientSideConnection,
  ndJsonStream,
  PROTOCOL_VERSION,
  type Client,
} from '@agentclientprotocol/sdk'

const cwd = 'D:\\mycode\\deepseek\\.tmp-cursor-acp-review-probe'
await mkdir(cwd, { recursive: true })
await writeFile(`${cwd}\\probe.txt`, 'BEFORE_ONE\nBEFORE_TWO\n', 'utf8')
const child = spawn(
  'C:\\Users\\李现\\AppData\\Local\\cursor-agent\\versions\\2026.08.11-e8db854\\node.exe',
  [
    'C:\\Users\\李现\\AppData\\Local\\cursor-agent\\versions\\2026.08.11-e8db854\\index.js',
    '--model',
    'cursor-grok-4.5-high-fast',
    'acp',
  ],
  {
    cwd,
    stdio: ['pipe', 'pipe', 'inherit'],
    env: {
      ...process.env,
      HTTP_PROXY: 'http://127.0.0.1:7890',
      HTTPS_PROXY: 'http://127.0.0.1:7890',
      ALL_PROXY: 'http://127.0.0.1:7890',
      NODE_USE_ENV_PROXY: '1',
    },
  },
)

try {
  const client: Client = {
    sessionUpdate(params) {
      if (
        params.update.sessionUpdate === 'tool_call'
        || params.update.sessionUpdate === 'tool_call_update'
        || params.update.sessionUpdate === 'agent_message_chunk'
      ) {
        console.log(`UPDATE ${JSON.stringify(params.update)}`)
      }
      return Promise.resolve()
    },
    requestPermission(params) {
      console.log(`PERMISSION ${JSON.stringify(params.toolCall)}`)
      const allow = params.options.find(
        option => option.kind === 'allow_once' || option.kind === 'allow_always',
      )
      return Promise.resolve(allow === undefined
        ? { outcome: { outcome: 'cancelled' } }
        : { outcome: { outcome: 'selected', optionId: allow.optionId } })
    },
  }
  const conn = new ClientSideConnection(
    () => client,
    ndJsonStream(
      NodeWritable.toWeb(child.stdin) as WritableStream<Uint8Array>,
      NodeReadable.toWeb(child.stdout) as ReadableStream<Uint8Array>,
    ),
  )
  await conn.initialize({ protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} })
  const session = await conn.newSession({ cwd, mcpServers: [] })
  const result = await conn.prompt({
    sessionId: session.sessionId,
    prompt: [{
      type: 'text',
      text: 'In probe.txt, replace BEFORE_TWO with AFTER_TWO and make no other change, then stop.',
    }],
  })
  console.log(`STOP ${result.stopReason}`)
  console.log(`FILE ${JSON.stringify(await readFile(`${cwd}\\probe.txt`, 'utf8'))}`)
} finally {
  child.stdin.end()
  await new Promise<void>((resolve) => {
    if (child.exitCode !== null) {
      resolve()
      return
    }
    const timer = setTimeout(() => {
      child.kill()
    }, 3_000)
    child.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
  })
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await rm(cwd, { recursive: true, force: true })
      break
    } catch (error: unknown) {
      if (attempt === 9) throw error
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }
}
