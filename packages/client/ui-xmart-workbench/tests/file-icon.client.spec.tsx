// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { FileIcon } from '../src/client/FileIcon.tsx'

afterEach(cleanup)

describe('FileIcon', () => {
  it('stamps the Seti id on a java file and a workspace folder', () => {
    const file = render(<FileIcon path="MethodFormat.java" kind="file" />)
    expect(file.container.querySelector('[data-file-icon="java"]')).toBeTruthy()
    expect(file.container.querySelector('img')?.getAttribute('alt')).toBe('')
    cleanup()
    const folder = render(<FileIcon path="/ws/src" kind="directory" expanded size={14} />)
    expect(folder.container.querySelector('[data-file-icon="folder"]')).toBeTruthy()
  })
})
