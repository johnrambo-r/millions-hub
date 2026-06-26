// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    try {
      // ctx.supabase is now already scoped to the caller's own session — no need to manually
      // create a client or call getUser() separately, though we still do need their user id
      const { data: callerData, error: callerError } = await ctx.supabase.auth.getUser();
      if (callerError || !callerData?.user) {
        return Response.json({ error: "Invalid or expired session" }, { status: 401 });
      }
      const currentUserId = callerData.user.id;

      const { data: callerProfile, error: callerProfileError } = await ctx.supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", currentUserId)
        .single();

      if (callerProfileError || !callerProfile || callerProfile.role !== "founder") {
        return Response.json({ error: "Not authorized to invite users" }, { status: 403 });
      }

      const { name, email, role } = await req.json();
      if (!name?.trim() || !email?.trim() || !role) {
        return Response.json({ error: "Name, email, and role are required" }, { status: 400 });
      }

      const { data: authData, error: authError } = await ctx.supabaseAdmin.auth.admin.inviteUserByEmail(
        email.trim(),
        {
          data: { name: name.trim() },
          redirectTo: "https://millions-hub.pages.dev/",
        },
      );

      if (authError) {
        return Response.json({ error: authError.message }, { status: 400 });
      }

      const userId = authData.user.id;
      const now = new Date().toISOString();

      const { error: profileError } = await ctx.supabaseAdmin
        .from("profiles")
        .upsert({
          id: userId,
          name: name.trim(),
          email: email.trim(),
          role,
          active: true,
          invited_by: currentUserId,
          created_at: now,
          updated_at: now,
        });

      if (profileError) {
        return Response.json({ error: profileError.message }, { status: 400 });
      }

      return Response.json({
        id: userId,
        name: name.trim(),
        email: email.trim(),
        role,
        active: true,
        created_at: now,
      });
    } catch (err) {
      return Response.json({ error: err?.message ?? "Unexpected error" }, { status: 500 });
    }
  }),
};

/* To invoke locally:
  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request, with the caller's own user JWT as the apiKey/Authorization:
  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/invite-user' \
    --header 'Authorization: Bearer YOUR_USER_JWT' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Test User","email":"test@millionsadvisory.com","role":"recruiter"}'
*/
