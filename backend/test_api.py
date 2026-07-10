import asyncio
import httpx

async def main():
    async with httpx.AsyncClient() as client:
        # First, login as Admin (soodkrrish@gmail.com)
        login_res = await client.post("http://localhost:8000/api/v1/auth/login", json={"email": "soodkrrish@gmail.com", "password": "password123"})
        if login_res.status_code != 200:
            print("Login failed:", login_res.text)
            return
            
        token = login_res.json()["access_token"]
        
        # Now try to hit the proctor dashboard endpoint
        dashboard_res = await client.get("http://localhost:8000/api/v1/proctor/dashboard", headers={"Authorization": f"Bearer {token}"})
        print("Status Code:", dashboard_res.status_code)
        print("Response:", dashboard_res.text)

if __name__ == "__main__":
    asyncio.run(main())
