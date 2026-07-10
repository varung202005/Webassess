import asyncio
from app.db.supabase import get_supabase_admin
from app.api.v1.endpoints.proctor import get_proctor_dashboard

async def main():
    # User ID for soodkrrish@gmail.com
    admin_id = "731ba54a-0792-4752-8a94-45910dbd75ed"
    try:
        res = await get_proctor_dashboard({"user_id": admin_id, "roles": ["Admin", "Proctor"]})
        print("Success, keys:", res.keys())
    except Exception as e:
        print("Error:", e)
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
