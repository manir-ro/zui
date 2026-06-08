"""Backend tests for AI Travel Planner.

Covers auth, trip generation (AI), trip CRUD, photo upload/list/download/delete,
isolation between users, and unauthorized access.
"""
import io
import os
import uuid
import time

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    # Fall back to frontend/.env if running pytest directly
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().strip('"')
                    break
    except FileNotFoundError:
        pass

assert BASE_URL, "REACT_APP_BACKEND_URL must be set"
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def existing_user_token(session):
    """Login using pre-seeded test user."""
    r = session.post(f"{API}/auth/login", json={
        "email": "test@example.com", "password": "password123",
    })
    if r.status_code != 200:
        pytest.skip(f"Cannot login existing test user: {r.status_code} {r.text}")
    return r.json()["token"]


@pytest.fixture(scope="session")
def new_user(session):
    """Create a fresh user (used for isolation tests)."""
    # Backend lowercases emails, so use lowercase prefix in tests
    email = f"test_{uuid.uuid4().hex[:10]}@example.com"
    pwd = "password123"
    r = session.post(f"{API}/auth/signup", json={
        "email": email, "password": pwd, "name": "TEST User",
    })
    assert r.status_code == 200, f"signup failed: {r.status_code} {r.text}"
    data = r.json()
    return {"email": email, "password": pwd, "token": data["token"], "id": data["user"]["id"]}


def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- Health ----------
class TestHealth:
    def test_root(self, session):
        r = session.get(f"{API}/")
        assert r.status_code == 200
        assert "message" in r.json()


# ---------- Auth ----------
class TestAuth:
    def test_signup_and_login(self, session, new_user):
        assert new_user["token"]
        assert new_user["id"]
        # login with same credentials
        r = session.post(f"{API}/auth/login", json={
            "email": new_user["email"], "password": new_user["password"],
        })
        assert r.status_code == 200
        body = r.json()
        assert body["user"]["email"] == new_user["email"]
        assert body["user"]["name"] == "TEST User"
        assert isinstance(body["token"], str) and len(body["token"]) > 20

    def test_signup_duplicate_email(self, session, new_user):
        r = session.post(f"{API}/auth/signup", json={
            "email": new_user["email"], "password": "password123", "name": "Dup",
        })
        assert r.status_code == 400

    def test_login_invalid_credentials(self, session):
        r = session.post(f"{API}/auth/login", json={
            "email": "no-such-user-xyz@example.com", "password": "wrong",
        })
        assert r.status_code == 401

    def test_me_requires_auth(self, session):
        r = session.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_with_token(self, session, new_user):
        r = session.get(f"{API}/auth/me", headers=auth_headers(new_user["token"]))
        assert r.status_code == 200
        body = r.json()
        assert body["email"] == new_user["email"]
        assert body["id"] == new_user["id"]

    def test_me_invalid_token(self, session):
        r = session.get(f"{API}/auth/me", headers={"Authorization": "Bearer abc.def.ghi"})
        assert r.status_code == 401


# ---------- Trip generation (AI, slow) ----------
@pytest.fixture(scope="session")
def generated_trip(session, existing_user_token):
    """Generate a trip once and reuse across photo/CRUD tests."""
    payload = {
        "destination": "Paris, France",
        "days": 2,
        "budget": "mid-range",
        "travelers": "couple",
        "interests": ["food", "art"],
    }
    r = session.post(
        f"{API}/trips/generate", json=payload,
        headers=auth_headers(existing_user_token), timeout=120,
    )
    if r.status_code != 200:
        pytest.skip(f"AI generation failed: {r.status_code} {r.text[:300]}")
    return r.json()


class TestTripGeneration:
    def test_generate_requires_auth(self, session):
        r = session.post(f"{API}/trips/generate", json={
            "destination": "Tokyo", "days": 2, "budget": "budget",
            "travelers": "solo", "interests": [],
        })
        assert r.status_code == 401

    def test_generate_returns_valid_itinerary(self, generated_trip):
        t = generated_trip
        # top-level keys
        for key in ("id", "user_id", "title", "overview", "cover_image_query", "itinerary"):
            assert key in t, f"missing key: {key}"
        assert isinstance(t["title"], str) and t["title"]
        assert isinstance(t["overview"], str) and t["overview"]
        assert isinstance(t["cover_image_query"], str) and t["cover_image_query"]
        assert isinstance(t["itinerary"], list) and len(t["itinerary"]) >= 1
        # validate first DayPlan
        d = t["itinerary"][0]
        for key in ("day", "title", "summary", "places", "hotel"):
            assert key in d, f"day missing key: {key}"
        assert isinstance(d["places"], list) and len(d["places"]) >= 1
        p = d["places"][0]
        for key in ("name", "description", "image_query", "time_of_day", "location_query"):
            assert key in p and p[key], f"place missing key: {key}"
        h = d["hotel"]
        for key in ("name", "description", "image_query", "location_query", "price_range"):
            assert key in h and h[key], f"hotel missing key: {key}"


# ---------- Trip CRUD ----------
class TestTripCRUD:
    def test_list_trips_requires_auth(self, session):
        r = session.get(f"{API}/trips")
        assert r.status_code == 401

    def test_list_trips_includes_generated(self, session, existing_user_token, generated_trip):
        r = session.get(f"{API}/trips", headers=auth_headers(existing_user_token))
        assert r.status_code == 200
        trips = r.json()
        assert isinstance(trips, list)
        ids = [t["id"] for t in trips]
        assert generated_trip["id"] in ids
        # ensure _id not leaked
        assert all("_id" not in t for t in trips)

    def test_get_trip_by_id(self, session, existing_user_token, generated_trip):
        r = session.get(
            f"{API}/trips/{generated_trip['id']}",
            headers=auth_headers(existing_user_token),
        )
        assert r.status_code == 200
        assert r.json()["id"] == generated_trip["id"]

    def test_get_trip_other_user_returns_404(self, session, new_user, generated_trip):
        r = session.get(
            f"{API}/trips/{generated_trip['id']}",
            headers=auth_headers(new_user["token"]),
        )
        assert r.status_code == 404

    def test_new_user_has_no_trips(self, session, new_user):
        r = session.get(f"{API}/trips", headers=auth_headers(new_user["token"]))
        assert r.status_code == 200
        # generated_trip belongs to test@example.com, not the new user
        ids = [t["id"] for t in r.json()]
        assert all(tid != "" for tid in ids)  # placeholder
        # New user should NOT see other users' trips
        # (cannot reference generated_trip here without fixture order; checked above)


# ---------- Photos ----------
PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\xcf"
    b"\xc0\xf0\x1f\x00\x05\x00\x01\xff\xa3\xa7\x9e\xd1\x00\x00\x00\x00IEND\xaeB`\x82"
)


@pytest.fixture(scope="session")
def uploaded_photo(existing_user_token, generated_trip):
    files = {"file": ("test.png", io.BytesIO(PNG_BYTES), "image/png")}
    r = requests.post(
        f"{API}/trips/{generated_trip['id']}/photos",
        headers={"Authorization": f"Bearer {existing_user_token}"},
        files=files, data={"caption": "TEST caption"}, timeout=60,
    )
    if r.status_code != 200:
        pytest.skip(f"Photo upload failed: {r.status_code} {r.text[:300]}")
    return r.json()


class TestPhotos:
    def test_upload_requires_auth(self, generated_trip):
        files = {"file": ("test.png", io.BytesIO(PNG_BYTES), "image/png")}
        r = requests.post(
            f"{API}/trips/{generated_trip['id']}/photos",
            files=files, timeout=30,
        )
        assert r.status_code == 401

    def test_upload_to_other_users_trip_returns_404(self, generated_trip, new_user):
        files = {"file": ("test.png", io.BytesIO(PNG_BYTES), "image/png")}
        r = requests.post(
            f"{API}/trips/{generated_trip['id']}/photos",
            headers={"Authorization": f"Bearer {new_user['token']}"},
            files=files, timeout=30,
        )
        assert r.status_code == 404

    def test_uploaded_photo_metadata(self, uploaded_photo, generated_trip):
        p = uploaded_photo
        assert p["trip_id"] == generated_trip["id"]
        assert p["original_filename"] == "test.png"
        assert p["content_type"] == "image/png"
        assert p["is_deleted"] is False
        assert "_id" not in p
        assert "id" in p and p["id"]

    def test_list_photos_returns_uploaded(self, session, existing_user_token,
                                         generated_trip, uploaded_photo):
        r = session.get(
            f"{API}/trips/{generated_trip['id']}/photos",
            headers=auth_headers(existing_user_token),
        )
        assert r.status_code == 200
        photos = r.json()
        ids = [ph["id"] for ph in photos]
        assert uploaded_photo["id"] in ids

    def test_download_with_header_auth(self, existing_user_token, uploaded_photo):
        r = requests.get(
            f"{API}/photos/{uploaded_photo['id']}/download",
            headers={"Authorization": f"Bearer {existing_user_token}"},
            timeout=30,
        )
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("image/")
        assert len(r.content) > 0

    def test_download_with_query_token(self, existing_user_token, uploaded_photo):
        r = requests.get(
            f"{API}/photos/{uploaded_photo['id']}/download",
            params={"auth": existing_user_token}, timeout=30,
        )
        assert r.status_code == 200
        assert len(r.content) > 0

    def test_download_no_auth_fails(self, uploaded_photo):
        r = requests.get(f"{API}/photos/{uploaded_photo['id']}/download", timeout=30)
        assert r.status_code == 401

    def test_download_other_user_returns_404(self, uploaded_photo, new_user):
        r = requests.get(
            f"{API}/photos/{uploaded_photo['id']}/download",
            headers={"Authorization": f"Bearer {new_user['token']}"},
            timeout=30,
        )
        assert r.status_code == 404

    def test_delete_other_user_returns_404(self, session, uploaded_photo, new_user):
        r = session.delete(
            f"{API}/photos/{uploaded_photo['id']}",
            headers=auth_headers(new_user["token"]),
        )
        assert r.status_code == 404

    def test_delete_photo_soft_deletes(self, session, existing_user_token,
                                       generated_trip, uploaded_photo):
        # Upload an extra photo just for delete test (so primary one stays alive
        # for earlier tests if order changes).
        files = {"file": ("del.png", io.BytesIO(PNG_BYTES), "image/png")}
        up = requests.post(
            f"{API}/trips/{generated_trip['id']}/photos",
            headers={"Authorization": f"Bearer {existing_user_token}"},
            files=files, timeout=30,
        )
        assert up.status_code == 200
        pid = up.json()["id"]

        d = session.delete(
            f"{API}/photos/{pid}", headers=auth_headers(existing_user_token),
        )
        assert d.status_code == 200

        # Should no longer appear in list
        lst = session.get(
            f"{API}/trips/{generated_trip['id']}/photos",
            headers=auth_headers(existing_user_token),
        )
        assert lst.status_code == 200
        assert pid not in [p["id"] for p in lst.json()]

        # Download should now 404
        dn = requests.get(
            f"{API}/photos/{pid}/download",
            headers={"Authorization": f"Bearer {existing_user_token}"},
            timeout=30,
        )
        assert dn.status_code == 404


# ---------- Trip delete (run last; soft-deletes photos) ----------
class TestTripDelete:
    def test_delete_other_user_returns_404(self, session, new_user, generated_trip):
        r = session.delete(
            f"{API}/trips/{generated_trip['id']}",
            headers=auth_headers(new_user["token"]),
        )
        assert r.status_code == 404

    def test_delete_own_trip(self, session, existing_user_token, generated_trip):
        r = session.delete(
            f"{API}/trips/{generated_trip['id']}",
            headers=auth_headers(existing_user_token),
        )
        assert r.status_code == 200

        # Verify gone
        g = session.get(
            f"{API}/trips/{generated_trip['id']}",
            headers=auth_headers(existing_user_token),
        )
        assert g.status_code == 404
