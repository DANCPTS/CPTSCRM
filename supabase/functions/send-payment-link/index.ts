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

function formatCurrency(amount: string | number | null, currency: string = 'GBP'): string {
  if (!amount) return 'TBC';
  const symbols: Record<string, string> = {
    'GBP': '£',
    'EUR': '€',
    'USD': '$',
    'PLN': 'zł'
  };
  return `${symbols[currency] || currency} ${Number(amount).toFixed(2)}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { bookingFormId, clientName, clientEmail, paymentLink, courses } = await req.json();

    if (!clientName || !clientEmail || !paymentLink) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: emailSettingsData, error: settingsError } = await supabase
      .from('email_settings')
      .select('*')
      .eq('settings_type', 'transactional')
      .maybeSingle();

    if (settingsError || !emailSettingsData) {
      return new Response(
        JSON.stringify({ error: "Email settings not configured" }),
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

    let coursesHtml = '';
    let totalPrice = 0;
    let currency = 'GBP';

    if (courses && courses.length > 0) {
      currency = courses[0]?.currency || 'GBP';
      totalPrice = courses.reduce((sum: number, c: any) => sum + (Number(c.price) || 0), 0);

      coursesHtml = courses.map((course: any, index: number) => `
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 5px; margin: 10px 0; border-left: 4px solid #0f3d5e;">
          <h4 style="margin-top: 0; color: #1f2937;">${courses.length > 1 ? `Course ${index + 1}: ` : ''}${course.course_name}</h4>
          ${course.course_dates ? `<p style="margin: 5px 0;"><strong>Dates:</strong> ${course.course_dates}</p>` : ''}
          ${course.course_venue ? `<p style="margin: 5px 0;"><strong>Venue:</strong> ${course.course_venue}</p>` : ''}
          <p style="margin: 5px 0;"><strong>Delegates:</strong> ${course.number_of_delegates || 1}</p>
          <p style="margin: 5px 0;"><strong>Price:</strong> ${formatCurrency(course.price, course.currency || 'GBP')}${course.vat_exempt ? '' : ' + VAT'}</p>
        </div>
      `).join('');
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #0f3d5e; color: white; padding: 30px 20px; text-align: center; }
          .logo { max-width: 250px; height: auto; margin: 0 auto 15px; display: block; }
          .content { background-color: #f9fafb; padding: 30px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="https://www.cpcs-training-courses.co.uk/wp-content/uploads/2023/02/cpcs-training-courses-logo.png" alt="CPCS Training" class="logo" />
            <h1 style="margin: 0;">Payment Request</h1>
          </div>
          <div class="content">
            <p>Dear ${clientName},</p>
            <p>Thank you for your booking. Please complete your payment using the secure link below.</p>

            ${coursesHtml ? `
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
              <h3 style="margin-top: 0; color: #1f2937;">Your Booking Details</h3>
              ${coursesHtml}
              ${courses && courses.length > 1 ? `
                <div style="background-color: #0f3d5e; color: white; padding: 15px; border-radius: 5px; margin-top: 15px;">
                  <p style="margin: 5px 0;"><strong>Total Amount:</strong> ${formatCurrency(totalPrice, currency)}${courses.every((c: any) => c.vat_exempt) ? '' : ' + VAT'}</p>
                </div>
              ` : ''}
            </div>
            ` : ''}

            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0;">
              <tr>
                <td align="center">
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center" bgcolor="#F28D00" style="background-color: #F28D00; border-radius: 5px; padding: 16px 32px;">
                        <a href="${paymentLink}" target="_blank" style="color: #ffffff; font-family: Arial, sans-serif; font-size: 18px; font-weight: bold; text-decoration: none; display: inline-block;">
                          Pay Now Securely
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <p style="text-align: center; color: #64748b; font-size: 14px;">
              This is a secure Stripe payment link. Your payment details are protected.
            </p>

            <p style="margin-top: 30px;">If you have any questions about your booking or payment, please don't hesitate to contact us.</p>
            <p>Best regards,<br>CPTS Training Team</p>
          </div>
          <div class="footer">
            <p>${emailSettings.from_name} | ${emailSettings.from_email}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmail(
      clientEmail,
      `Payment Request - ${emailSettings.from_name}`,
      emailHtml,
      emailSettings
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: "Payment link email sent successfully"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});