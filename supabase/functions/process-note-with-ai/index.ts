import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ProcessNoteRequest {
  noteId: string;
  content: string;
  entityType?: 'lead' | 'company' | 'candidate' | 'booking';
  entityId?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY is not configured. Please add your OpenAI API key in Supabase Dashboard → Project Settings → Edge Functions → Secrets' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { noteId, content, entityType, entityId }: ProcessNoteRequest = await req.json();

    if (!noteId || !content) {
      return new Response(
        JSON.stringify({ error: 'noteId and content are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Call OpenAI API to extract structured data
    const today = new Date().toISOString().split('T')[0];
    const systemPrompt = `You are an AI assistant that extracts structured information from meeting and call notes for a training company CRM.

Today's date is ${today}. When calculating due dates from relative time references (e.g., "in 2 days", "next week"), calculate from today's date.

Extract the following from the notes:
1. Action items (things that need to be done)
2. Important dates mentioned
3. People mentioned (names, roles)
4. Commitments made (by either party)
5. Overall sentiment (positive, neutral, negative)
6. Priority level (high, medium, low)
7. Suggested next status (if discussing a lead: new, contacted, proposal_sent, won, lost)

Return a JSON object with this structure:
{
  "action_items": [{"description": string, "assignee": string | null, "due_date": string | null (YYYY-MM-DD format, calculated from today: ${today})}],
  "dates": [{"date": string, "context": string}],
  "people": [{"name": string, "role": string | null, "context": string}],
  "commitments": [{"party": string, "commitment": string}],
  "sentiment": "positive" | "neutral" | "negative",
  "priority": "high" | "medium" | "low",
  "suggested_status": string | null,
  "summary": string
}`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Extract information from these notes:\n\n${content}` },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      }),
    });

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const openaiData = await openaiResponse.json();
    const extractedData = JSON.parse(openaiData.choices[0].message.content);
    const tokensUsed = openaiData.usage?.total_tokens || 0;

    // Save extraction to database
    const { data: extraction, error: extractionError } = await supabase
      .from('note_extractions')
      .insert({
        note_id: noteId,
        action_items: extractedData.action_items || [],
        dates: extractedData.dates || [],
        people: extractedData.people || [],
        commitments: extractedData.commitments || [],
        sentiment: extractedData.sentiment || 'neutral',
        priority: extractedData.priority || 'medium',
        suggested_status: extractedData.suggested_status,
        extracted_data: extractedData,
        model_used: 'gpt-4o-mini',
        tokens_used: tokensUsed,
      })
      .select()
      .single();

    if (extractionError) {
      throw extractionError;
    }

    // Update note to mark as processed
    await supabase
      .from('notes')
      .update({
        ai_processed: true,
        ai_processed_at: new Date().toISOString(),
      })
      .eq('id', noteId);

    // Auto-create tasks from action items
    const tasksToCreate = extractedData.action_items
      ?.filter((item: any) => item.description)
      .map((item: any) => ({
        title: item.description,
        status: 'open',
        due_date: item.due_date || null,
        related_to_type: entityType || null,
        related_to_id: entityId || null,
        assigned_to: user.id,
      }));

    if (tasksToCreate && tasksToCreate.length > 0) {
      const { error: taskError } = await supabase.from('tasks').insert(tasksToCreate);
      if (taskError) {
        console.error('Failed to create tasks:', taskError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        extraction,
        tasks_created: tasksToCreate?.length || 0,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error processing note:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});