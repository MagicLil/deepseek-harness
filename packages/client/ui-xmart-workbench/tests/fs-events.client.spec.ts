import { describe, expect, it, vi } from 'vitest'
import { createWorkbenchFsDefinition, pathFromArgs, pathsFromFileTool } from '../src/client/fs-events.ts'

describe('pathFromArgs / pathsFromFileTool', () => {
  it('parses path fields and classifies mutations', () => {
    expect(pathFromArgs('{')).toEqual([])
    expect(pathFromArgs('null')).toEqual([])
    expect(pathFromArgs('[]')).toEqual([])
    expect(pathFromArgs('{"x":1}')).toEqual([])
    expect(pathFromArgs('{"path":""}')).toEqual([])
    expect(pathFromArgs('{"file_path":"/a.ts"}')).toEqual(['/a.ts'])
    expect(pathsFromFileTool('read', '{"path":"/a.ts"}', undefined)).toEqual({
      refresh: ['/a.ts'], reload: [],
    })
    expect(pathsFromFileTool('write', '{}', [{ path: '/a.ts' }, { path: '/a.ts' }, { path: '' }])).toEqual({
      refresh: ['/a.ts'], reload: ['/a.ts'],
    })
    expect(pathsFromFileTool('edit', '{"path":"/b.ts"}', undefined).reload).toEqual(['/b.ts'])
    expect(pathsFromFileTool('str_replace_editor', '{"path":"/c.ts"}', undefined).reload).toEqual(['/c.ts'])
  })
})

describe('createWorkbenchFsDefinition', () => {
  it('matches file-tool events and notifies on new seq', () => {
    const onTouch = vi.fn()
    const def = createWorkbenchFsDefinition(onTouch)
    expect(def.match({ type: 'turn/start', data: { turn: 1 } } as never)).toEqual({
      id: '1', role: 'start',
    })
    expect(def.match({ type: 'tool/call', data: { turn: 2 } } as never)?.role).toBe('update')
    expect(def.match({ type: 'tool/result', data: {}, surfaceOp: 'append' } as never)?.role).toBe('update')
    expect(def.match({ type: 'message', data: {} } as never)).toBeNull()
    expect(() => def.start({} as never, { event: { type: 'tool/call', data: {} } } as never)).toThrow(
      'workbench-fs start requires turn/start',
    )
    const state = def.start({} as never, { event: { type: 'turn/start', data: { turn: 1 } } } as never)
    expect(state.turn).toBe(1)
    const same = def.update({ state } as never, { event: { type: 'tool/result', data: {} } } as never)
    expect(same).toBe(state)
    const empty = def.update({ state } as never, {
      event: { type: 'tool/call', seq: 1, data: { name: 'read', arguments: '{}' } },
    } as never)
    expect(empty).toBe(state)
    const next = def.update({ state } as never, {
      event: { type: 'tool/call', seq: 4, data: { name: 'write', arguments: '{"path":"/a.ts"}' } },
      view: { for: 'call', view: { locations: [{ path: '/a.ts' }] } },
    } as never)
    expect(next.refresh).toEqual(['/a.ts'])
    expect(onTouch).toHaveBeenCalledWith(4, ['/a.ts'], ['/a.ts'])
    const again = def.update({ state: next } as never, {
      event: { type: 'tool/call', seq: 5, data: { name: 'read', arguments: '{"path":"/b.ts"}' } },
      view: { for: 'result' },
    } as never)
    expect(again.refresh).toEqual(['/a.ts', '/b.ts'])
  })
})
