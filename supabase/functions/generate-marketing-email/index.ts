import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { prompt, existingSubject, existingBody } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ success: false, error: "Prompt is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const openAIKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAIKey) {
      return new Response(
        JSON.stringify({ success: false, error: "OpenAI API key not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const isModification = existingSubject || existingBody;

    const systemPrompt = isModification
      ? `You are an expert email marketing copywriter for CPCS Training Courses, a professional training company that provides construction equipment training and certification.

You have been given an existing marketing email to modify based on the user's instructions.

EXISTING EMAIL:
Subject: ${existingSubject || '(no subject)'}
Body: ${existingBody || '(no body)'}

Your task is to modify this email according to the user's instructions while:
- Maintaining a professional and engaging tone
- Keeping the email focused on CPCS training benefits
- Preserving any important information unless asked to remove it
- Using proper grammar and professional tone

Return ONLY a JSON object with this exact format:
{
  "subject": "Your modified subject line here",
  "body": "Your modified email body here"
}

Do not include any other text outside the JSON object.`
      : `You are an expert email marketing copywriter for CPCS Training Courses, a professional training company that provides construction equipment training and certification.

Your task is to create compelling marketing emails that:
- Are professional and engaging
- Highlight the benefits of CPCS training and certification
- Include clear calls-to-action
- Are formatted in a clean, readable way
- Use proper grammar and professional tone

Generate both an email subject line and email body. Return ONLY a JSON object with this exact format:
{
  "subject": "Your subject line here",
  "body": "Your email body here"
}

Do not include any other text outside the JSON object.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAIKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("OpenAI API error:", errorData);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to generate email with AI" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();
    const generatedContent = data.choices[0]?.message?.content;

    if (!generatedContent) {
      return new Response(
        JSON.stringify({ success: false, error: "No content generated" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    try {
      const parsedContent = JSON.parse(generatedContent);
      return new Response(
        JSON.stringify({
          success: true,
          subject: parsedContent.subject,
          body: parsedContent.body,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } catch (parseError) {
      console.error("Failed to parse AI response:", generatedContent);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to parse AI response" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    console.error("Error generating marketing email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
