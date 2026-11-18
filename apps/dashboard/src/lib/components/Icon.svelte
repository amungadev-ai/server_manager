<script lang="ts">
  let { name, size = 18 }: { name: string; size?: number } = $props();
  const paths: Record<string, string[]> = {
    cloud: ['M20 16.2A4.5 4.5 0 0 0 18 7.7a6 6 0 0 0-11.6-1A5 5 0 0 0 7 17h12'],
    overview: [
      'M3 3h7v7H3z',
      'M14 3h7v7h-7z',
      'M3 14h7v7H3z',
      'M14 14h7v7h-7z',
    ],
    folder: [
      'M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z',
    ],
    globe: [
      'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
      'M3 12h18',
      'M12 3a18 18 0 0 1 0 18 18 18 0 0 1 0-18',
    ],
    database: [
      'M20 6c0 2-3.6 3-8 3S4 8 4 6s3.6-3 8-3 8 1 8 3Z',
      'M4 6v12c0 2 3.6 3 8 3s8-1 8-3V6',
      'M4 12c0 2 3.6 3 8 3s8-1 8-3',
    ],
    mail: [
      'M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z',
      'm3 6 9 7 9-7',
    ],
    clock: ['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0', 'M12 7v5l3 2'],
    activity: ['M3 12h4l3-8 4 16 3-8h4'],
    server: [
      'M4 3h16v7H4z',
      'M4 14h16v7H4z',
      'M7 6.5h.01M7 17.5h.01M11 6.5h6M11 17.5h6',
    ],
    settings: [
      'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1Z',
      'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    ],
    book: ['M3 4h6l3 2 3-2h6v15h-6l-3 2-3-2H3Z', 'M12 6v15'],
    chevron: ['m9 5 7 7-7 7'],
    down: ['m6 9 6 6 6-6'],
    plus: ['M12 5v14M5 12h14'],
    rocket: [
      'M12 16 8 12c2-6 6-9 12-9 0 6-3 10-8 13Z',
      'm8 12-5 1 3-6 5-1M12 16l-1 5 6-3 1-5',
      'm5 16-2 5 5-2',
      'M16 7h.01',
    ],
    search: ['M18 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0', 'm15 15 6 6'],
    code: ['m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16'],
    storage: ['M4 6h16v14H4z', 'M3 3h18v3H3z', 'M9 10h6'],
    check: ['m5 12 4 4L19 6'],
    close: ['m6 6 12 12M6 18 18 6'],
    menu: ['M4 6h16M4 12h16M4 18h16'],
    sun: [
      'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
      'M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5',
    ],
    moon: ['M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z'],
    sparkles: [
      'm12 3 2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2Z',
      'm20 2 .5 1.5L22 4l-1.5.5L20 6l-.5-1.5L18 4l1.5-.5Z',
    ],
    info: ['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0', 'M12 11v6M12 7h.01'],
    shield: ['m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z', 'm8 12 3 3 5-6'],
    refresh: [
      'M3 10a9 9 0 0 1 16-5l2 3M21 3v5h-5M21 14A9 9 0 0 1 5 19l-2-3M3 21v-5h5',
    ],
  };
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.65"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#each paths[name] ?? paths.info ?? [] as d}<path {d} />{/each}
</svg>
