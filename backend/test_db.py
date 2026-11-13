
from sqlalchemy import text
from database import engine

try:
    with engine.connect() as connection:
        result = connection.execute(text("SELECT version()"))
        print("DATABASE CONNECTED SUCCESSFULLY!")
        print(result.fetchone()[0])

except Exception as e:
    print("DATABASE CONNECTION FAILED")
    print(e)
