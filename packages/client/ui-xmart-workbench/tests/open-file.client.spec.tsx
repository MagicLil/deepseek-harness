// @vitest-environment jsdom
/**
 * Click a workspace file → the editor column shows that file's tab.
 * This is the user-visible seam: ExplorerTab onOpenFile → openFile → column.
 */
import { useSyncExternalStore } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { ExplorerTab } from '../src/client/ExplorerTab.tsx'
import { WorkbenchColumn } from '../src/client/WorkbenchColumn.tsx'
import { XmartWorkbenchController } from '../src/client/service.ts'
import { createWorkbenchFilesStore } from '../src/client/files-store.ts'
import { activeEditorPath } from '../src/client/active-file.ts'
import { zh } from '../src/client/locales.ts'
import type { TabBodyProps } from '../src/client/types.ts'
import type { WorkbenchColumnProps } from '../src/client/contract.ts'

beforeEach(() => { localStorage.clear() })
afterEach(() => {
  localStorage.clear()
  cleanup()
})

const t = makeTranslate(zh, commonZh) as never

const JAVA = 'D:\\mycode\\worldCoffee\\microservices\\wc-common\\src\\main\\java\\cn\\lx\\worldcoffee\\common\\config\\GlobalExceptionHandler.java'

function FileBody({ tab }: TabBodyProps) {
  return <div data-testid="xmart-workbench-opened">{tab.path}</div>
}

describe('click-to-open in the editor column', () => {
  it('opens a Java file from the explorer into the editor strip', async () => {
    const service = new XmartWorkbenchController()
    service.registerTab({
      id: 'editor',
      title: '编辑器',
      hidden: true,
      dedupeKey: tab => tab.path,
      component: FileBody,
    })
    service.bindSession('s1')
    const files = createWorkbenchFilesStore()

    function Live() {
      const view = useSyncExternalStore(
        fn => service.subscribe(fn),
        () => service.getSnapshot('s1'),
      )
      return (
        <>
          <ExplorerTab
            tab={{ id: 'ex', type: 'explorer', title: '资源管理器' }}
            visible
            sessionId="s1"
            t={t}
            getRoots={() => [{ path: 'D:\\ws', title: 'ws' }]}
            watchSessions={() => () => {}}
            listEntries={async () => ({
              path: 'D:\\ws',
              truncated: false,
              entries: [
                { name: 'GlobalExceptionHandler.java', path: JAVA, kind: 'file', hidden: false },
              ],
            })}
            gitStatus={async () => ({
              root: 'D:\\ws', branch: 'main', ahead: 0, behind: 0, detached: false, changes: [],
            })}
            writeFile={async () => {}}
            createDirectory={async () => 'D:\\ws\\n'}
            renameEntry={async () => 'D:\\ws\\n'}
            deleteEntry={async () => {}}
            openSystem={async () => {}}
            openFile={(path) => {
              service.bindSession('s1')
              service.openFile(path, { sessionId: 's1' })
            }}
            mentionFile={() => {}}
            files={files}
            getActivePath={id => activeEditorPath(service.getSnapshot(id))}
            watchWorkbench={fn => service.subscribe(fn)}
          />
          <WorkbenchColumn
            {...({
              width: 400,
              sessionId: 's1' as SessionId,
              useSession: (() => null) as never,
              useSessions: (() => null) as never,
              useWorkspaces: (() => null) as never,
              openTab: () => {},
              closeTab: () => {},
              activateTab: () => {},
              resolveBody: type => service.getTab(type)?.component,
              useWorkbenchSession: sel => sel(view),
              useWorkbenchRegistry: sel => sel({ tabs: [], viewers: [], activities: [] }),
              t,
            } as WorkbenchColumnProps)}
          />
        </>
      )
    }

    render(<Live />)
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText('从资源管理器打开文件后，会显示在这里。')).toBeTruthy()
    fireEvent.click(screen.getByText('GlobalExceptionHandler.java'))
    expect(screen.getByRole('tab', { name: 'GlobalExceptionHandler.java' })).toBeTruthy()
    expect(screen.getByTestId('xmart-workbench-opened').textContent).toBe(JAVA)
    expect(screen.getByTestId('xmart-workbench-tree').querySelector('[data-active="true"]')?.getAttribute('data-path')).toBe(JAVA)
  })
})
