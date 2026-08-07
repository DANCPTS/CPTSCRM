import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-worker-token",
};

interface MarketingEmailSettings {
  resend_api_key: string;
  from_email: string;
  from_name: string;
}

const BATCH_LEASE_SECONDS = 120;
const MAX_ATTEMPTS = 5;
const DELAY_BETWEEN_EMAILS_MS = 120;
const MAX_BATCH_WALL_MS = 25000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function convertMarkdownToHtml(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(#\)/g, '<a href="https://cpcs-training-courses.co.uk" style="display: inline-block; background-color: #F28D00; color: white; padding: 12px 30px; text-decoration: none; font-weight: bold; border-radius: 5px; margin: 10px 0;">$1</a>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #F28D00; text-decoration: none; font-weight: bold;">$1</a>')
    .replace(/\n/g, "<br>");
}

function wrapLinksWithTracking(html: string, recipientId: string, supabaseUrl: string): string {
  const trackingBaseUrl = `${supabaseUrl}/functions/v1/track-email-click`;
  let linkIndex = 0;
  return html.replace(/href="(https?:\/\/[^"]+)"/g, (match, url) => {
    if (url.includes("/functions/v1/")) return match;
    const encodedUrl = encodeURIComponent(url);
    linkIndex++;
    return `href="${trackingBaseUrl}?rid=${recipientId}&url=${encodedUrl}&l=${linkIndex}"`;
  });
}

function personalizeContent(body: string, firstName: string): string {
  return body
    .replace(/\[Recipient's Name\]/g, firstName)
    .replace(/\[recipient's name\]/g, firstName)
    .replace(/\[First Name\]/g, firstName)
    .replace(/\[first name\]/g, firstName)
    .replace(/Dear \[.*?\]/g, `Dear ${firstName}`)
    .replace(/\{\{first_name\}\}/gi, firstName);
}

function buildStandardEmailHtml(
  trackedHtmlBody: string,
  subject: string,
  emailSettings: MarketingEmailSettings,
  trackingPixelUrl: string,
  unsubscribeUrl: string
): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
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
}

function normalizeUnsubscribeHtml(html: string): string {
  return html
    .replace(/%7B%7Bunsubscribe_url%7D%7D/gi, "{{unsubscribe_url}}")
    .replace(/&#123;&#123;unsubscribe_url&#125;&#125;/gi, "{{unsubscribe_url}}");
}

function buildStandaloneEmailHtml(trackedBody: string, trackingPixelUrl: string, unsubscribeUrl: string): string {
  let html = normalizeUnsubscribeHtml(trackedBody);
  const hasPlaceholder = /\{\{unsubscribe_url\}\}/i.test(html);
  if (hasPlaceholder) {
    html = html.replace(/\{\{unsubscribe_url\}\}/gi, unsubscribeUrl);
  } else {
    const unsubBlock = `<div style="text-align:center;padding:10px;font-size:11px;color:#999999;"><a href="${unsubscribeUrl}" style="color:#999999;text-decoration:underline;">Unsubscribe</a></div>`;
    if (/<\/body>/i.test(html)) {
      html = html.replace(/<\/body>/i, `${unsubBlock}</body>`);
    } else {
      html += unsubBlock;
    }
  }
  const trackingPixel = `<img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;border:0;" />`;
  if (/<\/body>/i.test(html)) {
    html = html.replace(/<\/body>/i, `${trackingPixel}</body>`);
  } else {
    html += trackingPixel;
  }
  return html;
}

// Exponential backoff with jitter (seconds), capped at 15 minutes.
function backoffSeconds(attempts: number, retryAfter?: number): number {
  if (retryAfter && retryAfter > 0) {
    return Math.min(retryAfter, 900) + Math.floor(Math.random() * 5);
  }
  const base = 30 * Math.pow(2, Math.max(0, attempts - 1));
  const jitter = Math.floor(Math.random() * 15);
  return Math.min(base + jitter, 900);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: "Server configuration missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const campaignId = body?.campaignId;
    if (!campaignId) {
      return new Response(JSON.stringify({ error: "campaignId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authenticate the caller with the shared worker token.
    const providedToken = req.headers.get("x-worker-token") || "";
    const { data: config } = await supabase
      .from("private_worker_config")
      .select("worker_token")
      .eq("id", 1)
      .maybeSingle();
    if (!config?.worker_token || providedToken !== config.worker_token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load the job control row.
    const { data: job } = await supabase
      .from("campaign_send_jobs")
      .select("*")
      .eq("campaign_id", campaignId)
      .maybeSingle();

    if (!job || job.status !== "running") {
      return new Response(JSON.stringify({ ok: true, skipped: `job status: ${job?.status ?? "none"}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Heartbeat immediately so overlapping cron kicks stand down.
    await supabase
      .from("campaign_send_jobs")
      .update({ last_heartbeat_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("campaign_id", campaignId);

    // Load marketing email settings.
    const { data: emailSettingsData } = await supabase
      .from("email_settings")
      .select("*")
      .eq("settings_type", "marketing")
      .maybeSingle();

    if (!emailSettingsData?.resend_api_key || !emailSettingsData?.from_email) {
      await supabase
        .from("campaign_send_jobs")
        .update({ status: "paused", last_error: "Marketing email settings not configured", updated_at: new Date().toISOString() })
        .eq("campaign_id", campaignId);
      return new Response(JSON.stringify({ error: "Marketing email settings not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailSettings: MarketingEmailSettings = {
      resend_api_key: emailSettingsData.resend_api_key,
      from_email: emailSettingsData.from_email,
      from_name: emailSettingsData.from_name,
    };

    // Load campaign + template.
    const { data: campaign } = await supabase
      .from("marketing_campaigns")
      .select("*, email_templates(*)")
      .eq("id", campaignId)
      .maybeSingle();

    if (!campaign || !campaign.email_templates) {
      await supabase
        .from("campaign_send_jobs")
        .update({ status: "paused", last_error: "Campaign or template not found", updated_at: new Date().toISOString() })
        .eq("campaign_id", campaignId);
      return new Response(JSON.stringify({ error: "Campaign or template not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const templateMode = campaign.email_templates?.template_mode || "standard";
    const batchSize = Math.max(1, Math.min(job.batch_size || 50, 200));

    // Atomically claim a batch (also reclaims expired leases, fails over-limit rows).
    const { data: claimed, error: claimError } = await supabase.rpc("claim_campaign_batch", {
      p_campaign_id: campaignId,
      p_batch_size: batchSize,
      p_lease_seconds: BATCH_LEASE_SECONDS,
      p_max_attempts: MAX_ATTEMPTS,
    });

    if (claimError) {
      console.error(JSON.stringify({ evt: "claim_error", campaignId, error: claimError.message }));
      return new Response(JSON.stringify({ error: "Failed to claim batch" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recipients: any[] = claimed || [];

    // Nothing left to claim: check whether the campaign is finished.
    if (recipients.length === 0) {
      const { count: outstanding } = await supabase
        .from("campaign_recipients")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaignId)
        .in("delivery_status", ["pending", "retry_wait", "processing"]);

      await supabase.rpc("refresh_campaign_job_counts", { p_campaign_id: campaignId });

      if ((outstanding || 0) === 0) {
        await supabase
          .from("campaign_send_jobs")
          .update({ status: "completed", completed_at: new Date().toISOString(), last_heartbeat_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("campaign_id", campaignId);
        await supabase
          .from("marketing_campaigns")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", campaignId);
        console.log(JSON.stringify({ evt: "campaign_complete", campaignId }));
        return new Response(JSON.stringify({ ok: true, complete: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Work exists but is not due yet (all in retry_wait/processing with future timers).
      return new Response(JSON.stringify({ ok: true, complete: false, waiting: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Suppression recheck for exactly this batch, immediately before sending.
    const batchEmails = Array.from(new Set(recipients.map((r) => (r.normalized_email || r.email || "").toLowerCase()).filter(Boolean)));
    const suppressedSet = new Set<string>();
    for (let i = 0; i < batchEmails.length; i += 200) {
      const chunk = batchEmails.slice(i, i + 200);
      const { data: unsub } = await supabase.from("unsubscribed_emails").select("email").in("email", chunk);
      (unsub || []).forEach((u: any) => suppressedSet.add((u.email || "").toLowerCase()));
    }

    const batchStart = Date.now();
    let sentCount = 0;
    let failedCount = 0;
    let suppressedCount = 0;
    let throttled = false;
    let throttleUntil: string | null = null;
    const leftover: any[] = [];

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];

      // Respect the batch wall clock: release unprocessed rows for the next worker.
      if (Date.now() - batchStart > MAX_BATCH_WALL_MS) {
        leftover.push(...recipients.slice(i));
        break;
      }

      const normEmail = (recipient.normalized_email || recipient.email || "").toLowerCase();

      try {
        // Suppression takes precedence over audience membership.
        if (suppressedSet.has(normEmail)) {
          await supabase
            .from("campaign_recipients")
            .update({ sent: true, sent_at: new Date().toISOString(), delivery_status: "suppressed", lease_expires_at: null, last_error_code: "unsubscribed", last_error_message: "Recipient unsubscribed" })
            .eq("id", recipient.id);
          suppressedCount++;
          continue;
        }

        // Permanent: invalid address or missing data — never retried.
        if (!recipient.email || !EMAIL_REGEX.test(recipient.email)) {
          await supabase
            .from("campaign_recipients")
            .update({ delivery_status: "failed", lease_expires_at: null, last_error_code: "invalid_email", last_error_message: "Invalid email address" })
            .eq("id", recipient.id);
          failedCount++;
          continue;
        }

        const firstName = (recipient.name || "").split(" ")[0] || recipient.name || "there";
        const trackingPixelUrl = `${supabaseUrl}/functions/v1/track-email-open?rid=${recipient.id}&t=${Date.now()}`;
        const unsubscribeUrl = `${supabaseUrl}/functions/v1/email-unsubscribe?rid=${recipient.id}`;

        let emailHtml: string;
        let plainTextBody: string;

        if (templateMode === "standalone_html") {
          let personalizedBody = personalizeContent(campaign.email_templates.body, firstName);
          if (recipient.company_name) {
            personalizedBody = personalizedBody.replace(/\{\{company_name\}\}/gi, recipient.company_name);
          }
          const trackedBody = wrapLinksWithTracking(personalizedBody, recipient.id, supabaseUrl);
          emailHtml = buildStandaloneEmailHtml(trackedBody, trackingPixelUrl, unsubscribeUrl);
          plainTextBody = personalizedBody
            .replace(/<[^>]*>/g, "")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/\s+/g, " ")
            .trim();
        } else {
          const personalizedBody = personalizeContent(campaign.email_templates.body, firstName);
          const htmlBody = convertMarkdownToHtml(personalizedBody);
          const trackedHtmlBody = wrapLinksWithTracking(htmlBody, recipient.id, supabaseUrl);
          emailHtml = buildStandardEmailHtml(trackedHtmlBody, campaign.email_templates.subject, emailSettings, trackingPixelUrl, unsubscribeUrl);
          plainTextBody = personalizedBody
            .replace(/\*\*([^*]+)\*\*/g, "$1")
            .replace(/\*([^*]+)\*/g, "$1")
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1: $2")
            .replace(/\[([^\]]+)\]\(#\)/g, "$1");
        }

        let resendResponse: Response;
        try {
          resendResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${emailSettings.resend_api_key}`,
              "Content-Type": "application/json",
              // Deterministic idempotency key: provider dedupes if the function crashed after acceptance.
              "Idempotency-Key": `campaign-${campaignId}-rid-${recipient.id}`,
            },
            body: JSON.stringify({
              from: `${emailSettings.from_name} <${emailSettings.from_email}>`,
              to: [recipient.email],
              subject: campaign.email_templates.subject,
              html: emailHtml,
              text: plainTextBody + `\n\nUnsubscribe: ${unsubscribeUrl}`,
              headers: {
                "List-Unsubscribe": `<${unsubscribeUrl}>`,
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
              },
            }),
          });
        } catch (netErr) {
          // Network/timeout — transient, retry with backoff.
          const secs = backoffSeconds(recipient.attempts);
          await supabase
            .from("campaign_recipients")
            .update({ delivery_status: "retry_wait", next_attempt_at: new Date(Date.now() + secs * 1000).toISOString(), lease_expires_at: null, last_error_code: "network_error", last_error_message: String(netErr).slice(0, 200) })
            .eq("id", recipient.id);
          failedCount++;
          continue;
        }

        const resendResult = await resendResponse.json().catch(() => ({}));

        if (resendResponse.ok) {
          await supabase
            .from("campaign_recipients")
            .update({ sent: true, sent_at: new Date().toISOString(), delivery_status: "sent", resend_message_id: resendResult?.id || null, lease_expires_at: null, last_error_code: null, last_error_message: null })
            .eq("id", recipient.id);
          sentCount++;
        } else if (resendResponse.status === 429) {
          // Rate limited — honour Retry-After, stop the batch to respect provider limits.
          const retryAfterHeader = resendResponse.headers.get("retry-after");
          const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
          const secs = backoffSeconds(recipient.attempts, retryAfter);
          const nextAt = new Date(Date.now() + secs * 1000).toISOString();
          throttled = true;
          throttleUntil = nextAt;
          await supabase
            .from("campaign_recipients")
            .update({ delivery_status: "retry_wait", next_attempt_at: nextAt, lease_expires_at: null, last_error_code: "rate_limited", last_error_message: "Provider rate limit (429)" })
            .eq("id", recipient.id);
          leftover.push(...recipients.slice(i + 1));
          break;
        } else if ([408, 500, 502, 503, 504].includes(resendResponse.status)) {
          const secs = backoffSeconds(recipient.attempts);
          await supabase
            .from("campaign_recipients")
            .update({ delivery_status: "retry_wait", next_attempt_at: new Date(Date.now() + secs * 1000).toISOString(), lease_expires_at: null, last_error_code: `http_${resendResponse.status}`, last_error_message: (resendResult?.message || "Temporary provider error").slice(0, 200) })
            .eq("id", recipient.id);
          failedCount++;
        } else {
          // Permanent rejection (4xx) — do not retry.
          await supabase
            .from("campaign_recipients")
            .update({ delivery_status: "failed", lease_expires_at: null, last_error_code: `http_${resendResponse.status}`, last_error_message: (resendResult?.message || "Rejected by provider").slice(0, 200) })
            .eq("id", recipient.id);
          failedCount++;
        }

        if (i < recipients.length - 1) {
          await delay(DELAY_BETWEEN_EMAILS_MS);
        }
      } catch (err) {
        // Unexpected error on one recipient must never fail the batch.
        const secs = backoffSeconds(recipient.attempts);
        await supabase
          .from("campaign_recipients")
          .update({ delivery_status: "retry_wait", next_attempt_at: new Date(Date.now() + secs * 1000).toISOString(), lease_expires_at: null, last_error_code: "worker_error", last_error_message: String(err).slice(0, 200) })
          .eq("id", recipient.id);
        failedCount++;
      }
    }

    // Release any rows we claimed but did not process, so they are picked up promptly.
    if (leftover.length > 0) {
      const leftoverIds = leftover.map((r) => r.id);
      const nextAt = throttleUntil || new Date().toISOString();
      await supabase
        .from("campaign_recipients")
        .update({ delivery_status: "retry_wait", next_attempt_at: nextAt, lease_expires_at: null })
        .in("id", leftoverIds)
        .eq("delivery_status", "processing");
    }

    const durationMs = Date.now() - batchStart;

    await supabase.rpc("refresh_campaign_job_counts", { p_campaign_id: campaignId });
    await supabase
      .from("campaign_send_jobs")
      .update({
        last_batch_claimed: recipients.length,
        last_batch_sent: sentCount,
        last_batch_failed: failedCount,
        last_batch_duration_ms: durationMs,
        throttled,
        throttled_until: throttled ? throttleUntil : null,
        last_heartbeat_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("campaign_id", campaignId);

    console.log(JSON.stringify({
      evt: "batch_done",
      campaignId,
      jobId: job.id,
      claimed: recipients.length,
      sent: sentCount,
      suppressed: suppressedCount,
      failed: failedCount,
      throttled,
      durationMs,
    }));

    // Re-read job status (a Pause/Cancel may have arrived mid-batch).
    const { data: freshJob } = await supabase
      .from("campaign_send_jobs")
      .select("status")
      .eq("campaign_id", campaignId)
      .maybeSingle();

    // Chain the next batch automatically — but stand down when throttled and let the
    // cron backstop resume after the backoff window (prevents hammering the provider).
    if (freshJob?.status === "running" && !throttled) {
      await supabase.rpc("kick_campaign_worker", { p_campaign_id: campaignId });
    }

    return new Response(JSON.stringify({ ok: true, claimed: recipients.length, sent: sentCount, failed: failedCount, throttled }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(JSON.stringify({ evt: "worker_fatal", error: String(error) }));
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
