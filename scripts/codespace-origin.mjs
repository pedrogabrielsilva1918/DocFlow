// Derive one exact development host; never allow all *.github.dev hosts.
export function codespaceOrigin(environment = process.env, port = 5173) {
  if (environment.CODESPACES !== 'true') return '';
  const name = environment.CODESPACE_NAME;
  const domain = environment.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
  if (!name || !/^[a-z0-9-]+$/.test(name) || !domain || !/^[a-z0-9.-]+$/.test(domain)) return '';
  if (!Number.isInteger(port) || port < 1 || port > 65535) return '';
  return `https://${name}-${port}.${domain}`;
}
