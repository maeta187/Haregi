DO $$
DECLARE actual_timezone text;
BEGIN
  SHOW TimeZone INTO actual_timezone;
  IF actual_timezone <> 'UTC' THEN
    RAISE EXCEPTION 'drizzle-kit must connect in UTC, got %', actual_timezone;
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE timezone_probe AS SELECT current_setting('TimeZone') AS timezone;
