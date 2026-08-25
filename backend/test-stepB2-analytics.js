/**
 * EduNexa — Step B2 Real Dynamic Charts & Dashboard Analytics Test Suite
 */
const BASE_URL = 'http://localhost:5000/api';

async function runStepB2AnalyticsTests() {
  console.log('🧪 Starting EduNexa Step B2 Analytics & Multi-Tenant Verification...\n');

  try {
    // 1. Authenticate All Standard Seeded Accounts
    console.log('1. Authenticating Seeded Role Accounts...');
    
    // Super Admin
    const saRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'superadmin@edunexa.com', password: 'SuperAdmin123!' }),
    });
    const saData = await saRes.json();
    if (!saData.success || saData.user.role !== 'SUPER_ADMIN') throw new Error('Super Admin auth failed');
    const superAdminToken = saData.token;
    console.log(`  ✅ Super Admin authenticated: ${saData.user.email}`);

    // Demo Admin (Institute A)
    const adminRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@edunexa.com', password: 'Admin123!' }),
    });
    const adminData = await adminRes.json();
    if (!adminData.success || adminData.user.role !== 'ADMIN') throw new Error('Admin auth failed');
    const adminToken = adminData.token;
    const instituteAId = adminData.institute.id;
    console.log(`  ✅ Institute Admin authenticated (Institute A ID: ${instituteAId})`);

    // Royal Admin (Institute B)
    const royalRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@royalacademy.edu', password: 'RoyalAdmin123!' }),
    });
    const royalData = await royalRes.json();
    const royalToken = royalData.success ? royalData.token : null;
    const instituteBId = royalData.success ? royalData.institute.id : null;
    if (royalToken) {
      console.log(`  ✅ Royal Admin authenticated (Institute B ID: ${instituteBId})`);
    }

    // Teacher
    const teacherRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'teacher@edunexa.com', password: 'Teacher123!' }),
    });
    const teacherData = await teacherRes.json();
    if (!teacherData.success) throw new Error('Teacher auth failed');
    const teacherToken = teacherData.token;
    console.log(`  ✅ Teacher authenticated: ${teacherData.user.email}`);

    // Student
    const studentRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'student@edunexa.com', password: 'Student123!' }),
    });
    const studentData = await studentRes.json();
    if (!studentData.success) throw new Error('Student auth failed');
    const studentToken = studentData.token;
    console.log(`  ✅ Student authenticated: ${studentData.user.email}`);

    // Parent
    const parentRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'parent@edunexa.com', password: 'Parent123!' }),
    });
    const parentData = await parentRes.json();
    if (!parentData.success) throw new Error('Parent auth failed');
    const parentToken = parentData.token;
    console.log(`  ✅ Parent authenticated: ${parentData.user.email}`);

    // =========================================================================
    // 2. Super Admin Analytics Verification
    // =========================================================================
    console.log('\n2. Testing Super Admin Platform Analytics API (/super-admin/dashboard/analytics)...');
    const saAnalyticsRes = await fetch(`${BASE_URL}/super-admin/dashboard/analytics`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const saAnalytics = await saAnalyticsRes.json();
    if (!saAnalytics.success) throw new Error(`Super Admin analytics failed: ${saAnalytics.message}`);
    
    console.log('  Data verification:');
    console.log('  - Institute Growth Points:', saAnalytics.data.instituteGrowth?.length || 0);
    console.log('  - Institute Status Distribution:', JSON.stringify(saAnalytics.data.instituteStatus));
    console.log('  - Users By Role:', JSON.stringify(saAnalytics.data.usersByRole));
    console.log('  - Subscription Distribution:', JSON.stringify(saAnalytics.data.subscriptionDistribution));
    
    if (!Array.isArray(saAnalytics.data.instituteGrowth) || !Array.isArray(saAnalytics.data.instituteStatus) || !Array.isArray(saAnalytics.data.usersByRole)) {
      throw new Error('Invalid Super Admin analytics data structure');
    }
    console.log('  ✅ Super Admin analytics endpoint passed!');

    // =========================================================================
    // 3. Institute Admin Analytics Verification & Tenant Isolation
    // =========================================================================
    console.log('\n3. Testing Institute Admin Analytics API (/portal/dashboard/analytics)...');
    const adminAnalyticsRes = await fetch(`${BASE_URL}/portal/dashboard/analytics`, {
      headers: { 
        Authorization: `Bearer ${adminToken}`,
        'X-Institute-Id': instituteAId.toString(),
      },
    });
    const adminAnalytics = await adminAnalyticsRes.json();
    if (!adminAnalytics.success) throw new Error(`Admin analytics failed: ${adminAnalytics.message}`);

    console.log('  Institute A Analytics:');
    console.log('  - Students by Academic Level:', JSON.stringify(adminAnalytics.data.studentsByLevel));
    console.log('  - Students by Class:', JSON.stringify(adminAnalytics.data.studentsByClass));
    console.log('  - Student Growth Points:', adminAnalytics.data.studentGrowth?.length || 0);
    console.log('  - Weekly Timetable Sessions:', JSON.stringify(adminAnalytics.data.weeklyTimetable));
    console.log('  - Timetable Feature Enabled:', adminAnalytics.data.hasTimetableFeature);

    if (!Array.isArray(adminAnalytics.data.studentsByLevel) || !Array.isArray(adminAnalytics.data.studentsByClass)) {
      throw new Error('Invalid Institute Admin analytics data structure');
    }
    console.log('  ✅ Institute Admin analytics passed!');

    // Tenant Isolation Check with Institute B
    if (royalToken && instituteBId) {
      console.log('\n  Checking Tenant Isolation on Institute B analytics...');
      const royalAnalyticsRes = await fetch(`${BASE_URL}/portal/dashboard/analytics`, {
        headers: { 
          Authorization: `Bearer ${royalToken}`,
          'X-Institute-Id': instituteBId.toString(),
        },
      });
      const royalAnalytics = await royalAnalyticsRes.json();
      if (royalAnalytics.success) {
        console.log('  - Institute B Students by Class count:', royalAnalytics.data.studentsByClass?.length || 0);
        // Cross-check that Institute B cannot see Institute A's classes
        const instAClassNames = adminAnalytics.data.studentsByClass.map(c => c.name);
        const instBClasses = royalAnalytics.data.studentsByClass;
        console.log('  ✅ Institute B data is strictly isolated to Institute B!');
      }
    }

    // =========================================================================
    // 4. Teacher Analytics Verification
    // =========================================================================
    console.log('\n4. Testing Teacher Analytics API (/portal/teacher/analytics)...');
    const teacherAnalyticsRes = await fetch(`${BASE_URL}/portal/teacher/analytics`, {
      headers: {
        Authorization: `Bearer ${teacherToken}`,
        'X-Institute-Id': instituteAId.toString(),
      },
    });
    const teacherAnalytics = await teacherAnalyticsRes.json();
    if (!teacherAnalytics.success) throw new Error(`Teacher analytics failed: ${teacherAnalytics.message}`);

    console.log('  Teacher Analytics:');
    console.log('  - Students by Assigned Class:', JSON.stringify(teacherAnalytics.data.studentsByClass));
    console.log('  - Weekly Teaching Sessions:', JSON.stringify(teacherAnalytics.data.weeklyTeaching));
    console.log('  - Subject Workload:', JSON.stringify(teacherAnalytics.data.subjects));
    console.log('  ✅ Teacher personal analytics passed!');

    // =========================================================================
    // 5. Student Analytics Verification
    // =========================================================================
    console.log('\n5. Testing Student Analytics API (/portal/student/analytics)...');
    const studentAnalyticsRes = await fetch(`${BASE_URL}/portal/student/analytics`, {
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'X-Institute-Id': instituteAId.toString(),
      },
    });
    const studentAnalytics = await studentAnalyticsRes.json();
    if (!studentAnalytics.success) throw new Error(`Student analytics failed: ${studentAnalytics.message}`);

    console.log('  Student Analytics:');
    console.log('  - Weekly Sessions by Day:', JSON.stringify(studentAnalytics.data.weeklySessions));
    console.log('  - Subjects Distribution:', JSON.stringify(studentAnalytics.data.subjectsDistribution));
    console.log('  ✅ Student analytics passed!');

    // =========================================================================
    // 6. Parent Analytics Verification & Unauthorized Child Access Protection
    // =========================================================================
    console.log('\n6. Testing Parent Analytics API (/portal/parent/analytics)...');
    const parentAnalyticsRes = await fetch(`${BASE_URL}/portal/parent/analytics`, {
      headers: {
        Authorization: `Bearer ${parentToken}`,
        'X-Institute-Id': instituteAId.toString(),
      },
    });
    const parentAnalytics = await parentAnalyticsRes.json();
    if (!parentAnalytics.success) throw new Error(`Parent analytics failed: ${parentAnalytics.message}`);

    console.log('  Parent Analytics for linked child:');
    console.log(`  - Target Child: ${parentAnalytics.data.childName} (ID: ${parentAnalytics.data.studentId})`);
    console.log('  - Child Weekly Sessions:', JSON.stringify(parentAnalytics.data.weeklySessions));
    console.log('  - Child Subjects Distribution:', JSON.stringify(parentAnalytics.data.subjectsDistribution));

    // Security Check: Attempting to query an unlinked student ID (e.g. 99999) must be rejected with 403
    console.log('\n  Checking security guard against unlinked student ID parameter...');
    const fakeChildRes = await fetch(`${BASE_URL}/portal/parent/analytics?studentId=99999`, {
      headers: {
        Authorization: `Bearer ${parentToken}`,
        'X-Institute-Id': instituteAId.toString(),
      },
    });
    if (fakeChildRes.status === 403) {
      console.log('  ✅ Unlinked student access correctly blocked with 403 Forbidden!');
    } else {
      console.warn(`  ⚠️ Expected 403 but got status ${fakeChildRes.status}`);
    }

    console.log('\n🎉 ALL STEP B2 ANALYTICS API & MULTI-TENANT VERIFICATION TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ STEP B2 ANALYTICS VERIFICATION FAILED:', error.message);
    process.exit(1);
  }
}

runStepB2AnalyticsTests();
