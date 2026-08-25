import prisma from '../src/config/prisma.js';

async function applyStep7cMigration() {
  console.log('Applying Step 7C schema updates directly to MySQL...');

  // 1. Add fields to examattempt if not present
  const attemptColumns = [
    `ALTER TABLE \`examattempt\` ADD COLUMN IF NOT EXISTS \`answerPaperFile\` VARCHAR(255) NULL`,
    `ALTER TABLE \`examattempt\` ADD COLUMN IF NOT EXISTS \`answerPaperOriginalName\` VARCHAR(255) NULL`,
    `ALTER TABLE \`examattempt\` ADD COLUMN IF NOT EXISTS \`answerPaperMimeType\` VARCHAR(100) NULL`,
    `ALTER TABLE \`examattempt\` ADD COLUMN IF NOT EXISTS \`answerPaperSize\` INT NULL`,
    `ALTER TABLE \`examattempt\` ADD COLUMN IF NOT EXISTS \`answerUploadedAt\` DATETIME NULL`,
    `ALTER TABLE \`examattempt\` ADD COLUMN IF NOT EXISTS \`teacherFeedback\` TEXT NULL`,
    `ALTER TABLE \`examattempt\` ADD COLUMN IF NOT EXISTS \`markedBy\` INT NULL`,
    `ALTER TABLE \`examattempt\` ADD COLUMN IF NOT EXISTS \`markedAt\` DATETIME NULL`,
  ];

  for (const sql of attemptColumns) {
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log(`Executed: ${sql}`);
    } catch (e) {
      console.log(`Notice for ${sql}: ${e.message}`);
    }
  }

  // 2. Add fields to result if not present
  const resultColumns = [
    `ALTER TABLE \`result\` ADD COLUMN IF NOT EXISTS \`resultStatus\` VARCHAR(50) NOT NULL DEFAULT 'PENDING'`,
    `ALTER TABLE \`result\` ADD COLUMN IF NOT EXISTS \`teacherFeedback\` TEXT NULL`,
    `ALTER TABLE \`result\` ADD COLUMN IF NOT EXISTS \`markedBy\` INT NULL`,
    `ALTER TABLE \`result\` ADD COLUMN IF NOT EXISTS \`markedAt\` DATETIME NULL`,
    `ALTER TABLE \`result\` ADD COLUMN IF NOT EXISTS \`publishedBy\` INT NULL`,
    `ALTER TABLE \`result\` ADD COLUMN IF NOT EXISTS \`publishedAt\` DATETIME NULL`,
  ];

  for (const sql of resultColumns) {
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log(`Executed: ${sql}`);
    } catch (e) {
      console.log(`Notice for ${sql}: ${e.message}`);
    }
  }

  // 3. Create resultauditlog table if not exists
  const createAuditLogSql = `
    CREATE TABLE IF NOT EXISTS \`resultauditlog\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`instituteId\` INT DEFAULT 1,
      \`resultId\` INT NOT NULL,
      \`examId\` INT NOT NULL,
      \`studentId\` INT NOT NULL,
      \`action\` VARCHAR(50) NOT NULL,
      \`previousMarks\` DOUBLE NULL,
      \`newMarks\` DOUBLE NULL,
      \`previousPercentage\` DOUBLE NULL,
      \`newPercentage\` DOUBLE NULL,
      \`previousGrade\` VARCHAR(20) NULL,
      \`newGrade\` VARCHAR(20) NULL,
      \`previousPassFail\` VARCHAR(20) NULL,
      \`newPassFail\` VARCHAR(20) NULL,
      \`reason\` TEXT NULL,
      \`changedBy\` INT NULL,
      \`changedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX (\`resultId\`),
      INDEX (\`examId\`),
      INDEX (\`studentId\`),
      INDEX (\`instituteId\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  try {
    await prisma.$executeRawUnsafe(createAuditLogSql);
    console.log('Executed create resultauditlog table');
  } catch (e) {
    console.log(`Notice for resultauditlog: ${e.message}`);
  }

  // 4. Create gradingscheme table if not exists
  const createGradingSchemeSql = `
    CREATE TABLE IF NOT EXISTS \`gradingscheme\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`instituteId\` INT DEFAULT 1,
      \`name\` VARCHAR(100) NOT NULL DEFAULT 'Standard Scale',
      \`isDefault\` BOOLEAN NOT NULL DEFAULT TRUE,
      \`rules\` JSON NOT NULL,
      \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` DATETIME NULL,
      INDEX (\`instituteId\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  try {
    await prisma.$executeRawUnsafe(createGradingSchemeSql);
    console.log('Executed create gradingscheme table');
  } catch (e) {
    console.log(`Notice for gradingscheme: ${e.message}`);
  }

  console.log('✅ Step 7C database updates successfully applied!');
  process.exit(0);
}

applyStep7cMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
