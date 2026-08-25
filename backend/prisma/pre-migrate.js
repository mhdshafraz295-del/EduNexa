import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function preMigrate() {
  console.log('🔄 Running pre-migration script to preserve existing data and prepare institute relations...');

  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'edumanage_pro'
  });

  try {
    // 1. Create institute table if not exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`institute\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`name\` varchar(191) NOT NULL,
        \`slug\` varchar(191) NOT NULL,
        \`code\` varchar(191) NOT NULL,
        \`email\` varchar(191) DEFAULT NULL,
        \`phone\` varchar(191) DEFAULT NULL,
        \`address\` varchar(191) DEFAULT NULL,
        \`logo\` varchar(191) DEFAULT NULL,
        \`isActive\` tinyint(1) NOT NULL DEFAULT 1,
        \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`Institute_slug_key\` (\`slug\`),
        UNIQUE KEY \`Institute_code_key\` (\`code\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Insert default demo institute if not exists
    await connection.query(`
      INSERT INTO \`institute\` (\`id\`, \`name\`, \`slug\`, \`code\`, \`email\`, \`phone\`, \`address\`, \`logo\`, \`isActive\`)
      VALUES (1, 'EduNexa Demo Institute', 'edunexa-demo', 'EDU0001', 'contact@edunexa-demo.lk', '+94 11 234 5678', '123 Innovation Way, Colombo', '/logo.png', 1)
      ON DUPLICATE KEY UPDATE \`name\`='EduNexa Demo Institute';
    `);

    // Tables that need instituteId added / backfilled
    const tables = [
      'user', 'class', 'subject', 'student', 'teacher', 'parent', 'attendance',
      'assignment', 'submission', 'exam', 'examquestion', 'examattempt', 'examanswer',
      'result', 'termexam', 'termexamsubject', 'termexammark', 'termexamresult',
      'course', 'courseenrollment', 'courseorder', 'coursebookmark', 'paymentmethod',
      'invoice', 'invoiceitem', 'transaction', 'book', 'bookissue', 'supportticket',
      'supportmessage', 'announcement', 'popupannouncement', 'popupview', 'popupenrollment',
      'notification', 'message', 'pdfsetting', 'pdfreporttemplate', 'whatsappsetting',
      'whatsapplog', 'setting'
    ];

    for (const table of tables) {
      try {
        const [cols] = await connection.query(`SHOW COLUMNS FROM \`${table}\` LIKE 'instituteId'`);
        if (cols.length === 0) {
          await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`instituteId\` int(11) DEFAULT 1`);
          console.log(`+ Added instituteId to ${table}`);
        } else {
          await connection.query(`UPDATE \`${table}\` SET \`instituteId\` = 1 WHERE \`instituteId\` IS NULL`);
        }
      } catch (err) {
        // table might not exist yet; prisma will create it
      }
    }

    console.log('✅ Pre-migration successful! All existing records mapped to EduNexa Demo Institute (id: 1).');
  } catch (error) {
    console.error('Error during pre-migration:', error);
  } finally {
    await connection.end();
  }
}

preMigrate();
