import fs from 'fs';
import path from 'path';
import prisma from '../src/config/prisma.js';
import { isR2Configured, uploadToR2, getObjectFromR2 } from '../src/services/storage/r2Storage.service.js';

/**
 * OPTIONAL, SAFE LOCAL-TO-R2 MIGRATION SCRIPT
 *
 * Requirements:
 * - DRY RUN by default (previews migration actions without modifying DB or deleting files).
 * - Requires explicit --execute flag to run real migration.
 * - Never deletes local source files.
 * - Migrates only recognized DB-referenced local files.
 * - Verifies R2 upload success before updating DB reference.
 * - Generates JSON manifest for auditing and rollback.
 * - No credentials printed in output.
 */

async function main() {
  const args = process.argv.slice(2);
  const isExecute = args.includes('--execute');

  console.log('\n================================================================');
  console.log(`  EDUNEXA CLOUDFLARE R2 MIGRATION TOOL (${isExecute ? 'EXECUTE MODE' : 'DRY RUN MODE'})`);
  console.log('================================================================\n');

  if (!isR2Configured()) {
    console.error('Error: Cloudflare R2 environment variables are not configured in process.env.');
    console.error('Migration cannot proceed without valid R2 credentials.');
    process.exit(1);
  }

  const manifest = {
    timestamp: new Date().toISOString(),
    isExecute,
    migrated: [],
    skipped: [],
    failed: [],
  };

  try {
    // 1. Gallery Items
    console.log('--- Checking Gallery Media Records ---');
    const galleryItems = await prisma.galleryMedia.findMany({
      where: {
        filePath: { not: null },
      },
    });

    for (const item of galleryItems) {
      if (item.filePath.startsWith('r2://')) {
        manifest.skipped.push({ model: 'GalleryMedia', id: item.id, reason: 'Already on R2' });
        continue;
      }

      const cleanPath = item.filePath.startsWith('/') ? item.filePath.slice(1) : item.filePath;
      const localFullPath = path.isAbsolute(item.filePath)
        ? item.filePath
        : path.join(process.cwd(), cleanPath);

      if (!fs.existsSync(localFullPath)) {
        manifest.skipped.push({ model: 'GalleryMedia', id: item.id, reason: 'Local file missing on disk' });
        continue;
      }

      const ext = path.extname(localFullPath).toLowerCase();
      const uniqueFilename = `migrated_gallery_${item.id}_${Date.now()}${ext}`;
      const r2Key = `institutes/${item.instituteId}/gallery/${uniqueFilename}`;
      const newRef = `r2://${r2Key}`;

      console.log(`[GalleryMedia #${item.id}] Local: ${item.filePath} -> Target R2: ${newRef}`);

      if (isExecute) {
        try {
          const buffer = fs.readFileSync(localFullPath);
          await uploadToR2({ buffer, key: r2Key, contentType: item.mimeType || 'image/jpeg' });

          const verify = await getObjectFromR2(r2Key);
          if (!verify || !verify.Body) {
            throw new Error('Upload verification failed');
          }

          await prisma.galleryMedia.update({
            where: { id: item.id },
            data: { filePath: newRef, thumbnailPath: item.thumbnailPath ? newRef : null },
          });

          manifest.migrated.push({ model: 'GalleryMedia', id: item.id, oldRef: item.filePath, newRef });
        } catch (err) {
          console.error(`  ✗ Migration failed for GalleryMedia #${item.id}:`, err.message);
          manifest.failed.push({ model: 'GalleryMedia', id: item.id, error: err.message });
        }
      } else {
        manifest.migrated.push({ model: 'GalleryMedia', id: item.id, oldRef: item.filePath, newRef, dryRun: true });
      }
    }

    // 2. Study Materials
    console.log('\n--- Checking Study Material PDF Records ---');
    const studyMaterials = await prisma.studyMaterial.findMany({
      where: {
        pdfFilePath: { not: null },
      },
    });

    for (const mat of studyMaterials) {
      if (mat.pdfFilePath.startsWith('r2://')) {
        manifest.skipped.push({ model: 'StudyMaterial', id: mat.id, reason: 'Already on R2' });
        continue;
      }

      const cleanPath = mat.pdfFilePath.startsWith('/') ? mat.pdfFilePath.slice(1) : mat.pdfFilePath;
      const localFullPath = path.isAbsolute(mat.pdfFilePath)
        ? mat.pdfFilePath
        : path.join(process.cwd(), cleanPath);

      if (!fs.existsSync(localFullPath)) {
        manifest.skipped.push({ model: 'StudyMaterial', id: mat.id, reason: 'Local file missing on disk' });
        continue;
      }

      const ext = path.extname(localFullPath).toLowerCase() || '.pdf';
      const uniqueFilename = `migrated_study_material_${mat.id}_${Date.now()}${ext}`;
      const r2Key = `institutes/${mat.instituteId}/study-materials/${uniqueFilename}`;
      const newRef = `r2://${r2Key}`;

      console.log(`[StudyMaterial #${mat.id}] Local: ${mat.pdfFilePath} -> Target R2: ${newRef}`);

      if (isExecute) {
        try {
          const buffer = fs.readFileSync(localFullPath);
          await uploadToR2({ buffer, key: r2Key, contentType: mat.mimeType || 'application/pdf' });

          const verify = await getObjectFromR2(r2Key);
          if (!verify || !verify.Body) {
            throw new Error('Upload verification failed');
          }

          await prisma.studyMaterial.update({
            where: { id: mat.id },
            data: { pdfFilePath: newRef },
          });

          manifest.migrated.push({ model: 'StudyMaterial', id: mat.id, oldRef: mat.pdfFilePath, newRef });
        } catch (err) {
          console.error(`  ✗ Migration failed for StudyMaterial #${mat.id}:`, err.message);
          manifest.failed.push({ model: 'StudyMaterial', id: mat.id, error: err.message });
        }
      } else {
        manifest.migrated.push({ model: 'StudyMaterial', id: mat.id, oldRef: mat.pdfFilePath, newRef, dryRun: true });
      }
    }

    // 3. Subscription Payments
    console.log('\n--- Checking Subscription Payment Receipt Records ---');
    const subPayments = await prisma.subscriptionPayment.findMany({
      where: {
        receiptFile: { not: null },
      },
    });

    for (const pay of subPayments) {
      if (pay.receiptFile.startsWith('r2://')) {
        manifest.skipped.push({ model: 'SubscriptionPayment', id: pay.id, reason: 'Already on R2' });
        continue;
      }

      let localFullPath = pay.receiptFile;
      if (!path.isAbsolute(localFullPath) && !localFullPath.startsWith('/uploads/')) {
        localFullPath = path.join(process.cwd(), 'uploads', 'receipts', pay.receiptFile);
      }

      if (!fs.existsSync(localFullPath)) {
        manifest.skipped.push({ model: 'SubscriptionPayment', id: pay.id, reason: 'Local file missing on disk' });
        continue;
      }

      const ext = path.extname(localFullPath).toLowerCase();
      const uniqueFilename = `migrated_sub_receipt_${pay.id}_${Date.now()}${ext}`;
      const r2Key = `institutes/${pay.instituteId}/subscriptions/receipts/${uniqueFilename}`;
      const newRef = `r2://${r2Key}`;

      console.log(`[SubscriptionPayment #${pay.id}] Local: ${pay.receiptFile} -> Target R2: ${newRef}`);

      if (isExecute) {
        try {
          const buffer = fs.readFileSync(localFullPath);
          await uploadToR2({ buffer, key: r2Key, contentType: pay.receiptMimeType || 'image/jpeg' });

          const verify = await getObjectFromR2(r2Key);
          if (!verify || !verify.Body) {
            throw new Error('Upload verification failed');
          }

          await prisma.subscriptionPayment.update({
            where: { id: pay.id },
            data: { receiptFile: newRef },
          });

          manifest.migrated.push({ model: 'SubscriptionPayment', id: pay.id, oldRef: pay.receiptFile, newRef });
        } catch (err) {
          console.error(`  ✗ Migration failed for SubscriptionPayment #${pay.id}:`, err.message);
          manifest.failed.push({ model: 'SubscriptionPayment', id: pay.id, error: err.message });
        }
      } else {
        manifest.migrated.push({ model: 'SubscriptionPayment', id: pay.id, oldRef: pay.receiptFile, newRef, dryRun: true });
      }
    }

    // Save Manifest Report
    const manifestPath = path.join(process.cwd(), 'scripts', `migration-manifest-${Date.now()}.json`);
    if (!fs.existsSync(path.dirname(manifestPath))) {
      fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    }
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    console.log('\n================================================================');
    console.log(`  MIGRATION SUMMARY (${isExecute ? 'EXECUTE' : 'DRY RUN'})`);
    console.log(`  Migrated: ${manifest.migrated.length}`);
    console.log(`  Skipped:  ${manifest.skipped.length}`);
    console.log(`  Failed:   ${manifest.failed.length}`);
    console.log(`  Manifest saved to: ${manifestPath}`);
    console.log('================================================================\n');

  } catch (err) {
    console.error('Fatal migration error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
