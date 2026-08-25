ALTER TABLE "config_versions" ADD CONSTRAINT "config_versions_published_snapshot" CHECK (("config_versions"."status" <> 'PUBLISHED') OR ("config_versions"."snapshot" <> '{}'::jsonb));
--> statement-breakpoint
CREATE FUNCTION "prevent_published_config_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'PUBLISHED' THEN
    RAISE EXCEPTION 'Published configuration versions are immutable';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "config_versions_published_immutable"
BEFORE UPDATE OR DELETE ON "config_versions"
FOR EACH ROW
EXECUTE FUNCTION "prevent_published_config_mutation"();
