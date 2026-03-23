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
  let linkIndex = 0;
  return html.replace(
    /href="(https?:\/\/[^"]+)"/g,
    (match, url) => {
      if (url.includes('/functions/v1/')) return match;
      const encodedUrl = encodeURIComponent(url);
      linkIndex++;
      return `href="${trackingBaseUrl}?rid=${recipientId}&url=${encodedUrl}&l=${linkIndex}"`;
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

    const allUnsubscribed: any[] = [];
    let unsubPage = 0;
    let unsubHasMore = true;
    while (unsubHasMore) {
      const { data: unsubBatch } = await supabase
        .from("unsubscribed_emails")
        .select("email")
        .range(unsubPage * 1000, (unsubPage + 1) * 1000 - 1);
      if (unsubBatch) allUnsubscribed.push(...unsubBatch);
      unsubHasMore = (unsubBatch?.length || 0) === 1000;
      unsubPage++;
    }

    const unsubscribedSet = new Set(
      allUnsubscribed.map((u: any) => u.email.toLowerCase())
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

        const trackingPixelUrl = `${supabaseUrl}/functions/v1/track-email-open?rid=${recipient.id}&t=${Date.now()}`;
        const unsubscribeUrl = `${supabaseUrl}/functions/v1/email-unsubscribe?rid=${recipient.id}`;

        const plainTextBody = personalizedBody
          .replace(/\*\*([^*]+)\*\*/g, '$1')
          .replace(/\*([^*]+)\*/g, '$1')
          .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1: $2')
          .replace(/\[([^\]]+)\]\(#\)/g, '$1');

        const emailHtml = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${campaign.email_templates.subject}</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#333333;background-color:#f4f4f4;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f4;">
    <tr>
      <td align="center" style="padding:20px 10px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:4px;overflow:hidden;">
          <tr>
            <td style="background-color:#0f3d5e;padding:30px 20px;text-align:center;">
              <img src="https://www.cpcs-training-courses.co.uk/wp-content/uploads/2023/02/cpcs-training-courses-logo.png" alt="CPCS Training Courses" width="250" style="max-width:250px;height:auto;display:block;margin:0 auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding:30px;background-color:#ffffff;">
              ${trackedHtmlBody}
            </td>
          </tr>
          <tr>
            <td style="padding:20px;text-align:center;font-size:12px;color:#666666;border-top:1px solid #eeeeee;">
              <p style="margin:0 0 5px;"><strong>${emailSettings.from_name}</strong></p>
              <p style="margin:0 0 5px;">01234 604 151 | ${emailSettings.from_email}</p>
              <p style="margin:0 0 15px;">cpcs-training-courses.co.uk</p>
              <p style="margin:0;padding-top:15px;border-top:1px solid #eeeeee;">
                <a href="${unsubscribeUrl}" style="color:#999999;text-decoration:underline;font-size:11px;">Unsubscribe from marketing emails</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  <img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;border:0;" />
</body>
</html>`;

        await transporter.sendMail({
          from: `${emailSettings.from_name} <${emailSettings.from_email}>`,
          to: recipient.email,
          subject: campaign.email_templates.subject,
          text: plainTextBody + `\n\nUnsubscribe: ${unsubscribeUrl}`,
          html: emailHtml,
          headers: {
            'List-Unsubscribe': `<${unsubscribeUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
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
