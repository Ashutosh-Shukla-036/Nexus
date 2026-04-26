import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

# Global connection pool. Min 1 and Max 10
pool = None

# async function cause we use await.
async def connect():
    global pool # Refer global pool 
    if pool is None:
        try:
            # Makes min 1 and max 10 connection pool that can we used to hit db
            pool = await asyncpg.create_pool(
                os.getenv('DATABASE_URL'),
                min_size=1,
                max_size=10
            )
            try:
                # Create tables
                await create_tables()
            except Exception as e:
                # Raise exception for any failure. Will not execute futhure
                raise Exception(f"Error creating tables: {e}")
            print("Database connected successfully")
        except Exception as e:
            # Raise exception for any failure. Will not execute futhure
            raise Exception(f"Error connecting to database: {e}")

# async function cause we use await.
async def disconnect():
    global pool # Refer global pool 
    if pool is not None:
        try:
            # Close the connection pool that we created
            await pool.close()
            pool = None
            print("Database disconnected successfully")
        except Exception as e:
            # Raise exception for any failure. Will not execute futhure
            raise Exception(f"Error disconnecting from database: {e}")

async def create_tables():
    global pool
    # Borrow a connection from the pool. async with ensures connection is returned to pool after block exits
    async with pool.acquire() as conn:
        # Execute all CREATE TABLE statements in one shot
        # ON DELETE CASCADE in uptime_checks means deleting an app auto-deletes its health checks
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS apps (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name TEXT NOT NULL UNIQUE,
                repo_url TEXT NOT NULL,
                port INTEGER NOT NULL,
                domain TEXT NOT NULL,
                status TEXT DEFAULT 'stopped',
                created_at TIMESTAMP DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS metrics (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                cpu FLOAT,
                ram FLOAT,
                disk FLOAT,
                recorded_at TIMESTAMP DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS uptime_checks (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                app_id UUID REFERENCES apps(id) ON DELETE CASCADE,
                status_code INTEGER,
                response_time FLOAT,
                checked_at TIMESTAMP DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS services (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name TEXT NOT NULL UNIQUE,
                enabled BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT now()
            );
        ''')