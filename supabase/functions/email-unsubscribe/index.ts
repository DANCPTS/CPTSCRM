import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const recipientId = url.searchParams.get('rid');
    const reason = url.searchParams.get('reason') || 'user_request';

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let email = '';
    let campaignId = null;

    if (recipientId) {
      const { data: recipient } = await supabase
        .from('campaign_recipients')
        .select('email, campaign_id')
        .eq('id', recipientId)
        .maybeSingle();

      if (recipient) {
        email = recipient.email;
        campaignId = recipient.campaign_id;

        await supabase
          .from('campaign_recipients')
          .update({ unsubscribed_at: new Date().toISOString() })
          .eq('id', recipientId);
      }
    }

    if (email) {
      await supabase
        .from('unsubscribed_emails')
        .upsert({
          email: email.toLowerCase(),
          campaign_id: campaignId,
          reason: reason,
          unsubscribed_at: new Date().toISOString()
        }, {
          onConflict: 'email'
        });
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Unsubscribed - CPTS Training</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .container {
            background: white;
            border-radius: 16px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
            max-width: 480px;
            width: 100%;
            padding: 48px 40px;
            text-align: center;
          }
          .icon {
            width: 80px;
            height: 80px;
            background: #f0f9ff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 24px;
          }
          .icon svg {
            width: 40px;
            height: 40px;
            color: #0369a1;
          }
          h1 {
            color: #1e293b;
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 12px;
          }
          p {
            color: #64748b;
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 24px;
          }
          .email {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px 16px;
            font-size: 14px;
            color: #334155;
            margin-bottom: 24px;
          }
          .button {
            display: inline-block;
            background: #0f3d5e;
            color: white;
            padding: 12px 32px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 500;
            transition: background 0.2s;
          }
          .button:hover {
            background: #0c3049;
          }
          .footer {
            margin-top: 32px;
            padding-top: 24px;
            border-top: 1px solid #e2e8f0;
            font-size: 13px;
            color: #94a3b8;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1>You've been unsubscribed</h1>
          <p>You will no longer receive marketing emails from CPTS Training. We're sorry to see you go!</p>
          ${email ? `<div class="email">${email}</div>` : ''}
          <a href="https://cpcs-training-courses.co.uk" class="button">Visit Our Website</a>
          <div class="footer">
            <p>CPTS Training - Construction and Plant Training Services</p>
            <p>If you unsubscribed by mistake, please contact us at daniel@cpts.uk</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return new Response(html, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Error processing unsubscribe:', error);
    return new Response('An error occurred. Please contact support.', {
      status: 500,
      headers: corsHeaders,
    });
  }
});
