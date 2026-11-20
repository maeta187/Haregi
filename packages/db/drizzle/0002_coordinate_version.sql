CREATE TABLE "coordinate_version" (
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"last_version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "coordinate_version_user_id_date_pk" PRIMARY KEY("user_id","date")
);
--> statement-breakpoint
ALTER TABLE "coordinate_version" ADD CONSTRAINT "coordinate_version_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
-- 既存データの発行済み版を引き継ぐ。コーデ削除後も履歴は保持する。
INSERT INTO "coordinate_version" ("user_id", "date", "last_version")
SELECT "user_id", "date", "version" FROM "coordinate";
