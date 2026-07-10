import asyncio
from app.api.v1.endpoints.auth import get_me
from app.db.supabase import get_supabase_admin

async def main():
    current_user = {
        "user_id": "b34e48fd-4625-48e8-84c1-0169e5fda400",
        "roles": [] # Simulate before get_current_user_with_roles
    }
    
    # Simulate get_current_user_with_roles
    supabase = get_supabase_admin()
    result = supabase.table("user_roles").select("roles(name)").eq("user_id", current_user["user_id"]).execute()
    roles = [row["roles"]["name"] for row in result.data]
    current_user["roles"] = roles
    
    # Call get_me
    res = await get_me(current_user)
    print("get_me result:", res)

if __name__ == "__main__":
    asyncio.run(main())
