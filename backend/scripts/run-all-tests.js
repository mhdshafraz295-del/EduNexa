import { execSync } from 'child_process';
import path from 'path';

const testFiles = [
  'test-tenant-isolation.js',
  'test-platform-cms.js',
  'test-platform-announcements.js',
  'test-referral-campaign-system.js',
  'test-referral-link-and-registration.js',
  'test-internal-messaging.js',
  'test-admin-broadcast-messaging.js',
  'test-new-message-flow.js',
  'test-gallery-system.js',
  'test-study-materials.js',
  'test-study-notes-admin-visibility.js',
  'test-receipt-stream-auth.js',
  'test-poll-system.js',
  'test-student-poll-visibility.js',
  'test-poll-delete-action.js',
  'test-invoice-analytics.js',
  'test-step3-subscription-flow.js',
  'test-step4-subscription-enforcement.js',
  'test-step5-academic-foundation.js',
  'test-step6-attendance.js',
  'test-step7A-mcq-exams.js',
  'test-step7C-written-marking-results.js',
  'test-step7D-report-cards.js',
  'test-timetable-zoom-integration.js',
  'test-live-exam-admin-create.js',
  'test-dynamic-branding.js',
  'test-auth-logo-persistence.js',
  'test-dynamic-preview.js',
  'test-refresh-visibility.js',
  'test-plans-management.js',
  'test-step10-crud-and-real-data.js',
  'test-stepA-comprehensive.js',
  'test-stepB2-analytics.js',
];

async function runMasterSuite() {
  console.log('========================================================================');
  console.log('EDUNEXA MASTER TEST SUITE RUNNER — FULL PLATFORM QA & VERIFICATION');
  console.log('========================================================================\n');

  const results = [];
  let totalSuitesPassed = 0;
  let totalSuitesFailed = 0;

  for (const file of testFiles) {
    const filePath = path.join(process.cwd(), file);
    process.stdout.write(`▶ Running ${file.padEnd(42)} `);
    const start = Date.now();
    try {
      const output = execSync(`node ${file}`, {
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const duration = ((Date.now() - start) / 1000).toFixed(2);
      console.log(`✅ PASSED (${duration}s)`);
      results.push({ file, status: 'PASSED', duration: `${duration}s`, error: null });
      totalSuitesPassed++;
    } catch (err) {
      const duration = ((Date.now() - start) / 1000).toFixed(2);
      console.log(`❌ FAILED (${duration}s)`);
      const errorMsg = (err.stderr || err.stdout || err.message).slice(-500);
      results.push({ file, status: 'FAILED', duration: `${duration}s`, error: errorMsg });
      totalSuitesFailed++;
    }
  }

  console.log('\n========================================================================');
  console.log('MASTER SUITE EXECUTION SUMMARY');
  console.log('========================================================================');
  console.log(`Total Suites Run:     ${testFiles.length}`);
  console.log(`Passed Suites:        ${totalSuitesPassed}`);
  console.log(`Failed Suites:        ${totalSuitesFailed}`);
  console.log('========================================================================\n');

  if (totalSuitesFailed > 0) {
    console.log('Failed Suites Details:');
    results.filter(r => r.status === 'FAILED').forEach(r => {
      console.log(`\n--- ${r.file} ---`);
      console.log(r.error);
    });
    process.exit(1);
  }
}

runMasterSuite();
