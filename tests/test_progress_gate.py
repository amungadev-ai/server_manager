"""Exercise real Git comparisons: code without a checkpoint must fail."""
from pathlib import Path
import importlib.util
import subprocess
import tempfile
import unittest

MODULE = Path(__file__).resolve().parents[1] / 'scripts/validate_progress.py'
spec = importlib.util.spec_from_file_location('progress', MODULE)
progress = importlib.util.module_from_spec(spec)
spec.loader.exec_module(progress)


class ProgressGateTest(unittest.TestCase):
    def git(self, *args):
        return subprocess.check_output(['git', *args], cwd=self.root, text=True, stderr=subprocess.DEVNULL).strip()

    def setUp(self):
        temporary_root = MODULE.parents[1] / '.sites-runtime/test-fixtures'
        temporary_root.mkdir(parents=True, exist_ok=True)
        self.directory = tempfile.TemporaryDirectory(dir=temporary_root)
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.git('init', '-b', 'main')
        self.git('config', 'user.email', 'fixture@example.test')
        self.git('config', 'user.name', 'Test fixture')
        (self.root / 'tasks/progress').mkdir(parents=True)
        self.record = self.root / 'tasks/progress/CL-001.md'
        self.record.write_text('---\ntask_id: CL-001\nstatus: in-progress\nupdated_utc: 2026-11-18T00:00:00Z\nbranch: main\nlast_commit: not-committed\nclaim_ref: provisional\n---\n' + '\n'.join(f'## {heading}\nInitial checkpoint\n' for heading in progress.SECTIONS))
        self.git('add', '.')
        self.git('commit', '-m', 'Initial task fixture')
        self.base = self.git('rev-parse', 'HEAD')
        (self.root / 'apps').mkdir()
        (self.root / 'apps/change.ts').write_text('export const value = 1;\n')

    def test_implementation_without_progress_is_rejected(self):
        self.git('add', '.')
        self.git('commit', '-m', 'Code without checkpoint')
        self.assertTrue(any('require a changed' in error for error in progress.validate(self.root, self.base)))

    def test_implementation_with_progress_is_accepted(self):
        with self.record.open('a') as file:
            file.write('\nCheckpoint: implemented fixture\n')
        self.git('add', '.')
        self.git('commit', '-m', 'Code with checkpoint')
        self.assertEqual(progress.validate(self.root, self.base), [])

    def test_invalid_metadata_is_rejected(self):
        self.record.write_text(self.record.read_text().replace('status: in-progress', 'status: invented'))
        self.assertTrue(any('invalid status' in error for error in progress.validate(self.root)))

    def test_tooling_changes_require_checkpoint(self):
        (self.root / 'apps/change.ts').unlink()
        (self.root / 'tools').mkdir()
        (self.root / 'tools/generator.mjs').write_text('export const value = 1;\n')
        self.git('add', '.')
        self.git('commit', '-m', 'Tooling without checkpoint')
        self.assertTrue(any('require a changed' in error for error in progress.validate(self.root, self.base)))

    def test_root_browser_configuration_requires_checkpoint(self):
        (self.root / 'apps/change.ts').unlink()
        (self.root / 'playwright.config.ts').write_text('export default {};\n')
        self.git('add', '.')
        self.git('commit', '-m', 'Browser configuration without checkpoint')
        self.assertTrue(any('require a changed' in error for error in progress.validate(self.root, self.base)))

    def test_deleting_a_checkpoint_cannot_satisfy_gate(self):
        self.record.unlink()
        self.git('add', '.')
        self.git('commit', '-m', 'Code with deleted checkpoint')
        self.assertTrue(any('require a changed' in error for error in progress.validate(self.root, self.base)))

    def test_not_started_record_cannot_cover_code(self):
        self.record.write_text(self.record.read_text().replace('status: in-progress', 'status: not-started'))
        self.git('add', '.')
        self.git('commit', '-m', 'Code with inactive checkpoint')
        self.assertTrue(any('require a changed' in error for error in progress.validate(self.root, self.base)))

    def test_renaming_code_into_docs_still_requires_checkpoint(self):
        self.git('add', 'apps')
        self.git('commit', '-m', 'Initial code fixture')
        self.base = self.git('rev-parse', 'HEAD')
        (self.root / 'docs').mkdir()
        self.git('mv', 'apps/change.ts', 'docs/moved.md')
        self.git('commit', '-m', 'Move code into docs')
        self.assertTrue(any('require a changed' in error for error in progress.validate(self.root, self.base)))

    def test_each_declared_task_needs_its_own_checkpoint(self):
        second = self.root / 'tasks/progress/CL-002.md'
        second.write_text(self.record.read_text().replace('task_id: CL-001', 'task_id: CL-002'))
        self.git('add', 'tasks')
        self.git('commit', '-m', 'Second task fixture')
        self.base = self.git('rev-parse', 'HEAD')
        self.record.write_text(self.record.read_text() + '\nCheckpoint for CL-001 only\n')
        self.git('add', '.')
        self.git('commit', '-m', 'One task checkpoint for two declared tasks')
        errors = progress.validate(self.root, self.base, ('CL-001', 'CL-002'))
        self.assertEqual(errors, ['CL-002: declared task requires its own changed checkpoint'])

    def test_invalid_comparison_ref_is_rejected_without_shell_evaluation(self):
        errors = progress.validate(self.root, '$(not-a-ref)')
        self.assertIn('Could not resolve the comparison base to a commit.', errors)


if __name__ == '__main__':
    unittest.main()
