const REPLACEMENTS: Record<string, string> = {
  ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss',
  à: 'a', á: 'a', â: 'a', è: 'e', é: 'e', ê: 'e',
  ì: 'i', í: 'i', î: 'i', ò: 'o', ó: 'o', ô: 'o',
  ù: 'u', ú: 'u', û: 'u', ç: 'c', ñ: 'n'
};

export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[äöüßàáâèéêìíîòóôùúûçñ]/g, (c) => REPLACEMENTS[c] ?? c)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'venue';
}
