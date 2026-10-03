export function getRelativeLocaleUrl(_locale: string | undefined, route: string) {
  return '/' + route.replace(/^\/+/, '');
}
