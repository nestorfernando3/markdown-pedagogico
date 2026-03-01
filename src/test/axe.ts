import axeCore from 'axe-core';

const DEFAULT_AXE_OPTIONS: axeCore.RunOptions = {
  rules: {
    'color-contrast': { enabled: false },
  },
};

export async function runAxe(
  container: Element | Document,
  options?: axeCore.RunOptions
): Promise<axeCore.AxeResults> {
  const mergedOptions: axeCore.RunOptions = {
    ...DEFAULT_AXE_OPTIONS,
    ...options,
    rules: {
      ...DEFAULT_AXE_OPTIONS.rules,
      ...options?.rules,
    },
  };

  return axeCore.run(container, mergedOptions);
}

export function formatViolations(results: axeCore.AxeResults): string {
  if (results.violations.length === 0) {
    return 'No accessibility violations.';
  }

  return results.violations
    .map((violation) => {
      const targets = violation.nodes.map((node) => node.target.join(' ')).join(' | ');
      return `${violation.id}: ${violation.help} -> ${targets}`;
    })
    .join('\n');
}
