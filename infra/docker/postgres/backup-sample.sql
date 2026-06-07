--
-- PostgreSQL database dump
--

\restrict V3OkI5mcMEg1t1H5TJq7qtKKHWSdJwAUsOHK7wvWd3zXUrIcVqDQ2Ar9f1BoMdm

-- Dumped from database version 16.14
-- Dumped by pg_dump version 16.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: citext; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;


--
-- Name: EXTENSION citext; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION citext IS 'data type for case-insensitive character strings';


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA public;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: __EFMigrationsHistory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."__EFMigrationsHistory" (
    "MigrationId" character varying(150) NOT NULL,
    "ProductVersion" character varying(32) NOT NULL
);


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    actor_user_id uuid NOT NULL,
    actor_role character varying(40) NOT NULL,
    action character varying(80) NOT NULL,
    entity_type character varying(80) NOT NULL,
    entity_id character varying(64) NOT NULL,
    metadata jsonb,
    ip_address character varying(64),
    user_agent character varying(500),
    occurred_at timestamp with time zone NOT NULL
);


--
-- Name: check_in_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.check_in_records (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    event_id uuid NOT NULL,
    registration_id uuid NOT NULL,
    jti uuid NOT NULL,
    gate_id uuid NOT NULL,
    staff_user_id uuid NOT NULL,
    status integer NOT NULL,
    reject_reason character varying(500),
    scanned_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    subscription_id uuid NOT NULL,
    amount_minor bigint NOT NULL,
    currency character varying(3) NOT NULL,
    provider_invoice_id character varying(200),
    issued_at timestamp with time zone NOT NULL,
    paid_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.memberships (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    role character varying(40) NOT NULL,
    status integer NOT NULL,
    invited_at timestamp with time zone NOT NULL,
    joined_at timestamp with time zone,
    revoked_at timestamp with time zone
);

ALTER TABLE ONLY public.memberships FORCE ROW LEVEL SECURITY;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    event_id uuid NOT NULL,
    ticket_type_id uuid NOT NULL,
    quantity integer NOT NULL,
    buyer_email character varying(254) NOT NULL,
    buyer_name character varying(200) NOT NULL,
    subtotal_amount_minor bigint NOT NULL,
    discount_amount_minor bigint NOT NULL,
    total_amount_minor bigint NOT NULL,
    currency character varying(3) NOT NULL,
    discount_code character varying(50),
    provider character varying(20) NOT NULL,
    provider_session_id character varying(200),
    status integer NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid NOT NULL,
    name character varying(200) NOT NULL,
    slug character varying(40) NOT NULL,
    default_locale character varying(10) DEFAULT 'en'::character varying NOT NULL,
    default_currency character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    timezone character varying(64) DEFAULT 'UTC'::character varying NOT NULL,
    plan_id uuid,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plans (
    id uuid NOT NULL,
    name character varying(100) NOT NULL,
    tier integer NOT NULL,
    price_amount_minor bigint NOT NULL,
    price_currency character varying(3) NOT NULL,
    period integer NOT NULL,
    max_active_events integer NOT NULL,
    max_attendees_per_month integer NOT NULL,
    max_staff_seats integer NOT NULL,
    is_default boolean NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: platform_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    refresh_token_hash character varying(64) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    created_from_ip character varying(64)
);


--
-- Name: platform_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_users (
    id uuid NOT NULL,
    email public.citext NOT NULL,
    full_name character varying(200) NOT NULL,
    password_hash text NOT NULL,
    role integer NOT NULL,
    mfa_enabled boolean NOT NULL,
    mfa_secret_base32 character varying(64),
    last_login_at timestamp with time zone,
    locked_until timestamp with time zone,
    failed_login_count integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: registrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.registrations (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    event_id uuid NOT NULL,
    order_id uuid NOT NULL,
    ticket_type_id uuid NOT NULL,
    jti uuid NOT NULL,
    attendee_email character varying(254) NOT NULL,
    attendee_name character varying(200) NOT NULL,
    attendee_phone character varying(40),
    status integer NOT NULL,
    issued_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    checked_in_at timestamp with time zone,
    qr_image_url character varying(500),
    signature character varying(200),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    state integer NOT NULL,
    current_period_start timestamp with time zone NOT NULL,
    current_period_end timestamp with time zone NOT NULL,
    trial_ends_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    external_subscription_id character varying(200),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: ticket_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_types (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    event_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    price_amount_minor bigint NOT NULL,
    price_currency character varying(3) NOT NULL,
    capacity integer NOT NULL,
    sold_count integer NOT NULL,
    sale_starts_at timestamp with time zone NOT NULL,
    sale_ends_at timestamp with time zone NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    email public.citext NOT NULL,
    email_verified_at timestamp with time zone,
    full_name character varying(200) NOT NULL,
    password_hash text,
    avatar_url text,
    locale character varying(10),
    last_login_at timestamp with time zone,
    locked_until timestamp with time zone,
    failed_login_count integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Data for Name: __EFMigrationsHistory; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."__EFMigrationsHistory" ("MigrationId", "ProductVersion") FROM stdin;
20260605095916_InitialIdentity	10.0.0
20260606043723_AddPlatformUsersAndSessions	10.0.0
20260606045340_AddPlatformGrants	10.0.0
\.


--
-- Data for Name: audit_log; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.audit_log (id, tenant_id, actor_user_id, actor_role, action, entity_type, entity_id, metadata, ip_address, user_agent, occurred_at) FROM stdin;
\.


--
-- Data for Name: check_in_records; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.check_in_records (id, tenant_id, event_id, registration_id, jti, gate_id, staff_user_id, status, reject_reason, scanned_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.invoices (id, organization_id, subscription_id, amount_minor, currency, provider_invoice_id, issued_at, paid_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: memberships; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.memberships (id, user_id, tenant_id, role, status, invited_at, joined_at, revoked_at) FROM stdin;
83a49b5c-019b-4c09-8cca-5139bce95ba8	00000000-0000-0000-0000-0000000000a1	00000000-0000-0000-0000-000000000001	Owner	1	2026-06-05 10:02:13.638526+00	2026-06-05 10:02:13.638526+00	\N
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.orders (id, tenant_id, event_id, ticket_type_id, quantity, buyer_email, buyer_name, subtotal_amount_minor, discount_amount_minor, total_amount_minor, currency, discount_code, provider, provider_session_id, status, expires_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.organizations (id, name, slug, default_locale, default_currency, timezone, plan_id, created_at, updated_at) FROM stdin;
00000000-0000-0000-0000-000000000001	Acme Events	acme	vi	VND	Asia/Ho_Chi_Minh	\N	2026-06-05 10:02:13.638526+00	2026-06-05 10:02:13.638526+00
\.


--
-- Data for Name: plans; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.plans (id, name, tier, price_amount_minor, price_currency, period, max_active_events, max_attendees_per_month, max_staff_seats, is_default, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: platform_sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.platform_sessions (id, user_id, refresh_token_hash, created_at, expires_at, revoked_at, created_from_ip) FROM stdin;
0a6c9f84-e7b5-43e2-8a25-2dd41cc027e9	d7e23c21-d1fd-4cc5-b688-d13475f63e9d	073218e557034e2f63f86cdc56258565908b2678c2bcd6870231ad2a8d6f6e7d	2026-06-06 06:00:51.868751+00	2026-06-06 14:00:51.868751+00	\N	\N
c5a49838-02c1-401f-a57a-cc808be86012	d7e23c21-d1fd-4cc5-b688-d13475f63e9d	e4515fe002f46be1d7646134d40c1f6610e7b288989869b2fcf1323e20752ffe	2026-06-06 06:00:51.977953+00	2026-06-06 14:00:51.977953+00	\N	\N
ea081435-c55b-4ea7-962f-7baeaac4747b	d7e23c21-d1fd-4cc5-b688-d13475f63e9d	2a03a87bf45ed88ffc47f48003560c5c52af98e061c32ad6376637f3d77291c6	2026-06-06 09:00:43.527718+00	2026-06-06 17:00:43.527718+00	\N	\N
\.


--
-- Data for Name: platform_users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.platform_users (id, email, full_name, password_hash, role, mfa_enabled, mfa_secret_base32, last_login_at, locked_until, failed_login_count, created_at, updated_at) FROM stdin;
d7e23c21-d1fd-4cc5-b688-d13475f63e9d	owner@saas-checkin.com	Platform Owner	$2a$12$H4XvYm.Sf7u6lBhSsYqibOlutnCQ7ta2TK6hycZTLwkxl2wpogG9G	0	f	\N	2026-06-06 09:00:43.517942+00	\N	3	2026-06-06 04:48:27.147864+00	2026-06-07 00:26:38.359482+00
\.


--
-- Data for Name: registrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.registrations (id, tenant_id, event_id, order_id, ticket_type_id, jti, attendee_email, attendee_name, attendee_phone, status, issued_at, expires_at, checked_in_at, qr_image_url, signature, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: subscriptions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.subscriptions (id, organization_id, plan_id, state, current_period_start, current_period_end, trial_ends_at, cancelled_at, external_subscription_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: ticket_types; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ticket_types (id, tenant_id, event_id, name, description, price_amount_minor, price_currency, capacity, sold_count, sale_starts_at, sale_ends_at, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, email, email_verified_at, full_name, password_hash, avatar_url, locale, last_login_at, locked_until, failed_login_count, created_at, updated_at) FROM stdin;
00000000-0000-0000-0000-0000000000a1	alice@acme.test	2026-06-05 10:02:13.638526+00	Alice Nguyễn	$2a$12$.polLjDCNB3cmihtLZyuJO23EX3n7eEPOw.Pxm99BLnVy/3VtqLdK	\N	vi	\N	\N	0	2026-06-05 10:02:13.638526+00	2026-06-05 10:02:13.638526+00
\.


--
-- Name: __EFMigrationsHistory PK___EFMigrationsHistory; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."__EFMigrationsHistory"
    ADD CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY ("MigrationId");


--
-- Name: audit_log PK_audit_log; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT "PK_audit_log" PRIMARY KEY (id);


--
-- Name: check_in_records PK_check_in_records; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.check_in_records
    ADD CONSTRAINT "PK_check_in_records" PRIMARY KEY (id);


--
-- Name: invoices PK_invoices; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT "PK_invoices" PRIMARY KEY (id);


--
-- Name: memberships PK_memberships; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT "PK_memberships" PRIMARY KEY (id);


--
-- Name: orders PK_orders; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT "PK_orders" PRIMARY KEY (id);


--
-- Name: organizations PK_organizations; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT "PK_organizations" PRIMARY KEY (id);


--
-- Name: plans PK_plans; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT "PK_plans" PRIMARY KEY (id);


--
-- Name: platform_sessions PK_platform_sessions; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_sessions
    ADD CONSTRAINT "PK_platform_sessions" PRIMARY KEY (id);


--
-- Name: platform_users PK_platform_users; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_users
    ADD CONSTRAINT "PK_platform_users" PRIMARY KEY (id);


--
-- Name: registrations PK_registrations; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registrations
    ADD CONSTRAINT "PK_registrations" PRIMARY KEY (id);


--
-- Name: subscriptions PK_subscriptions; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT "PK_subscriptions" PRIMARY KEY (id);


--
-- Name: ticket_types PK_ticket_types; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_types
    ADD CONSTRAINT "PK_ticket_types" PRIMARY KEY (id);


--
-- Name: users PK_users; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "PK_users" PRIMARY KEY (id);


--
-- Name: IX_audit_log_tenant_id_actor_occurred_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_audit_log_tenant_id_actor_occurred_at" ON public.audit_log USING btree (tenant_id, actor_user_id, occurred_at);


--
-- Name: IX_audit_log_tenant_id_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_audit_log_tenant_id_entity" ON public.audit_log USING btree (tenant_id, entity_type, entity_id);


--
-- Name: IX_audit_log_tenant_id_occurred_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_audit_log_tenant_id_occurred_at" ON public.audit_log USING btree (tenant_id, occurred_at);


--
-- Name: IX_check_in_records_tenant_id_event_id_scanned_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_check_in_records_tenant_id_event_id_scanned_at" ON public.check_in_records USING btree (tenant_id, event_id, scanned_at);


--
-- Name: IX_check_in_records_tenant_id_registration_id_success; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_check_in_records_tenant_id_registration_id_success" ON public.check_in_records USING btree (tenant_id, registration_id, status) WHERE (status = 0);


--
-- Name: IX_memberships_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_memberships_tenant_id" ON public.memberships USING btree (tenant_id);


--
-- Name: IX_memberships_tenant_id_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_memberships_tenant_id_user_id" ON public.memberships USING btree (tenant_id, user_id);


--
-- Name: IX_memberships_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_memberships_user_id" ON public.memberships USING btree (user_id);


--
-- Name: IX_orders_provider_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_orders_provider_session_id" ON public.orders USING btree (provider_session_id);


--
-- Name: IX_orders_status_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_orders_status_expires_at" ON public.orders USING btree (status, expires_at);


--
-- Name: IX_orders_tenant_id_event_id_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_orders_tenant_id_event_id_status" ON public.orders USING btree (tenant_id, event_id, status);


--
-- Name: IX_organizations_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_organizations_slug" ON public.organizations USING btree (slug);


--
-- Name: IX_platform_sessions_refresh_token_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_platform_sessions_refresh_token_hash" ON public.platform_sessions USING btree (refresh_token_hash);


--
-- Name: IX_platform_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_platform_sessions_user_id" ON public.platform_sessions USING btree (user_id);


--
-- Name: IX_platform_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_platform_users_email" ON public.platform_users USING btree (email);


--
-- Name: IX_registrations_tenant_id_attendee_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_registrations_tenant_id_attendee_email" ON public.registrations USING btree (tenant_id, attendee_email);


--
-- Name: IX_registrations_tenant_id_event_id_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_registrations_tenant_id_event_id_status" ON public.registrations USING btree (tenant_id, event_id, status);


--
-- Name: IX_registrations_tenant_id_jti; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_registrations_tenant_id_jti" ON public.registrations USING btree (tenant_id, jti);


--
-- Name: IX_registrations_tenant_id_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_registrations_tenant_id_order_id" ON public.registrations USING btree (tenant_id, order_id);


--
-- Name: IX_subscriptions_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_subscriptions_organization_id" ON public.subscriptions USING btree (organization_id);


--
-- Name: IX_ticket_types_tenant_id_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_ticket_types_tenant_id_event_id" ON public.ticket_types USING btree (tenant_id, event_id);


--
-- Name: IX_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_users_email" ON public.users USING btree (email);


--
-- Name: memberships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

--
-- Name: memberships memberships_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY memberships_tenant_isolation ON public.memberships USING (((tenant_id)::text = current_setting('app.current_tenant'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.current_tenant'::text, true)));


--
-- PostgreSQL database dump complete
--

\unrestrict V3OkI5mcMEg1t1H5TJq7qtKKHWSdJwAUsOHK7wvWd3zXUrIcVqDQ2Ar9f1BoMdm

