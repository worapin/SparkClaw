import { Resend } from "resend";
import { logger } from "../lib/logger.js";
import { getEnv } from "@sparkclaw/shared";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

interface InstanceReadyEmailData {
  email: string;
  instanceUrl: string;
  customDomain: string;
  plan: string;
}

// Send welcome email when instance is ready
export async function sendInstanceReadyEmail(data: InstanceReadyEmailData): Promise<boolean> {
  const env = getEnv();
  
  try {
    const { email, instanceUrl, customDomain, plan } = data;
    
    const result = await getResend().emails.send({
      from: "SparkClaw <noreply@sparkclaw.io>",
      to: email,
      subject: "🎉 Your OpenClaw instance is ready!",
      html: generateInstanceReadyHtml({
        instanceUrl,
        customDomain,
        plan,
      }),
    });

    logger.info("Instance ready email sent", { 
      email, 
      instanceUrl, 
      emailId: result.data?.id 
    });
    
    return true;
  } catch (error) {
    logger.error("Failed to send instance ready email", { 
      email: data.email, 
      error: (error as Error).message 
    });
    return false;
  }
}

// Generate HTML email content
function generateInstanceReadyHtml(data: {
  instanceUrl: string;
  customDomain: string;
  plan: string;
}): string {
  const { instanceUrl, customDomain, plan } = data;
  const planDisplay = plan.charAt(0).toUpperCase() + plan.slice(1);
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your OpenClaw instance is ready!</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #FF6B35 0%, #FF8C42 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Your OpenClaw is Ready!</h1>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
    <p style="font-size: 16px; margin-bottom: 20px;">
      Great news! Your OpenClaw instance has been successfully deployed and is ready to use.
    </p>
    
    <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e5e7eb;">
      <h3 style="margin: 0 0 10px 0; color: #374151;">Instance Details</h3>
      <p style="margin: 5px 0;"><strong>Plan:</strong> ${planDisplay}</p>
      <p style="margin: 5px 0;"><strong>URL:</strong> <a href="${instanceUrl}" style="color: #FF6B35;">${customDomain}</a></p>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${instanceUrl}/setup" style="background: linear-gradient(135deg, #FF6B35 0%, #FF8C42 100%); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
        Open Setup Wizard
      </a>
    </div>
    
    <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-top: 20px;">
      <h4 style="margin: 0 0 10px 0; color: #92400e;">Quick Start Guide</h4>
      <ol style="margin: 0; padding-left: 20px; color: #92400e;">
        <li>Click "Open Setup Wizard" above</li>
        <li>Connect your preferred channel (Telegram, Discord, LINE, etc.)</li>
        <li>Configure your AI model settings</li>
        <li>Start chatting with your AI assistant!</li>
      </ol>
    </div>
    
    <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
      Questions? Reply to this email or visit our <a href="https://sparkclaw.io/docs" style="color: #FF6B35;">documentation</a>.
    </p>
  </div>
  
  <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 20px;">
    Powered by OpenClaw • SparkClaw
  </p>
</body>
</html>
  `.trim();
}

// Send error notification email
export async function sendErrorEmail(
  email: string,
  errorMessage: string,
): Promise<boolean> {
  try {
    await getResend().emails.send({
      from: "SparkClaw <noreply@sparkclaw.io>",
      to: email,
      subject: "⚠️ Issue with your OpenClaw instance",
      html: `
        <h2>We encountered an issue</h2>
        <p>We're sorry, but there was a problem setting up your OpenClaw instance.</p>
        <p><strong>Error:</strong> ${errorMessage}</p>
        <p>Our team has been notified and we'll fix this as soon as possible. You can also contact support at support@sparkclaw.io</p>
      `,
    });

    return true;
  } catch (error) {
    logger.error("Failed to send error email", { 
      email, 
      error: (error as Error).message 
    });
    return false;
  }
}
