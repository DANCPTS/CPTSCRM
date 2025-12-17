import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

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
    const { leadId, leadName, leadEmail, formUrl } = await req.json();

    if (!leadId || !leadName || !leadEmail || !formUrl) {
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
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .maybeSingle();

    if (leadError) {
      console.error('Error fetching lead:', leadError);
    }

    const { data: proposalCourses, error: coursesError } = await supabase
      .from('proposal_courses')
      .select('*')
      .eq('lead_id', leadId)
      .order('display_order');

    if (coursesError) {
      console.error('Error fetching proposal courses:', coursesError);
    }

    let quoteDetailsHtml = '';

    if (proposalCourses && proposalCourses.length > 0) {
      const totalDelegates = proposalCourses.reduce((sum, course) => sum + (course.number_of_delegates || 0), 0);
      const totalPrice = proposalCourses.reduce((sum, course) => sum + (course.price || 0), 0);
      const currency = proposalCourses[0]?.currency || 'GBP';

      const coursesHtml = proposalCourses.map((course, index) => `
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 5px; margin: 10px 0; border-left: 4px solid #0f3d5e;">
          <h4 style="margin-top: 0; color: #1f2937;">Course ${index + 1}: ${course.course_name}</h4>
          <p style="margin: 5px 0;"><strong>Price:</strong> ${formatCurrency(course.price, course.currency || 'GBP')} (inc. VAT)</p>
          ${course.dates ? `<p style="margin: 5px 0;"><strong>Dates:</strong> ${course.dates}</p>` : ''}
          ${course.venue ? `<p style="margin: 5px 0;"><strong>Venue:</strong> ${course.venue}</p>` : ''}
          <p style="margin: 5px 0;"><strong>Delegates:</strong> ${course.number_of_delegates}</p>
        </div>
      `).join('');

      quoteDetailsHtml = `
        <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
          <h3 style="margin-top: 0; color: #1f2937;">${proposalCourses.length > 1 ? 'Courses in Your Proposal' : 'Quote Details'}</h3>
          ${coursesHtml}
          ${proposalCourses.length > 1 ? `
            <div style="background-color: #0f3d5e; color: white; padding: 15px; border-radius: 5px; margin-top: 15px;">
              <p style="margin: 5px 0;"><strong>Total Delegates:</strong> ${totalDelegates}</p>
              <p style="margin: 5px 0;"><strong>Total Price:</strong> ${formatCurrency(totalPrice, currency)} (inc. VAT)</p>
            </div>
          ` : ''}
        </div>
      `;
    } else if (lead && (lead.quoted_course || lead.quoted_price)) {
      quoteDetailsHtml = `
        <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
          <h3 style="margin-top: 0; color: #1f2937;">Quote Details</h3>
          ${lead.quoted_course ? `<p><strong>Course:</strong> ${lead.quoted_course}</p>` : ''}
          ${lead.quoted_price ? `<p><strong>Price:</strong> ${formatCurrency(lead.quoted_price, lead.quoted_currency || 'GBP')} (inc. VAT)</p>` : ''}
          ${lead.quoted_dates ? `<p><strong>Proposed Dates:</strong> ${lead.quoted_dates}</p>` : ''}
          ${lead.quoted_venue ? `<p><strong>Venue:</strong> ${lead.quoted_venue}</p>` : ''}
          ${lead.number_of_delegates ? `<p><strong>Number of Delegates:</strong> ${lead.number_of_delegates}</p>` : ''}
        </div>
      `;
    }

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
          .button { display: inline-block; background: linear-gradient(to right, #F9B000, #F28D00); color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="https://www.cpcs-training-courses.co.uk/wp-content/uploads/2023/02/cpcs-training-courses-logo.png" alt="CPCS Training" class="logo" />
            <h1 style="margin: 0;">Training Booking Form</h1>
          </div>
          <div class="content">
            <p>Dear ${leadName},</p>
            <p>Thank you for your interest in our training courses. We're pleased to send you our booking form to confirm your training reservation.</p>
            ${quoteDetailsHtml}
            <p>Please click the button below to access and complete your booking form:</p>
            <div style="text-align: center;">
              <a href="${formUrl}" class="button">Complete Booking Form</a>
            </div>
            <p><strong>Important:</strong></p>
            <ul>
              <li>This link will expire in 7 days</li>
              <li>Please review all details carefully before signing</li>
              <li>Your signature confirms acceptance of our terms and conditions</li>
            </ul>
            <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>
            <p>Best regards,<br>CPTS Training Team</p>
          </div>
          <div class="footer">
            <p>CPTS Training | daniel@cpts.uk</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmail(
      leadEmail,
      'Your Training Booking Form - CPTS Training',
      emailHtml
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: "Booking form email sent successfully"
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