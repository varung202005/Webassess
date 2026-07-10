import asyncio
from app.db.supabase import get_supabase_admin

async def main():
    supabase = get_supabase_admin()
    
    users = supabase.table("users").select("id, email").in_("email", ["soodkrrish@gmail.com", "krrishsood06@gmail.com"]).execute()
    admin_role_id = 1
    
    for u in users.data:
        # Check if they have admin role already
        existing = supabase.table("user_roles").select("*").eq("user_id", u["id"]).eq("role_id", admin_role_id).execute()
        if not existing.data:
            supabase.table("user_roles").insert({"user_id": u["id"], "role_id": admin_role_id}).execute()
            print(f"Added Admin role to {u['email']}")

if __name__ == "__main__":
    asyncio.run(main())
