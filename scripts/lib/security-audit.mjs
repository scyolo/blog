/** Assess a pnpm audit without suppressing reviewed, still-unpatched advisories. */
export function assessAudit(report, exceptions, now = new Date()) {
  if (!report || report.error || typeof report.metadata !== 'object' || !report.advisories || Array.isArray(report.advisories)) {
    throw new Error('Incomplete audit report; refusing to assume dependencies are safe');
  }
  const blocked = [];
  const reviewed = [];
  for (const advisory of Object.values(report.advisories)) {
    const id = advisory.github_advisory_id ?? advisory.url?.split('/').at(-1);
    const exception = exceptions.find(item =>
      item.id === id && item.module === advisory.module_name &&
      typeof item.reason === 'string' && item.reason.length > 0 &&
      new Date(item.expires + 'T23:59:59Z').getTime() >= now.getTime() &&
      Array.isArray(advisory.findings) && advisory.findings.length > 0 &&
      advisory.findings.every(finding =>
        finding.version === item.version &&
        Array.isArray(finding.paths) && finding.paths.length > 0 &&
        finding.paths.every(path => path === item.path)
      )
    );
    const entry = { id, module: advisory.module_name, severity: advisory.severity };
    if (exception) reviewed.push({ ...entry, expires: exception.expires, reason: exception.reason });
    else blocked.push(entry);
  }
  return { blocked, reviewed };
}
