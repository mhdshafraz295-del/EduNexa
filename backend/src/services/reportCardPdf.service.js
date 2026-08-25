import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.resolve(__dirname, '../../');

/**
 * Resolves local file path for branding assets
 */
function resolveAssetPath(relativePath) {
  if (!relativePath) return null;
  const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
  const fullPath = path.join(BACKEND_ROOT, cleanPath);
  return fs.existsSync(fullPath) ? fullPath : null;
}

/**
 * Draws the dynamic institute header on a PDFKit document
 */
function drawInstituteHeader(doc, institute, title = 'TERM EXAMINATION REPORT CARD', subtitle = '') {
  const startY = 35;
  let logoDrawn = false;

  // 1. Resolve and embed logo if available
  if (institute?.logo) {
    const logoPath = resolveAssetPath(institute.logo);
    if (logoPath) {
      try {
        doc.image(logoPath, 40, startY, { fit: [55, 55], align: 'center', valign: 'center' });
        logoDrawn = true;
      } catch (e) {
        console.warn('Failed to embed institute logo in PDF:', e.message);
      }
    }
  }

  const textLeft = logoDrawn ? 105 : 40;
  const textWidth = doc.page.width - textLeft - 40;

  // Institute Name
  doc
    .font('Helvetica-Bold')
    .fontSize(16)
    .fillColor('#0F172A')
    .text(institute?.name || 'EduNexa Partner Institute', textLeft, startY, { width: textWidth });

  // Institute Code & Contact
  const contactParts = [];
  if (institute?.code) contactParts.push(`Code: ${institute.code}`);
  if (institute?.address) contactParts.push(institute.address);
  if (institute?.phone) contactParts.push(`Tel: ${institute.phone}`);
  if (institute?.email) contactParts.push(institute.email);
  if (institute?.website) contactParts.push(institute.website);

  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#64748B')
    .text(contactParts.join('  •  '), textLeft, doc.y + 2, { width: textWidth });

  // Header Divider
  const headerBottomY = Math.max(doc.y + 6, startY + 60);
  doc
    .strokeColor('#E2E8F0')
    .lineWidth(1)
    .moveTo(40, headerBottomY)
    .lineTo(doc.page.width - 40, headerBottomY)
    .stroke();

  // Report Title Badge
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor('#0F172A')
    .text(title.toUpperCase(), 40, headerBottomY + 8, { align: 'center' });

  if (subtitle) {
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#64748B')
      .text(subtitle, 40, doc.y + 1, { align: 'center' });
  }

  return doc.y + 8;
}

/**
 * Draws the Signatory and Official Stamp Block at the bottom of the page
 */
function drawSignatoryAndStamp(doc, institute, startY) {
  const pageHeight = doc.page.height;
  const footerY = Math.min(startY, pageHeight - 120);

  // Divider
  doc
    .strokeColor('#E2E8F0')
    .lineWidth(0.75)
    .moveTo(40, footerY)
    .lineTo(doc.page.width - 40, footerY)
    .stroke();

  const colWidth = (doc.page.width - 80) / 2;

  // Left Column: Principal Signature
  let sigDrawn = false;
  if (institute?.signatureImage) {
    const sigPath = resolveAssetPath(institute.signatureImage);
    if (sigPath) {
      try {
        doc.image(sigPath, 60, footerY + 8, { fit: [110, 38], align: 'left' });
        sigDrawn = true;
      } catch (e) {
        console.warn('Failed to embed signature in report card PDF:', e.message);
      }
    }
  }

  const sigTextY = footerY + (sigDrawn ? 48 : 28);
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#0F172A')
    .text(institute?.principalName || 'Principal / Authorized Director', 60, sigTextY);
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#64748B')
    .text('Official Institute Signature', 60, sigTextY + 11);

  // Right Column: Official Stamp
  let stampDrawn = false;
  if (institute?.stampImage) {
    const stampPath = resolveAssetPath(institute.stampImage);
    if (stampPath) {
      try {
        doc.image(stampPath, doc.page.width - 170, footerY + 6, { fit: [55, 55], align: 'center' });
        stampDrawn = true;
      } catch (e) {
        console.warn('Failed to embed official stamp in report card PDF:', e.message);
      }
    }
  }

  if (!stampDrawn) {
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#0F172A')
      .text('OFFICIAL SEAL', doc.page.width - 160, footerY + 28, { align: 'center', width: 100 });
  }

  // Security Verification Footer
  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor('#94A3B8')
    .text('Official Academic Transcript generated securely by EduNexa SaaS. Verified Authentic Document.', 40, pageHeight - 25, {
      align: 'center',
      width: doc.page.width - 80,
    });
}

/**
 * Generates an Individual Student Term Examination Report Card PDF
 */
export async function generateIndividualReportCardPdf(studentReport, examGroup, institute, templateSettings, res) {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 40,
    autoFirstPage: true,
    info: {
      Title: `Report Card - ${studentReport.studentName}`,
      Author: institute?.name || 'EduNexa',
      Subject: examGroup.name,
    },
  });

  doc.pipe(res);

  renderSingleReportCardContent(doc, studentReport, examGroup, institute, templateSettings);

  doc.end();
}

/**
 * Helper to render the body of a single student report card
 */
function renderSingleReportCardContent(doc, studentReport, examGroup, institute, templateSettings) {
  const subtitle = `${examGroup.name}  •  Academic Year: ${examGroup.academicYear?.name || 'Current'}  •  Class: ${examGroup.class?.name || 'Class'}`;
  let currentY = drawInstituteHeader(doc, institute, 'OFFICIAL TERM EXAMINATION REPORT CARD', subtitle);

  // 1. Student Particulars Card
  doc
    .roundedRect(40, currentY, doc.page.width - 80, 52, 6)
    .fillAndStroke('#F8FAFC', '#E2E8F0');

  const halfWidth = (doc.page.width - 100) / 2;

  // Left particulars
  doc
    .font('Helvetica-Bold').fontSize(8).fillColor('#64748B').text('STUDENT NAME', 52, currentY + 8)
    .font('Helvetica-Bold').fontSize(11).fillColor('#0F172A').text(studentReport.studentName, 52, currentY + 19);

  doc
    .font('Helvetica-Bold').fontSize(8).fillColor('#64748B').text('CLASS & SECTION', 52, currentY + 33)
    .font('Helvetica').fontSize(9).fillColor('#334155').text(examGroup.class?.name || 'Enrolled Class', 52, currentY + 43);

  // Right particulars
  doc
    .font('Helvetica-Bold').fontSize(8).fillColor('#64748B').text('ADMISSION NO', 52 + halfWidth, currentY + 8)
    .font('Helvetica-Bold').fontSize(10).fillColor('#0F172A').text(studentReport.admissionNumber, 52 + halfWidth, currentY + 19);

  doc
    .font('Helvetica-Bold').fontSize(8).fillColor('#64748B').text('ROLL NUMBER', 52 + halfWidth, currentY + 33)
    .font('Helvetica').fontSize(9).fillColor('#334155').text(studentReport.rollNo || '—', 52 + halfWidth, currentY + 43);

  currentY += 62;

  // 2. Subject Results Table Header
  const tableX = 40;
  const tableWidth = doc.page.width - 80;
  const colWidths = [180, 65, 65, 65, 65, 75]; // Total = 515

  doc
    .rect(tableX, currentY, tableWidth, 22)
    .fill('#0F172A');

  doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFD978');
  doc.text('SUBJECT', tableX + 8, currentY + 7);
  doc.text('MARKS', tableX + 185, currentY + 7, { width: 60, align: 'right' });
  doc.text('TOTAL', tableX + 250, currentY + 7, { width: 60, align: 'right' });
  doc.text('PERCENT', tableX + 315, currentY + 7, { width: 60, align: 'right' });
  doc.text('GRADE', tableX + 380, currentY + 7, { width: 60, align: 'center' });
  doc.text('STATUS', tableX + 445, currentY + 7, { width: 65, align: 'center' });

  currentY += 22;

  // Table Rows
  const results = studentReport.subjectResults || [];
  results.forEach((res, index) => {
    const isEven = index % 2 === 0;
    const rowHeight = 20;

    doc
      .rect(tableX, currentY, tableWidth, rowHeight)
      .fill(isEven ? '#FFFFFF' : '#F8FAFC');

    // Bottom border
    doc
      .strokeColor('#E2E8F0')
      .lineWidth(0.5)
      .moveTo(tableX, currentY + rowHeight)
      .lineTo(tableX + tableWidth, currentY + rowHeight)
      .stroke();

    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#1E293B').text(res.subjectName, tableX + 8, currentY + 6);
    doc.font('Helvetica').fontSize(8.5).fillColor('#334155');

    if (res.isCompleted) {
      doc.text(String(res.marksObtained), tableX + 185, currentY + 6, { width: 60, align: 'right' });
      doc.text(String(res.totalMarks), tableX + 250, currentY + 6, { width: 60, align: 'right' });
      doc.text(`${res.percentage}%`, tableX + 315, currentY + 6, { width: 60, align: 'right' });

      // Grade badge
      doc.font('Helvetica-Bold').fillColor('#0F172A').text(res.grade, tableX + 380, currentY + 6, { width: 60, align: 'center' });

      // Status
      doc
        .font('Helvetica-Bold')
        .fillColor(res.passStatus === 'PASS' ? '#15803D' : '#BE123C')
        .text(res.passStatus, tableX + 445, currentY + 6, { width: 65, align: 'center' });
    } else {
      doc.text('—', tableX + 185, currentY + 6, { width: 60, align: 'right' });
      doc.text(String(res.totalMarks), tableX + 250, currentY + 6, { width: 60, align: 'right' });
      doc.text('—', tableX + 315, currentY + 6, { width: 60, align: 'right' });
      doc.text('—', tableX + 380, currentY + 6, { width: 60, align: 'center' });
      doc.fillColor('#94A3B8').text('PENDING', tableX + 445, currentY + 6, { width: 65, align: 'center' });
    }

    currentY += rowHeight;
  });

  currentY += 10;

  // 3. Overall Performance Summary Card
  doc
    .roundedRect(tableX, currentY, tableWidth, 54, 6)
    .fillAndStroke('#FFFBEB', '#FDE68A');

  const metricWidth = tableWidth / 5;

  const drawSummaryMetric = (x, label, val, color = '#0F172A') => {
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#78350F').text(label, x, currentY + 9, { width: metricWidth, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(12).fillColor(color).text(String(val), x, currentY + 23, { width: metricWidth, align: 'center' });
  };

  drawSummaryMetric(tableX, 'TOTAL SCORE', `${studentReport.totalObtainedMarks} / ${studentReport.totalPossibleMarks}`);
  drawSummaryMetric(tableX + metricWidth, 'OVERALL AVERAGE', `${studentReport.overallAverage}%`);
  drawSummaryMetric(tableX + metricWidth * 2, 'OVERALL GRADE', studentReport.overallGrade);
  drawSummaryMetric(
    tableX + metricWidth * 3,
    'OUTCOME',
    studentReport.overallPassStatus,
    studentReport.overallPassStatus === 'PASS' ? '#15803D' : '#BE123C'
  );
  drawSummaryMetric(tableX + metricWidth * 4, 'CLASS POSITION', studentReport.rankDisplay || '—', '#D97706');

  currentY += 64;

  // 4. Attendance Summary (if available)
  if (studentReport.attendanceSummary) {
    const att = studentReport.attendanceSummary;
    doc
      .roundedRect(tableX, currentY, tableWidth, 34, 4)
      .fillAndStroke('#F8FAFC', '#E2E8F0');

    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor('#0F172A')
      .text('ATTENDANCE RECORD:', tableX + 10, currentY + 7);

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#475569')
      .text(
        `Total Sessions: ${att.totalSessions}   •   Present: ${att.presentCount}   •   Late: ${att.lateCount}   •   Absent: ${att.absentCount}   •   Rate: ${att.attendanceRate}%`,
        tableX + 10,
        currentY + 19
      );

    currentY += 42;
  }

  // 5. Remarks Box
  const remarksHeight = 46;
  doc
    .roundedRect(tableX, currentY, tableWidth, remarksHeight, 4)
    .fillAndStroke('#FFFFFF', '#E2E8F0');

  doc
    .font('Helvetica-Bold').fontSize(8).fillColor('#0F172A').text('FACULTY & PRINCIPAL REMARKS', tableX + 10, currentY + 6);

  const teacherRemarkText = studentReport.teacherRemark ? `Teacher: "${studentReport.teacherRemark}"` : 'Teacher: Good progress in curriculum.';
  const principalRemarkText = studentReport.principalRemark ? `Principal: "${studentReport.principalRemark}"` : '';

  doc
    .font('Helvetica-Oblique').fontSize(8).fillColor('#475569')
    .text(`${teacherRemarkText}${principalRemarkText ? `   •   ${principalRemarkText}` : ''}`, tableX + 10, currentY + 19, {
      width: tableWidth - 20,
    });

  currentY += remarksHeight + 10;

  // 6. Signatory and Stamp
  drawSignatoryAndStamp(doc, institute, currentY);
}

/**
 * Generates Class Result Sheet PDF (Landscape Multi-Subject Matrix)
 */
export async function generateClassResultSheetPdf(rankingData, institute, res) {
  const { examGroup, studentReports } = rankingData;
  const attachedItems = examGroup.items || [];

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 30,
    autoFirstPage: true,
    info: {
      Title: `Class Result Sheet - ${examGroup.name}`,
      Author: institute?.name || 'EduNexa',
    },
  });

  doc.pipe(res);

  const startY = 30;
  const pageWidth = doc.page.width;

  // Header
  doc
    .font('Helvetica-Bold')
    .fontSize(14)
    .fillColor('#0F172A')
    .text(institute?.name || 'EduNexa Academic Institute', 30, startY, { align: 'center' });

  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor('#334155')
    .text(`CLASS RESULT SHEET  •  ${examGroup.name.toUpperCase()}`, 30, doc.y + 2, { align: 'center' });

  doc
    .font('Helvetica')
    .fontSize(8.5)
    .fillColor('#64748B')
    .text(`Class: ${examGroup.class?.name || 'Class'}  •  Academic Year: ${examGroup.academicYear?.name || 'Year'}  •  Total Students: ${studentReports.length}`, 30, doc.y + 2, { align: 'center' });

  let currentY = doc.y + 12;

  // Table Structure
  const tableX = 30;
  const tableWidth = pageWidth - 60;

  // Table Columns
  const studentColWidth = 140;
  const rankColWidth = 40;
  const totalColWidth = 55;
  const avgColWidth = 55;
  const gradeColWidth = 45;
  const statusColWidth = 55;

  const subjectColCount = Math.max(1, attachedItems.length);
  const remainingWidth = tableWidth - (studentColWidth + rankColWidth + totalColWidth + avgColWidth + gradeColWidth + statusColWidth);
  const subjectColWidth = Math.max(45, remainingWidth / subjectColCount);

  // Draw Table Header
  doc
    .rect(tableX, currentY, tableWidth, 20)
    .fill('#0F172A');

  doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#FFD978');
  doc.text('STUDENT NAME (ADM NO)', tableX + 6, currentY + 6, { width: studentColWidth });

  let colX = tableX + studentColWidth;
  attachedItems.forEach((item) => {
    const subName = item.exam.subject?.code || item.exam.subject?.name?.slice(0, 7) || 'SUB';
    doc.text(subName, colX, currentY + 6, { width: subjectColWidth, align: 'center' });
    colX += subjectColWidth;
  });

  doc.text('TOTAL', colX, currentY + 6, { width: totalColWidth, align: 'right' });
  colX += totalColWidth;
  doc.text('AVG %', colX, currentY + 6, { width: avgColWidth, align: 'right' });
  colX += avgColWidth;
  doc.text('GRADE', colX, currentY + 6, { width: gradeColWidth, align: 'center' });
  colX += gradeColWidth;
  doc.text('RESULT', colX, currentY + 6, { width: statusColWidth, align: 'center' });
  colX += statusColWidth;
  doc.text('RANK', colX, currentY + 6, { width: rankColWidth, align: 'center' });

  currentY += 20;

  // Rows
  studentReports.forEach((report, index) => {
    if (currentY > doc.page.height - 45) {
      doc.addPage({ size: 'A4', layout: 'landscape', margin: 30 });
      currentY = 30;
    }

    const rowHeight = 16;
    const isEven = index % 2 === 0;

    doc.rect(tableX, currentY, tableWidth, rowHeight).fill(isEven ? '#FFFFFF' : '#F8FAFC');

    // Bottom line
    doc.strokeColor('#E2E8F0').lineWidth(0.5).moveTo(tableX, currentY + rowHeight).lineTo(tableX + tableWidth, currentY + rowHeight).stroke();

    // Student name
    doc
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor('#0F172A')
      .text(`${report.studentName} (${report.admissionNumber})`, tableX + 6, currentY + 4, {
        width: studentColWidth - 8,
        lineBreak: false,
      });

    let rowColX = tableX + studentColWidth;
    doc.font('Helvetica').fontSize(7.5).fillColor('#334155');

    attachedItems.forEach((item) => {
      const subRes = report.subjectResults.find((s) => s.examId === item.examId);
      const marksText = subRes && subRes.isCompleted ? String(subRes.marksObtained) : '—';
      doc.text(marksText, rowColX, currentY + 4, { width: subjectColWidth, align: 'center' });
      rowColX += subjectColWidth;
    });

    doc.font('Helvetica-Bold');
    doc.text(String(report.totalObtainedMarks), rowColX, currentY + 4, { width: totalColWidth, align: 'right' });
    rowColX += totalColWidth;
    doc.text(`${report.overallAverage}%`, rowColX, currentY + 4, { width: avgColWidth, align: 'right' });
    rowColX += avgColWidth;
    doc.text(report.overallGrade, rowColX, currentY + 4, { width: gradeColWidth, align: 'center' });
    rowColX += gradeColWidth;

    doc
      .fillColor(report.overallPassStatus === 'PASS' ? '#15803D' : '#BE123C')
      .text(report.overallPassStatus, rowColX, currentY + 4, { width: statusColWidth, align: 'center' });
    rowColX += statusColWidth;

    doc
      .fillColor('#0F172A')
      .text(report.rankDisplay || '—', rowColX, currentY + 4, { width: rankColWidth, align: 'center' });

    currentY += rowHeight;
  });

  doc.end();
}

/**
 * Generates Combined Multi-Page Bulk PDF containing all student report cards
 */
export async function generateBulkReportCardsPdf(rankingData, institute, templateSettings, res) {
  const { examGroup, studentReports } = rankingData;

  const doc = new PDFDocument({
    size: 'A4',
    margin: 40,
    autoFirstPage: false,
    info: {
      Title: `Bulk Report Cards - ${examGroup.name}`,
      Author: institute?.name || 'EduNexa',
    },
  });

  doc.pipe(res);

  for (let i = 0; i < studentReports.length; i++) {
    doc.addPage({ size: 'A4', margin: 40 });
    renderSingleReportCardContent(doc, studentReports[i], examGroup, institute, templateSettings);
  }

  if (studentReports.length === 0) {
    doc.addPage({ size: 'A4', margin: 40 });
    doc.font('Helvetica').fontSize(12).text('No enrolled student records found for this term.', 40, 50);
  }

  doc.end();
}
