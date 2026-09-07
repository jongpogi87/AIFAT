export interface RegistrationConfirmationPayload {
  referenceNumber: string;
  fullName: string;
  rank: string;
  unit: string;
  email: string;
  contactNumber: string;
  classDesignation: string;
  deliveryMode: string;
  session: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  venue: string;
}

export interface NotificationService {
  sendRegistrationConfirmation(payload: RegistrationConfirmationPayload): Promise<{ success: boolean; messageId?: string; error?: string }>;
  sendBatchUpdateNotification(recipients: string[], subject: string, message: string): Promise<{ success: boolean; count: number }>;
}

export class ConsoleNotificationService implements NotificationService {
  async sendRegistrationConfirmation(payload: RegistrationConfirmationPayload) {
    // Structured logging for development and audit trail
    console.info(`[AIFAT Notification] Confirmation dispatched to ${payload.email} for ${payload.referenceNumber} (${payload.classDesignation})`);
    return { success: true, messageId: `mock-msg-${Date.now()}` };
  }

  async sendBatchUpdateNotification(recipients: string[], subject: string, message: string) {
    console.info(`[AIFAT Notification] Batch update sent to ${recipients.length} recipients: "${subject}"`);
    return { success: true, count: recipients.length };
  }
}

// Default export uses pluggable service instance
export const notificationService: NotificationService = new ConsoleNotificationService();
