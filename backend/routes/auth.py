import sys
import os
import re
from starlette.routing import Route
from starlette.responses import JSONResponse
from starlette.requests import Request

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
import database

# Also add backend directory so we can import auth module
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from auth import hash_password, verify_password, create_access_token, verify_access_token

def validate_email(email):
    return re.match(r"[^@]+@[^@]+\.[^@]+", email)

async def register(request: Request):
    try:
        data = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)
    
    email = data.get("email")
    password = data.get("password")
    wallet_address = data.get("wallet_address")

    if not email or not validate_email(email):
        return JSONResponse({"error": "Invalid email format"}, status_code=422)
    
    if not password or len(password) < 8:
        return JSONResponse({"error": "Password must be at least 8 characters"}, status_code=422)
    
    # Check if email exists
    existing_user = database.get_user_by_email(email)
    if existing_user:
        return JSONResponse({"error": "Email already registered"}, status_code=409)
    
    # Hash password
    hashed_pwd = hash_password(password)

    # Insert user
    user = database.create_user(email, hashed_pwd, wallet_address)
    if not user:
        return JSONResponse({"error": "Failed to create user"}, status_code=500)
    
    # Remove password_hash before returning
    user.pop("password_hash", None)

    return JSONResponse({"user": user}, status_code=201)

async def login(request: Request):
    try:
        data = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)
    
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return JSONResponse({"error": "Email and password required"}, status_code=400)
    
    user = database.get_user_by_email(email)
    if not user:
        return JSONResponse({"error": "Invalid email or password"}, status_code=401)
    
    if not verify_password(password, user["password_hash"]):
        return JSONResponse({"error": "Invalid email or password"}, status_code=401)
    
    # Update last login
    database.update_last_login(user["id"])
    user["last_login_at"] = database.get_user_by_id(user["id"])["last_login_at"] # Refresh

    # Generate token
    token = create_access_token({"sub": str(user["id"]), "email": user["email"]})

    # Prepare response
    user.pop("password_hash", None)
    response = JSONResponse({"user": user})

    # Set cookie. Cross-site (Vercel -> Railway) requires SameSite=None
    # + Secure so the browser stores it over HTTPS.
    response.set_cookie(
        key="a2z-token",
        value=token,
        httponly=True,
        path="/",
        max_age=604800, # 7 days
        samesite="none",
        secure=True
    )

    return response

async def me(request: Request):
    token = request.cookies.get("a2z-token")
    if not token:
        return JSONResponse({"error": "Not authenticated"}, status_code=401)
    
    payload = verify_access_token(token)
    if not payload or "sub" not in payload:
        return JSONResponse({"error": "Invalid or expired token"}, status_code=401)
    
    user_id = int(payload["sub"])
    user = database.get_user_by_id(user_id)
    if not user:
        return JSONResponse({"error": "User not found"}, status_code=401)
    
    return JSONResponse({"user": user})

async def logout(request: Request):
    response = JSONResponse({"ok": True})
    # Clear cookie on logout (SameSite=None+Secure to match login)
    response.set_cookie(
        key="a2z-token",
        value="",
        httponly=True,
        path="/",
        max_age=0,
        samesite="none",
        secure=True
    )
    return response

routes = [
    Route("/register", register, methods=["POST"]),
    Route("/login", login, methods=["POST"]),
    Route("/me", me, methods=["GET"]),
    Route("/logout", logout, methods=["POST"])
]
