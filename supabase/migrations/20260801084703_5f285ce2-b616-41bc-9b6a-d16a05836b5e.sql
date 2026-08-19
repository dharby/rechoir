
-- Broadcasts
CREATE POLICY "page admin manages broadcasts" ON public.broadcasts FOR ALL TO authenticated
USING (public.has_admin_page(auth.uid(),'broadcast') AND team_id = public.get_user_team_id(auth.uid()))
WITH CHECK (public.has_admin_page(auth.uid(),'broadcast') AND team_id = public.get_user_team_id(auth.uid()) AND sender_id = auth.uid());

-- Songs
CREATE POLICY "page admin manages songs" ON public.songs FOR ALL TO authenticated
USING (public.has_admin_page(auth.uid(),'songs') AND team_id = public.get_user_team_id(auth.uid()))
WITH CHECK (public.has_admin_page(auth.uid(),'songs') AND team_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "page admin manages song assignments" ON public.song_assignments FOR ALL TO authenticated
USING (public.has_admin_page(auth.uid(),'songs') AND EXISTS (SELECT 1 FROM public.songs s WHERE s.id = song_assignments.song_id AND s.team_id = public.get_user_team_id(auth.uid())))
WITH CHECK (public.has_admin_page(auth.uid(),'songs') AND EXISTS (SELECT 1 FROM public.songs s WHERE s.id = song_assignments.song_id AND s.team_id = public.get_user_team_id(auth.uid())));

-- Rehearsals
CREATE POLICY "page admin manages rehearsals" ON public.rehearsals FOR ALL TO authenticated
USING (public.has_admin_page(auth.uid(),'rehearsals') AND team_id = public.get_user_team_id(auth.uid()))
WITH CHECK (public.has_admin_page(auth.uid(),'rehearsals') AND team_id = public.get_user_team_id(auth.uid()));

-- Attendance (rehearsal attendance + service events/attendance)
CREATE POLICY "page admin manages attendance" ON public.attendance FOR ALL TO authenticated
USING (public.has_admin_page(auth.uid(),'attendance') AND EXISTS (SELECT 1 FROM public.rehearsals r WHERE r.id = attendance.rehearsal_id AND r.team_id = public.get_user_team_id(auth.uid())))
WITH CHECK (public.has_admin_page(auth.uid(),'attendance') AND EXISTS (SELECT 1 FROM public.rehearsals r WHERE r.id = attendance.rehearsal_id AND r.team_id = public.get_user_team_id(auth.uid())));

CREATE POLICY "page admin manages service events" ON public.service_events FOR ALL TO authenticated
USING ((public.has_admin_page(auth.uid(),'attendance') OR public.has_admin_page(auth.uid(),'rehearsals')) AND team_id = public.get_user_team_id(auth.uid()))
WITH CHECK ((public.has_admin_page(auth.uid(),'attendance') OR public.has_admin_page(auth.uid(),'rehearsals')) AND team_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "page admin manages service attendance" ON public.service_attendance FOR ALL TO authenticated
USING (public.has_admin_page(auth.uid(),'attendance') AND EXISTS (SELECT 1 FROM public.service_events e WHERE e.id = service_attendance.event_id AND e.team_id = public.get_user_team_id(auth.uid())))
WITH CHECK (public.has_admin_page(auth.uid(),'attendance') AND EXISTS (SELECT 1 FROM public.service_events e WHERE e.id = service_attendance.event_id AND e.team_id = public.get_user_team_id(auth.uid())));

-- Payments
CREATE POLICY "page admin manages due payments" ON public.due_payments FOR ALL TO authenticated
USING (public.has_admin_page(auth.uid(),'payments') AND team_id = public.get_user_team_id(auth.uid()))
WITH CHECK (public.has_admin_page(auth.uid(),'payments') AND team_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "page admin manages payment records" ON public.payment_records FOR ALL TO authenticated
USING (public.has_admin_page(auth.uid(),'payments') AND EXISTS (SELECT 1 FROM public.due_payments d WHERE d.id = payment_records.payment_id AND d.team_id = public.get_user_team_id(auth.uid())))
WITH CHECK (public.has_admin_page(auth.uid(),'payments') AND EXISTS (SELECT 1 FROM public.due_payments d WHERE d.id = payment_records.payment_id AND d.team_id = public.get_user_team_id(auth.uid())));

-- Checklists
CREATE POLICY "page admin manages checklists" ON public.weekly_checklists FOR ALL TO authenticated
USING (public.has_admin_page(auth.uid(),'checklists') AND team_id = public.get_user_team_id(auth.uid()))
WITH CHECK (public.has_admin_page(auth.uid(),'checklists') AND team_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "page admin manages checklist items" ON public.checklist_items FOR ALL TO authenticated
USING (public.has_admin_page(auth.uid(),'checklists') AND EXISTS (SELECT 1 FROM public.weekly_checklists c WHERE c.id = checklist_items.checklist_id AND c.team_id = public.get_user_team_id(auth.uid())))
WITH CHECK (public.has_admin_page(auth.uid(),'checklists') AND EXISTS (SELECT 1 FROM public.weekly_checklists c WHERE c.id = checklist_items.checklist_id AND c.team_id = public.get_user_team_id(auth.uid())));

CREATE POLICY "page admin manages checklist assignees" ON public.checklist_item_assignees FOR ALL TO authenticated
USING (public.has_admin_page(auth.uid(),'checklists') AND EXISTS (SELECT 1 FROM public.checklist_items ci JOIN public.weekly_checklists wc ON wc.id = ci.checklist_id WHERE ci.id = checklist_item_assignees.item_id AND wc.team_id = public.get_user_team_id(auth.uid())))
WITH CHECK (public.has_admin_page(auth.uid(),'checklists') AND EXISTS (SELECT 1 FROM public.checklist_items ci JOIN public.weekly_checklists wc ON wc.id = ci.checklist_id WHERE ci.id = checklist_item_assignees.item_id AND wc.team_id = public.get_user_team_id(auth.uid())));

-- Prayer chains
CREATE POLICY "page admin manages prayer chains" ON public.prayer_chains FOR ALL TO authenticated
USING (public.has_admin_page(auth.uid(),'prayer-chains') AND team_id = public.get_user_team_id(auth.uid()))
WITH CHECK (public.has_admin_page(auth.uid(),'prayer-chains') AND team_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "page admin manages prayer assignments" ON public.prayer_chain_assignments FOR ALL TO authenticated
USING (public.has_admin_page(auth.uid(),'prayer-chains') AND EXISTS (SELECT 1 FROM public.prayer_chains pc WHERE pc.id = prayer_chain_assignments.chain_id AND pc.team_id = public.get_user_team_id(auth.uid())))
WITH CHECK (public.has_admin_page(auth.uid(),'prayer-chains') AND EXISTS (SELECT 1 FROM public.prayer_chains pc WHERE pc.id = prayer_chain_assignments.chain_id AND pc.team_id = public.get_user_team_id(auth.uid())));

CREATE POLICY "page admin manages prayer leader schedule" ON public.prayer_leader_schedule FOR ALL TO authenticated
USING (public.has_admin_page(auth.uid(),'prayer-chains') AND team_id = public.get_user_team_id(auth.uid()))
WITH CHECK (public.has_admin_page(auth.uid(),'prayer-chains') AND team_id = public.get_user_team_id(auth.uid()));

-- Uniforms
CREATE POLICY "page admin manages uniform events" ON public.uniform_events FOR ALL TO authenticated
USING (public.has_admin_page(auth.uid(),'uniforms') AND team_id = public.get_user_team_id(auth.uid()))
WITH CHECK (public.has_admin_page(auth.uid(),'uniforms') AND team_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "page admin manages uniform readiness" ON public.uniform_readiness FOR ALL TO authenticated
USING (public.has_admin_page(auth.uid(),'uniforms') AND EXISTS (SELECT 1 FROM public.uniform_events e WHERE e.id = uniform_readiness.event_id AND e.team_id = public.get_user_team_id(auth.uid())))
WITH CHECK (public.has_admin_page(auth.uid(),'uniforms') AND EXISTS (SELECT 1 FROM public.uniform_events e WHERE e.id = uniform_readiness.event_id AND e.team_id = public.get_user_team_id(auth.uid())));

-- Members page admins may update team profiles, but never role/admin fields escalation on leads
CREATE POLICY "page admin updates team profiles" ON public.profiles FOR UPDATE TO authenticated
USING (public.has_admin_page(auth.uid(),'members') AND team_id = public.get_user_team_id(auth.uid()) AND role <> 'team_lead')
WITH CHECK (public.has_admin_page(auth.uid(),'members') AND team_id = public.get_user_team_id(auth.uid()) AND role <> 'team_lead');

-- Chat moderation
CREATE POLICY "page admin deletes chat messages" ON public.chat_messages FOR DELETE TO authenticated
USING (public.has_admin_page(auth.uid(),'chat') AND team_id = public.get_user_team_id(auth.uid()));
