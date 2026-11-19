/** Bounded central-directory inspection only. No extraction, execution or upload. */
export async function inspectZip(file: File) {
  if (!file.name.toLowerCase().endsWith('.zip') || file.size > 25 * 1024 * 1024)
    throw new Error(
      'Choose a ZIP archive smaller than 25 MB for this local preview.',
    );
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  let end = -1;
  for (
    let i = buffer.byteLength - 22;
    i >= Math.max(0, buffer.byteLength - 65557);
    i--
  )
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  if (end < 0) throw new Error('The ZIP central directory could not be read.');
  const count = view.getUint16(end + 10, true),
    size = view.getUint32(end + 12, true),
    start = view.getUint32(end + 16, true);
  if (
    count > 5000 ||
    start + size > end ||
    view.getUint16(end + 4, true) ||
    view.getUint16(end + 6, true)
  )
    throw new Error(
      'This archive is too large or uses an unsupported ZIP format.',
    );
  const decoder = new TextDecoder();
  let offset = start;
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    if (
      offset + 46 > start + size ||
      view.getUint32(offset, true) !== 0x02014b50
    )
      throw new Error('Invalid ZIP directory entry.');
    const length = view.getUint16(offset + 28, true),
      extra = view.getUint16(offset + 30, true),
      comment = view.getUint16(offset + 32, true);
    if (offset + 46 + length + extra + comment > start + size)
      throw new Error('Invalid ZIP directory bounds.');
    const name = decoder
      .decode(new Uint8Array(buffer, offset + 46, length))
      .replace(/\\/g, '/');
    if (name.startsWith('/') || name.split('/').includes('..'))
      throw new Error('Unsafe paths are not accepted.');
    names.push(name.toLowerCase());
    offset += 46 + length + extra + comment;
  }
  const has = (pattern: RegExp) => names.some((n) => pattern.test(n));
  const framework = has(/(^|\/)dockerfile$/)
    ? 'Dockerfile'
    : has(/(^|\/)next\.config\./)
      ? 'Next.js'
      : has(/(^|\/)nest-cli\.json$/)
        ? 'NestJS'
        : has(/(^|\/)vite\.config\./)
          ? 'React/Vite'
          : has(/(^|\/)package\.json$/)
            ? 'Node.js/Express'
            : has(/(^|\/)index\.html$/)
              ? 'Static HTML'
              : 'Not detected yet';
  return { count: names.length, framework };
}
