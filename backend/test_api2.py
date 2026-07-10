import asyncio
from supabase import create_client
import os
import httpx

async def main():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_ANON_KEY")
    client = create_client(url, key)
    
    res = client.auth.sign_in_with_password({"email": "soodkrrish@gmail.com", "password": "password123"})
    token = res.session.access_token
    
    async with httpx.AsyncClient() as hc:
        dashboard_res = await hc.get("http://localhost:8000/api/v1/proctor/dashboard", headers={"Authorization": f"Bearer {token}"})
        print("Status Code:", dashboard_res.status_code)
        print("Response:", dashboard_res.text)

if __name__ == "__main__":
    asyncio.run(main())
