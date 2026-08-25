import * as pollService from '../services/poll.service.js';

/**
 * Controller: Admin Create Poll
 */
export async function createAdminPoll(req, res) {
  try {
    const poll = await pollService.createPoll(
      req.instituteId,
      req.user.id,
      req.body
    );
    res.status(201).json({
      success: true,
      message: 'Poll created successfully.',
      data: poll,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

/**
 * Controller: Admin Get Polls List
 */
export async function getAdminPolls(req, res) {
  try {
    const result = await pollService.getAdminPolls(req.instituteId, req.query);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

/**
 * Controller: Admin Get Single Poll Details
 */
export async function getAdminPollById(req, res) {
  try {
    const poll = await pollService.getAdminPollById(
      req.instituteId,
      req.params.id
    );
    res.status(200).json({
      success: true,
      data: poll,
    });
  } catch (error) {
    const statusCode = error.message?.includes('not found') ? 404 : 400;
    res.status(statusCode).json({ success: false, message: error.message });
  }
}

/**
 * Controller: Admin Update Poll Configuration
 */
export async function updateAdminPoll(req, res) {
  try {
    const poll = await pollService.updatePoll(
      req.instituteId,
      req.params.id,
      req.body
    );
    res.status(200).json({
      success: true,
      message: 'Poll updated successfully.',
      data: poll,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

/**
 * Controller: Admin Update Poll Status
 */
export async function updateAdminPollStatus(req, res) {
  try {
    const poll = await pollService.updatePollStatus(
      req.instituteId,
      req.params.id,
      req.body.status
    );
    res.status(200).json({
      success: true,
      message: 'Poll status updated successfully.',
      data: poll,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

/**
 * Controller: Admin Delete or Archive Poll
 */
export async function deleteAdminPoll(req, res) {
  try {
    const result = await pollService.deletePoll(
      req.instituteId,
      req.params.id
    );
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    const statusCode = error.statusCode || (error.message?.includes('not found') ? 404 : 400);
    res.status(statusCode).json({ success: false, message: error.message });
  }
}

/**
 * Controller: Admin Get Overall KPIs
 */
export async function getAdminAnalytics(req, res) {
  try {
    const analytics = await pollService.getAdminOverallAnalytics(req.instituteId);
    res.status(200).json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

/**
 * Controller: Recipient Get Eligible Polls
 */
export async function getRecipientPolls(req, res) {
  try {
    const result = await pollService.getRecipientEligiblePolls(
      req.instituteId,
      req.user,
      req.query
    );
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

/**
 * Controller: Recipient Get Poll Details
 */
export async function getRecipientPollDetails(req, res) {
  try {
    const poll = await pollService.getRecipientPollDetails(
      req.instituteId,
      req.user,
      req.params.id
    );
    res.status(200).json({
      success: true,
      data: poll,
    });
  } catch (error) {
    const statusCode = error.message?.includes('not found')
      ? 404
      : error.message?.includes('not eligible')
      ? 403
      : 400;
    res.status(statusCode).json({ success: false, message: error.message });
  }
}

/**
 * Controller: Recipient Submit Vote
 */
export async function submitRecipientVote(req, res) {
  try {
    const result = await pollService.submitVote(
      req.instituteId,
      req.user,
      req.params.id,
      req.body.optionId
    );
    res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || (error.message?.includes('not eligible') || error.message?.includes('closed') ? 403 : 400);
    res.status(statusCode).json({ success: false, message: error.message });
  }
}
