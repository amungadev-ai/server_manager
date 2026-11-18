"""Run real Python tests and emit JUnit without an extra test dependency."""
from pathlib import Path
from datetime import datetime, timezone
import time
import unittest
import xml.etree.ElementTree as ET


class RecordingResult(unittest.TextTestResult):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.records = []

    def startTest(self, test):
        self.started = time.monotonic()
        super().startTest(test)

    def record(self, test, status, detail=''):
        self.records.append((test.id(), status, detail, time.monotonic() - self.started))

    def addSuccess(self, test):
        super().addSuccess(test)
        self.record(test, 'passed')

    def addFailure(self, test, error):
        super().addFailure(test, error)
        self.record(test, 'failure', self.failures[-1][1])

    def addError(self, test, error):
        super().addError(test, error)
        self.record(test, 'error', self.errors[-1][1])

    def addSkip(self, test, reason):
        super().addSkip(test, reason)
        self.record(test, 'skipped', reason)


if __name__ == '__main__':
    suite = unittest.defaultTestLoader.discover('tests', pattern='test_*.py')
    result = unittest.TextTestRunner(resultclass=RecordingResult, verbosity=2).run(suite)
    report = ET.Element('testsuite', name='cloudlane-python', tests=str(result.testsRun), failures=str(len(result.failures)), errors=str(len(result.errors)), skipped=str(len(result.skipped)), timestamp=datetime.now(timezone.utc).isoformat())
    for name, status, detail, duration in result.records:
        classname, _, method = name.rpartition('.')
        case = ET.SubElement(report, 'testcase', name=method, classname=classname, time=f'{duration:.6f}')
        if status != 'passed':
            ET.SubElement(case, status).text = detail
    output = Path('test-results/unit/python-junit.xml')
    output.parent.mkdir(parents=True, exist_ok=True)
    ET.ElementTree(report).write(output, encoding='utf-8', xml_declaration=True)
    raise SystemExit(0 if result.wasSuccessful() and result.testsRun > len(result.skipped) else 1)
