-- ZMC Hub, step 6: tighten who can call the helper functions (from the Supabase security check).
-- Trigger functions run automatically; nobody needs to call them directly.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.invoice_marks_job_done() from public, anon, authenticated;

-- Role helpers are used by the security rules for signed-in people only.
revoke execute on function public.my_role() from public, anon;
revoke execute on function public.my_crew_id() from public, anon;
revoke execute on function public.is_job_lead(uuid) from public, anon;
grant execute on function public.my_role() to authenticated;
grant execute on function public.my_crew_id() to authenticated;
grant execute on function public.is_job_lead(uuid) to authenticated;
