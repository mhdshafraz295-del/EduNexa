import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { PUBLIC_LOGO_DIR, PROTECTED_SIGNATURE_DIR, PROTECTED_STAMP_DIR } from '../middleware/upload.middleware.js';

/**
 * Generate Official Institute-Branded Result PDF Stream
 * 
 * @param {Object} data - Contains result, student, exam, institute, academicYear, class, subject
 * @returns {PDFDocument} - PDF stream ready to pipe to response
 */
export function generateOfficialResultPdf(data) {
  const {
    result,
    student,
    exam,
    institute,
    academicYear,
    classData,
    subject,
  } = data;

  const doc = new PDFDocument({
    size: 'A4',
    margin: 40,
    info: {
      Title: `Result - ${student.name} - ${exam.title}`,
      Author: institute?.name || 'EduNexa Platform',
      Subject: 'Official Examination Result',
    },
  });

  const pageWidth = 595.28;
  const pageMargin = 40;
  const contentWidth = pageWidth - pageMargin * 2;

  // -------------------------------------------------------------
  // 1. Dynamic Institute Header & Logo
  // -------------------------------------------------------------
  let currentY = 40;

  // Resolve Logo path if exists
  let logoPath = null;
  if (institute?.logo) {
    const filename = path.basename(institute.logo);
    const candidatePath = path.join(PUBLIC_LOGO_DIR, filename);
    if (fs.existsSync(candidatePath)) {
      logoPath = candidatePath;
    }
  }

  if (logoPath) {
    try {
      doc.image(logoPath, pageMargin, currentY, { width: 60, height: 60, fit: [60, 60] });
    } catch (e) {
      console.warn('Failed to embed logo in PDF:', e);
    }
  } else {
    // Elegant Monogram box
    const initials = institute?.name ? institute.name.slice(0, 2).toUpperCase() : 'IN';
    doc.rect(pageMargin, currentY, 60, 60).fillAndStroke('#1E293B', '#CBD5E1');
    doc.fillColor('#FFD978').fontSize(20).font('Helvetica-Bold').text(initials, pageMargin + 15, currentY + 18);
  }

  // Institute Text Details
  const textX = pageMargin + 75;
  doc.fillColor('#0F172A').fontSize(16).font('Helvetica-Bold').text(institute?.name || 'EduNexa Institute', textX, currentY);
  
  const codeText = institute?.code ? ` [Code: ${institute.code}]` : '';
  doc.fillColor('#64748B').fontSize(9).font('Helvetica').text(`${institute?.address || ''}${codeText}`, textX, currentY + 20);
  
  const contactParts = [];
  if (institute?.phone) contactParts.push(`Tel: ${institute.phone}`);
  if (institute?.email) contactParts.push(`Email: ${institute.email}`);
  if (institute?.website) contactParts.push(`Web: ${institute.website}`);
  doc.text(contactParts.join('  •  '), textX, currentY + 34);

  currentY += 75;

  // Decorative Accent Line
  doc.rect(pageMargin, currentY, contentWidth, 3).fill('#FFD978');
  currentY += 15;

  // -------------------------------------------------------------
  // 2. Document Title
  // -------------------------------------------------------------
  doc.fillColor('#0F172A').fontSize(14).font('Helvetica-Bold').text('OFFICIAL EXAMINATION RESULT REPORT', pageMargin, currentY, {
    align: 'center',
    width: contentWidth,
  });
  currentY += 25;

  // -------------------------------------------------------------
  // 3. Student & Examination Particulars (Grid Box)
  // -------------------------------------------------------------
  const gridBoxY = currentY;
  const gridBoxHeight = 105;

  doc.rect(pageMargin, gridBoxY, contentWidth, gridBoxHeight).fillAndStroke('#F8FAFC', '#E2E8F0');

  const col1X = pageMargin + 15;
  const col2X = pageMargin + 140;
  const col3X = pageMargin + 285;
  const col4X = pageMargin + 400;

  let rowY = gridBoxY + 12;

  // Row 1: Student Name & Exam Title
  doc.fillColor('#64748B').fontSize(8).font('Helvetica-Bold').text('STUDENT NAME:', col1X, rowY);
  doc.fillColor('#0F172A').fontSize(9).font('Helvetica-Bold').text(student?.name || '—', col2X, rowY);

  doc.fillColor('#64748B').fontSize(8).font('Helvetica-Bold').text('EXAM TITLE:', col3X, rowY);
  doc.fillColor('#0F172A').fontSize(9).font('Helvetica-Bold').text(exam?.title || '—', col4X, rowY);
  rowY += 22;

  // Row 2: Admission No & Subject
  doc.fillColor('#64748B').fontSize(8).font('Helvetica-Bold').text('ADMISSION NO:', col1X, rowY);
  doc.fillColor('#0F172A').fontSize(9).font('Helvetica').text(student?.admissionNumber || '—', col2X, rowY);

  doc.fillColor('#64748B').fontSize(8).font('Helvetica-Bold').text('SUBJECT:', col3X, rowY);
  doc.fillColor('#0F172A').fontSize(9).font('Helvetica').text(`${subject?.name || '—'} (${subject?.code || ''})`, col4X, rowY);
  rowY += 22;

  // Row 3: Class & Exam Type
  doc.fillColor('#64748B').fontSize(8).font('Helvetica-Bold').text('CLASS / BATCH:', col1X, rowY);
  doc.fillColor('#0F172A').fontSize(9).font('Helvetica').text(classData ? `${classData.name} ${classData.section ? '(' + classData.section + ')' : ''}` : '—', col2X, rowY);

  doc.fillColor('#64748B').fontSize(8).font('Helvetica-Bold').text('EXAM TYPE:', col3X, rowY);
  doc.fillColor('#0F172A').fontSize(9).font('Helvetica').text(exam?.examType === 'WRITTEN' ? 'Written Assessment' : 'Online MCQ Exam', col4X, rowY);
  rowY += 22;

  // Row 4: Academic Year & Roll No
  doc.fillColor('#64748B').fontSize(8).font('Helvetica-Bold').text('ACADEMIC YEAR:', col1X, rowY);
  doc.fillColor('#0F172A').fontSize(9).font('Helvetica').text(academicYear?.name || '—', col2X, rowY);

  doc.fillColor('#64748B').fontSize(8).font('Helvetica-Bold').text('ROLL NUMBER:', col3X, rowY);
  doc.fillColor('#0F172A').fontSize(9).font('Helvetica').text(student?.rollNo || '—', col4X, rowY);

  currentY = gridBoxY + gridBoxHeight + 20;

  // -------------------------------------------------------------
  // 4. Performance & Marks Summary (Detailed Results Table)
  // -------------------------------------------------------------
  doc.fillColor('#0F172A').fontSize(11).font('Helvetica-Bold').text('PERFORMANCE EVALUATION', pageMargin, currentY);
  currentY += 16;

  // Table Header
  const tableHeaderY = currentY;
  doc.rect(pageMargin, tableHeaderY, contentWidth, 24).fill('#1E293B');

  doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
  doc.text('TOTAL MARKS', pageMargin + 15, tableHeaderY + 7);
  doc.text('MARKS OBTAINED', pageMargin + 115, tableHeaderY + 7);
  doc.text('PERCENTAGE', pageMargin + 235, tableHeaderY + 7);
  doc.text('GRADE', pageMargin + 345, tableHeaderY + 7);
  doc.text('OUTCOME', pageMargin + 430, tableHeaderY + 7);

  currentY += 24;

  // Table Row
  const isPass = result.status === 'PASS';
  doc.rect(pageMargin, currentY, contentWidth, 32).fillAndStroke('#FFFFFF', '#CBD5E1');

  doc.fillColor('#0F172A').fontSize(10).font('Helvetica-Bold');
  doc.text(String(exam.totalMarks || 100), pageMargin + 15, currentY + 10);
  doc.text(String(result.marks !== undefined ? result.marks : '—'), pageMargin + 115, currentY + 10);
  doc.text(`${result.percentage !== undefined ? result.percentage : '—'}%`, pageMargin + 235, currentY + 10);
  
  // Grade
  doc.fillColor('#B45309').fontSize(12).font('Helvetica-Bold').text(result.grade || '—', pageMargin + 345, currentY + 8);

  // Pass/Fail badge
  doc.fillColor(isPass ? '#059669' : '#DC2626').fontSize(10).font('Helvetica-Bold').text(isPass ? 'PASSED' : 'FAILED', pageMargin + 430, currentY + 10);

  currentY += 45;

  // -------------------------------------------------------------
  // 5. Teacher Remarks / Feedback Block
  // -------------------------------------------------------------
  if (result.teacherFeedback) {
    doc.fillColor('#0F172A').fontSize(10).font('Helvetica-Bold').text('TEACHER REMARKS & FEEDBACK:', pageMargin, currentY);
    currentY += 14;

    doc.rect(pageMargin, currentY, contentWidth, 42).fillAndStroke('#F8FAFC', '#E2E8F0');
    doc.fillColor('#334155').fontSize(9).font('Helvetica-Oblique').text(result.teacherFeedback, pageMargin + 12, currentY + 10, {
      width: contentWidth - 24,
      height: 30,
    });
    currentY += 55;
  } else {
    currentY += 10;
  }

  // Publication Date
  const pubDateStr = result.publishedAt ? new Date(result.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : new Date().toLocaleDateString();
  doc.fillColor('#64748B').fontSize(8).font('Helvetica').text(`Result Publication Date: ${pubDateStr}`, pageMargin, currentY);

  currentY += 35;

  // -------------------------------------------------------------
  // 6. Signatory & Official Stamp Block
  // -------------------------------------------------------------
  const sigStampY = Math.max(currentY, 620);

  // Left: Official Stamp Seal
  let stampPath = null;
  if (institute?.stampImage) {
    const safeName = path.basename(institute.stampImage);
    const candidatePath = path.join(PROTECTED_STAMP_DIR, safeName);
    if (fs.existsSync(candidatePath)) {
      stampPath = candidatePath;
    }
  }

  if (stampPath) {
    try {
      doc.image(stampPath, pageMargin + 30, sigStampY - 20, { width: 70, height: 70, fit: [70, 70] });
    } catch (e) {
      console.warn('Failed to embed stamp in PDF:', e);
    }
  } else {
    // Dotted placeholder box
    doc.circle(pageMargin + 65, sigStampY + 15, 30).dash(3, { space: 2 }).stroke('#CBD5E1').undash();
    doc.fillColor('#94A3B8').fontSize(7).font('Helvetica-Bold').text('OFFICIAL\nSEAL', pageMargin + 45, sigStampY + 7, { align: 'center', width: 40 });
  }
  doc.fillColor('#64748B').fontSize(8).font('Helvetica-Bold').text('INSTITUTE SEAL', pageMargin + 25, sigStampY + 52);

  // Right: Authorized Signature & Principal
  const sigRightX = pageMargin + contentWidth - 180;
  let signaturePath = null;
  if (institute?.signatureImage) {
    const safeName = path.basename(institute.signatureImage);
    const candidatePath = path.join(PROTECTED_SIGNATURE_DIR, safeName);
    if (fs.existsSync(candidatePath)) {
      signaturePath = candidatePath;
    }
  }

  if (signaturePath) {
    try {
      doc.image(signaturePath, sigRightX, sigStampY - 25, { width: 140, height: 45, fit: [140, 45] });
    } catch (e) {
      console.warn('Failed to embed signature in PDF:', e);
    }
  } else {
    // Clean signature line
    doc.moveTo(sigRightX, sigStampY + 20).lineTo(sigRightX + 160, sigStampY + 20).stroke('#94A3B8');
  }

  const principalTitle = institute?.principalName || 'Principal / Director';
  doc.fillColor('#0F172A').fontSize(9).font('Helvetica-Bold').text(principalTitle, sigRightX, sigStampY + 25, { width: 160, align: 'center' });
  doc.fillColor('#64748B').fontSize(7).font('Helvetica').text('Authorized Signatory', sigRightX, sigStampY + 38, { width: 160, align: 'center' });

  // -------------------------------------------------------------
  // 7. Footer
  // -------------------------------------------------------------
  doc.rect(pageMargin, 770, contentWidth, 0.5).stroke('#E2E8F0');
  doc.fillColor('#94A3B8').fontSize(7).font('Helvetica').text('Powered by EduNexa Multi-Institute SaaS Gateway  •  Computer-Generated Authoritative Academic Report', pageMargin, 778, {
    align: 'center',
    width: contentWidth,
  });

  doc.end();
  return doc;
}
