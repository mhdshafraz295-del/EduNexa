import * as referralService from '../services/referral.service.js';

// Super Admin Handlers
export const createCampaign = async (req, res) => {
  try {
    const data = await referralService.createCampaign(req.user, req.body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Failed to create campaign.' });
  }
};

export const updateCampaign = async (req, res) => {
  try {
    const data = await referralService.updateCampaign(req.user, req.params.id, req.body);
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Failed to update campaign.' });
  }
};

export const setCampaignStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const data = await referralService.setCampaignStatus(req.user, req.params.id, status);
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Failed to set campaign status.' });
  }
};

export const listSuperAdminCampaigns = async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    const data = await referralService.listSuperAdminCampaigns();
    res.status(200).json(data);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Failed to list campaigns.' });
  }
};

export const getSuperAdminCampaignDetail = async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    const data = await referralService.getSuperAdminCampaignDetail(req.params.id);
    res.status(200).json(data);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Failed to load campaign detail.' });
  }
};

export const getSuperAdminReferralAnalytics = async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    const data = await referralService.getSuperAdminReferralAnalytics();
    res.status(200).json(data);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Failed to load referral analytics.' });
  }
};

export const approveReward = async (req, res) => {
  try {
    const data = await referralService.approveReward(req.user, req.params.id);
    res.status(200).json(data);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Failed to approve reward.' });
  }
};

export const rejectReward = async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    const data = await referralService.rejectReward(req.user, req.params.id, rejectionReason);
    res.status(200).json(data);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Failed to reject reward.' });
  }
};

// Institute Admin Handlers
export const getInstituteReferralDashboard = async (req, res) => {
  try {
    const origin = req.get('origin') || `${req.protocol}://${req.get('host')}`;
    const data = await referralService.getInstituteReferralDashboard(req.instituteId, origin);
    res.status(200).json(data);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Failed to load referral dashboard.' });
  }
};
