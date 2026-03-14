const EXTERNAL_PROTOCOL_PATTERN = /^(https?:|mailto:)/i;

export function isExternalResourceHref(href: string): boolean {
  return EXTERNAL_PROTOCOL_PATTERN.test(href);
}

export async function openExternalResource(url: string): Promise<void> {
  try {
    const { open } = await import('@tauri-apps/api/shell');
    await open(url);
    return;
  } catch (error) {
    console.warn('Falling back to window.open for external resource:', error);
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}
