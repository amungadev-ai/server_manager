/**
 * Trusted static SVG fragments from reference-cloudlane-v1.13.html.
 * Source SHA-256: f94204ed5e52ae58a80deea46d4fe6edba6626d8b0e36005f6fb9d9765a68f6d
 * Extracted without executing source JavaScript; final literal assignments retained.
 * Script, foreignObject, event, href and URL-bearing content are rejected on extraction.
 * Compatibility aliases: overview -> layout, activity -> pulse, storage -> harddrive.
 * The original cloud icon is preserved; use layers for the prototype brand mark.
 */
export const iconPaths: Record<string, string> = {
  cloud:
    '<path d="M20 16.6A4.4 4.4 0 0 0 18 8.3 6.5 6.5 0 0 0 5.6 10a4 4 0 0 0 1 7.9H18a4.2 4.2 0 0 0 2-1.3Z"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  layout:
    '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 9v12"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3Z"/>',
  server:
    '<rect x="3" y="3" width="18" height="8" rx="2"/><rect x="3" y="13" width="18" height="8" rx="2"/><path d="M7 7h.01M7 17h.01M11 7h7M11 17h7"/>',
  database:
    '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
  pulse: '<path d="M2 12h4l3-7 5 14 3-7h5"/>',
  settings:
    '<path d="M12 3a3 3 0 0 0-2.8 1.9L7 4 5 6l.9 2.2A3 3 0 0 0 4 11v2a3 3 0 0 0 1.9 2.8L5 18l2 2 2.2-.9A3 3 0 0 0 11 21h2a3 3 0 0 0 2.8-1.9L18 20l2-2-.9-2.2A3 3 0 0 0 21 13v-2a3 3 0 0 0-1.9-2.8L20 6l-2-2-2.2.9A3 3 0 0 0 13 3h-1Z"/><circle cx="12" cy="12" r="3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  check: '<path d="m4 12 5 5 11-11"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M3 16v4h18v-4"/>',
  github:
    '<path d="M9 19c-5 2-5-2-7-2m15 4v-3.9a3.4 3.4 0 0 0-.9-2.6c3-.3 6.1-1.5 6.1-6.7a5.2 5.2 0 0 0-1.4-3.6 4.8 4.8 0 0 0-.1-3.6s-1.2-.4-3.7 1.4a12.8 12.8 0 0 0-6.7 0C7.8.2 6.6.6 6.6.6a4.8 4.8 0 0 0-.1 3.6A5.2 5.2 0 0 0 5 7.8c0 5.2 3.1 6.4 6.1 6.7a3.4 3.4 0 0 0-.9 2.6V21" transform="translate(1 1) scale(.9)"/>',
  archive:
    '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v12h14V8M10 12h4"/>',
  code: '<path d="m8 8-4 4 4 4m8-8 4 4-4 4m-3-12-2 16"/>',
  terminal:
    '<rect x="2" y="3" width="20" height="18" rx="2"/><path d="m6 9 3 3-3 3m6 0h5"/>',
  rocket:
    '<path d="M7 17c-3 0-4 1-4 4 3 0 4-1 4-4Zm1-2 1 1 7-7c3-3 4-6 4-7-1 0-4 1-7 4L6 13l2 2ZM12 8l4 4M5 15l-2-2 4-4 3 1m4 4 1 3-4 4-2-2"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  shield:
    '<path d="M12 2 4 6v6c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6Z"/><path d="m9 12 2 2 4-4"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 11v5M12 7h.01"/>',
  alert: '<path d="m12 3 10 18H2Z"/><path d="M12 9v4m0 4h.01"/>',
  refresh:
    '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5 9a8 8 0 0 1 14-2l1 5M4 12l1 5a8 8 0 0 0 14-2"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  dots: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  zap: '<path d="m13 2-9 12h7l-1 8 10-12h-7Z"/>',
  external: '<path d="M12 4h8v8M20 4l-9 9M20 14v6H4V4h6"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9m-3 0h3v3m-6 0h3v3"/>',
  chart: '<path d="M4 20V9m6 11V4m6 16v-7m5 7H2"/>',
  history: '<path d="M3 12a9 9 0 1 0 2-6m-2-3v5h5M12 7v5l3 2"/>',
  branch:
    '<circle cx="6" cy="4" r="2"/><circle cx="6" cy="20" r="2"/><circle cx="18" cy="6" r="2"/><path d="M6 6v12M18 8a6 6 0 0 1-6 6H6"/>',
  box: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m3 9 9 5 9-5M12 14v7"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 .6l3-3a5 5 0 0 0-7-7l-2 2m3 5a5 5 0 0 0-7-.6l-3 3a5 5 0 0 0 7 7l2-2"/>',
  trash: '<path d="M3 6h18m-2 0-1 15H6L5 6m3 0V3h8v3M10 10v7m4-7v7"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff:
    '<path d="M3 3 21 21M10 5.2c.7-.1 1.4-.2 2-.2 6 0 10 7 10 7a19 19 0 0 1-3.2 4.1M6 6.7A20 20 0 0 0 2 12s4 7 10 7a9 9 0 0 0 4-.9"/>',
  play: '<path d="m8 5 11 7-11 7Z"/>',
  pause:
    '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  logout:
    '<path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5M14 7l5 5-5 5m5-5H8"/>',
  layers: '<path d="m12 2 9 5-9 5-9-5 9-5Zm-9 10 9 5 9-5M3 17l9 5 9-5"/>',
  file: '<path d="M6 2h9l5 5v15H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2ZM14 2v6h6"/>',
  cpu: '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v4m6-4v4M9 19v4m6-4v4M1 9h4m-4 6h4m14-6h4m-4 6h4"/>',
  harddrive:
    '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 13h18M7 16h.01M11 16h.01"/>',
  pencil: '<path d="m4 20 5-.8L20 8a2.1 2.1 0 0 0-4-4L5 15l-1 5Z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12a2 2 0 0 0 4 0"/>',
  sparkles:
    '<path d="m12 3 1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4L12 3Z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/>',
  book: '<path d="M4 4h7a3 3 0 0 1 3 3v14a3 3 0 0 0-3-3H4zM20 4h-7a3 3 0 0 0-3 3v14a3 3 0 0 1 3-3h7z"/>',
  connections:
    '<rect x="2" y="9" width="6" height="6" rx="1"/><rect x="16" y="2" width="6" height="6" rx="1"/><rect x="16" y="16" width="6" height="6" rx="1"/><path d="M8 12h4m0 0 4-7m-4 7 4 7"/>',
  bucket:
    '<path d="M3 7c0-2 4-4 9-4s9 2 9 4-4 4-9 4-9-2-9-4Zm0 0v10c0 2 4 4 9 4s9-2 9-4V7M3 12c0 2 4 4 9 4s9-2 9-4"/>',
  image:
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 17-5-5L5 21"/>',
  filelock:
    '<path d="M7 2h8l5 5v8M15 2v5h5M7 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h4"/><rect x="12" y="15" width="9" height="7" rx="1.5"/><path d="M14 15v-2a2.5 2.5 0 0 1 5 0v2"/>',
  folderopen:
    '<path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v3M3 6v13a2 2 0 0 0 2 2h12l5-9H8l-5 9"/>',
  disk: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 3v7h10V3M7 21v-8h10v8M10 6h4"/>',
  overview:
    '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 9v12"/>',
  activity: '<path d="M2 12h4l3-7 5 14 3-7h5"/>',
  storage:
    '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 13h18M7 16h.01M11 16h.01"/>',
};
