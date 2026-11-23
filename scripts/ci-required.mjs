export function assertRequiredResults(results) {
  const expected = ['progress', 'verify', 'postgres', 'installer', 'e2e'];
  for (const name of expected)
    if (results[name]?.result !== 'success')
      throw new Error(
        `Required job ${name} did not succeed (${results[name]?.result ?? 'missing'}).`,
      );
}
if (process.argv[1]?.endsWith('ci-required.mjs')) {
  assertRequiredResults(JSON.parse(process.env.NEEDS_JSON ?? '{}'));
  console.log('PASS: all required CI jobs succeeded');
}
