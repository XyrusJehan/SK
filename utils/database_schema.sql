-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.barangays (
  barangay_id integer NOT NULL DEFAULT nextval('barangays_barangay_id_seq'::regclass),
  barangay_name character varying NOT NULL,
  municipality character varying NOT NULL,
  province character varying NOT NULL,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT barangays_pkey PRIMARY KEY (barangay_id)
);
CREATE TABLE public.budget_allocations (
  allocation_id integer NOT NULL DEFAULT nextval('budget_allocations_allocation_id_seq'::regclass),
  barangay_id integer NOT NULL,
  forwarded_by integer,
  fiscal_year integer NOT NULL,
  amount numeric NOT NULL,
  workflow_status character varying DEFAULT 'sk_submitted'::character varying CHECK (workflow_status::text = ANY (ARRAY['sk_submitted'::character varying, 'under_review'::character varying, 'forwarded'::character varying]::text[])),
  notes text,
  date_received date,
  submitted_at timestamp without time zone,
  reviewed_at timestamp without time zone,
  forwarded_at timestamp without time zone,
  CONSTRAINT budget_allocations_pkey PRIMARY KEY (allocation_id),
  CONSTRAINT budget_allocations_barangay_id_fkey FOREIGN KEY (barangay_id) REFERENCES public.barangays(barangay_id),
  CONSTRAINT budget_allocations_forwarded_by_fkey FOREIGN KEY (forwarded_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.compliance_documents (
  compliance_id integer NOT NULL DEFAULT nextval('compliance_documents_compliance_id_seq'::regclass),
  barangay_id integer NOT NULL,
  uploaded_by integer NOT NULL,
  deadline_id integer,
  title character varying NOT NULL,
  document_type character varying NOT NULL,
  scanned_file_url character varying NOT NULL,
  remarks text,
  upload_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT compliance_documents_pkey PRIMARY KEY (compliance_id),
  CONSTRAINT compliance_documents_barangay_id_fkey FOREIGN KEY (barangay_id) REFERENCES public.barangays(barangay_id),
  CONSTRAINT compliance_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(user_id),
  CONSTRAINT compliance_documents_deadline_id_fkey FOREIGN KEY (deadline_id) REFERENCES public.submission_deadlines(deadline_id)
);
CREATE TABLE public.document_versions (
  version_id integer NOT NULL DEFAULT nextval('document_versions_version_id_seq'::regclass),
  document_id integer NOT NULL,
  version_number integer NOT NULL,
  file_url character varying NOT NULL,
  action character varying NOT NULL CHECK (action::text = ANY (ARRAY['submitted'::character varying, 'approved'::character varying, 'returned'::character varying]::text[])),
  actioned_by integer NOT NULL,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT document_versions_pkey PRIMARY KEY (version_id),
  CONSTRAINT document_versions_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(document_id),
  CONSTRAINT document_versions_actioned_by_fkey FOREIGN KEY (actioned_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.documents (
  document_id integer NOT NULL DEFAULT nextval('documents_document_id_seq'::regclass),
  barangay_id integer NOT NULL,
  submitted_by integer NOT NULL,
  reviewed_by integer,
  template_id integer,
  title character varying NOT NULL,
  folder_category character varying NOT NULL CHECK (folder_category::text = ANY (ARRAY['planning'::character varying, 'financial'::character varying, 'governance'::character varying, 'performance'::character varying]::text[])),
  document_type character varying NOT NULL,
  status character varying DEFAULT 'draft'::character varying CHECK (status::text = ANY (ARRAY['draft'::character varying, 'saved'::character varying, 'submitted'::character varying, 'approved'::character varying, 'returned'::character varying, 'published'::character varying]::text[])),
  current_version integer DEFAULT 1,
  year integer NOT NULL,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  saved_at timestamp without time zone,
  submitted_at timestamp without time zone,
  reviewed_at timestamp without time zone,
  CONSTRAINT documents_pkey PRIMARY KEY (document_id),
  CONSTRAINT documents_barangay_id_fkey FOREIGN KEY (barangay_id) REFERENCES public.barangays(barangay_id),
  CONSTRAINT documents_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(user_id),
  CONSTRAINT documents_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(user_id),
  CONSTRAINT documents_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(template_id)
);
CREATE TABLE public.lydo_comments (
  comment_id integer NOT NULL DEFAULT nextval('lydo_comments_comment_id_seq'::regclass),
  version_id integer NOT NULL,
  document_id integer NOT NULL,
  commented_by integer NOT NULL,
  content text NOT NULL,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT lydo_comments_pkey PRIMARY KEY (comment_id),
  CONSTRAINT lydo_comments_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.document_versions(version_id),
  CONSTRAINT lydo_comments_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(document_id),
  CONSTRAINT lydo_comments_commented_by_fkey FOREIGN KEY (commented_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.notifications (
  notification_id integer NOT NULL DEFAULT nextval('notifications_notification_id_seq'::regclass),
  recipient_id integer NOT NULL,
  reference_id integer,
  reference_type character varying CHECK (reference_type::text = ANY (ARRAY['document'::character varying, 'template'::character varying, 'budget'::character varying, 'deadline'::character varying, 'comment'::character varying]::text[])),
  type character varying NOT NULL CHECK (type::text = ANY (ARRAY['document_submitted'::character varying, 'document_approved'::character varying, 'document_returned'::character varying, 'new_template_forwarded'::character varying, 'budget_forwarded'::character varying, 'new_resident_comment'::character varying, 'deadline_reminder'::character varying, 'budget_alert'::character varying]::text[])),
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT notifications_pkey PRIMARY KEY (notification_id),
  CONSTRAINT notifications_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.policy_board_posts (
  board_post_id integer NOT NULL DEFAULT nextval('policy_board_posts_board_post_id_seq'::regclass),
  barangay_id integer NOT NULL,
  document_id integer NOT NULL,
  is_posted boolean DEFAULT false,
  posted_at timestamp without time zone,
  verified_by integer,
  verified_at timestamp without time zone,
  CONSTRAINT policy_board_posts_pkey PRIMARY KEY (board_post_id),
  CONSTRAINT policy_board_posts_barangay_id_fkey FOREIGN KEY (barangay_id) REFERENCES public.barangays(barangay_id),
  CONSTRAINT policy_board_posts_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(document_id),
  CONSTRAINT policy_board_posts_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.resident_comments (
  comment_id integer NOT NULL DEFAULT nextval('resident_comments_comment_id_seq'::regclass),
  website_post_id integer NOT NULL,
  resident_id integer NOT NULL,
  content text NOT NULL,
  is_read boolean DEFAULT false,
  is_flagged boolean DEFAULT false,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT resident_comments_pkey PRIMARY KEY (comment_id),
  CONSTRAINT resident_comments_post_id_fkey FOREIGN KEY (website_post_id) REFERENCES public.website_posts(website_post_id),
  CONSTRAINT resident_comments_resident_id_fkey FOREIGN KEY (resident_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.roles (
  role_id integer NOT NULL DEFAULT nextval('roles_role_id_seq'::regclass),
  role_name character varying NOT NULL UNIQUE,
  CONSTRAINT roles_pkey PRIMARY KEY (role_id)
);
CREATE TABLE public.sk_replies (
  reply_id integer NOT NULL DEFAULT nextval('sk_replies_reply_id_seq'::regclass),
  comment_id integer NOT NULL,
  replied_by integer NOT NULL,
  content text NOT NULL,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT sk_replies_pkey PRIMARY KEY (reply_id),
  CONSTRAINT sk_replies_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.resident_comments(comment_id),
  CONSTRAINT sk_replies_replied_by_fkey FOREIGN KEY (replied_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.submission_deadlines (
  deadline_id integer NOT NULL DEFAULT nextval('submission_deadlines_deadline_id_seq'::regclass),
  barangay_id integer NOT NULL,
  created_by integer NOT NULL,
  document_type character varying NOT NULL,
  description text,
  deadline_date date NOT NULL,
  is_met boolean DEFAULT false,
  met_at timestamp without time zone,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT submission_deadlines_pkey PRIMARY KEY (deadline_id),
  CONSTRAINT submission_deadlines_barangay_id_fkey FOREIGN KEY (barangay_id) REFERENCES public.barangays(barangay_id),
  CONSTRAINT submission_deadlines_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.template_distributions (
  distribution_id integer NOT NULL DEFAULT nextval('template_distributions_distribution_id_seq'::regclass),
  template_id integer NOT NULL,
  barangay_id integer NOT NULL,
  distributed_by integer NOT NULL,
  is_acknowledged boolean DEFAULT false,
  distributed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  acknowledged_at timestamp without time zone,
  CONSTRAINT template_distributions_pkey PRIMARY KEY (distribution_id),
  CONSTRAINT template_distributions_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(template_id),
  CONSTRAINT template_distributions_barangay_id_fkey FOREIGN KEY (barangay_id) REFERENCES public.barangays(barangay_id),
  CONSTRAINT template_distributions_distributed_by_fkey FOREIGN KEY (distributed_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.templates (
  template_id integer NOT NULL DEFAULT nextval('templates_template_id_seq'::regclass),
  uploaded_by integer NOT NULL,
  replaces_id integer,
  title character varying NOT NULL,
  description text,
  file_url character varying NOT NULL,
  version integer DEFAULT 1,
  status character varying DEFAULT 'draft'::character varying CHECK (status::text = ANY (ARRAY['draft'::character varying, 'active'::character varying, 'archived'::character varying]::text[])),
  template_category character varying NOT NULL CHECK (template_category::text = ANY (ARRAY['planning'::character varying, 'budgeting'::character varying, 'financial_records'::character varying, 'monitoring_evaluation'::character varying]::text[])),
  document_type character varying NOT NULL,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT templates_pkey PRIMARY KEY (template_id),
  CONSTRAINT templates_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(user_id),
  CONSTRAINT templates_replaces_id_fkey FOREIGN KEY (replaces_id) REFERENCES public.templates(template_id)
);
CREATE TABLE public.users (
  user_id integer NOT NULL DEFAULT nextval('users_user_id_seq'::regclass),
  role_id integer NOT NULL,
  barangay_id integer,
  first_name character varying NOT NULL,
  last_name character varying NOT NULL,
  email character varying NOT NULL UNIQUE,
  password character varying NOT NULL,
  position character varying CHECK ("position"::text = ANY (ARRAY['chairman'::character varying, 'secretary'::character varying, 'treasurer'::character varying]::text[])),
  status character varying DEFAULT 'active'::character varying CHECK (status::text = ANY (ARRAY['active'::character varying, 'inactive'::character varying, 'pending'::character varying]::text[])),
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT users_pkey PRIMARY KEY (user_id),
  CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(role_id),
  CONSTRAINT users_barangay_id_fkey FOREIGN KEY (barangay_id) REFERENCES public.barangays(barangay_id)
);
CREATE TABLE public.website_posts (
  website_post_id integer NOT NULL DEFAULT nextval('website_posts_website_post_id_seq'::regclass),
  barangay_id integer NOT NULL,
  document_id integer,
  published_by integer NOT NULL,
  title character varying NOT NULL,
  description text,
  document_category character varying,
  year integer,
  file_url character varying,
  portal_status character varying DEFAULT 'draft'::character varying CHECK (portal_status::text = ANY (ARRAY['draft'::character varying, 'published'::character varying, 'unpublished'::character varying]::text[])),
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  published_at timestamp without time zone,
  unpublished_at timestamp without time zone,
  CONSTRAINT website_posts_pkey PRIMARY KEY (website_post_id),
  CONSTRAINT website_posts_barangay_id_fkey FOREIGN KEY (barangay_id) REFERENCES public.barangays(barangay_id),
  CONSTRAINT website_posts_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(document_id),
  CONSTRAINT website_posts_published_by_fkey FOREIGN KEY (published_by) REFERENCES public.users(user_id)
);