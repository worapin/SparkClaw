import { Resend } from "resend";
import { logger } from "../lib/logger.js";

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

// Send subscription canceled notification email
export async function sendSubscriptionCanceledEmail(
  email: string,
  plan: string,
): Promise<boolean> {
  const planDisplay = plan.charAt(0).toUpperCase() + plan.slice(1);

  try {
    const result = await getResend().emails.send({
      from: "SparkClaw <noreply@sparkclaw.io>",
      to: email,
      subject: "Your SparkClaw subscription has been canceled",
      html: generateBrandedHtml({
        title: "Subscription Canceled",
        body: `
    <p style="font-size: 16px; margin-bottom: 20px;">
      Your <strong>${planDisplay}</strong> subscription has been canceled. You can continue using your instance until the end of your current billing period.
    </p>

    <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
      <p style="margin: 0; color: #92400e;">
        <strong>Important:</strong> Your data will be retained for 30 days after your subscription ends. After that, your instance and all associated data will be permanently deleted.
      </p>
    </div>

    <p style="font-size: 16px;">
      Changed your mind? You can resubscribe anytime from your <a href="https://sparkclaw.io/dashboard" style="color: #FF6B35;">dashboard</a>.
    </p>`,
      }),
    });

    logger.info("Subscription canceled email sent", {
      email,
      plan,
      emailId: result.data?.id,
    });

    return true;
  } catch (error) {
    logger.error("Failed to send subscription canceled email", {
      email,
      error: (error as Error).message,
    });
    return false;
  }
}

// Send payment failed notification email
export async function sendPaymentFailedEmail(
  email: string,
): Promise<boolean> {
  try {
    const result = await getResend().emails.send({
      from: "SparkClaw <noreply@sparkclaw.io>",
      to: email,
      subject: "Action required: Payment failed for your SparkClaw subscription",
      html: generateBrandedHtml({
        title: "Payment Failed",
        body: `
    <p style="font-size: 16px; margin-bottom: 20px;">
      We were unable to process your latest payment. Please update your payment method to avoid any interruption to your service.
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="https://sparkclaw.io/dashboard/billing" style="background: linear-gradient(135deg, #FF6B35 0%, #FF8C42 100%); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
        Update Payment Method
      </a>
    </div>

    <p style="font-size: 14px; color: #6b7280;">
      If your payment method is not updated, your subscription may be canceled and your instance suspended.
    </p>`,
      }),
    });

    logger.info("Payment failed email sent", {
      email,
      emailId: result.data?.id,
    });

    return true;
  } catch (error) {
    logger.error("Failed to send payment failed email", {
      email,
      error: (error as Error).message,
    });
    return false;
  }
}

// Send subscription renewed notification email
export async function sendSubscriptionRenewedEmail(
  email: string,
  plan: string,
  nextBillingDate: string,
): Promise<boolean> {
  const planDisplay = plan.charAt(0).toUpperCase() + plan.slice(1);

  try {
    const result = await getResend().emails.send({
      from: "SparkClaw <noreply@sparkclaw.io>",
      to: email,
      subject: "Your SparkClaw subscription has been renewed",
      html: generateBrandedHtml({
        title: "Subscription Renewed",
        body: `
    <p style="font-size: 16px; margin-bottom: 20px;">
      Your <strong>${planDisplay}</strong> subscription has been successfully renewed. Thank you for continuing with SparkClaw!
    </p>

    <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e5e7eb;">
      <h3 style="margin: 0 0 10px 0; color: #374151;">Billing Details</h3>
      <p style="margin: 5px 0;"><strong>Plan:</strong> ${planDisplay}</p>
      <p style="margin: 5px 0;"><strong>Next billing date:</strong> ${nextBillingDate}</p>
    </div>

    <p style="font-size: 14px; color: #6b7280;">
      You can manage your subscription anytime from your <a href="https://sparkclaw.io/dashboard/billing" style="color: #FF6B35;">billing dashboard</a>.
    </p>`,
      }),
    });

    logger.info("Subscription renewed email sent", {
      email,
      plan,
      emailId: result.data?.id,
    });

    return true;
  } catch (error) {
    logger.error("Failed to send subscription renewed email", {
      email,
      error: (error as Error).message,
    });
    return false;
  }
}

// Send account deleted confirmation email
export async function sendAccountDeletedEmail(
  email: string,
): Promise<boolean> {
  try {
    const result = await getResend().emails.send({
      from: "SparkClaw <noreply@sparkclaw.io>",
      to: email,
      subject: "Your SparkClaw account has been deleted",
      html: generateBrandedHtml({
        title: "Account Deleted",
        body: `
    <p style="font-size: 16px; margin-bottom: 20px;">
      Your SparkClaw account and all associated data have been permanently deleted as requested.
    </p>

    <p style="font-size: 16px; margin-bottom: 20px;">
      We're sorry to see you go. If you ever want to come back, you can create a new account at <a href="https://sparkclaw.io" style="color: #FF6B35;">sparkclaw.io</a>.
    </p>

    <p style="font-size: 14px; color: #6b7280;">
      If you did not request this deletion, please contact us immediately at <a href="mailto:support@sparkclaw.io" style="color: #FF6B35;">support@sparkclaw.io</a>.
    </p>`,
      }),
    });

    logger.info("Account deleted email sent", {
      email,
      emailId: result.data?.id,
    });

    return true;
  } catch (error) {
    logger.error("Failed to send account deleted email", {
      email,
      error: (error as Error).message,
    });
    return false;
  }
}

// Generate branded HTML email wrapper with consistent styling
function generateBrandedHtml(data: { title: string; body: string }): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #FF6B35 0%, #FF8C42 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">${data.title}</h1>
  </div>

  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
    ${data.body}

    <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
      Questions? Reply to this email or visit our <a href="https://sparkclaw.io/docs" style="color: #FF6B35;">documentation</a>.
    </p>
  </div>

  <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 20px;">
    Powered by OpenClaw &bull; SparkClaw
  </p>
</body>
</html>
  `.trim();
}
