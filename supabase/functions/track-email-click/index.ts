import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const recipientId = url.searchParams.get('rid');
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
      return new Response('Missing URL parameter', { status: 400 });
    }

    const decodedUrl = decodeURIComponent(targetUrl);

    if (recipientId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase.rpc('increment_recipient_click_count', {
        recipient_id: recipientId,
        link_url: decodedUrl
      });
    }

    return new Response(null, {
      status: 302,
      headers: {
        'Location': decodedUrl,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error tracking click:', error);
    const url = new URL(req.url);
    const targetUrl = url.searchParams.get('url');
    if (targetUrl) {
      return new Response(null, {
        status: 302,
        headers: { 'Location': decodeURIComponent(targetUrl) },
      });
    }
    return new Response('Error', { status: 500 });
  }
});
