import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const TRANSPARENT_GIF = Uint8Array.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00,
  0x80, 0x00, 0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21,
  0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00,
  0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
  0x01, 0x00, 0x3b
]);

Deno.serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const recipientId = url.searchParams.get('rid');

    if (recipientId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase.rpc('increment_recipient_open_count', { rid: recipientId });

      await supabase
        .from('campaign_recipients')
        .update({ opened: true })
        .eq('id', recipientId)
        .is('opened', false);
    }

    return new Response(TRANSPARENT_GIF, {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': 'Thu, 01 Jan 1970 00:00:00 GMT',
        'ETag': `"${Date.now()}"`,
      },
    });
  } catch (error) {
    return new Response(TRANSPARENT_GIF, {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  }
});
