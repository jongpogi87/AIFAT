export function matchRoute(
  pattern: string,
  pathname: string
): { match: boolean; params: Record<string, string> } {
  const paramNames: string[] = [];
  const regexPattern = pattern
    .replace(/:([a-zA-Z0-9_]+)/g, (_, name) => {
      paramNames.push(name);
      return "([^/]+)";
    })
    .replace(/\//g, "\\/");

  const regex = new RegExp(`^${regexPattern}$`);
  const match = pathname.match(regex);

  if (!match) {
    return { match: false, params: {} };
  }

  const params: Record<string, string> = {};
  paramNames.forEach((name, index) => {
    params[name] = decodeURIComponent(match[index + 1]);
  });

  return { match: true, params };
}
