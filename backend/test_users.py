import asyncio
from app.db.supabase import get_supabase_admin

async def main():
    supabase = get_supabase_admin()
    users = supabase.table("users").select("id, email").execute()
    roles = supabase.table("user_roles").select("user_id, role_id, roles(name)").execute()
    
    for u in users.data:
        u_roles = [r["roles"]["name"] for r in roles.data if r["user_id"] == u["id"]]
        print(f"{u['email']}: {u_roles}")

if __name__ == "__main__":
    asyncio.run(main())
