import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SITE_URL = "https://cptscrm.netlify.app";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const recipientId = url.searchParams.get("rid");
    const reason = url.searchParams.get("reason") || "user_request";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let email = "";
    let campaignId = null;

    if (recipientId) {
      const { data: recipient } = await supabase
        .from("campaign_recipients")
        .select("email, campaign_id")
        .eq("id", recipientId)
        .maybeSingle();

      if (recipient) {
        email = recipient.email;
        campaignId = recipient.campaign_id;

        await supabase
          .from("campaign_recipients")
          .update({ unsubscribed_at: new Date().toISOString() })
          .eq("id", recipientId);
      }
    }

    if (email) {
      await supabase
        .from("unsubscribed_emails")
        .upsert(
          {
            email: email.toLowerCase(),
            campaign_id: campaignId,
            reason: reason,
            unsubscribed_at: new Date().toISOString(),
          },
          { onConflict: "email" }
        );

      await supabase
        .from("audience_members")
        .update({
          subscribed: false,
          unsubscribed_at: new Date().toISOString(),
        })
        .eq("email", email.toLowerCase());
    }

    const redirectUrl = new URL("/unsubscribed", SITE_URL);
    if (email) {
      redirectUrl.searchParams.set("email", email);
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: redirectUrl.toString(),
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error("Error processing unsubscribe:", error);

    const redirectUrl = new URL("/unsubscribed", SITE_URL);
    return new Response(null, {
      status: 302,
      headers: {
        Location: redirectUrl.toString(),
        ...corsHeaders,
      },
    });
  }
});
