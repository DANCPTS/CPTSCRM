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
    const { prompt, existingSubject, existingBody, templateHtml, generationMode } = await req.json();

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
    const hasTemplate = templateHtml && generationMode;

    let systemPrompt: string;

    if (hasTemplate && generationMode === "rewrite_content") {
      systemPrompt = `You are an expert email marketing copywriter for CPCS Training Courses, a professional training company that provides construction equipment training and certification.

You have been given an imported HTML email template. Your task is to REPLACE the marketing copy while PRESERVING the original HTML structure, layout, formatting, section order, buttons, links, and responsive behaviour.

IMPORTED TEMPLATE HTML:
${templateHtml}

RULES:
- Keep ALL HTML structure, tables, inline CSS, colours, fonts, spacing, and responsive media queries exactly as they are.
- Replace ONLY the text content (headings, paragraphs, button labels, alt text) to match the user's campaign brief.
- Preserve any personalisation variables like {{first_name}}, {{company_name}}, {{unsubscribe_url}}.
- Do NOT invent prices, statistics, testimonials, guarantees, or legal claims.
- Maintain a professional and engaging tone.
- Keep the email focused on CPCS training benefits unless the user specifies otherwise.

Return ONLY a JSON object with this exact format:
{
  "subject": "Your new subject line",
  "body": "The full HTML email body with your new copy inserted into the original template structure"
}

Do not include any other text outside the JSON object.`;
    } else if (hasTemplate && generationMode === "inspiration") {
      systemPrompt = `You are an expert email marketing copywriter for CPCS Training Courses, a professional training company that provides construction equipment training and certification.

You have been given an HTML email template for INSPIRATION. Use its style, tone, and structure as a reference when creating new email content, but generate fresh HTML that follows similar design patterns.

REFERENCE TEMPLATE (for style inspiration only):
${templateHtml}

RULES:
- Create new content inspired by the template's style and tone.
- Maintain a professional and engaging tone.
- Keep the email focused on CPCS training benefits unless the user specifies otherwise.
- Preserve any personalisation variables like {{first_name}}, {{company_name}}, {{unsubscribe_url}}.
- Do NOT invent prices, statistics, testimonials, guarantees, or legal claims.
- Include clear calls-to-action.

Return ONLY a JSON object with this exact format:
{
  "subject": "Your subject line here",
  "body": "Your email body here"
}

Do not include any other text outside the JSON object.`;
    } else if (isModification) {
      systemPrompt = `You are an expert email marketing copywriter for CPCS Training Courses, a professional training company that provides construction equipment training and certification.

You have been given an existing marketing email to modify based on the user's instructions.

EXISTING EMAIL:
Subject: ${existingSubject || '(no subject)'}
Body: ${existingBody || '(no body)'}

Your task is to modify this email according to the user's instructions while:
- Maintaining a professional and engaging tone
- Keeping the email focused on CPCS training benefits
- Preserving any important information unless asked to remove it
- Using proper grammar and professional tone
- Preserving any personalisation variables like {{first_name}}, {{company_name}}, {{unsubscribe_url}}
- Do NOT invent prices, statistics, testimonials, guarantees, or legal claims

Return ONLY a JSON object with this exact format:
{
  "subject": "Your modified subject line here",
  "body": "Your modified email body here"
}

Do not include any other text outside the JSON object.`;
    } else {
      systemPrompt = `You are an expert email marketing copywriter for CPCS Training Courses, a professional training company that provides construction equipment training and certification.

Your task is to create compelling marketing emails that:
- Are professional and engaging
- Highlight the benefits of CPCS training and certification
- Include clear calls-to-action
- Are formatted in a clean, readable way
- Use proper grammar and professional tone
- Do NOT invent prices, statistics, testimonials, guarantees, or legal claims

Generate both an email subject line and email body. Return ONLY a JSON object with this exact format:
{
  "subject": "Your subject line here",
  "body": "Your email body here"
}

Do not include any other text outside the JSON object.`;
    }

    const maxTokens = hasTemplate ? 4000 : 1000;

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
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("OpenAI API error:", errorData);
      let errorMessage = "Failed to generate email with AI";
      try {
        const parsed = JSON.parse(errorData);
        errorMessage = parsed?.error?.message || errorMessage;
      } catch (_) {}
      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
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
      let jsonStr = generatedContent.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
      }
      const parsedContent = JSON.parse(jsonStr);
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
