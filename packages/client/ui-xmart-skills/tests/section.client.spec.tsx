// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SkillsSettingsSection } from '../src/client/SkillsSettingsSection.tsx'
import type { ManagedSkillSummary, SkillsSettingsProps } from '../src/client/contract.ts'
import { en, type SkillsKey } from '../src/client/locales.ts'

afterEach(cleanup)

const t = ((key: SkillsKey): string => en[key]) as SkillsSettingsProps['t']

const OWNED: ManagedSkillSummary = {
  name: 'mes-intake',
  description: 'Ask first',
  modelInvocable: true,
  userInvocable: true,
  origin: 'personal',
}

const PROJECT: ManagedSkillSummary = {
  name: 'qms-review',
  description: 'Review the form',
  modelInvocable: true,
  userInvocable: true,
  origin: 'project',
}

const AGENTS: ManagedSkillSummary = {
  name: 'dsh-code-review',
  description: 'Review code',
  modelInvocable: true,
  userInvocable: true,
  origin: 'agents',
}

const CLAUDE: ManagedSkillSummary = {
  name: 'claude-note',
  description: 'From Claude',
  modelInvocable: true,
  userInvocable: true,
  origin: 'claude',
}

const CURSOR: ManagedSkillSummary = {
  name: 'cursor-tip',
  description: 'From Cursor',
  modelInvocable: true,
  userInvocable: true,
  origin: 'cursor',
}

function props(overrides: Partial<SkillsSettingsProps> = {}): SkillsSettingsProps {
  return {
    t,
    useWorkspaces: (select: (state: { items: readonly { workspaceId: string; path: string }[]; recentWorkspaceId: string }) => unknown) =>
      select({ items: [{ workspaceId: 'w', path: '/proj/deepseek-harness' }], recentWorkspaceId: 'w' }),
    listOwned: vi.fn(async () => [OWNED]),
    listProject: vi.fn(async () => [PROJECT, AGENTS, CLAUDE, CURSOR]),
    setEnabled: vi.fn(async () => ({ ok: true })),
    ...overrides,
  }
}

describe('SkillsSettingsSection', () => {
  it('lists personal name, description, and origin', async () => {
    render(<SkillsSettingsSection {...props()} />)
    expect(screen.getByText(en.loading)).toBeTruthy()
    await waitFor(() => { expect(screen.getByText('mes-intake')).toBeTruthy() })
    expect(screen.getByText('Ask first')).toBeTruthy()
    expect(screen.getByText(en['origin.personal'])).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Import' })).toBeNull()
    expect(screen.queryByRole('tab', { name: 'Import' })).toBeNull()
    expect(screen.getByRole('switch', { name: `mes-intake ${en.enabled}` })).toBeTruthy()
  })

  it('labels a disabled switch', async () => {
    render(<SkillsSettingsSection {...props({
      listOwned: vi.fn(async () => [{ ...OWNED, modelInvocable: false }]),
    })} />)
    await waitFor(() => {
      expect(screen.getByRole('switch', { name: `mes-intake ${en.disabled}` })).toBeTruthy()
    })
  })

  it('toggles a personal skill and surfaces a failure', async () => {
    const setEnabled = vi.fn()
      .mockResolvedValueOnce({ ok: true as const })
      .mockResolvedValueOnce({ ok: false as const, error: 'not-found' })
    render(<SkillsSettingsSection {...props({ setEnabled })} />)
    await waitFor(() => { expect(screen.getByText('mes-intake')).toBeTruthy() })
    fireEvent.click(screen.getByRole('switch', { name: `mes-intake ${en.enabled}` }))
    await waitFor(() => {
      expect(setEnabled).toHaveBeenCalledWith({
        name: 'mes-intake',
        enabled: false,
      })
    })
    fireEvent.click(screen.getByRole('switch', { name: `mes-intake ${en.enabled}` }))
    await waitFor(() => { expect(screen.getByText(en['error.not-found'])).toBeTruthy() })
  })

  it('groups project skills by workspace and shows every origin', async () => {
    const listProject = vi.fn(async () => [PROJECT, AGENTS, CLAUDE, CURSOR])
    render(<SkillsSettingsSection {...props({ listProject })} />)
    await waitFor(() => { expect(screen.getByText('mes-intake')).toBeTruthy() })
    fireEvent.click(screen.getByRole('tab', { name: en['tab.project'] }))
    await waitFor(() => { expect(screen.getByText('deepseek-harness')).toBeTruthy() })
    expect(screen.getByText('/proj/deepseek-harness')).toBeTruthy()
    expect(listProject).toHaveBeenCalledWith('/proj/deepseek-harness')
    expect(screen.getByText('qms-review')).toBeTruthy()
    expect(screen.getByText(en['origin.project'])).toBeTruthy()
    expect(screen.getByText(en['origin.agents'])).toBeTruthy()
    expect(screen.getByText(en['origin.claude'])).toBeTruthy()
    expect(screen.getByText(en['origin.cursor'])).toBeTruthy()
  })

  it('toggles a project skill with its workspace path', async () => {
    const setEnabled = vi.fn(async () => ({ ok: true as const }))
    render(<SkillsSettingsSection {...props({
      listProject: vi.fn(async () => [{ ...PROJECT, sourcePath: '/proj/.dsh/skills/qms-review/SKILL.md' }]),
      setEnabled,
    })} />)
    await waitFor(() => { expect(screen.getByText('mes-intake')).toBeTruthy() })
    fireEvent.click(screen.getByRole('tab', { name: en['tab.project'] }))
    await waitFor(() => { expect(screen.getByText('qms-review')).toBeTruthy() })
    fireEvent.click(screen.getByRole('switch', { name: `qms-review ${en.enabled}` }))
    await waitFor(() => {
      expect(setEnabled).toHaveBeenCalledWith({
        name: 'qms-review',
        enabled: false,
        sourcePath: '/proj/.dsh/skills/qms-review/SKILL.md',
        projectRoot: '/proj/deepseek-harness',
      })
    })
  })

  it('lists each open workspace as its own project group', async () => {
    const listProject = vi.fn(async (projectRoot: string) => (
      projectRoot === '/a' ? [PROJECT] : [CLAUDE]
    ))
    render(<SkillsSettingsSection {...props({
      useWorkspaces: (select: (state: {
        items: readonly { workspaceId: string; path: string }[]
        recentWorkspaceId: string
      }) => unknown) => select({
        items: [
          { workspaceId: 'a', path: '/a' },
          { workspaceId: 'b', path: '/b/other' },
        ],
        recentWorkspaceId: 'a',
      }),
      listProject,
    })} />)
    await waitFor(() => { expect(screen.getByText('mes-intake')).toBeTruthy() })
    fireEvent.click(screen.getByRole('tab', { name: en['tab.project'] }))
    await waitFor(() => { expect(screen.getByText('other')).toBeTruthy() })
    expect(screen.getByText('a')).toBeTruthy()
    expect(screen.getByText('qms-review')).toBeTruthy()
    expect(screen.getByText('claude-note')).toBeTruthy()
    expect(listProject).toHaveBeenCalledWith('/a')
    expect(listProject).toHaveBeenCalledWith('/b/other')
  })

  it('requires a workspace for the project tab and keeps personal available', async () => {
    const listOwned = vi.fn(async () => [])
    const listProject = vi.fn(async () => [])
    render(<SkillsSettingsSection {...props({
      useWorkspaces: (select: (state: { items: readonly []; recentWorkspaceId: undefined }) => unknown) =>
        select({ items: [], recentWorkspaceId: undefined }),
      listOwned,
      listProject,
    })} />)
    await waitFor(() => { expect(screen.getByText(en['empty.personal'])).toBeTruthy() })
    fireEvent.click(screen.getByRole('tab', { name: en['tab.project'] }))
    await waitFor(() => { expect(screen.getByText(en['empty.workspace'])).toBeTruthy() })
    expect(listProject).not.toHaveBeenCalled()
  })

  it('retries a failed personal list', async () => {
    const listOwned = vi.fn()
      .mockRejectedValueOnce(new Error('nope'))
      .mockResolvedValue([OWNED])
    render(<SkillsSettingsSection {...props({ listOwned })} />)
    await waitFor(() => { expect(screen.getByText(en.error)).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: en.retry }))
    await waitFor(() => { expect(screen.getByText('mes-intake')).toBeTruthy() })
  })

  it('shows an empty project catalog when a workspace is open', async () => {
    const listProject = vi.fn(async () => [])
    render(<SkillsSettingsSection {...props({ listProject })} />)
    await waitFor(() => { expect(screen.getByText('mes-intake')).toBeTruthy() })
    fireEvent.click(screen.getByRole('tab', { name: en['tab.project'] }))
    await waitFor(() => { expect(screen.getByText(en['empty.project'])).toBeTruthy() })
  })

  it('ignores a stale list after the tab changes', async () => {
    let release!: (items: ManagedSkillSummary[]) => void
    let rejectFirst!: (error: Error) => void
    const first = new Promise<ManagedSkillSummary[]>((resolve) => { release = resolve })
    const failing = new Promise<ManagedSkillSummary[]>((_, reject) => { rejectFirst = reject })
    const listOwned = vi.fn()
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(failing)
    const listProject = vi.fn().mockResolvedValue([])
    render(<SkillsSettingsSection {...props({ listOwned, listProject })} />)
    expect(screen.getByText(en.loading)).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: en['tab.project'] }))
    await waitFor(() => { expect(screen.getByText(en['empty.project'])).toBeTruthy() })
    fireEvent.click(screen.getByRole('tab', { name: en['tab.personal'] }))
    await waitFor(() => { expect(screen.getByText(en.loading)).toBeTruthy() })
    fireEvent.click(screen.getByRole('tab', { name: en['tab.project'] }))
    await waitFor(() => { expect(screen.getByText(en['empty.project'])).toBeTruthy() })
    release([OWNED])
    rejectFirst(new Error('stale'))
    await waitFor(() => { expect(screen.queryByText(en.error)).toBeNull() })
    expect(screen.queryByText('mes-intake')).toBeNull()
  })

  it('filters the personal list by keyword', async () => {
    render(<SkillsSettingsSection {...props({
      listOwned: vi.fn(async () => [OWNED, { ...OWNED, name: 'qms-review', description: 'Form' }]),
    })} />)
    await waitFor(() => { expect(screen.getByText('qms-review')).toBeTruthy() })
    fireEvent.change(screen.getByTestId('xmart-skills-search'), { target: { value: 'mes' } })
    expect(screen.getByText('mes-intake')).toBeTruthy()
    expect(screen.queryByText('qms-review')).toBeNull()
    fireEvent.change(screen.getByTestId('xmart-skills-search'), { target: { value: 'nope' } })
    expect(screen.getByText(en['empty.search'])).toBeTruthy()
  })

  it('hides project groups that do not match the search', async () => {
    render(<SkillsSettingsSection {...props({
      useWorkspaces: (select: (state: {
        items: readonly { workspaceId: string; path: string }[]
        recentWorkspaceId: string
      }) => unknown) => select({
        items: [
          { workspaceId: 'a', path: '/a' },
          { workspaceId: 'b', path: '/b/other' },
        ],
        recentWorkspaceId: 'a',
      }),
      listProject: vi.fn(async (projectRoot: string) => (
        projectRoot === '/a' ? [PROJECT] : [CLAUDE]
      )),
    })} />)
    await waitFor(() => { expect(screen.getByText('mes-intake')).toBeTruthy() })
    fireEvent.click(screen.getByRole('tab', { name: en['tab.project'] }))
    await waitFor(() => { expect(screen.getByText('claude-note')).toBeTruthy() })
    fireEvent.change(screen.getByTestId('xmart-skills-search'), { target: { value: 'qms' } })
    expect(screen.getByText('qms-review')).toBeTruthy()
    expect(screen.queryByText('claude-note')).toBeNull()
    expect(screen.queryByText('other')).toBeNull()
    fireEvent.change(screen.getByTestId('xmart-skills-search'), { target: { value: 'zzz' } })
    expect(screen.getByText(en['empty.search'])).toBeTruthy()
  })
})
