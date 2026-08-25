import prisma from './src/config/prisma.js';
import {
  getInvoiceAnalytics,
  recordInvoicePayment,
  updateTransactionStatus,
  getDateRange,
} from './src/services/invoiceAnalytics.service.js';

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedCount++;
  }
}

async function createTestStudent(instituteId, name, admNumber, email) {
  const user = await prisma.user.create({
    data: {
      username: `${email.split('@')[0]}_${Math.floor(Math.random() * 10000)}`,
      email,
      passwordHash: 'hashedpassword',
      role: 'STUDENT',
      instituteId,
      isActive: true,
    },
  });

  return await prisma.student.create({
    data: {
      userId: user.id,
      instituteId,
      name,
      admissionNumber: admNumber,
    },
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('EDUNEXA INVOICE MONTHLY ANALYTICS & COLLECTION TESTS');
  console.log('====================================================\n');

  let instA, instB, emptyInst;

  try {
    // 1. Setup Test Institutes, Students, and Classes
    const testCodeA = `TEST-INST-A-${Date.now().toString().slice(-4)}`;
    const testCodeB = `TEST-INST-B-${Date.now().toString().slice(-4)}`;

    instA = await prisma.institute.create({
      data: {
        name: 'Analytics Test Institute A',
        slug: `analytics-test-a-${Date.now()}`,
        code: testCodeA,
        settings: {
          create: {
            currencySymbol: 'LKR',
          },
        },
      },
    });

    instB = await prisma.institute.create({
      data: {
        name: 'Analytics Test Institute B',
        slug: `analytics-test-b-${Date.now()}`,
        code: testCodeB,
        settings: {
          create: {
            currencySymbol: '$',
          },
        },
      },
    });

    const timeNonce = Date.now();
    const studentA1 = await createTestStudent(instA.id, 'Amal Perera', `ADM-${timeNonce}-1`, `amal-${timeNonce}@edunexa.test`);
    const studentA2 = await createTestStudent(instA.id, 'Kamal Silva', `ADM-${timeNonce}-2`, `kamal-${timeNonce}@edunexa.test`);
    const studentB1 = await createTestStudent(instB.id, 'Tenant B Student', `ADMB-${timeNonce}-1`, `tenantb-${timeNonce}@edunexa.test`);

    console.log(`Created test institutes: A (ID: ${instA.id}), B (ID: ${instB.id})`);

    const now = new Date();
    const pastDueDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
    const futureDueDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); // 15 days in future

    // Invoice 1 (Institute A): Fully Paid (LKR 10,000)
    const inv1 = await prisma.invoice.create({
      data: {
        instituteId: instA.id,
        studentId: studentA1.id,
        invoiceNumber: `INV-A1-${Date.now()}`,
        title: 'Term 1 Tuition Fee',
        totalAmount: 10000,
        paidAmount: 10000,
        dueDate: futureDueDate,
        status: 'PAID',
        transactions: {
          create: {
            instituteId: instA.id,
            studentId: studentA1.id,
            transactionNumber: `TXN-A1-${Date.now()}`,
            amount: 10000,
            status: 'VERIFIED',
            paymentDate: now,
          },
        },
      },
      include: { transactions: true },
    });

    // Invoice 2 (Institute A): Partially Paid (LKR 20,000 total, 5,000 verified paid)
    const inv2 = await prisma.invoice.create({
      data: {
        instituteId: instA.id,
        studentId: studentA1.id,
        invoiceNumber: `INV-A2-${Date.now()}`,
        title: 'Lab & Library Fee',
        totalAmount: 20000,
        paidAmount: 5000,
        dueDate: futureDueDate,
        status: 'PARTIALLY_PAID',
        transactions: {
          create: {
            instituteId: instA.id,
            studentId: studentA1.id,
            transactionNumber: `TXN-A2-${Date.now()}`,
            amount: 5000,
            status: 'VERIFIED',
            paymentDate: now,
          },
        },
      },
      include: { transactions: true },
    });

    // Invoice 3 (Institute A): Unpaid & Overdue (LKR 15,000 total, 0 paid, past due date)
    const inv3 = await prisma.invoice.create({
      data: {
        instituteId: instA.id,
        studentId: studentA2.id,
        invoiceNumber: `INV-A3-${Date.now()}`,
        title: 'Sports & Facility Fee',
        totalAmount: 15000,
        paidAmount: 0,
        dueDate: pastDueDate,
        status: 'OVERDUE',
      },
    });

    // Invoice 4 (Institute B - Tenant Isolation): Total LKR 50,000
    const invB = await prisma.invoice.create({
      data: {
        instituteId: instB.id,
        studentId: studentB1.id,
        invoiceNumber: `INV-B1-${Date.now()}`,
        title: 'Institute B Invoice',
        totalAmount: 50000,
        paidAmount: 50000,
        dueDate: futureDueDate,
        status: 'PAID',
        transactions: {
          create: {
            instituteId: instB.id,
            studentId: studentB1.id,
            transactionNumber: `TXN-B1-${Date.now()}`,
            amount: 50000,
            status: 'VERIFIED',
            paymentDate: now,
          },
        },
      },
    });

    console.log('--- EXECUTING TEST SCENARIOS ---\n');

    // Test 1: Tenant Isolation
    const analyticsA = await getInvoiceAnalytics({ instituteId: instA.id, period: 'all_time' });
    const analyticsB = await getInvoiceAnalytics({ instituteId: instB.id, period: 'all_time' });
    assert(analyticsA.summary.totalInvoiced === 45000, `Test 1: Institute A Total Invoiced excludes Institute B (Expected 45,000, got ${analyticsA.summary.totalInvoiced})`);
    assert(analyticsB.summary.totalInvoiced === 50000, `Test 1b: Institute B Total Invoiced isolated (Expected 50,000, got ${analyticsB.summary.totalInvoiced})`);

    // Test 2: Total Invoiced Calculation (Institute A)
    // 10000 + 20000 + 15000 = 45000
    assert(analyticsA.summary.totalInvoiced === 45000, `Test 2: Total Invoiced correctly sums 45,000`);

    // Test 3: Total Collected Calculation (Institute A)
    // 10000 + 5000 = 15000
    assert(analyticsA.summary.totalCollected === 15000, `Test 3: Total Collected correctly sums 15,000 from verified transactions`);

    // Test 4: Outstanding Amount Calculation (Institute A)
    // Inv1 (0) + Inv2 (15000) + Inv3 (15000) = 30000
    assert(analyticsA.summary.outstanding === 30000, `Test 4: Total Outstanding balance correctly computes 30,000`);

    // Test 5: Overdue Calculation
    // Inv3 is past due (15000)
    assert(analyticsA.summary.overdue === 15000, `Test 5: Overdue amount correctly identifies 15,000`);

    // Test 6: Paid Count
    assert(analyticsA.summary.paidCount === 1, `Test 6: Paid invoice count is 1`);

    // Test 7: Partial Count
    assert(analyticsA.summary.partialCount === 1, `Test 7: Partially paid invoice count is 1`);

    // Test 8: Unpaid Count (for invoices not overdue)
    // Inv3 is past due so it's in overdueCount, leaving 0 regular unpaid before due date
    assert(analyticsA.summary.unpaidCount === 0, `Test 8: Unpaid (before due date) count is 0`);

    // Test 9: Overdue Count
    assert(analyticsA.summary.overdueCount === 1, `Test 9: Overdue invoice count is 1`);

    // Test 10: Collection Rate %
    // (15000 / 45000) * 100 = 33.3%
    assert(analyticsA.summary.collectionRate === 33.3, `Test 10: Collection Rate is 33.3% (Got ${analyticsA.summary.collectionRate}%)`);

    // Test 11: Zero Invoice Safe Calculation
    emptyInst = await prisma.institute.create({
      data: {
        name: 'Empty Test Institute',
        slug: `empty-inst-${Date.now()}`,
        code: `EMP-${Date.now().toString().slice(-4)}`,
      },
    });
    const emptyAnalytics = await getInvoiceAnalytics({ instituteId: emptyInst.id, period: 'all_time' });
    assert(emptyAnalytics.summary.totalInvoiced === 0 && emptyAnalytics.summary.collectionRate === 0 && !isNaN(emptyAnalytics.summary.collectionRate), 'Test 11: Empty institute produces safe 0 values with 0% collection rate and no NaN');

    // Test 12: Pending Payment Excluded from Collection
    const invPending = await prisma.invoice.create({
      data: {
        instituteId: instA.id,
        studentId: studentA1.id,
        invoiceNumber: `INV-PEND-${Date.now()}`,
        title: 'Pending Transfer Invoice',
        totalAmount: 8000,
        dueDate: futureDueDate,
        status: 'UNPAID',
        transactions: {
          create: {
            instituteId: instA.id,
            studentId: studentA1.id,
            transactionNumber: `TXN-PEND-${Date.now()}`,
            amount: 8000,
            status: 'PENDING',
            paymentDate: now,
          },
        },
      },
    });
    const analyticsPending = await getInvoiceAnalytics({ instituteId: instA.id, period: 'all_time' });
    assert(analyticsPending.summary.totalCollected === 15000, `Test 12: PENDING transactions are excluded from Total Collected (Expected 15,000, got ${analyticsPending.summary.totalCollected})`);

    // Test 13: Approved / Verified Payment Included
    const pendingTx = await prisma.transaction.findFirst({
      where: { invoiceId: invPending.id },
    });
    await updateTransactionStatus({
      instituteId: instA.id,
      transactionId: pendingTx.id,
      status: 'VERIFIED',
    });
    const analyticsApproved = await getInvoiceAnalytics({ instituteId: instA.id, period: 'all_time' });
    assert(analyticsApproved.summary.totalCollected === 23000, `Test 13: VERIFIED approved transaction is included in Total Collected (Expected 23,000, got ${analyticsApproved.summary.totalCollected})`);

    // Test 14: Rejected Payment Excluded
    await updateTransactionStatus({
      instituteId: instA.id,
      transactionId: pendingTx.id,
      status: 'REJECTED',
    });
    const analyticsRejected = await getInvoiceAnalytics({ instituteId: instA.id, period: 'all_time' });
    assert(analyticsRejected.summary.totalCollected === 15000, `Test 14: REJECTED transaction is excluded from Total Collected (Expected 15,000, got ${analyticsRejected.summary.totalCollected})`);

    // Test 15: Partial Payment Recording via Service
    const recordResult = await recordInvoicePayment({
      instituteId: instA.id,
      invoiceId: inv3.id,
      amount: 5000,
      paymentMethodName: 'Cash',
    });
    assert(recordResult.invoice.paidAmount === 5000 && recordResult.invoice.status === 'PARTIALLY_PAID', `Test 15: Partial payment recorded correctly, invoice status set to PARTIALLY_PAID`);

    // Test 16: Multiple Payments against same Invoice
    const secondPayment = await recordInvoicePayment({
      instituteId: instA.id,
      invoiceId: inv3.id,
      amount: 10000,
      paymentMethodName: 'Bank Transfer',
    });
    assert(secondPayment.invoice.paidAmount === 15000 && secondPayment.invoice.status === 'PAID', `Test 16: Multiple payments against same invoice accumulate to 15,000 and status becomes PAID`);

    // Test 17: No Double Counting
    const analyticsAfterPayments = await getInvoiceAnalytics({ instituteId: instA.id, period: 'all_time' });
    assert(analyticsAfterPayments.summary.totalCollected === 30000, `Test 17: No double counting in collected total (Expected 30,000, got ${analyticsAfterPayments.summary.totalCollected})`);

    // Test 18: Overpayment Safety (balance >= 0)
    const invOverpay = await prisma.invoice.create({
      data: {
        instituteId: instA.id,
        studentId: studentA1.id,
        invoiceNumber: `INV-OVER-${Date.now()}`,
        title: 'Overpayment Test Invoice',
        totalAmount: 1000,
        dueDate: futureDueDate,
        status: 'UNPAID',
      },
    });
    await recordInvoicePayment({
      instituteId: instA.id,
      invoiceId: invOverpay.id,
      amount: 1200,
      paymentMethodName: 'Direct Cash',
    });
    const analyticsOverpay = await getInvoiceAnalytics({ instituteId: instA.id, period: 'all_time' });
    assert(analyticsOverpay.summary.outstanding >= 0, `Test 18: Overpayment does not produce negative outstanding balance`);

    // Test 19: "This Month" Filter
    const thisMonthAnalytics = await getInvoiceAnalytics({ instituteId: instA.id, period: 'this_month' });
    assert(thisMonthAnalytics.summary.totalInvoiced > 0, `Test 19: 'this_month' filter returns current month invoices (${thisMonthAnalytics.summary.totalInvoiced})`);

    // Test 20: "Last Month" Filter
    const lastMonthAnalytics = await getInvoiceAnalytics({ instituteId: instA.id, period: 'last_month' });
    assert(lastMonthAnalytics.summary.totalInvoiced === 0, `Test 20: 'last_month' returns 0 for newly created test records`);

    // Test 21: Custom Date Range Filter
    const customAnalytics = await getInvoiceAnalytics({
      instituteId: instA.id,
      period: 'custom',
      startDate: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });
    assert(customAnalytics.summary.totalInvoiced > 0, `Test 21: Custom date range accurately captures today's invoices`);

    // Test 22: Payment Received This Month for Old Invoice Semantics
    const oldDate = new Date(now.getFullYear(), now.getMonth() - 2, 10);
    const oldInvoice = await prisma.invoice.create({
      data: {
        instituteId: instA.id,
        studentId: studentA2.id,
        invoiceNumber: `INV-OLD-${Date.now()}`,
        title: 'Old Term Invoice',
        totalAmount: 7000,
        createdAt: oldDate,
        dueDate: oldDate,
        status: 'UNPAID',
      },
    });
    // Record payment TODAY
    await recordInvoicePayment({
      instituteId: instA.id,
      invoiceId: oldInvoice.id,
      amount: 7000,
      paymentDate: now,
      paymentMethodName: 'Cash',
    });
    const curMonthCheck = await getInvoiceAnalytics({ instituteId: instA.id, period: 'this_month' });
    assert(curMonthCheck.summary.totalCollected >= 37000, `Test 22: Payment received this month for old invoice is correctly included in this month collection`);

    // Test 23: Monthly Trend Aggregation
    assert(Array.isArray(curMonthCheck.monthlyTrend) && curMonthCheck.monthlyTrend.length === 6, `Test 23: Monthly trend aggregates rolling 6 months`);

    // Test 24: Current vs Previous Month Comparison
    assert(curMonthCheck.comparison && typeof curMonthCheck.comparison.invoicedChange === 'number', `Test 24: Comparison contains safe numeric invoicedChange (${curMonthCheck.comparison.invoicedChange}%)`);

    // Test 25: Cross-tenant Analytics Blocked
    try {
      await getInvoiceAnalytics({ instituteId: null });
      assert(false, 'Test 25: Missing instituteId must throw error');
    } catch (e) {
      assert(true, 'Test 25: Tenant isolation error correctly thrown when instituteId is missing');
    }

    // Test 26: Currency Setting from DB
    assert(analyticsA.summary.currencySymbol === 'LKR', `Test 26: Correct institute currency symbol fetched (LKR)`);
    assert(analyticsB.summary.currencySymbol === '$', `Test 26b: Tenant B currency symbol correctly isolated ($)`);

    // Test 27: Recent Payments Accuracy
    assert(curMonthCheck.recentPayments.length > 0 && (curMonthCheck.recentPayments[0].transactionNumber.startsWith('REC-') || curMonthCheck.recentPayments[0].transactionNumber.startsWith('TXN-')), `Test 27: Recent payments contains verified transaction references`);

    // Test 28: Top Outstanding Debtors List
    assert(Array.isArray(curMonthCheck.topOutstandingStudents), `Test 28: Top outstanding students list structured properly`);

    // Test 29: Invoice Items & Printable Document Data Integrity
    const detailedInv = await prisma.invoice.findFirst({
      where: { id: inv1.id },
      include: { student: true, items: true, transactions: true, institute: true },
    });
    assert(detailedInv && detailedInv.transactions.length > 0 && detailedInv.student.name === 'Amal Perera', `Test 29: Invoice detail retains full relational graph for official printing`);

    // Test 30: End-to-end Financial Integrity
    assert(failedCount === 0, `Test 30: All financial integrity tests passed without errors!`);

    // Cleanup Test Data
    console.log('\n--- CLEANING UP TEST DATA ---');
    const instIds = [instA.id, instB.id, emptyInst.id];
    await prisma.transaction.deleteMany({ where: { instituteId: { in: instIds } } });
    await prisma.invoiceItem.deleteMany({ where: { invoice: { instituteId: { in: instIds } } } });
    await prisma.invoice.deleteMany({ where: { instituteId: { in: instIds } } });
    await prisma.student.deleteMany({ where: { instituteId: { in: instIds } } });
    await prisma.user.deleteMany({ where: { instituteId: { in: instIds } } });
    await prisma.setting.deleteMany({ where: { instituteId: { in: instIds } } });
    await prisma.paymentMethod.deleteMany({ where: { instituteId: { in: instIds } } });
    await prisma.institute.deleteMany({ where: { id: { in: instIds } } });
    console.log('Cleanup completed successfully.\n');

  } catch (error) {
    console.error('Test Execution Error:', error);
    failedCount++;
    if (instA || instB || emptyInst) {
      try {
        const instIds = [instA?.id, instB?.id, emptyInst?.id].filter(Boolean);
        await prisma.transaction.deleteMany({ where: { instituteId: { in: instIds } } });
        await prisma.invoiceItem.deleteMany({ where: { invoice: { instituteId: { in: instIds } } } });
        await prisma.invoice.deleteMany({ where: { instituteId: { in: instIds } } });
        await prisma.student.deleteMany({ where: { instituteId: { in: instIds } } });
        await prisma.user.deleteMany({ where: { instituteId: { in: instIds } } });
        await prisma.setting.deleteMany({ where: { instituteId: { in: instIds } } });
        await prisma.paymentMethod.deleteMany({ where: { instituteId: { in: instIds } } });
        await prisma.institute.deleteMany({ where: { id: { in: instIds } } });
      } catch (e) {
        // ignore
      }
    }
  }

  console.log('====================================================');
  console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('====================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests();
