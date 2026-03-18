import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";

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

const BATCH_SIZE = 10;
const DELAY_BETWEEN_EMAILS_MS = 2000;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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
      .eq("settings_type", "marketing")
      .maybeSingle();

    if (settingsError || !emailSettingsData) {
      return new Response(
        JSON.stringify({ success: false, error: "Marketing email settings not configured. Please configure Marketing Email Settings in Settings." }),
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

    const { data: unsubscribedList } = await supabase
      .from("unsubscribed_emails")
      .select("email");

    const unsubscribedSet = new Set(
      (unsubscribedList || []).map((u: any) => u.email.toLowerCase())
    );

    const { data: recipients, error: recipientsError } = await supabase
      .from("campaign_recipients")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("sent", false)
      .limit(BATCH_SIZE);

    if (recipientsError) {
      return new Response(
        JSON.stringify({ success: false, error: "Error fetching recipients" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!recipients || recipients.length === 0) {
      await supabase
        .from("marketing_campaigns")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", campaignId);

      return new Response(
        JSON.stringify({ success: true, sentCount: 0, complete: true, message: "All emails sent" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { count: remainingCount } = await supabase
      .from("campaign_recipients")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .eq("sent", false);

    await supabase
      .from("marketing_campaigns")
      .update({ status: "sending" })
      .eq("id", campaignId);

    const transporter = nodemailer.createTransport({
      host: emailSettings.smtp_host,
      port: emailSettings.smtp_port,
      secure: emailSettings.smtp_port === 465,
      auth: {
        user: emailSettings.smtp_username,
        pass: emailSettings.smtp_password,
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 30000,
      greetingTimeout: 15000,
      socketTimeout: 60000,
      pool: true,
      maxConnections: 1,
      maxMessages: BATCH_SIZE + 5,
      rateDelta: 2000,
      rateLimit: 1,
    });

    let sentCount = 0;
    const errors: string[] = [];

    try {
      await transporter.verify();
    } catch (verifyErr) {
      transporter.close();
      return new Response(
        JSON.stringify({
          success: false,
          sentCount: 0,
          remaining: remainingCount || 0,
          complete: false,
          error: `SMTP connection failed: ${verifyErr.message}. Check your email settings.`,
          errors: [`SMTP connection failed: ${verifyErr.message}`],
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      try {
        if (unsubscribedSet.has(recipient.email.toLowerCase())) {
          await supabase
            .from("campaign_recipients")
            .update({
              sent: true,
              sent_at: new Date().toISOString(),
              delivery_status: 'skipped_unsubscribed'
            })
            .eq("id", recipient.id);
          sentCount++;
          continue;
        }

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

        await transporter.sendMail({
          from: `${emailSettings.from_name} <${emailSettings.from_email}>`,
          to: recipient.email,
          subject: campaign.email_templates.subject,
          html: emailHtml,
        });

        console.log(`Email sent to ${recipient.email}`);

        await supabase
          .from("campaign_recipients")
          .update({
            sent: true,
            sent_at: new Date().toISOString(),
            delivery_status: 'delivered'
          })
          .eq("id", recipient.id);

        sentCount++;

        if (i < recipients.length - 1) {
          await delay(DELAY_BETWEEN_EMAILS_MS);
        }
      } catch (error) {
        errors.push(`Failed: ${recipient.email} - ${error.message}`);
        console.error(`Failed to send to ${recipient.email}:`, error);

        await supabase
          .from("campaign_recipients")
          .update({ delivery_status: 'failed' })
          .eq("id", recipient.id);
      }
    }

    transporter.close();

    const remainingAfterBatch = (remainingCount || 0) - sentCount;

    if (sentCount === 0 && errors.length > 0) {
      await supabase
        .from("marketing_campaigns")
        .update({
          status: "failed",
          sent_at: new Date().toISOString(),
        })
        .eq("id", campaignId);

      return new Response(
        JSON.stringify({
          success: false,
          sentCount: 0,
          remaining: remainingAfterBatch,
          complete: true,
          error: errors[0],
          errors,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const complete = remainingAfterBatch <= 0;

    if (complete) {
      await supabase
        .from("marketing_campaigns")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
        })
        .eq("id", campaignId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sentCount,
        remaining: remainingAfterBatch,
        complete,
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
