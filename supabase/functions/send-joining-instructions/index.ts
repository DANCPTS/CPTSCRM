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

function formatDate(date: string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (start.toDateString() === end.toDateString()) {
    return formatDate(startDate);
  }
  
  const startDay = start.getDate();
  const endDay = end.getDate();
  const month = end.toLocaleDateString('en-GB', { month: 'short' });
  const year = end.getFullYear();
  
  return `${startDay} – ${endDay} ${month} ${year}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { leadId } = await req.json();

    if (!leadId) {
      return new Response(
        JSON.stringify({ error: "Missing leadId" }),
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

    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        *,
        company:companies(*),
        contact:contacts(*),
        candidate:candidates(first_name, last_name),
        course_run:course_runs(
          *,
          course:courses(*)
        )
      `)
      .eq('lead_id', leadId);

    if (bookingsError) {
      throw new Error(`Failed to fetch bookings: ${bookingsError.message}`);
    }

    if (!bookings || bookings.length === 0) {
      return new Response(
        JSON.stringify({ error: "No bookings found for this lead" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const firstBooking = bookings[0];
    const company = firstBooking.company;
    const contact = firstBooking.contact;
    const companyName = company?.name || 'N/A';

    const coursesHtml = bookings.map(booking => {
      const courseRun = booking.course_run;
      const course = courseRun?.course;
      const candidate = booking.candidate;

      let candidateName = 'TBC';
      if (candidate) {
        candidateName = `${candidate.first_name} ${candidate.last_name}`;
      }

      return `
        <div style="margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-left: 4px solid #0f3d5e;">
          <h3 style="color: #0f3d5e; margin-top: 0;">${course?.title || 'Training Course'}</h3>
          <table class="info-table">
            <tr>
              <td>Course Date(s):</td>
              <td>${courseRun ? formatDateRange(courseRun.start_date, courseRun.end_date) : 'TBC'}</td>
            </tr>
            <tr>
              <td>Venue Location:</td>
              <td>${courseRun?.location || 'Construction & Plant Training Services, Podington, NN29 7XA'}</td>
            </tr>
            <tr>
              <td>Delegate Name:</td>
              <td>${candidateName}</td>
            </tr>
            <tr>
              <td>Purchase Order Number:</td>
              <td>${booking.invoice_number || firstBooking.invoice_number || 'TBC'}</td>
            </tr>
          </table>
        </div>
      `;
    }).join('');

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { background-color: #0f3d5e; color: white; padding: 30px 20px; text-align: center; }
          .logo { max-width: 250px; height: auto; margin: 0 auto 15px; display: block; }
          .content { background-color: white; padding: 30px; }
          .info-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .info-table td { padding: 12px; border: 2px solid #0f3d5e; }
          .info-table td:first-child { background-color: #e6f2ff; font-weight: bold; width: 40%; }
          .important-box { background-color: #fff9e6; border: 2px solid #0f3d5e; padding: 20px; margin: 20px 0; }
          .important-box h3 { margin-top: 0; color: #0f3d5e; }
          .highlight { background-color: #ffeb3b; font-weight: bold; }
          ul { margin: 10px 0; padding-left: 20px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="https://www.cpcs-training-courses.co.uk/wp-content/uploads/2023/02/cpcs-training-courses-logo.png" alt="CPCS Training" class="logo" />
            <h1 style="margin: 0;">CPTS Joining Instructions</h1>
          </div>
          <div class="content">
            <table class="info-table">
              <tr>
                <td>Company Name:</td>
                <td>${companyName}</td>
              </tr>
            </table>

            <h2 style="color: #0f3d5e; margin-top: 30px;">Your Training Course${bookings.length > 1 ? 's' : ''}</h2>
            <p style="margin-bottom: 20px;">Below are the details for ${bookings.length > 1 ? 'all your upcoming courses' : 'your upcoming course'}:</p>

            ${coursesHtml}

            <div style="margin: 20px 0; padding: 15px; background-color: #e6f2ff; border-radius: 5px;">
              <p style="margin: 5px 0;"><strong>Start Time (All Courses):</strong> 09:00</p>
              <p style="margin: 5px 0;"><strong>Site Contact:</strong> Daniel Pawela 01234 604 151</p>
            </div>

            <div class="important-box">
              <h3>Important Information</h3>
              
              <p>Please ensure that you arrive 15 minutes prior to the course start time.</p>
              
              <p class="highlight">Please call us on 01234604151 and we will open the gate</p>
              
              <p>All visitors must report to reception and follow site safety rules displayed on entrance.</p>
              
              <p><strong>What to bring with you:</strong></p>
              <ul>
                <li>National ID or a photocard driving licence or valid passport</li>
                <li>Steel toe cap boots (preferably wellingtons as the digging yard is muddy and preferably second pair of normal shoes to change when you're taking a break in office building)</li>
                <li>Hi viz vest</li>
                <li>Hard hat</li>
                <li>Gloves</li>
              </ul>
              
              <p>All equipment must be clean and fit for purpose.</p>
              
              <p><strong>Food & drink:</strong></p>
              <p>You have to bring your own lunch. Tea and coffee will be provided. There is a vending machine with snacks and drinks.</p>
              
              <p><strong>Delegates arriving after the start of the course will only be admitted at the discretion of the trainer and in accordance with any awarding body regulations. Delegates refused entry will be CHARGED IN FULL.</strong></p>
            </div>

            <div style="margin: 30px 0;">
              <h3 style="color: #0f3d5e;">How to find us?</h3>
              <p>As you travel up Airfield Road, you will see the gates for MSF on your right-hand side, with our signs for Construction and Plant Training Services.</p>
              <p>Please use the Plant Training buzzer, we will then open the gate</p>
              <p>Once you are inside the premises, please follow the road past the MSF units on the left. You will see our offices as you continue on, the parking area is within the green fenced area.</p>
              <p><strong>Have What3words?</strong> Find us under <a href="https://what3words.com/cemented.gong.bystander">///cemented.gong.bystander</a></p>
            </div>

            <div class="important-box">
              <h3>Information Sheet for CPCS Technical Testing</h3>
              <p>You are required to bring one form of identification (containing both a photograph and signature) from the list below:</p>
              <ul>
                <li>Photograph card driving licence (No more than 6 months out of date)</li>
                <li>Passport (No more than 6 months out of date)</li>
                <li>A non-UK driving licence with a photograph and signature</li>
                <li>An EU identity card with a photograph and signature</li>
              </ul>
              <p><strong>If the candidate does not have one of the forms of identification, they will need to have two items of valid ID (No more than 6 months out of date):</strong></p>
              <p><strong>LIST A:</strong> Non-UK Driving Licence, Citizens Card, Work ID Card, Young Scots Card, EU Country ID Card, Proof of Age, CITB Scheme Card, British Armed Forces Card, Student ID Card, Trade Union Card</p>
              <p><strong>LIST B:</strong> Credit Card, Cheque Guarantee Card, Debit Card, Building Society Passbook, Paper Driving Licence, Bank Statement, UK Travel Document, B79 Notification of Discharge Letter, National Insurance Card/HMRC Letter, Inland Revenue Card</p>
              <p><em>Photocopies will NOT be accepted</em></p>
            </div>

            <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>
            <p>Best regards,<br>CPTS Training Team</p>
          </div>
          <div class="footer">
            <p>Construction & Plant Training Services | Podington, NN29 7XA</p>
            <p>Tel: 01234 604 151 | Email: daniel@cpts.uk</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailSubject = bookings.length > 1
      ? `Joining Instructions - ${bookings.length} Training Courses`
      : `Joining Instructions - ${firstBooking.course_run?.course?.title || 'Training Course'}`;

    await sendEmail(
      contact?.email || '',
      emailSubject,
      emailHtml
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: "Joining instructions sent successfully"
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
