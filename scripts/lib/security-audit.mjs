const isRecord = value =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const levels = ["info", "low", "moderate", "high", "critical"];

/** Fail closed on incomplete reports; keep reviewed but unpatched issues visible. */
export function assessAudit(report, exceptions, now = new Date()) {
  if (
    !isRecord(report) ||
    report.error ||
    !isRecord(report.metadata?.vulnerabilities) ||
    !isRecord(report.advisories)
  ) {
    throw new Error(
      "Incomplete audit report; refusing to assume dependencies are safe"
    );
  }
  const counts = report.metadata.vulnerabilities;
  if (
    !levels.every(
      level => Number.isInteger(counts[level]) && counts[level] >= 0
    )
  )
    throw new Error("Invalid vulnerability counts");
  const advisories = Object.values(report.advisories);
  const count = levels.reduce((total, level) => total + counts[level], 0);
  if (Boolean(count) !== Boolean(advisories.length))
    throw new Error("Audit summary contradicts advisory details");
  if (!Array.isArray(exceptions) || !Number.isFinite(now.getTime()))
    throw new Error("Invalid audit review context");
  const blocked = [];
  const reviewed = [];
  for (const advisory of advisories) {
    if (!isRecord(advisory)) throw new Error("Invalid advisory details");
    const id = advisory.github_advisory_id ?? advisory.url?.split("/").at(-1);
    const exception = exceptions.find(
      item =>
        item.id === id &&
        item.module === advisory.module_name &&
        item.severity === advisory.severity &&
        advisory.patched_versions === "<0.0.0" &&
        typeof item.reason === "string" &&
        item.reason.trim().length > 0 &&
        typeof item.expires === "string" &&
        /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(item.expires) &&
        new Date(item.expires).getTime() >= now.getTime() &&
        Array.isArray(advisory.findings) &&
        advisory.findings.length > 0 &&
        advisory.findings.every(
          finding =>
            finding.version === item.version &&
            Array.isArray(finding.paths) &&
            finding.paths.length > 0 &&
            finding.paths.every(path => path === item.path)
        )
    );
    const entry = {
      id,
      module: advisory.module_name,
      severity: advisory.severity,
    };
    if (exception)
      reviewed.push({
        ...entry,
        expires: exception.expires,
        reason: exception.reason,
      });
    else blocked.push(entry);
  }
  return { blocked, reviewed };
}
