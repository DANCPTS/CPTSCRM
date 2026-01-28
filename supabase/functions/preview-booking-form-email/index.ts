import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

function generateBookingFormEmailHtml(
  leadName: string,
  formUrl: string,
  quoteDetailsHtml: string
): string {
  return `
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
          <h1 style="margin: 0;">Training Booking Form</h1>
        </div>
        <div class="content">
          <p>Dear ${leadName},</p>
          <p>Thank you for your interest in our training courses. We're pleased to send you our booking form to confirm your training reservation.</p>
          ${quoteDetailsHtml}
          <p>Please click the button below to access and complete your booking form:</p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0;">
            <tr>
              <td align="center">
                <table cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center" bgcolor="#F28D00" style="background-color: #F28D00; border-radius: 5px; padding: 14px 28px;">
                      <a href="${formUrl}" target="_blank" style="color: #ffffff; font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; text-decoration: none; display: inline-block;">
                        Complete Booking Form
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
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
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { leadId, leadName, leadEmail, formUrl, baseUrl } = await req.json();

    if (!leadId || !leadName || !leadEmail) {
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

    const { data: bookingForm, error: formError } = await supabase
      .from('booking_forms')
      .select('id')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (formError) {
      console.error('Error fetching booking form:', formError);
    }

    let proposalCourses = null;
    if (bookingForm) {
      const { data: courses, error: coursesError } = await supabase
        .from('booking_form_courses')
        .select('*')
        .eq('booking_form_id', bookingForm.id)
        .order('display_order');

      if (coursesError) {
        console.error('Error fetching booking form courses:', coursesError);
      } else {
        proposalCourses = courses?.map(c => ({
          course_name: c.course_name,
          dates: c.course_dates,
          venue: c.course_venue,
          number_of_delegates: c.number_of_delegates,
          price: c.price,
          currency: c.currency,
          vat_exempt: c.vat_exempt || false,
        }));
      }
    }

    if (!proposalCourses) {
      const { data: courses, error: coursesError } = await supabase
        .from('proposal_courses')
        .select('*')
        .eq('lead_id', leadId)
        .order('display_order');

      if (coursesError) {
        console.error('Error fetching proposal courses:', coursesError);
      }
      proposalCourses = courses;
    }

    let quoteDetailsHtml = '';

    if (proposalCourses && proposalCourses.length > 0) {
      const totalDelegates = proposalCourses.reduce((sum, course) => sum + (course.number_of_delegates || 0), 0);
      const totalPrice = proposalCourses.reduce((sum, course) => sum + (course.price || 0), 0);
      const currency = proposalCourses[0]?.currency || 'GBP';

      const coursesHtml = proposalCourses.map((course, index) => `
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 5px; margin: 10px 0; border-left: 4px solid #0f3d5e;">
          <h4 style="margin-top: 0; color: #1f2937;">Course ${index + 1}: ${course.course_name}</h4>
          <p style="margin: 5px 0;"><strong>Price:</strong> ${formatCurrency(course.price, course.currency || 'GBP')}${course.vat_exempt ? '' : ' + VAT'}</p>
          ${course.dates ? `<p style="margin: 5px 0;"><strong>Dates:</strong> ${course.dates}</p>` : ''}
          ${course.venue ? `<p style="margin: 5px 0;"><strong>Venue:</strong> ${course.venue}</p>` : ''}
          <p style="margin: 5px 0;"><strong>Delegates:</strong> ${course.number_of_delegates}</p>
        </div>
      `).join('');

      const allVatExempt = proposalCourses.every(c => c.vat_exempt);
      const vatSuffix = allVatExempt ? '' : ' + VAT';

      quoteDetailsHtml = `
        <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
          <h3 style="margin-top: 0; color: #1f2937;">${proposalCourses.length > 1 ? 'Courses in Your Proposal' : 'Quote Details'}</h3>
          ${coursesHtml}
          ${proposalCourses.length > 1 ? `
            <div style="background-color: #0f3d5e; color: white; padding: 15px; border-radius: 5px; margin-top: 15px;">
              <p style="margin: 5px 0;"><strong>Total Delegates:</strong> ${totalDelegates}</p>
              <p style="margin: 5px 0;"><strong>Total Price:</strong> ${formatCurrency(totalPrice, currency)}${vatSuffix}</p>
            </div>
          ` : ''}
        </div>
      `;
    } else if (lead && (lead.quoted_course || lead.quoted_price)) {
      quoteDetailsHtml = `
        <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
          <h3 style="margin-top: 0; color: #1f2937;">Quote Details</h3>
          ${lead.quoted_course ? `<p><strong>Course:</strong> ${lead.quoted_course}</p>` : ''}
          ${lead.quoted_price ? `<p><strong>Price:</strong> ${formatCurrency(lead.quoted_price, lead.quoted_currency || 'GBP')} + VAT</p>` : ''}
          ${lead.quoted_dates ? `<p><strong>Proposed Dates:</strong> ${lead.quoted_dates}</p>` : ''}
          ${lead.quoted_venue ? `<p><strong>Venue:</strong> ${lead.quoted_venue}</p>` : ''}
          ${lead.number_of_delegates ? `<p><strong>Number of Delegates:</strong> ${lead.number_of_delegates}</p>` : ''}
        </div>
      `;
    }

    let previewFormUrl = formUrl;
    if (!previewFormUrl && bookingForm) {
      const { data: formWithToken } = await supabase
        .from('booking_forms')
        .select('token')
        .eq('id', bookingForm.id)
        .maybeSingle();

      if (formWithToken?.token && baseUrl) {
        previewFormUrl = `${baseUrl}/booking-form/${formWithToken.token}`;
      }
    }
    if (!previewFormUrl) {
      previewFormUrl = baseUrl ? `${baseUrl}/booking-form/[token]` : '#';
    }
    const emailHtml = generateBookingFormEmailHtml(leadName, previewFormUrl, quoteDetailsHtml);
    const subject = 'Your Training Booking Form - CPTS Training';

    return new Response(
      JSON.stringify({
        success: true,
        recipientEmail: leadEmail,
        subject,
        htmlContent: emailHtml,
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
