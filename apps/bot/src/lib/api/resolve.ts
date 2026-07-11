import path from 'node:path';

export function resolveRoutePath(filePath: string, baseDir: string) {
  const relative = path.relative(baseDir, filePath);
  const noExt = relative.replace(/\.(ts|js)$/, '');

  const segments = noExt.split(path.sep);

  const parts: string[] = [];

  for (const segment of segments) {
    // index route
    if (segment === 'index') continue;

    // wildcard: [...catch] => *
    if (segment.startsWith('[...') && segment.endsWith(']')) {
      parts.push('*');
      continue;
    }

    // param: [id] => :id
    if (segment.startsWith('[') && segment.endsWith(']')) {
      const param = segment.slice(1, -1);
      parts.push(`:${param}`);
      continue;
    }

    parts.push(segment);
  }

  return '/' + parts.join('/');
}