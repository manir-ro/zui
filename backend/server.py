from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Header, Query, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
import re
import uuid
import requests
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt

from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Config
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALG = "HS256"
EMERGENT_LLM_KEY = os.environ['EMERGENT_LLM_KEY']
APP_NAME = os.environ.get('APP_NAME', 'travelplanner')
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============== Object Storage ==============
storage_key: Optional[str] = None


def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60,
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ============== Models ==============
class UserSignup(BaseModel):
    email: EmailStr
    password: str
    name: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    id: str
    email: str
    name: str


class TripPreferences(BaseModel):
    destination: str
    days: int = Field(ge=1, le=30)
    budget: str  # "budget" | "mid-range" | "luxury"
    travelers: str  # "solo" | "couple" | "family" | "friends"
    interests: List[str] = []


class Place(BaseModel):
    name: str
    description: str
    image_query: str
    time_of_day: str  # "morning" | "afternoon" | "evening"
    location_query: str  # for google maps


class Hotel(BaseModel):
    name: str
    description: str
    image_query: str
    location_query: str
    price_range: str


class DayPlan(BaseModel):
    day: int
    title: str
    summary: str
    places: List[Place]
    hotel: Hotel


class Trip(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    destination: str
    days: int
    budget: str
    travelers: str
    interests: List[str] = []
    title: str
    overview: str
    itinerary: List[DayPlan]
    cover_image_query: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class TripCreateRequest(TripPreferences):
    pass


class PhotoMeta(BaseModel):
    id: str
    trip_id: str
    user_id: str
    storage_path: str
    original_filename: str
    content_type: str
    size: int
    caption: str = ""
    created_at: str


# ============== Auth ==============
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ============== Auth Routes ==============
@api_router.post("/auth/signup")
async def signup(payload: UserSignup):
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": payload.email.lower(),
        "name": payload.name,
        "password_hash": hash_password(payload.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)
    token = create_token(user_id)
    return {"token": token, "user": {"id": user_id, "email": user_doc["email"], "name": user_doc["name"]}}


@api_router.post("/auth/login")
async def login(payload: UserLogin):
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(user["id"])
    return {"token": token, "user": {"id": user["id"], "email": user["email"], "name": user["name"]}}


@api_router.get("/auth/me")
async def me(current_user: dict = Depends(get_current_user)):
    return {"id": current_user["id"], "email": current_user["email"], "name": current_user["name"]}


# ============== AI Itinerary Generation ==============
ITINERARY_SYSTEM_PROMPT = """You are an expert travel planner. Generate a detailed day-by-day itinerary as STRICT JSON only with no markdown, no prose, no code fences.

The JSON schema MUST be:
{
  "title": "Short catchy trip title",
  "overview": "2-3 sentence trip overview",
  "cover_image_query": "vivid 2-4 word query for stock photo of the destination",
  "itinerary": [
    {
      "day": 1,
      "title": "Day theme",
      "summary": "1-2 sentence day summary",
      "places": [
        {
          "name": "Place name",
          "description": "1-2 sentence description with what to do",
          "image_query": "specific 2-4 word stock photo search query",
          "time_of_day": "morning|afternoon|evening",
          "location_query": "Place name, City, Country (for google maps)"
        }
      ],
      "hotel": {
        "name": "Hotel name",
        "description": "1-2 sentence description",
        "image_query": "2-4 word stock photo query",
        "location_query": "Hotel name, City, Country",
        "price_range": "$ | $$ | $$$"
      }
    }
  ]
}

Rules:
- Each day MUST have 3-4 places with diverse time_of_day values.
- Each day MUST have exactly 1 hotel; you may keep the same hotel across multiple days if convenient.
- Tailor activities to traveler type (family/friends/couple/solo) and budget.
- Use REAL well-known places & hotels for the destination.
- Return ONLY valid JSON, nothing else.
"""


def extract_json(text: str) -> dict:
    # Remove code fences if any
    text = text.strip()
    text = re.sub(r"^```(?:json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    # Try to find first { ... last }
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1:
        text = text[start:end + 1]
    return json.loads(text)


async def generate_itinerary(prefs: TripPreferences) -> dict:
    user_prompt = f"""Plan a trip with these preferences:
- Destination: {prefs.destination}
- Days: {prefs.days}
- Budget: {prefs.budget}
- Travelers: {prefs.travelers}
- Interests: {', '.join(prefs.interests) if prefs.interests else 'general sightseeing'}

Return the JSON itinerary now."""

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"trip-{uuid.uuid4()}",
        system_message=ITINERARY_SYSTEM_PROMPT,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    response = await chat.send_message(UserMessage(text=user_prompt))
    return extract_json(response)


# ============== Trip Routes ==============
@api_router.post("/trips/generate")
async def generate_trip(payload: TripCreateRequest, current_user: dict = Depends(get_current_user)):
    try:
        plan_json = await generate_itinerary(payload)
    except Exception as e:
        logger.exception("Itinerary generation failed")
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")

    trip = Trip(
        user_id=current_user["id"],
        destination=payload.destination,
        days=payload.days,
        budget=payload.budget,
        travelers=payload.travelers,
        interests=payload.interests,
        title=plan_json.get("title", f"{payload.destination} Trip"),
        overview=plan_json.get("overview", ""),
        itinerary=[DayPlan(**d) for d in plan_json.get("itinerary", [])],
        cover_image_query=plan_json.get("cover_image_query", payload.destination),
    )
    await db.trips.insert_one(trip.model_dump())
    return trip.model_dump()


@api_router.get("/trips")
async def list_trips(current_user: dict = Depends(get_current_user)):
    cursor = db.trips.find({"user_id": current_user["id"]}, {"_id": 0}).sort("created_at", -1)
    trips = await cursor.to_list(200)
    return trips


@api_router.get("/trips/{trip_id}")
async def get_trip(trip_id: str, current_user: dict = Depends(get_current_user)):
    trip = await db.trips.find_one({"id": trip_id, "user_id": current_user["id"]}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip


@api_router.delete("/trips/{trip_id}")
async def delete_trip(trip_id: str, current_user: dict = Depends(get_current_user)):
    res = await db.trips.delete_one({"id": trip_id, "user_id": current_user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Trip not found")
    # Soft-delete photos
    await db.photos.update_many(
        {"trip_id": trip_id, "user_id": current_user["id"]},
        {"$set": {"is_deleted": True}},
    )
    return {"ok": True}


# ============== Photo Routes ==============
MIME_TYPES = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
    "gif": "image/gif", "webp": "image/webp", "heic": "image/heic",
}


@api_router.post("/trips/{trip_id}/photos")
async def upload_photo(
    trip_id: str,
    file: UploadFile = File(...),
    caption: str = "",
    current_user: dict = Depends(get_current_user),
):
    trip = await db.trips.find_one({"id": trip_id, "user_id": current_user["id"]})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    ext = (file.filename.rsplit(".", 1)[-1] if "." in file.filename else "bin").lower()
    content_type = file.content_type or MIME_TYPES.get(ext, "application/octet-stream")
    photo_id = str(uuid.uuid4())
    path = f"{APP_NAME}/trips/{current_user['id']}/{trip_id}/{photo_id}.{ext}"
    data = await file.read()

    try:
        result = put_object(path, data, content_type)
    except Exception as e:
        logger.exception("Upload to object storage failed")
        raise HTTPException(status_code=500, detail=f"Storage upload failed: {e}")

    doc = {
        "id": photo_id,
        "trip_id": trip_id,
        "user_id": current_user["id"],
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": content_type,
        "size": result.get("size", len(data)),
        "caption": caption,
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.photos.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/trips/{trip_id}/photos")
async def list_photos(trip_id: str, current_user: dict = Depends(get_current_user)):
    cursor = db.photos.find(
        {"trip_id": trip_id, "user_id": current_user["id"], "is_deleted": False},
        {"_id": 0},
    ).sort("created_at", -1)
    return await cursor.to_list(500)


@api_router.get("/photos/{photo_id}/download")
async def download_photo(
    photo_id: str,
    authorization: Optional[str] = Header(None),
    auth: Optional[str] = Query(None),
):
    # Allow query token auth so <img src> works
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
    elif auth:
        token = auth
    if not token:
        raise HTTPException(status_code=401, detail="Missing token")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        user_id = payload["sub"]
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    photo = await db.photos.find_one(
        {"id": photo_id, "user_id": user_id, "is_deleted": False},
        {"_id": 0},
    )
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    data, _ = get_object(photo["storage_path"])
    return Response(content=data, media_type=photo.get("content_type", "image/jpeg"))


@api_router.delete("/photos/{photo_id}")
async def delete_photo(photo_id: str, current_user: dict = Depends(get_current_user)):
    res = await db.photos.update_one(
        {"id": photo_id, "user_id": current_user["id"]},
        {"$set": {"is_deleted": True}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Photo not found")
    return {"ok": True}


# ============== Health ==============
@api_router.get("/")
async def root():
    return {"message": "AI Travel Planner API"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    try:
        init_storage()
        logger.info("Object storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed (will retry on demand): {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
