ALTER TABLE "account" ADD COLUMN "issuer" text;--> statement-breakpoint
UPDATE "account" SET "issuer" = 'local:credential' WHERE "issuer" IS NULL AND "provider_id" = 'credential';--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM "account" WHERE "issuer" IS NULL) THEN
		RAISE EXCEPTION 'account.issuer を補完できない provider_id があります: %', (SELECT string_agg(DISTINCT "provider_id", ', ') FROM "account" WHERE "issuer" IS NULL)
			USING HINT = 'credential 以外の provider は本アプリの対象外です。issuer を推測で埋めると Better Auth のアカウント紐付けが壊れるため、値を決めてから再実行してください。';
	END IF;
END $$;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "issuer" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "account_issuer_accountId_uidx" ON "account" USING btree ("issuer","account_id");
