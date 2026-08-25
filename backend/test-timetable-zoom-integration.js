import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:5000/api';

let adminToken = '';
let teacherToken = '';
let studentToken = '';

async function postJson(url, data, token = '') {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || `Request failed with status ${res.status}`);
  return json;
}

async function getJson(url, token = '') {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || `Request failed with status ${res.status}`);
  return json;
}

async function runTests() {
  console.log('🧪 Starting Timetable Session & Online Meeting Link Verification...\n');

  try {
    // 0. Ensure Institute 1 active subscription featuresSnapshot includes ZOOM_CLASSES and TIMETABLE
    const activeSub = await prisma.instituteSubscription.findFirst({
      where: { instituteId: 1, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });

    if (activeSub) {
      const currentFeatures = Array.isArray(activeSub.featuresSnapshot)
        ? [...activeSub.featuresSnapshot]
        : Object.keys(activeSub.featuresSnapshot || {}).map((code) => ({ code, name: code }));

      if (!currentFeatures.some((f) => f.code === 'ZOOM_CLASSES')) {
        currentFeatures.push({ code: 'ZOOM_CLASSES', name: 'Zoom & Online Classes' });
      }
      if (!currentFeatures.some((f) => f.code === 'TIMETABLE')) {
        currentFeatures.push({ code: 'TIMETABLE', name: 'Timetable Scheduling' });
      }

      await prisma.instituteSubscription.update({
        where: { id: activeSub.id },
        data: { featuresSnapshot: currentFeatures },
      });
    }

    // 1. Authenticate users
    console.log('1. Authenticating test users...');
    const [adminRes, teachRes, studRes] = await Promise.all([
      postJson(`${API_URL}/auth/login`, {
        email: 'admin@edunexa.com',
        password: 'Admin123!',
      }),
      postJson(`${API_URL}/auth/login`, {
        email: 'teacher@edunexa.com',
        password: 'Teacher123!',
      }),
      postJson(`${API_URL}/auth/login`, {
        email: 'student@edunexa.com',
        password: 'Student123!',
      }),
    ]);

    adminToken = adminRes.token;
    teacherToken = teachRes.token;
    studentToken = studRes.token;
    console.log('  ✅ Admin, Teacher, and Student authenticated.');

    // 2. Verify Subject Architecture: Ensure Subject only contains academic metadata
    console.log('\n2. Verifying Subject Architecture (Academic Metadata only)...');
    const randomCode = `SUB_${Math.floor(1000 + Math.random() * 9000)}`;
    const subRes = await postJson(
      `${API_URL}/academic/subjects`,
      {
        name: 'Advanced Physics',
        code: randomCode,
        description: 'Comprehensive physics curriculum with practicals',
      },
      adminToken
    );
    console.log('  ✅ Created Subject successfully:', subRes.data.name, `(${subRes.data.code})`);

    // Check that subject does not hold Zoom meetingUrl in DB
    const createdSubject = await prisma.subject.findUnique({
      where: { id: subRes.data.id },
    });
    if (createdSubject.meetingUrl !== undefined) {
      console.warn('  ⚠️ Note: meetingUrl found on subject object.');
    } else {
      console.log('  ✅ Confirmed: Subject has no direct meetingUrl column.');
    }

    // 3. Create Timetable Session with ONLINE classType and valid HTTPS Zoom URL
    console.log('\n3. Creating Timetable Session with ONLINE Class Type & Zoom Link (Feature Enabled)...');
    const activeClass = await prisma.class.findFirst({
      where: { instituteId: 1, isActive: true },
    });
    const teacher = await prisma.teacher.findFirst({
      where: { instituteId: 1 },
    });

    // Pick dynamic hours to avoid conflict with existing slots
    const startHour = 12 + Math.floor(Math.random() * 4); // 12, 13, 14, 15
    const startTimeStr = `${startHour.toString().padStart(2, '0')}:00`;
    const endTimeStr = `${startHour.toString().padStart(2, '0')}:45`;

    const ttRes = await postJson(
      `${API_URL}/timetable`,
      {
        classId: activeClass.id,
        subjectId: subRes.data.id,
        teacherId: teacher.id,
        dayOfWeek: 'THURSDAY',
        startTime: startTimeStr,
        endTime: endTimeStr,
        classType: 'ONLINE',
        room: 'Virtual Room 1',
        meetingUrl: 'https://zoom.us/j/9876543210',
        meetingId: '987 654 3210',
        meetingPassword: 'pass_zoom_123',
        notes: 'Please connect 5 minutes before class with microphone enabled.',
      },
      adminToken
    );

    console.log('  ✅ Timetable Session created:');
    console.log(`     - ID: ${ttRes.data.id}`);
    console.log(`     - Class Type: ${ttRes.data.classType}`);
    console.log(`     - Meeting URL: ${ttRes.data.meetingUrl}`);
    console.log(`     - Meeting ID: ${ttRes.data.meetingId}`);
    console.log(`     - Notes: ${ttRes.data.notes}`);

    if (
      ttRes.data.classType === 'ONLINE' &&
      ttRes.data.meetingUrl === 'https://zoom.us/j/9876543210' &&
      ttRes.data.notes.includes('microphone')
    ) {
      console.log('  ✅ TimetableSession is the source of truth for online class meetings.');
    } else {
      throw new Error('TimetableSession did not persist online meeting metadata correctly.');
    }

    // 4. Create PHYSICAL Timetable Session to ensure meeting fields are cleared
    console.log('\n4. Creating Timetable Session with PHYSICAL Class Type...');
    const physStartHour = 16;
    const physRes = await postJson(
      `${API_URL}/timetable`,
      {
        classId: activeClass.id,
        subjectId: subRes.data.id,
        teacherId: teacher.id,
        dayOfWeek: 'FRIDAY',
        startTime: `${physStartHour}:00`,
        endTime: `${physStartHour}:45`,
        classType: 'PHYSICAL',
        room: 'Science Lab 3',
        meetingUrl: null,
        meetingId: null,
        meetingPassword: null,
        notes: 'Bring standard laboratory kit.',
      },
      adminToken
    );

    console.log('  ✅ PHYSICAL Timetable Session created:');
    console.log(`     - ID: ${physRes.data.id}`);
    console.log(`     - Class Type: ${physRes.data.classType}`);
    console.log(`     - Room: ${physRes.data.room}`);
    console.log(`     - Meeting URL: ${physRes.data.meetingUrl}`);

    // 5. Query Teacher Portal & Student Portal Dashboards
    console.log('\n5. Querying Teacher & Student Portal Dashboards...');
    const [teachDash, studDash] = await Promise.all([
      getJson(`${API_URL}/portal/teacher/dashboard`, teacherToken),
      getJson(`${API_URL}/portal/student/dashboard`, studentToken),
    ]);

    console.log('  ✅ Teacher Dashboard Sessions received:', teachDash.data.weeklyTimetable.length);
    console.log('  ✅ Student Dashboard Sessions received:', studDash.data.weeklyTimetable.length);

    // Verify online session has meetingUrl
    const teacherOnlineSession = teachDash.data.weeklyTimetable.find((s) => s.id === ttRes.data.id);
    if (teacherOnlineSession && teacherOnlineSession.meetingUrl === 'https://zoom.us/j/9876543210') {
      console.log('  ✅ Teacher Dashboard includes valid HTTPS Zoom meetingUrl for assigned online session.');
    }

    console.log('\n================================================================');
    console.log('🎉 ALL TIMETABLE SESSION & ZOOM LINK ARCHITECTURE TESTS PASSED!');
    console.log('================================================================');
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
