import * as announcementService from '../services/platformAnnouncement.service.js';

// Super Admin Handlers
export const createAnnouncement = async (req, res, next) => {
  try {
    const data = await announcementService.createAnnouncement(req.user, req.body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Failed to create announcement.' });
  }
};

export const updateAnnouncement = async (req, res, next) => {
  try {
    const data = await announcementService.updateAnnouncement(req.user, req.params.id, req.body);
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Failed to update announcement.' });
  }
};

export const setAnnouncementStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const data = await announcementService.setAnnouncementStatus(req.user, req.params.id, status);
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Failed to change announcement status.' });
  }
};

export const deleteAnnouncement = async (req, res, next) => {
  try {
    await announcementService.deleteAnnouncement(req.user, req.params.id);
    res.status(200).json({ success: true, message: 'Announcement deleted successfully.' });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Failed to delete announcement.' });
  }
};

export const listSuperAdminAnnouncements = async (req, res, next) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    const data = await announcementService.listSuperAdminAnnouncements(req.query);
    res.status(200).json(data);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Failed to list announcements.' });
  }
};

export const getSuperAdminAnnouncementDetail = async (req, res, next) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    const data = await announcementService.getSuperAdminAnnouncementDetail(req.params.id);
    res.status(200).json(data);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Failed to get announcement detail.' });
  }
};

export const getSuperAdminAnnouncementAnalytics = async (req, res, next) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    const data = await announcementService.getSuperAdminAnnouncementAnalytics();
    res.status(200).json(data);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Failed to load analytics.' });
  }
};

// Institute Admin Handlers
export const listInstituteAnnouncements = async (req, res, next) => {
  try {
    const data = await announcementService.listInstituteAnnouncements(req.instituteId, req.user.id, req.query);
    res.status(200).json(data);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Failed to load announcements.' });
  }
};

export const markAnnouncementRead = async (req, res, next) => {
  try {
    const data = await announcementService.markAnnouncementRead(req.instituteId, req.user.id, req.params.id);
    res.status(200).json(data);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Failed to mark as read.' });
  }
};

export const dismissAnnouncement = async (req, res, next) => {
  try {
    const data = await announcementService.dismissAnnouncement(req.instituteId, req.user.id, req.params.id);
    res.status(200).json(data);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Failed to dismiss announcement.' });
  }
};
