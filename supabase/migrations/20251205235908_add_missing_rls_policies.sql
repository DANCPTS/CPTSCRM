/*
  # Add Missing RLS Policies

  1. Issue
    - Many tables have RLS enabled but no policies
    - This blocks all access to the data
    
  2. Solution
    - Add SELECT, INSERT, UPDATE, DELETE policies for all missing tables
    - Allow authenticated users to access all data
    
  3. Tables Fixed
    - attendance
    - booking_forms (has some policies but incomplete)
    - bookings
    - calendar_settings
    - campaign_recipients
    - candidate_courses
    - companies
    - contacts
    - course_accreditation_pricing
    - course_runs
    - courses
    - email_templates
    - leads
    - marketing_campaigns
    - note_extractions
    - notes
    - notifications
    - oauth_tokens
    - trainer_certifications
    - trainers
    - training_sessions
*/

-- Attendance policies
CREATE POLICY "Authenticated users can view attendance"
  ON attendance FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert attendance"
  ON attendance FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update attendance"
  ON attendance FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete attendance"
  ON attendance FOR DELETE
  TO authenticated
  USING (true);

-- Bookings policies
CREATE POLICY "Authenticated users can view bookings"
  ON bookings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert bookings"
  ON bookings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update bookings"
  ON bookings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete bookings"
  ON bookings FOR DELETE
  TO authenticated
  USING (true);

-- Calendar settings policies
CREATE POLICY "Authenticated users can view calendar settings"
  ON calendar_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert calendar settings"
  ON calendar_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update calendar settings"
  ON calendar_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete calendar settings"
  ON calendar_settings FOR DELETE
  TO authenticated
  USING (true);

-- Campaign recipients policies
CREATE POLICY "Authenticated users can view campaign recipients"
  ON campaign_recipients FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert campaign recipients"
  ON campaign_recipients FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update campaign recipients"
  ON campaign_recipients FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete campaign recipients"
  ON campaign_recipients FOR DELETE
  TO authenticated
  USING (true);

-- Candidate courses policies
CREATE POLICY "Authenticated users can view candidate courses"
  ON candidate_courses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert candidate courses"
  ON candidate_courses FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update candidate courses"
  ON candidate_courses FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete candidate courses"
  ON candidate_courses FOR DELETE
  TO authenticated
  USING (true);

-- Companies policies
CREATE POLICY "Authenticated users can view companies"
  ON companies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update companies"
  ON companies FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete companies"
  ON companies FOR DELETE
  TO authenticated
  USING (true);

-- Contacts policies
CREATE POLICY "Authenticated users can view contacts"
  ON contacts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert contacts"
  ON contacts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update contacts"
  ON contacts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete contacts"
  ON contacts FOR DELETE
  TO authenticated
  USING (true);

-- Course accreditation pricing policies
CREATE POLICY "Authenticated users can view course accreditation pricing"
  ON course_accreditation_pricing FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert course accreditation pricing"
  ON course_accreditation_pricing FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update course accreditation pricing"
  ON course_accreditation_pricing FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete course accreditation pricing"
  ON course_accreditation_pricing FOR DELETE
  TO authenticated
  USING (true);

-- Course runs policies
CREATE POLICY "Authenticated users can view course runs"
  ON course_runs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert course runs"
  ON course_runs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update course runs"
  ON course_runs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete course runs"
  ON course_runs FOR DELETE
  TO authenticated
  USING (true);

-- Courses policies
CREATE POLICY "Authenticated users can view courses"
  ON courses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert courses"
  ON courses FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update courses"
  ON courses FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete courses"
  ON courses FOR DELETE
  TO authenticated
  USING (true);

-- Email templates policies
CREATE POLICY "Authenticated users can view email templates"
  ON email_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert email templates"
  ON email_templates FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update email templates"
  ON email_templates FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete email templates"
  ON email_templates FOR DELETE
  TO authenticated
  USING (true);

-- Leads policies
CREATE POLICY "Authenticated users can view leads"
  ON leads FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert leads"
  ON leads FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update leads"
  ON leads FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete leads"
  ON leads FOR DELETE
  TO authenticated
  USING (true);

-- Marketing campaigns policies
CREATE POLICY "Authenticated users can view marketing campaigns"
  ON marketing_campaigns FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert marketing campaigns"
  ON marketing_campaigns FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update marketing campaigns"
  ON marketing_campaigns FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete marketing campaigns"
  ON marketing_campaigns FOR DELETE
  TO authenticated
  USING (true);

-- Note extractions policies
CREATE POLICY "Authenticated users can view note extractions"
  ON note_extractions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert note extractions"
  ON note_extractions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update note extractions"
  ON note_extractions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete note extractions"
  ON note_extractions FOR DELETE
  TO authenticated
  USING (true);

-- Notes policies
CREATE POLICY "Authenticated users can view notes"
  ON notes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert notes"
  ON notes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update notes"
  ON notes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete notes"
  ON notes FOR DELETE
  TO authenticated
  USING (true);

-- Notifications policies
CREATE POLICY "Authenticated users can view notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (true);

-- OAuth tokens policies
CREATE POLICY "Authenticated users can view oauth tokens"
  ON oauth_tokens FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert oauth tokens"
  ON oauth_tokens FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update oauth tokens"
  ON oauth_tokens FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete oauth tokens"
  ON oauth_tokens FOR DELETE
  TO authenticated
  USING (true);

-- Trainer certifications policies
CREATE POLICY "Authenticated users can view trainer certifications"
  ON trainer_certifications FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert trainer certifications"
  ON trainer_certifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update trainer certifications"
  ON trainer_certifications FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete trainer certifications"
  ON trainer_certifications FOR DELETE
  TO authenticated
  USING (true);

-- Trainers policies
CREATE POLICY "Authenticated users can view trainers"
  ON trainers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert trainers"
  ON trainers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update trainers"
  ON trainers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete trainers"
  ON trainers FOR DELETE
  TO authenticated
  USING (true);

-- Training sessions policies
CREATE POLICY "Authenticated users can view training sessions"
  ON training_sessions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert training sessions"
  ON training_sessions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update training sessions"
  ON training_sessions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete training sessions"
  ON training_sessions FOR DELETE
  TO authenticated
  USING (true);
