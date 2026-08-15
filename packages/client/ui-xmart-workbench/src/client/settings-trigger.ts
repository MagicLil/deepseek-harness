/**
 * Click the existing `sidebar.settings` trigger. The settings panel is
 * component-local state inside ui-settings-general; there is no ctx API.
 * @param doc - document to query; omitted in non-DOM apply tests.
 */
export function clickSettingsTrigger(doc: Document | undefined): void {
  doc?.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')?.click()
}
