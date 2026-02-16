import { Resend } from 'resend';
import { env } from '../config/env';

// Initialize Resend with API key from environment
const resendApiKey = env.RESEND_API_KEY;
if (!resendApiKey) {
    console.warn('RESEND_API_KEY is not defined in environment variables. Email service will not work.');
}
const resend = new Resend(resendApiKey || 'dummy_key_to_prevent_crash_initialization');

export type SupportRequest = {
    name: string;
    email: string;
    issue: string;
    specialistId: string;
};

// Specialist allowed recipients
const supportEmails: Record<string, string> = {
    'ali': 'alihasnaat888@gmail.com',
    'hassam_faizan': 'hassamjalbani1122@gmail.com',
    'mudassir_usman': 'usjuttsaab@gmail.com'
};

const supportNames: Record<string, string> = {
    'ali': 'Ali Hasnaat',
    'hassam_faizan': 'Hassam & Faizan',
    'mudassir_usman': 'Usman Aftab' // Assuming this maps to Usman Aftab based on the email usjuttsaab@gmail.com
};

/**
 * Send a support email via Resend
 */
export const sendSupportEmail = async (data: SupportRequest) => {
    const recipientEmail = supportEmails[data.specialistId];
    const specialistName = supportNames[data.specialistId] || 'Support Team';

    if (!recipientEmail) {
        throw new Error(`Invalid specialist ID: ${data.specialistId}`);
    }

    // Determine the sender name/email. 
    // Ideally, this should be a verified domain on Resend.
    // We'll use a generic one or the one configured in env if available.
    const fromEmail = 'onboarding@resend.dev'; // Default Resend verified sender for testing

    try {
        const response = await resend.emails.send({
            from: `NexDevs Support <${fromEmail}>`,
            to: recipientEmail,
            subject: `New Support Request from ${data.name}`,
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">New Support Request</h2>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
            <p><strong>User Name:</strong> ${data.name}</p>
            <p><strong>User Email:</strong> ${data.email}</p>
            <p><strong>Assigned Specialist:</strong> ${specialistName}</p>
          </div>
          
          <h3 style="color: #555;">Issue Description:</h3>
          <div style="border-left: 4px solid #007bff; padding-left: 15px; margin-top: 10px;">
            <p style="white-space: pre-wrap;">${data.issue}</p>
          </div>
          
          <hr style="margin-top: 30px; border: 0; border-top: 1px solid #eee;" />
          <p style="color: #888; font-size: 12px;">Sent from NexDevs n8n Dashboard</p>
        </div>
      `
        });

        return { success: true, data: response };
    } catch (error) {
        console.error('Resend Email Error:', error);
        throw error;
    }
};
