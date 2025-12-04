import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ParsedEmail {
  from: string;
  subject: string;
  body: string;
  date: Date;
  messageId: string;
}

interface LeadData {
  name?: string;
  email?: string;
  phone?: string;
  company_name?: string;
  notes: string;
  source: string;
  status: string;
  channel: string;
  preferred_language: string;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function stripHtmlTags(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();
}

async function fetchNewEmails(): Promise<ParsedEmail[]> {
  let tlsConn: Deno.TlsConn | null = null;
  try {
    const conn = await Promise.race([
      Deno.connect({
        hostname: 'IMAP.cpts-host.beep.pl',
        port: 993,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), 10000)
      )
    ]);

    tlsConn = await Deno.startTls(conn, { hostname: 'IMAP.cpts-host.beep.pl' });

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const readBuffer = new Uint8Array(16384);
    let tagCounter = 1;

    async function sendCmd(cmd: string): Promise<string> {
      const tag = `A${String(tagCounter++).padStart(3, '0')}`;
      await tlsConn.write(encoder.encode(`${tag} ${cmd}\r\n`));

      let response = '';
      const maxIterations = 50;
      let iterations = 0;

      while (iterations < maxIterations) {
        const n = await tlsConn.read(readBuffer);
        if (n === null) break;

        response += decoder.decode(readBuffer.subarray(0, n));

        if (response.includes(`${tag} OK`) || response.includes(`${tag} NO`) || response.includes(`${tag} BAD`)) {
          break;
        }
        iterations++;
      }

      return response;
    }

    await tlsConn.read(readBuffer);

    await sendCmd('LOGIN daniel@cpts.uk Da.2023niel');
    await sendCmd('SELECT INBOX');

    // Get ALL UIDs first
    const searchResp = await sendCmd('UID SEARCH ALL');
    const match = searchResp.match(/\* SEARCH ([\d\s]+)/);
    const allUids = match ? match[1].trim().split(/\s+/).filter(id => id).map(id => parseInt(id)) : [];

    // Sort and take most recent 50 to reduce compute load
    allUids.sort((a, b) => a - b);
    const recentUids = allUids.slice(-50);

    console.log(`Total emails: ${allUids.length}, checking most recent 50 (UIDs ${recentUids[0]} to ${recentUids[recentUids.length-1]})`);

    const emails: ParsedEmail[] = [];

    // Fetch in smaller batches to avoid timeout
    for (let i = 0; i < recentUids.length; i += 10) {
      const batchUids = recentUids.slice(i, i + 10);
      const uidRange = batchUids.join(',');

      const resp = await sendCmd(`UID FETCH ${uidRange} (BODY[HEADER.FIELDS (FROM SUBJECT DATE MESSAGE-ID)] BODY.PEEK[TEXT]<0.5000>)`);

      // Split response by individual email responses
      const emailResponses = resp.split(/(?=\* \d+ FETCH)/);

      for (const emailResp of emailResponses) {
        if (!emailResp.includes('FETCH')) continue;

        const fromMatch = emailResp.match(/From:\s*(.+?)\r\n/i);
        const subjMatch = emailResp.match(/Subject:\s*(.+?)\r\n/i);
        const dateMatch = emailResp.match(/Date:\s*(.+?)\r\n/i);
        const messageIdMatch = emailResp.match(/Message-ID:\s*(.+?)\r\n/i);
        const uidMatch = emailResp.match(/UID (\d+)/);

        // Match body content - get first 5000 bytes
        const bodyMatch = emailResp.match(/BODY\[TEXT\]<\d+>[^\r\n]*\r\n([\s\S]+?)(?=\r\n\)|$)/m);
        let bodyContent = '';

        if (bodyMatch) {
          bodyContent = decodeHtmlEntities(bodyMatch[1].trim());
        }

        if (fromMatch && subjMatch) {
          emails.push({
            from: fromMatch[1].trim(),
            subject: decodeHtmlEntities(subjMatch[1].trim()),
            body: bodyContent,
            date: dateMatch ? new Date(dateMatch[1]) : new Date(),
            messageId: messageIdMatch ? messageIdMatch[1].trim() : `uid-${uidMatch ? uidMatch[1] : Date.now()}`,
          });
        }
      }
    }

    await sendCmd('LOGOUT');
    tlsConn?.close();

    return emails;
  } catch (error) {
    console.error('IMAP error:', error);
    if (tlsConn) {
      try {
        tlsConn.close();
      } catch (e) {
        console.error('Error closing connection:', e);
      }
    }
    throw new Error(`IMAP connection failed: ${error.message}`);
  }
}

function parseEmailToLead(email: ParsedEmail): LeadData {
  const body = email.body || '';
  const subject = email.subject || '';

  const nameFromBodyMatch = body.match(/Name\s*&\s*Surname\s*::\s*(.+?)(?:\r?\n|Email)/i);
  const extractedName = nameFromBodyMatch ? stripHtmlTags(nameFromBodyMatch[1]) : '';

  const emailFromBodyMatch = body.match(/Email\s*Address\s*::\s*(.+?)(?:\r?\n|Phone)/i);
  const extractedEmail = emailFromBodyMatch ? stripHtmlTags(emailFromBodyMatch[1]) : email.from;

  const phoneMatch = body.match(/Phone\s*Number\s*::\s*(.+?)(?:\r?\n|Message)/i);
  const extractedPhone = phoneMatch ? stripHtmlTags(phoneMatch[1]) : undefined;

  // Extract only the message content, stopping before any footer/signature content
  const messageMatch = body.match(/Message\s*::\s*(.+?)(?=\r?\n\r?\n---|uploading|upload|---|\*\*\*|This email was sent|$)/is);
  const extractedMessage = messageMatch ? stripHtmlTags(messageMatch[1]).trim() : '';

  return {
    name: extractedName || 'Unknown',
    email: extractedEmail,
    phone: extractedPhone,
    company_name: undefined,
    notes: extractedMessage,
    source: 'email_import',
    status: 'new',
    channel: 'email',
    preferred_language: 'EN',
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization');

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error('Unauthorized');

    console.log('Fetching emails...');
    const emails = await fetchNewEmails();
    console.log(`Found ${emails.length} emails`);

    // Log all subjects for debugging
    console.log('All email subjects:');
    emails.forEach((email, index) => {
      console.log(`  [${index + 1}] "${email.subject}"`);
      console.log(`      From: ${email.from}`);
    });

    const enquiryEmails = emails.filter(email => {
      const body = email.body || '';
      const subject = email.subject || '';

      // Check if the email body contains the booking form URL
      // This is the most reliable way to identify website enquiries
      const isEnquiry = body.includes('cpcs-training-courses.co.uk/booking/#form-book');

      console.log(`\n=== EMAIL ${emails.indexOf(email) + 1} ===`);
      console.log(`Subject: "${subject}"`);
      console.log(`From: ${email.from}`);
      console.log(`Body length: ${body.length} chars`);
      console.log(`Body preview: ${body.substring(0, 200)}...`);
      console.log(`Has booking URL: ${isEnquiry}`);
      console.log(`MATCH: ${isEnquiry ? '\u2713 YES' : '\u2717 NO'}`);

      return isEnquiry;
    });

    console.log(`${enquiryEmails.length} enquiry emails out of ${emails.length} total`);

    const createdLeads = [];
    const errors = [];
    const skipped = [];

    const danielUserId = 'bb8f5dec-898a-41a1-8e63-73903558ad43';

    for (const email of enquiryEmails) {
      try {
        const { data: existingLead } = await supabase
          .from('leads')
          .select('id')
          .eq('email_message_id', email.messageId)
          .maybeSingle();

        if (existingLead) {
          console.log(`Lead already exists for message ID: ${email.messageId}`);
          skipped.push({ email: email.from, reason: 'Already imported' });
          continue;
        }

        const leadData = parseEmailToLead(email);
        const { data, error } = await supabase
          .from('leads')
          .insert([{ ...leadData, assigned_to: danielUserId, email_message_id: email.messageId }])
          .select()
          .single();

        if (error) {
          console.error('Failed to create lead:', error);
          errors.push({ email: email.from, error: error.message });
        } else {
          console.log('Lead created successfully');
          createdLeads.push(data);
        }
      } catch (error) {
        console.error('Error processing email:', error);
        errors.push({ email: email.from, error: error.message });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${enquiryEmails.length} of ${emails.length} emails`,
        created: createdLeads.length,
        skipped: skipped.length,
        errors: errors.length,
        leads: createdLeads,
        skippedDetails: skipped,
        errorDetails: errors,
        allEmails: emails.map(e => ({
          subject: e.subject,
          from: e.from,
          bodyLength: e.body.length,
          bodyPreview: e.body.substring(0, 300)
        })),
        enquiryEmails: enquiryEmails.map(e => ({ subject: e.subject, from: e.from })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});