import asyncio
from app.db.supabase import get_supabase_admin

async def main():
    supabase = get_supabase_admin()
    roles_res = supabase.table("user_roles").select("*").execute()
    roles_dict = supabase.table("roles").select("*").execute()
    print("ROLES DICT:", roles_dict.data)
    print("USER ROLES:", roles_res.data)

if __name__ == "__main__":
    asyncio.run(main())
