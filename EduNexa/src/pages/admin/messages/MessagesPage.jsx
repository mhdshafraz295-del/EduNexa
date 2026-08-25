import React from 'react';
import MessagingWorkspace from '../../../components/messaging/MessagingWorkspace';
import PageHeader from '../../../components/common/PageHeader';
import { MessageSquare } from 'lucide-react';

export default function MessagesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Direct Communication & Messaging Hub"
        subtitle="Secure, role-based internal communication across faculty, students, and parents"
        icon={MessageSquare}
      />
      <MessagingWorkspace portalRole="ADMIN" />
    </div>
  );
}
