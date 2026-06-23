// Checks for interview reminders due in the current 5-minute window and sends
// them via the "Hub Reminders" Zoho Cliq bot. Called by the pg_cron job every 5 min.
// fired_at on each row acts as the dedup guard — a reminder is sent exactly once.

import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

// Zoho endpoints
const ZOHO_TOKEN_URL = "https://accounts.zoho.com/oauth/v2/token";
const CLIQ_BOT_MESSAGE_URL = "https://cliq.zoho.com/api/v2/bots/hubreminders/message";

// All interview times are treated as IST (Asia/Kolkata, UTC+5:30).
// If the team moves timezone, update this offset.
const IST_OFFSET = "+05:30";

// The cron job runs every 5 min. We catch reminders up to 15 min late
// so a brief job outage doesn't silently drop them.
const CATCH_UP_WINDOW_MS = 15 * 60 * 1000;

Deno.serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date();
    const windowStart = new Date(now.getTime() - CATCH_UP_WINDOW_MS);

    // ── 1. Fetch all unfired, uncancelled reminders ─────────────────────────
    const { data: reminders, error: remErr } = await supabase
      .from("interview_reminders")
      .select("id, lead_time_minutes, mandate_candidate_id")
      .is("fired_at", null)
      .is("cancelled_at", null);

    if (remErr) {
      console.error("[reminders] fetch error:", remErr.message);
      return Response.json({ error: remErr.message }, { status: 500 });
    }
    if (!reminders?.length) {
      return Response.json({ fired: 0, checked: 0 });
    }

    // ── 2. For each reminder, check timing and collect recipients ───────────
    const due: Array<{
      reminderId: string;
      leadTimeMinutes: number;
      candidateName: string;
      mandateTitle: string;
      clientName: string;
      recruiterName: string | null;
      recruiterEmail: string | null;
      amEmail: string | null;
      sameRecruiterAndAm: boolean;
    }> = [];

    for (const r of reminders) {
      // Fetch mandate_candidate
      const { data: mc } = await supabase
        .from("mandate_candidates")
        .select("interview_date, interview_time, linked_by, mandate_id, candidate_id")
        .eq("id", r.mandate_candidate_id)
        .maybeSingle();

      if (!mc?.interview_date || !mc?.interview_time) continue;

      // Compute fire time in IST
      const interviewTs = new Date(
        `${mc.interview_date}T${mc.interview_time.length === 5 ? mc.interview_time : mc.interview_time + ":00"}${IST_OFFSET}`,
      );
      const fireTime = new Date(interviewTs.getTime() - r.lead_time_minutes * 60_000);

      if (fireTime > now || fireTime < windowStart) continue;

      // Fetch mandate + client
      const { data: mandate } = await supabase
        .from("mandates")
        .select("title, am_id, clients(name)")
        .eq("id", mc.mandate_id)
        .maybeSingle();

      // Fetch candidate name
      const { data: candidate } = await supabase
        .from("candidates")
        .select("name")
        .eq("id", mc.candidate_id)
        .maybeSingle();

      // Fetch recruiter profile
      let recruiterName: string | null = null;
      let recruiterEmail: string | null = null;
      if (mc.linked_by) {
        const { data: rp } = await supabase
          .from("profiles")
          .select("name, email")
          .eq("id", mc.linked_by)
          .maybeSingle();
        recruiterName = rp?.name ?? null;
        recruiterEmail = rp?.email ?? null;
      }

      // Fetch AM email (only if AM differs from recruiter)
      let amEmail: string | null = null;
      const sameRecruiterAndAm = !mandate?.am_id || mandate.am_id === mc.linked_by;
      if (mandate?.am_id && !sameRecruiterAndAm) {
        const { data: ap } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", mandate.am_id)
          .maybeSingle();
        amEmail = ap?.email ?? null;
      }

      // Log edge case: no recipients at all
      if (!recruiterEmail && !amEmail) {
        console.warn(
          `[reminders] reminder ${r.id}: no recipients — linked_by and am_id are both null or missing email.` +
          ` mandate_candidate_id=${r.mandate_candidate_id}. Check for bad data.`,
        );
        continue;
      }

      due.push({
        reminderId: r.id,
        leadTimeMinutes: r.lead_time_minutes,
        candidateName: candidate?.name ?? "Unknown Candidate",
        mandateTitle: mandate?.title ?? "Unknown Role",
        clientName: (mandate?.clients as { name?: string } | null)?.name ?? "Unknown Client",
        recruiterName,
        recruiterEmail,
        amEmail,
        sameRecruiterAndAm,
      });
    }

    if (!due.length) {
      return Response.json({ fired: 0, checked: reminders.length });
    }

    // ── 3. Get/refresh Zoho bot access token ────────────────────────────────
    const { data: creds, error: credsErr } = await supabase
      .from("zoho_bot_credentials")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (credsErr || !creds) {
      console.error("[reminders] bot credentials not found:", credsErr?.message);
      return Response.json({ error: "Bot credentials not configured" }, { status: 500 });
    }

    let accessToken: string = creds.access_token ?? "";
    const expiresAt = creds.access_token_expires_at ? new Date(creds.access_token_expires_at) : null;
    const needsRefresh =
      !accessToken || !expiresAt || expiresAt.getTime() < now.getTime() + 2 * 60_000;

    if (needsRefresh) {
      const params = new URLSearchParams({
        grant_type: "refresh_token",
        client_id: creds.client_id,
        client_secret: creds.client_secret,
        refresh_token: creds.refresh_token,
      });
      const tokenRes = await fetch(`${ZOHO_TOKEN_URL}?${params}`, { method: "POST" });
      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) {
        console.error("[reminders] token refresh failed:", JSON.stringify(tokenData));
        return Response.json({ error: "Token refresh failed" }, { status: 500 });
      }
      accessToken = tokenData.access_token;
      const newExpiry = new Date(now.getTime() + (tokenData.expires_in ?? 3600) * 1000);
      await supabase
        .from("zoho_bot_credentials")
        .update({
          access_token: accessToken,
          access_token_expires_at: newExpiry.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("id", creds.id);
    }

    // ── 4. Send messages and mark fired ─────────────────────────────────────
    let firedCount = 0;

    for (const item of due) {
      const baseMsg =
        `Reminder: Interview with ${item.candidateName} for ${item.mandateTitle}` +
        ` at ${item.clientName} starts in ${item.leadTimeMinutes} minutes.`;

      const recipients: Array<{ email: string; text: string }> = [];

      if (item.recruiterEmail) {
        recipients.push({ email: item.recruiterEmail, text: baseMsg });
      }
      if (item.amEmail) {
        const amText = item.recruiterName
          ? `${baseMsg} [Recruiter: ${item.recruiterName}]`
          : baseMsg;
        recipients.push({ email: item.amEmail, text: amText });
      }

      let allSent = true;
      for (const recipient of recipients) {
        const res = await fetch(CLIQ_BOT_MESSAGE_URL, {
          method: "POST",
          headers: {
            "Authorization": `Zoho-oauthtoken ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text: recipient.text, user_unique_name: recipient.email }),
        });

        if (!res.ok) {
          const body = await res.text();
          console.error(
            `[reminders] Cliq message failed for ${recipient.email}:`,
            res.status,
            body,
          );
          allSent = false;
        }
      }

      // Only mark fired if every recipient was successfully notified
      if (allSent) {
        await supabase
          .from("interview_reminders")
          .update({ fired_at: now.toISOString() })
          .eq("id", item.reminderId);
        firedCount++;
      }
    }

    return Response.json({ fired: firedCount, checked: reminders.length, due: due.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[reminders] unexpected error:", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
});
