import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function sendEmail(to: string, subject: string, htmlBody: string): Promise<void> {
  try {
    const conn = await Deno.connectTls({
      hostname: 'smtp.cpts-host.beep.pl',
      port: 465,
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

    await sendCommand('EHLO cpts-host.beep.pl');
    await sendCommand('AUTH LOGIN');
    await sendCommand(btoa('daniel@cpts.uk'));
    await sendCommand(btoa('Da.2023niel'));

    await sendCommand('MAIL FROM:<daniel@cpts.uk>');
    await sendCommand(`RCPT TO:<${to}>`);
    await sendCommand('DATA');

    const emailContent = [
      `From: CPTS Training <daniel@cpts.uk>`,
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

        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #0f3d5e; color: white; padding: 30px 20px; text-align: center; }
              .content { background-color: #f9fafb; padding: 30px; }
              .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">CPTS Training</h1>
              </div>
              <div class="content">
                ${htmlBody}
              </div>
              <div class="footer">
                <p><strong>CPTS Training - Construction and Plant Training Services</strong></p>
                <p>📞 01234 604 151 | ✉️ daniel@cpts.uk</p>
                <p>🌐 cpcs-training-courses.co.uk</p>
              </div>
            </div>
          </body>
          </html>
        `;

        await sendEmail(
          recipient.email,
          campaign.email_templates.subject,
          emailHtml
        );

        await supabase
          .from("campaign_recipients")
          .update({ sent: true, sent_at: new Date().toISOString() })
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