import asyncio
from app.db.supabase import get_supabase_admin

async def main():
    supabase = get_supabase_admin()
    res = supabase.table("roles").select("*").execute()
    # It's hard to get the trigger definition through PostgREST. Let's see if we can get it using another way.
    # What if I just try to sign up a new user via the API and see what role they get?

    from supabase import create_client
    import os
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_ANON_KEY")
    client = create_client(url, key)
    
    # Try signing up a fake user
    import uuid
    fake_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    res = client.auth.sign_up({"email": fake_email, "password": "password123", "options": {"data": {"full_name": "Test", "role": "student"}}})
    print(res.user.id)
    
    # Now check their roles
    await asyncio.sleep(2)
    admin = get_supabase_admin()
    roles = admin.table("user_roles").select("role_id").eq("user_id", res.user.id).execute()
    print("New user roles:", roles.data)

if __name__ == "__main__":
    asyncio.run(main())
