import asyncio
from app.db.supabase import get_supabase_admin

async def main():
    supabase = get_supabase_admin()
    
    # Try querying proctoring_summary to see existing columns
    try:
        res = supabase.table("proctoring_summary").select("*").limit(1).execute()
        if res.data:
            print("Existing columns:", res.data[0].keys())
        else:
            print("Table empty, cannot infer columns from select *")
    except Exception as e:
        print("Error fetching:", e)
        
    # We need to execute raw SQL to add columns.
    # Supabase Python client doesn't support raw SQL easily unless using the posgrest rpc or postgres connection string.
    # Let's see if we have a way to run migrations.

if __name__ == "__main__":
    asyncio.run(main())
