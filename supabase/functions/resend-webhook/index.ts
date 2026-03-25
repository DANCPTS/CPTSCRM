import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const eventType = payload.type;
    const data = payload.data;

    if (!eventType || !data) {
      return new Response(
        JSON.stringify({ received: true, skipped: "missing event type or data" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailId = data.email_id;
    if (!emailId) {
      return new Response(
        JSON.stringify({ received: true, skipped: "no email_id in payload" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: recipient, error: lookupError } = await supabase
      .from("campaign_recipients")
      .select("id, campaign_id, email")
      .eq("resend_message_id", emailId)
      .maybeSingle();

    if (lookupError || !recipient) {
      return new Response(
        JSON.stringify({ received: true, skipped: "recipient not found for email_id" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    switch (eventType) {
      case "email.delivered": {
        await supabase
          .from("campaign_recipients")
          .update({ delivery_status: "delivered" })
          .eq("id", recipient.id);
        break;
      }

      case "email.bounced": {
        const bounceType = data.bounce?.type === "Permanent" ? "hard" : "soft";
        await supabase
          .from("campaign_recipients")
          .update({
            bounced_at: new Date().toISOString(),
            bounce_type: bounceType,
            delivery_status: "bounced",
          })
          .eq("id", recipient.id);
        break;
      }

      case "email.complained": {
        await supabase
          .from("campaign_recipients")
          .update({ spam_reported_at: new Date().toISOString() })
          .eq("id", recipient.id);

        await supabase
          .from("unsubscribed_emails")
          .upsert(
            {
              email: recipient.email.toLowerCase(),
              campaign_id: recipient.campaign_id,
              reason: "spam_complaint",
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
          .eq("email", recipient.email.toLowerCase());
        break;
      }

      case "email.delivery_delayed": {
        await supabase
          .from("campaign_recipients")
          .update({ delivery_status: "delayed" })
          .eq("id", recipient.id);
        break;
      }

      case "email.failed": {
        await supabase
          .from("campaign_recipients")
          .update({ delivery_status: "failed" })
          .eq("id", recipient.id);
        break;
      }

      case "email.suppressed": {
        const bounceType = "hard";
        await supabase
          .from("campaign_recipients")
          .update({
            bounced_at: new Date().toISOString(),
            bounce_type: bounceType,
            delivery_status: "bounced",
          })
          .eq("id", recipient.id);
        break;
      }

      default:
        break;
    }

    return new Response(
      JSON.stringify({ received: true, event: eventType, recipientId: recipient.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Resend webhook error:", error);
    return new Response(
      JSON.stringify({ received: true, error: error.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
