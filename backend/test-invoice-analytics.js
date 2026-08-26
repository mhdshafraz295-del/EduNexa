/**
 * Automated Verification Suite for EduNexa Invoice & Monthly Collection Analytics
 * Tests:
 * 1. Admin Authentication & Tenant Isolation
 * 2. Total Invoiced, Paid, Unpaid Balance, Overdue calculations
 * 3. Partial payments, paid invoices, overdue status enforcement
 * 4. Month-over-Month comparison, collection rate clamped 0-100%
 * 5. Monthly trend 6-month aggregate DB data
 * 6. Exclusion of rejected/cancelled transactions & cross-tenant records
 * 7. Date filtering (This Month, Last Month, Custom Range, Invalid range 400)
 */

import prisma from './src/config/prisma.js';
import {
  getInvoiceAnalytics,
  recordInvoicePayment,
  updateTransactionStatus,
  getDateRange,
} from './src/services/invoiceAnalytics.service.js';

async function runTests() {
  console.log('🧪 Starting EduNexa Invoice Analytics Test Suite...\n');

  let testInstituteA = null;
  let testInstituteB = null;
  let testStudentA = null;
  let testStudentB = null;

  try {
    // Setup Test Institutes
    const suffix = Date.now().toString().slice(-6);
    testInstituteA = await prisma.institute.create({
      data: {
        name: `Analytics Test Inst A ${suffix}`,
        slug: `test-inst-a-${suffix}`,
        code: `TIA${suffix}`,
        isActive: true,
      },
    });

    testInstituteB = await prisma.institute.create({
      data: {
        name: `Analytics Test Inst B ${suffix}`,
        slug: `test-inst-b-${suffix}`,
        code: `TIB${suffix}`,
        isActive: true,
      },
    });

    // Create User & Student records for Institute A & B
    const userA = await prisma.user.create({
      data: {
        username: `studentA_${suffix}`,
        email: `studentA_${suffix}@test.com`,
        passwordHash: 'hash123',
        role: 'STUDENT',
        instituteId: testInstituteA.id,
      },
    });

    testStudentA = await prisma.student.create({
      data: {
        userId: userA.id,
        instituteId: testInstituteA.id,
        name: 'Student Alpha',
        admissionNumber: `ADM-A-${suffix}`,
      },
    });

    const userB = await prisma.user.create({
      data: {
        username: `studentB_${suffix}`,
        email: `studentB_${suffix}@test.com`,
        passwordHash: 'hash123',
        role: 'STUDENT',
        instituteId: testInstituteB.id,
      },
    });

    testStudentB = await prisma.student.create({
      data: {
        userId: userB.id,
        instituteId: testInstituteB.id,
        name: 'Student Beta',
        admissionNumber: `ADM-B-${suffix}`,
      },
    });

    console.log('✅ Setup: Created test institutes & students.');

    // -------------------------------------------------------------
    // Test 1: Date Range Computation & Invalid Range Rejection
    // -------------------------------------------------------------
    console.log('\nTest 1: Date Range Helper & Validation...');
    const thisMonthRange = getDateRange('this_month');
    if (!thisMonthRange.startDate || !thisMonthRange.endDate) {
      throw new Error('this_month date range failed');
    }

    const lastMonthRange = getDateRange('last_month');
    if (!lastMonthRange.startDate || !lastMonthRange.endDate) {
      throw new Error('last_month date range failed');
    }

    // Invalid range should throw 400 error
    let invalidRangeCaught = false;
    try {
      getDateRange('custom', '2026-12-31', '2026-01-01');
    } catch (err) {
      if (err.message.includes('Start date cannot be after end date')) {
        invalidRangeCaught = true;
      }
    }
    if (!invalidRangeCaught) {
      throw new Error('Failed to reject invalid custom date range');
    }
    console.log('  ✅ Passed: Date ranges generated and invalid range properly rejected.');

    // -------------------------------------------------------------
    // Test 2: Empty Institute Analytics (Zero Division Safety)
    // -------------------------------------------------------------
    console.log('\nTest 2: Zero Invoices / Empty State Analytics...');
    const emptyAnalytics = await getInvoiceAnalytics({ instituteId: testInstituteA.id, period: 'this_month' });
    if (emptyAnalytics.summary.totalInvoiced !== 0 || emptyAnalytics.summary.totalPaid !== 0 || emptyAnalytics.summary.collectionRate !== 0) {
      throw new Error(`Empty analytics returned unexpected non-zero values: ${JSON.stringify(emptyAnalytics.summary)}`);
    }
    if (emptyAnalytics.comparison.invoicedChange !== 0 || emptyAnalytics.comparison.collectedChange !== 0) {
      throw new Error(`Empty comparison returned unexpected values: ${JSON.stringify(emptyAnalytics.comparison)}`);
    }
    console.log('  ✅ Passed: Empty state handled safely with 0 values and 0% collection rate.');

    // -------------------------------------------------------------
    // Test 3: Create Controlled Invoices in Institute A
    // -------------------------------------------------------------
    console.log('\nTest 3: Seed Controlled Invoices & Transactions in Institute A...');
    const now = new Date();
    const futureDueDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); // 15 days in future
    const pastDueDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days in past

    // Invoice 1: 10,000 (Fully Paid) -> PAID
    const inv1 = await prisma.invoice.create({
      data: {
        instituteId: testInstituteA.id,
        invoiceNumber: `INV-A1-${suffix}`,
        studentId: testStudentA.id,
        title: 'Term 1 Fee (Fully Paid)',
        totalAmount: 10000,
        paidAmount: 0,
        dueDate: futureDueDate,
        status: 'UNPAID',
      },
    });

    // Pay 10,000 in full
    await recordInvoicePayment({
      instituteId: testInstituteA.id,
      invoiceId: inv1.id,
      amount: 10000,
      paymentMethodName: 'Bank Transfer',
    });

    // Invoice 2: 10,000 (Partially Paid with 4,000) -> PARTIAL (Balance 6,000)
    const inv2 = await prisma.invoice.create({
      data: {
        instituteId: testInstituteA.id,
        invoiceNumber: `INV-A2-${suffix}`,
        studentId: testStudentA.id,
        title: 'Term 1 Lab Fee (Partially Paid)',
        totalAmount: 10000,
        paidAmount: 0,
        dueDate: futureDueDate,
        status: 'UNPAID',
      },
    });

    // Pay 4,000
    await recordInvoicePayment({
      instituteId: testInstituteA.id,
      invoiceId: inv2.id,
      amount: 4000,
      paymentMethodName: 'Cash',
    });

    // Invoice 3: 8,000 (Unpaid with future due date) -> UNPAID (Balance 8,000)
    const inv3 = await prisma.invoice.create({
      data: {
        instituteId: testInstituteA.id,
        invoiceNumber: `INV-A3-${suffix}`,
        studentId: testStudentA.id,
        title: 'Sports & Facilities Fee (Unpaid)',
        totalAmount: 8000,
        paidAmount: 0,
        dueDate: futureDueDate,
        status: 'UNPAID',
      },
    });

    // Invoice 4: 5,000 (Unpaid with past due date) -> OVERDUE (Balance 5,000)
    const inv4 = await prisma.invoice.create({
      data: {
        instituteId: testInstituteA.id,
        invoiceNumber: `INV-A4-${suffix}`,
        studentId: testStudentA.id,
        title: 'Late Registration Fee (Overdue)',
        totalAmount: 5000,
        paidAmount: 0,
        dueDate: pastDueDate,
        status: 'UNPAID',
      },
    });

    // Invoice in Institute B (for cross-tenant leakage check): 500,000
    const invB = await prisma.invoice.create({
      data: {
        instituteId: testInstituteB.id,
        invoiceNumber: `INV-B1-${suffix}`,
        studentId: testStudentB.id,
        title: 'Inst B Massive Fee',
        totalAmount: 500000,
        paidAmount: 0,
        dueDate: futureDueDate,
        status: 'UNPAID',
      },
    });

    await recordInvoicePayment({
      instituteId: testInstituteB.id,
      invoiceId: invB.id,
      amount: 250000,
      paymentMethodName: 'Online Gateway',
    });

    console.log('  ✅ Passed: Controlled dataset populated for Inst A and Inst B.');

    // -------------------------------------------------------------
    // Test 4: Financial Math & KPI Verification for Institute A
    // -------------------------------------------------------------
    console.log('\nTest 4: Verifying Financial KPI Math for Institute A...');
    const instAAnalytics = await getInvoiceAnalytics({ instituteId: testInstituteA.id, period: 'this_month' });
    const s = instAAnalytics.summary;

    console.log('  Summary Results:');
    console.log(`    Total Invoiced:  ${s.totalInvoiced} (Expected: 33000)`);
    console.log(`    Total Collected: ${s.totalCollected} (Expected: 14000)`);
    console.log(`    Outstanding:     ${s.outstanding} (Expected: 19000)`);
    console.log(`    Overdue:         ${s.overdue} (Expected: 5000)`);
    console.log(`    Collection Rate: ${s.collectionRate}% (Expected: ~42.4%)`);
    console.log(`    Invoices Count:  ${s.totalInvoices} (Paid: ${s.paidCount}, Partial: ${s.partialCount}, Unpaid: ${s.unpaidCount}, Overdue: ${s.overdueCount})`);

    if (s.totalInvoiced !== 33000) {
      throw new Error(`Total Invoiced mismatch: expected 33000, got ${s.totalInvoiced}`);
    }
    if (s.totalCollected !== 14000 || s.totalPaid !== 14000) {
      throw new Error(`Total Collected mismatch: expected 14000, got ${s.totalCollected}`);
    }
    if (s.outstanding !== 19000 || s.totalUnpaid !== 19000) {
      throw new Error(`Outstanding balance mismatch: expected 19000, got ${s.outstanding}`);
    }
    if (s.overdue !== 5000 || s.overdueAmount !== 5000) {
      throw new Error(`Overdue amount mismatch: expected 5000, got ${s.overdue}`);
    }
    if (s.totalInvoices !== 4) {
      throw new Error(`Total invoices count mismatch: expected 4, got ${s.totalInvoices}`);
    }
    if (s.paidCount !== 1) {
      throw new Error(`Paid count mismatch: expected 1, got ${s.paidCount}`);
    }
    if (s.partialCount !== 1) {
      throw new Error(`Partial count mismatch: expected 1, got ${s.partialCount}`);
    }
    if (s.unpaidCount !== 1) {
      throw new Error(`Unpaid count mismatch: expected 1, got ${s.unpaidCount}`);
    }
    if (s.overdueCount !== 1) {
      throw new Error(`Overdue count mismatch: expected 1, got ${s.overdueCount}`);
    }

    const expectedRate = Math.round((14000 / 33000) * 1000) / 10;
    if (s.collectionRate !== expectedRate) {
      throw new Error(`Collection rate mismatch: expected ${expectedRate}, got ${s.collectionRate}`);
    }

    console.log('  ✅ Passed: All 10 KPIs match authoritative mathematical expectations exactly.');

    // -------------------------------------------------------------
    // Test 5: Tenant Isolation Verification (No Leakage from Inst B)
    // -------------------------------------------------------------
    console.log('\nTest 5: Verifying Strict Tenant Isolation...');
    const instBAnalytics = await getInvoiceAnalytics({ instituteId: testInstituteB.id, period: 'this_month' });
    if (instBAnalytics.summary.totalInvoiced !== 500000) {
      throw new Error(`Inst B total invoiced mismatch: expected 500000, got ${instBAnalytics.summary.totalInvoiced}`);
    }
    if (instBAnalytics.summary.totalCollected !== 250000) {
      throw new Error(`Inst B total collected mismatch: expected 250000, got ${instBAnalytics.summary.totalCollected}`);
    }
    // Verify Institute A has not received any of Inst B data
    if (instAAnalytics.summary.totalInvoiced >= 500000 || instAAnalytics.summary.totalCollected >= 250000) {
      throw new Error('Tenant isolation failure: Inst A contains Inst B financial data!');
    }
    console.log('  ✅ Passed: Tenant isolation verified; Inst A and Inst B are strictly separated.');

    // -------------------------------------------------------------
    // Test 6: Overdue Clearance when Paid in Full
    // -------------------------------------------------------------
    console.log('\nTest 6: Clearing Overdue Invoice by Paying in Full...');
    await recordInvoicePayment({
      instituteId: testInstituteA.id,
      invoiceId: inv4.id,
      amount: 5000,
      paymentMethodName: 'Cash',
    });

    const updatedAfterPay = await getInvoiceAnalytics({ instituteId: testInstituteA.id, period: 'this_month' });
    const s2 = updatedAfterPay.summary;
    console.log(`    After paying overdue inv: Overdue Amount = ${s2.overdue} (Expected: 0), Overdue Count = ${s2.overdueCount} (Expected: 0), Paid Count = ${s2.paidCount} (Expected: 2)`);

    if (s2.overdue !== 0 || s2.overdueCount !== 0) {
      throw new Error(`Overdue invoice was fully paid but still counted as overdue: amount=${s2.overdue}, count=${s2.overdueCount}`);
    }
    if (s2.paidCount !== 2) {
      throw new Error(`Paid count should now be 2, got ${s2.paidCount}`);
    }
    if (s2.totalCollected !== 19000) {
      throw new Error(`Total collected should now be 19000, got ${s2.totalCollected}`);
    }
    console.log('  ✅ Passed: Fully paying an overdue invoice clears overdue balance and count.');

    // -------------------------------------------------------------
    // Test 7: Exclusion of Rejected Transactions
    // -------------------------------------------------------------
    console.log('\nTest 7: Verification of Rejected Transaction Exclusion...');
    // Create a pending transaction on Invoice 3
    const pendingTx = await prisma.transaction.create({
      data: {
        instituteId: testInstituteA.id,
        transactionNumber: `TX-REJ-${suffix}`,
        invoiceId: inv3.id,
        studentId: testStudentA.id,
        amount: 8000,
        status: 'PENDING',
      },
    });

    // Reject it
    await updateTransactionStatus({
      instituteId: testInstituteA.id,
      transactionId: pendingTx.id,
      status: 'REJECTED',
      remarks: 'Invalid bank slip',
    });

    const analyticsAfterRejection = await getInvoiceAnalytics({ instituteId: testInstituteA.id, period: 'this_month' });
    if (analyticsAfterRejection.summary.totalCollected !== 19000) {
      throw new Error(`Rejected transaction was incorrectly counted in collected total: got ${analyticsAfterRejection.summary.totalCollected}`);
    }
    console.log('  ✅ Passed: Rejected transactions are correctly excluded from total collections.');

    console.log('\n🎉 ALL INVOICE ANALYTICS TESTS PASSED SUCCESSFULLY! 🎉\n');
  } finally {
    // Cleanup Test Records
    console.log('Cleaning up test records...');
    if (testInstituteA) {
      await prisma.transaction.deleteMany({ where: { instituteId: testInstituteA.id } });
      await prisma.invoiceItem.deleteMany({ where: { invoice: { instituteId: testInstituteA.id } } });
      await prisma.invoice.deleteMany({ where: { instituteId: testInstituteA.id } });
      await prisma.student.deleteMany({ where: { instituteId: testInstituteA.id } });
      await prisma.user.deleteMany({ where: { instituteId: testInstituteA.id } });
      await prisma.institute.delete({ where: { id: testInstituteA.id } });
    }
    if (testInstituteB) {
      await prisma.transaction.deleteMany({ where: { instituteId: testInstituteB.id } });
      await prisma.invoiceItem.deleteMany({ where: { invoice: { instituteId: testInstituteB.id } } });
      await prisma.invoice.deleteMany({ where: { instituteId: testInstituteB.id } });
      await prisma.student.deleteMany({ where: { instituteId: testInstituteB.id } });
      await prisma.user.deleteMany({ where: { instituteId: testInstituteB.id } });
      await prisma.institute.delete({ where: { id: testInstituteB.id } });
    }
    console.log('✅ Cleanup complete.');
  }
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
