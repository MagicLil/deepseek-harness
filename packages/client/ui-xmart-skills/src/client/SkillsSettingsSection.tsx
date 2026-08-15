/**
 * Settings → Skills: browse name + description, grouped by personal or project.
 */
import { useEffect, useState, type ReactNode } from 'react'
import type { ManagedSkillSummary, SkillScope, SkillsSettingsProps } from './contract.ts'
import { errorKey } from './errors.ts'
import { filterProjectGroups, filterSkills } from './filter.ts'
import { originKey } from './origin.ts'
import { workspaceTitle } from './project-root.ts'
import css from './SkillsSettingsSection.module.css'

type Tab = SkillScope

interface ProjectGroup {
  readonly id: string
  readonly title: string
  readonly path: string
  readonly items: readonly ManagedSkillSummary[]
}

type ViewState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'personal'; readonly items: readonly ManagedSkillSummary[] }
  | { readonly status: 'projects'; readonly groups: readonly ProjectGroup[] }

/** Skills settings page (see module doc). */
export function SkillsSettingsSection({
  t,
  useWorkspaces,
  listOwned,
  listProject,
  setEnabled,
}: SkillsSettingsProps): ReactNode {
  const workspaces = useWorkspaces(state => state)
  const workspaceKey = workspaces.items.map(item => `${item.workspaceId}:${item.path}`).join('|')
  const [tab, setTab] = useState<Tab>('personal')
  const [query, setQuery] = useState('')
  const [request, setRequest] = useState(0)
  const [view, setView] = useState<ViewState>({ status: 'loading' })
  const [jobError, setJobError] = useState<string | undefined>(undefined)
  const personalItems = view.status === 'personal' ? filterSkills(view.items, query) : []
  const projectGroups = view.status === 'projects' ? filterProjectGroups(view.groups, query) : []

  useEffect(() => {
    let current = true
    setView({ status: 'loading' })
    const load = tab === 'personal'
      ? listOwned('personal').then((items): ViewState => ({ status: 'personal', items }))
      : workspaces.items.length === 0
        ? Promise.resolve<ViewState>({ status: 'projects', groups: [] })
        : Promise.all(workspaces.items.map(async workspace => ({
          id: workspace.workspaceId,
          title: workspaceTitle(workspace.path),
          path: workspace.path,
          items: await listProject(workspace.path),
        }))).then((groups): ViewState => ({ status: 'projects', groups }))
    void load.then(
      (next) => { if (current) setView(next) },
      () => { if (current) setView({ status: 'error' }) },
    )
    return () => { current = false }
  }, [tab, workspaceKey, request, listOwned, listProject])

  const toggle = async (item: ManagedSkillSummary, projectRoot?: string) => {
    const result = await setEnabled({
      name: item.name,
      enabled: !item.modelInvocable,
      ...item.sourcePath === undefined ? {} : { sourcePath: item.sourcePath },
      ...projectRoot === undefined ? {} : { projectRoot },
    })
    if (!result.ok) {
      setJobError(result.error)
      return
    }
    setJobError(undefined)
    setRequest(n => n + 1)
  }

  return (
    <div className={css.section} data-testid="xmart-skills-settings">
      <h2 className={css.heading}>{t('title')}</h2>
      <p className={css.intro}>{t('intro')}</p>
      <div className={css.tabs} role="tablist">
        {(['personal', 'project'] as const).map(id => (
          <button
            key={id}
            type="button"
            role="tab"
            className={css.tab}
            aria-selected={tab === id}
            onClick={() => {
              setTab(id)
              setJobError(undefined)
            }}
          >
            {t(`tab.${id}`)}
          </button>
        ))}
      </div>
      <input
        type="search"
        className={css.search}
        value={query}
        placeholder={t('search.placeholder')}
        aria-label={t('search.label')}
        data-testid="xmart-skills-search"
        onChange={(event) => { setQuery(event.target.value) }}
      />
      {view.status === 'loading' && <p className={css.status}>{t('loading')}</p>}
      {view.status === 'error' && (
        <div>
          <p className={css.jobError}>{t('error')}</p>
          <button type="button" className={css.button} onClick={() => { setRequest(n => n + 1) }}>
            {t('retry')}
          </button>
        </div>
      )}
      {view.status === 'personal' && (
        view.items.length === 0
          ? <p className={css.empty}>{t('empty.personal')}</p>
          : personalItems.length === 0
            ? <p className={css.empty}>{t('empty.search')}</p>
            : <SkillList t={t} items={personalItems} onToggle={(item) => { void toggle(item) }} />
      )}
      {view.status === 'projects' && view.groups.length === 0 && (
        <p className={css.empty}>{t('empty.workspace')}</p>
      )}
      {view.status === 'projects' && view.groups.length > 0 && projectGroups.length === 0 && (
        <p className={css.empty}>{t('empty.search')}</p>
      )}
      {view.status === 'projects' && projectGroups.map(group => (
        <section key={group.id} className={css.projectGroup}>
          <h3 className={css.projectHead}>{group.title}</h3>
          <p className={css.projectPath}>{group.path}</p>
          {group.items.length === 0
            ? <p className={css.empty}>{t('empty.project')}</p>
            : (
              <SkillList
                t={t}
                items={group.items}
                onToggle={(item) => { void toggle(item, group.path) }}
              />
            )}
        </section>
      ))}
      {jobError !== undefined && <p className={css.jobError}>{t(errorKey(jobError))}</p>}
    </div>
  )
}

function SkillList({
  t,
  items,
  onToggle,
}: {
  readonly t: SkillsSettingsProps['t']
  readonly items: readonly ManagedSkillSummary[]
  readonly onToggle: (item: ManagedSkillSummary) => void
}): ReactNode {
  return (
    <ul className={css.list}>
      {items.map(item => (
        <li key={`${item.origin}:${item.name}`} className={css.row}>
          <div className={css.rowTop}>
            <div className={css.rowTitle}>{item.name}</div>
            <label className={css.switch}>
              <input
                type="checkbox"
                role="switch"
                checked={item.modelInvocable}
                aria-label={`${item.name} ${t(item.modelInvocable ? 'enabled' : 'disabled')}`}
                onChange={() => { onToggle(item) }}
              />
              <span>{t(item.modelInvocable ? 'enabled' : 'disabled')}</span>
            </label>
          </div>
          <div className={css.rowMeta}>{item.description}</div>
          <div className={css.rowMeta}>{t(originKey(item.origin))}</div>
        </li>
      ))}
    </ul>
  )
}
