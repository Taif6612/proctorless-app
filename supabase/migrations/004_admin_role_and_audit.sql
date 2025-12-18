-- Create user_roles table if missing
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'student',
  updated_at timestamptz DEFAULT now()
);

-- Ensure RLS is enabled and basic policy
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_roles' AND policyname = 'users_select_own_role'
  ) THEN
    CREATE POLICY users_select_own_role ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- Admin audit logs
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NULL,
  actor_email text NULL,
  action text NOT NULL,
  target_user_id uuid NULL,
  details jsonb NULL,
  created_at timestamptz DEFAULT now()
);

-- Function: assign default role on signup; ensure specific email is admin
CREATE OR REPLACE FUNCTION public.handle_user_roles_on_signup()
RETURNS trigger AS $$
DECLARE
  v_email text;
BEGIN
  v_email := new.email;
  INSERT INTO public.user_roles(user_id, role)
  VALUES (new.id, CASE WHEN lower(v_email) = 'storage12002@gmail.com' THEN 'admin' ELSE 'student' END)
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger
DROP TRIGGER IF EXISTS on_assign_user_roles ON auth.users;
CREATE TRIGGER on_assign_user_roles
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_roles_on_signup();

