import fs from 'fs';
import * as studyMaterialService from '../services/studyMaterial.service.js';

/**
 * Controller: List Study Materials (Admin)
 */
export async function getAdminMaterials(req, res) {
  try {
    const data = await studyMaterialService.getAdminStudyMaterials(req.instituteId, req.query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

/**
 * Controller: Get Single Study Material by ID (Admin)
 */
export async function getAdminMaterialById(req, res) {
  try {
    const data = await studyMaterialService.getAdminStudyMaterialById(req.instituteId, req.params.id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
}

/**
 * Controller: Create Study Material with PDF Upload (Admin)
 */
export async function createAdminMaterial(req, res) {
  try {
    const data = await studyMaterialService.createStudyMaterial(
      req.instituteId,
      req.user.id,
      req.body,
      req.file
    );
    res.status(201).json({
      success: true,
      message: data.status === 'PUBLISHED' ? 'Study material published successfully!' : 'Study material draft saved!',
      data,
    });
  } catch (error) {
    // If multer uploaded a file before validation error, clean it up
    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    res.status(400).json({ success: false, message: error.message });
  }
}

/**
 * Controller: Update Study Material (Admin)
 */
export async function updateAdminMaterial(req, res) {
  try {
    const data = await studyMaterialService.updateStudyMaterial(
      req.instituteId,
      req.params.id,
      req.body,
      req.file
    );
    res.status(200).json({
      success: true,
      message: 'Study material updated successfully!',
      data,
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    res.status(400).json({ success: false, message: error.message });
  }
}

/**
 * Controller: Update Material Status (Admin)
 */
export async function updateAdminMaterialStatus(req, res) {
  try {
    const data = await studyMaterialService.updateStudyMaterialStatus(
      req.instituteId,
      req.params.id,
      req.body.status
    );
    res.status(200).json({
      success: true,
      message: `Study material status updated to ${data.status}.`,
      data,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

/**
 * Controller: Delete or Archive Study Material (Admin)
 */
export async function deleteAdminMaterial(req, res) {
  try {
    const result = await studyMaterialService.deleteStudyMaterial(req.instituteId, req.params.id);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

/**
 * Controller: List Note Payment Transactions (Admin)
 */
export async function getAdminPayments(req, res) {
  try {
    const data = await studyMaterialService.getAdminPayments(req.instituteId, req.query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

/**
 * Controller: Get Single Payment Review Detail (Admin)
 */
export async function getAdminPaymentById(req, res) {
  try {
    const data = await studyMaterialService.getAdminPaymentById(req.instituteId, req.params.id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
}

/**
 * Controller: Approve Student Payment (Admin)
 */
export async function approvePayment(req, res) {
  try {
    const result = await studyMaterialService.approveStudentPayment(
      req.instituteId,
      req.user.id,
      req.params.id
    );
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

/**
 * Controller: Reject Student Payment (Admin)
 */
export async function rejectPayment(req, res) {
  try {
    const result = await studyMaterialService.rejectStudentPayment(
      req.instituteId,
      req.user.id,
      req.params.id,
      req.body.rejectionReason
    );
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

/**
 * Controller: Get Bank Payment Settings (Admin)
 */
export async function getPaymentSettings(req, res) {
  try {
    const data = await studyMaterialService.getInstitutePaymentSettings(req.instituteId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

/**
 * Controller: Update Bank Payment Settings (Admin)
 */
export async function updatePaymentSettings(req, res) {
  try {
    const data = await studyMaterialService.upsertInstitutePaymentSettings(req.instituteId, req.body);
    res.status(200).json({
      success: true,
      message: 'Bank payment settings updated successfully!',
      data,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

/**
 * Controller: Get Study Notes Analytics (Admin)
 */
export async function getAdminAnalytics(req, res) {
  try {
    const data = await studyMaterialService.getAdminStudyMaterialAnalytics(req.instituteId, req.query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

/**
 * Controller: Get Eligible Study Materials for Logged-In Student
 */
export async function getMyMaterials(req, res) {
  try {
    const data = await studyMaterialService.getStudentStudyMaterials(
      req.instituteId,
      req.user.id,
      req.query
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

/**
 * Controller: Get Detail for a Specific Material (Student)
 */
export async function getMaterialDetails(req, res) {
  try {
    const data = await studyMaterialService.getStudentMaterialDetails(
      req.instituteId,
      req.user.id,
      req.params.id
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
}

/**
 * Controller: Submit Bank Transfer Payment Receipt (Student)
 */
export async function submitPurchase(req, res) {
  try {
    const data = await studyMaterialService.submitStudentMaterialPurchase(
      req.instituteId,
      req.user.id,
      req.params.id,
      req.file
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    res.status(400).json({ success: false, message: error.message });
  }
}

/**
 * Controller: Get Personal Study Note Purchase History (Student)
 */
export async function getMyPurchases(req, res) {
  try {
    const data = await studyMaterialService.getStudentPurchases(
      req.instituteId,
      req.user.id,
      req.query
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

/**
 * Controller: Stream Protected Study Material PDF (Admin or Eligible Student)
 */
export async function streamMaterialPdf(req, res) {
  try {
    const isDownload = req.query.download === 'true' || req.query.download === '1';
    const result = await studyMaterialService.getStudyMaterialPdfStream(
      req.instituteId,
      req.user,
      req.params.id
    );

    if (!result || !result.filePath || !fs.existsSync(result.filePath)) {
      return res.status(404).json({ success: false, message: 'Study material file missing.' });
    }

    const rawName = result.fileName.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const safeEncodedName = encodeURIComponent(result.fileName);
    const disposition = isDownload
      ? `attachment; filename="${rawName}"; filename*=UTF-8''${safeEncodedName}`
      : `inline; filename="${rawName}"; filename*=UTF-8''${safeEncodedName}`;

    res.setHeader('Content-Type', result.mimeType || 'application/pdf');
    res.setHeader('Content-Disposition', disposition);
    if (result.fileSize) {
      res.setHeader('Content-Length', result.fileSize);
    }

    const stream = fs.createReadStream(result.filePath);
    stream.on('error', (err) => {
      console.error('PDF stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Failed to stream PDF file.' });
      }
    });

    stream.pipe(res);
  } catch (error) {
    const statusCode = error.message?.includes('not found') || error.message?.includes('could not be found') ? 404 : 403;
    res.status(statusCode).json({ success: false, message: error.message });
  }
}

/**
 * Controller: Stream Protected Purchase Receipt (Admin or Purchasing Student)
 */
export async function streamProtectedReceipt(req, res) {
  try {
    const result = await studyMaterialService.getPurchaseReceiptStream(
      req.instituteId,
      req.user,
      req.params.id
    );

    const safeFilename = encodeURIComponent(result.fileName.replace(/[^a-zA-Z0-9_.-]/g, '_'));
    res.setHeader('Content-Type', result.mimeType || 'image/jpeg');
    res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"`);
    if (result.fileSize) {
      res.setHeader('Content-Length', result.fileSize);
    }

    const stream = fs.createReadStream(result.filePath);
    stream.on('error', (err) => {
      console.error('Receipt stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Failed to stream receipt file.' });
      }
    });

    stream.pipe(res);
  } catch (error) {
    res.status(403).json({ success: false, message: error.message });
  }
}
