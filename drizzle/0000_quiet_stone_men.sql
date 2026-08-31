CREATE TYPE "public"."currency" AS ENUM('pesos', 'usd');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TABLE "shared_group_expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" "currency" NOT NULL,
	"paid_by_member_id" text NOT NULL,
	"date" date NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shared_group_expenses_amount_positive" CHECK ("shared_group_expenses"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "shared_group_invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"member_id" text NOT NULL,
	"invited_by_user_id" text NOT NULL,
	"target_email" text NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "shared_group_members" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shared_group_settlements" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"paid_by_member_id" text NOT NULL,
	"paid_to_member_id" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" "currency" NOT NULL,
	"date" date NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	CONSTRAINT "shared_group_settlements_amount_positive" CHECK ("shared_group_settlements"."amount" > 0),
	CONSTRAINT "shared_group_settlements_parties_distinct" CHECK ("shared_group_settlements"."paid_by_member_id" <> "shared_group_settlements"."paid_to_member_id")
);
--> statement-breakpoint
CREATE TABLE "shared_group_splits" (
	"id" text PRIMARY KEY NOT NULL,
	"expense_id" text NOT NULL,
	"member_id" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	CONSTRAINT "shared_group_splits_amount_positive" CHECK ("shared_group_splits"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "shared_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shared_group_expenses" ADD CONSTRAINT "shared_group_expenses_group_id_shared_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."shared_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_group_expenses" ADD CONSTRAINT "shared_group_expenses_paid_by_member_id_shared_group_members_id_fk" FOREIGN KEY ("paid_by_member_id") REFERENCES "public"."shared_group_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_group_invitations" ADD CONSTRAINT "shared_group_invitations_group_id_shared_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."shared_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_group_invitations" ADD CONSTRAINT "shared_group_invitations_member_id_shared_group_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."shared_group_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_group_members" ADD CONSTRAINT "shared_group_members_group_id_shared_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."shared_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_group_settlements" ADD CONSTRAINT "shared_group_settlements_group_id_shared_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."shared_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_group_settlements" ADD CONSTRAINT "shared_group_settlements_paid_by_member_id_shared_group_members_id_fk" FOREIGN KEY ("paid_by_member_id") REFERENCES "public"."shared_group_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_group_settlements" ADD CONSTRAINT "shared_group_settlements_paid_to_member_id_shared_group_members_id_fk" FOREIGN KEY ("paid_to_member_id") REFERENCES "public"."shared_group_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_group_splits" ADD CONSTRAINT "shared_group_splits_expense_id_shared_group_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."shared_group_expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_group_splits" ADD CONSTRAINT "shared_group_splits_member_id_shared_group_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."shared_group_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shared_group_expenses_group_date_idx" ON "shared_group_expenses" USING btree ("group_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "shared_group_invitations_member_pending_unique" ON "shared_group_invitations" USING btree ("member_id") WHERE "shared_group_invitations"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "shared_group_invitations_target_email_status_idx" ON "shared_group_invitations" USING btree ("target_email","status");--> statement-breakpoint
CREATE INDEX "shared_group_invitations_group_member_status_idx" ON "shared_group_invitations" USING btree ("group_id","member_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "shared_group_members_group_user_unique" ON "shared_group_members" USING btree ("group_id","user_id") WHERE "shared_group_members"."user_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "shared_group_members_group_email_unique" ON "shared_group_members" USING btree ("group_id",lower("email")) WHERE "shared_group_members"."email" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "shared_group_members_user_id_idx" ON "shared_group_members" USING btree ("user_id") WHERE "shared_group_members"."user_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "shared_group_settlements_group_date_idx" ON "shared_group_settlements" USING btree ("group_id","date");--> statement-breakpoint
CREATE INDEX "shared_group_splits_expense_id_idx" ON "shared_group_splits" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX "shared_group_splits_member_id_idx" ON "shared_group_splits" USING btree ("member_id");