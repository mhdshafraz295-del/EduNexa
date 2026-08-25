import express from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { tenantMiddleware } from '../middleware/tenant.middleware.js';
import { requireActiveSubscription, requireFeature } from '../middleware/subscription.middleware.js';
import { uploadMessageAttachment } from '../middleware/upload.middleware.js';
import * as messageController from '../controllers/message.controller.js';
import * as broadcastController from '../controllers/broadcast.controller.js';

const router = express.Router();

// Apply auth, tenant resolution, subscription, and INTERNAL_MESSAGES feature guard to all routes
router.use(authenticate);
router.use(tenantMiddleware);
router.use(requireActiveSubscription);
router.use(requireFeature('INTERNAL_MESSAGES'));

// 1. Recipient directory
router.get('/recipients', messageController.getRecipients);

// 2. Unread counts
router.get('/unread-count', messageController.getGlobalUnreadCount);

// 3. Conversations
router.get('/conversations', messageController.listConversations);
router.post('/conversations', uploadMessageAttachment.single('file'), messageController.createConversation);
router.get('/conversations/:id', messageController.getConversationThread);
router.post('/conversations/:id/messages', uploadMessageAttachment.single('file'), messageController.sendReply);
router.patch('/conversations/:id/read', messageController.markConversationRead);
router.patch('/conversations/:id/archive', messageController.archiveConversation);
router.delete('/conversations/:id', messageController.deleteConversation);

// 4. Messages (Edit / Delete)
router.patch('/messages/:id', messageController.editMessage);
router.delete('/messages/:id', messageController.deleteMessage);

// 5. Attachments
router.get('/attachments/:id/content', messageController.streamAttachment);

// 6. Broadcasts
router.post('/broadcasts/preview', broadcastController.previewAudience);
router.post('/broadcasts', uploadMessageAttachment.single('file'), broadcastController.createBroadcast);
router.get('/broadcasts/admin', broadcastController.listAdminBroadcasts);
router.get('/broadcasts', broadcastController.listUserBroadcasts);
router.get('/broadcasts/attachments/:attachmentId/content', broadcastController.downloadBroadcastAttachment);
router.get('/broadcasts/:id', broadcastController.getBroadcastDetail);
router.patch('/broadcasts/:id/read', broadcastController.markBroadcastRead);
router.patch('/broadcasts/:id/archive', broadcastController.archiveBroadcast);
router.delete('/broadcasts/:id/for-user', broadcastController.deleteBroadcastForUser);
router.delete('/broadcasts/:id', broadcastController.withdrawBroadcast);

export default router;
