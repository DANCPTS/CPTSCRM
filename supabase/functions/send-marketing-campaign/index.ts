import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EmailSettings {
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password: string;
  from_email: string;
  from_name: string;
}

async function sendEmail(to: string, subject: string, htmlBody: string, settings: EmailSettings): Promise<void> {
  try {
    const conn = await Deno.connectTls({
      hostname: settings.smtp_host,
      port: settings.smtp_port,
    });

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const readBuffer = new Uint8Array(8192);

    async function readResponse(): Promise<string> {
      const n = await conn.read(readBuffer);
      if (n === null) return '';
      return decoder.decode(readBuffer.subarray(0, n));
    }

    async function sendCommand(cmd: string): Promise<string> {
      await conn.write(encoder.encode(cmd + '\r\n'));
      return await readResponse();
    }

    await readResponse();

    const hostPart = settings.smtp_host.split('.').slice(-2).join('.');
    await sendCommand(`EHLO ${hostPart}`);
    await sendCommand('AUTH LOGIN');
    await sendCommand(btoa(settings.smtp_username));
    await sendCommand(btoa(settings.smtp_password));

    await sendCommand(`MAIL FROM:<${settings.from_email}>`);
    await sendCommand(`RCPT TO:<${to}>`);
    await sendCommand('DATA');

    const emailContent = [
      `From: ${settings.from_name} <${settings.from_email}>`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=utf-8`,
      ``,
      htmlBody,
      `.`
    ].join('\r\n');

    await conn.write(encoder.encode(emailContent + '\r\n'));
    await readResponse();

    await sendCommand('QUIT');
    conn.close();

    console.log(`Email sent successfully to ${to}`);
  } catch (error) {
    console.error('SMTP error:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

function convertMarkdownToHtml(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(#\)/g, '<a href="https://cpcs-training-courses.co.uk" style="display: inline-block; background-color: #F28D00; color: white; padding: 12px 30px; text-decoration: none; font-weight: bold; border-radius: 5px; margin: 10px 0;">$1</a>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #F28D00; text-decoration: none; font-weight: bold;">$1</a>')
    .replace(/\n/g, '<br>');
}

function wrapLinksWithTracking(html: string, recipientId: string, supabaseUrl: string): string {
  const trackingBaseUrl = `${supabaseUrl}/functions/v1/track-email-click`;
  return html.replace(
    /href="(https?:\/\/[^"]+)"/g,
    (match, url) => {
      if (url.includes('/functions/v1/')) return match;
      const encodedUrl = encodeURIComponent(url);
      return `href="${trackingBaseUrl}?rid=${recipientId}&url=${encodedUrl}"`;
    }
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { campaignId } = await req.json();

    if (!campaignId) {
      return new Response(
        JSON.stringify({ success: false, error: "Campaign ID is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Supabase configuration missing" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: emailSettingsData, error: settingsError } = await supabase
      .from("email_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (settingsError || !emailSettingsData) {
      return new Response(
        JSON.stringify({ success: false, error: "Email settings not configured. Please configure SMTP settings in Settings." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const emailSettings: EmailSettings = {
      smtp_host: emailSettingsData.smtp_host,
      smtp_port: emailSettingsData.smtp_port,
      smtp_username: emailSettingsData.smtp_username,
      smtp_password: emailSettingsData.smtp_password,
      from_email: emailSettingsData.from_email,
      from_name: emailSettingsData.from_name,
    };

    if (!emailSettings.smtp_host || !emailSettings.smtp_username || !emailSettings.smtp_password) {
      return new Response(
        JSON.stringify({ success: false, error: "Incomplete email settings. Please configure SMTP host, username, and password in Settings." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: campaign, error: campaignError } = await supabase
      .from("marketing_campaigns")
      .select("*, email_templates(*)")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ success: false, error: "Campaign not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: recipients, error: recipientsError } = await supabase
      .from("campaign_recipients")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("sent", false);

    if (recipientsError || !recipients || recipients.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No recipients to send to" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    await supabase
      .from("marketing_campaigns")
      .update({ status: "sending" })
      .eq("id", campaignId);

    let sentCount = 0;
    const errors = [];

    for (const recipient of recipients) {
      try {
        const firstName = recipient.name.split(' ')[0] || recipient.name;
        
        let personalizedBody = campaign.email_templates.body
          .replace(/\[Recipient's Name\]/g, firstName)
          .replace(/\[recipient's name\]/g, firstName)
          .replace(/\[First Name\]/g, firstName)
          .replace(/\[first name\]/g, firstName)
          .replace(/Dear \[.*?\]/g, `Dear ${firstName}`);

        const htmlBody = convertMarkdownToHtml(personalizedBody);
        const trackedHtmlBody = wrapLinksWithTracking(htmlBody, recipient.id, supabaseUrl);

        const trackingPixelUrl = `${supabaseUrl}/functions/v1/track-email-open?rid=${recipient.id}`;
        const unsubscribeUrl = `${supabaseUrl}/functions/v1/email-unsubscribe?rid=${recipient.id}`;

        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #0f3d5e; color: white; padding: 30px 20px; text-align: center; }
              .logo { max-width: 250px; height: auto; margin: 0 auto 15px; display: block; }
              .content { background-color: #f9fafb; padding: 30px; }
              .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
              .unsubscribe { margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb; }
              .unsubscribe a { color: #9ca3af; text-decoration: underline; font-size: 11px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <img src="https://www.cpcs-training-courses.co.uk/wp-content/uploads/2023/02/cpcs-training-courses-logo.png" alt="CPCS Training" class="logo" />
              </div>
              <div class="content">
                ${trackedHtmlBody}
              </div>
              <div class="footer">
                <p><strong>${emailSettings.from_name}</strong></p>
                <p>01234 604 151 | ${emailSettings.from_email}</p>
                <p>cpcs-training-courses.co.uk</p>
                <div class="unsubscribe">
                  <a href="${unsubscribeUrl}">Unsubscribe from marketing emails</a>
                </div>
              </div>
            </div>
            <img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" alt="" />
          </body>
          </html>
        `;

        await sendEmail(
          recipient.email,
          campaign.email_templates.subject,
          emailHtml,
          emailSettings
        );

        await supabase
          .from("campaign_recipients")
          .update({
            sent: true,
            sent_at: new Date().toISOString(),
            delivery_status: 'delivered'
          })
          .eq("id", recipient.id);
        
        sentCount++;
      } catch (error) {
        errors.push(`Failed to send to ${recipient.email}: ${error.message}`);
        console.error(`Failed to send to ${recipient.email}:`, error);
      }
    }

    await supabase
      .from("marketing_campaigns")
      .update({
        status: sentCount > 0 ? "sent" : "failed",
        sent_at: new Date().toISOString(),
      })
      .eq("id", campaignId);

    return new Response(
      JSON.stringify({
        success: true,
        sentCount,
        totalRecipients: recipients.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error sending marketing campaign:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});