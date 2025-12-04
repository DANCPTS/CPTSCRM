import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser(token);
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { data: userProfile } = await supabaseClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userProfile?.role !== 'admin') {
      throw new Error('Not authorized - admin only');
    }

    const { action, userId, email, password, fullName, role } = await req.json();

    switch (action) {
      case 'create': {
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

        if (authError) throw authError;

        const { error: profileError } = await supabaseAdmin
          .from('users')
          .insert({
            id: authData.user.id,
            email,
            full_name: fullName,
            role,
          });

        if (profileError) throw profileError;

        return new Response(
          JSON.stringify({ success: true, userId: authData.user.id }),
          {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      case 'updatePassword': {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password,
        });

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true }),
          {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      case 'updateRole': {
        const { error } = await supabaseAdmin
          .from('users')
          .update({ role })
          .eq('id', userId);

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true }),
          {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      case 'delete': {
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (authError) throw authError;

        const { error: profileError } = await supabaseAdmin
          .from('users')
          .delete()
          .eq('id', userId);

        if (profileError) throw profileError;

        return new Response(
          JSON.stringify({ success: true }),
          {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      default:
        throw new Error('Invalid action');
    }
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
