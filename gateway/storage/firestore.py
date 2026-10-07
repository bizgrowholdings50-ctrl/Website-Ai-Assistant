"""WebClaw Firestore Client: Persistent storage for site configs, sessions, and knowledge bases.

When Firestore is unavailable (no credentials, emulator, or library), all operations
fall back to in-memory dicts so that the full dashboard works in local development.
"""

from __future__ import annotations

import logging
import os
import re
import time
from collections import defaultdict
from typing import Any

logger = logging.getLogger(__name__)

# Firestore availability flag
_firestore_available = False
_db = None
_db_init_attempted = False

try:
    from google.cloud import firestore
    from google.api_core.exceptions import GoogleAPICallError
    _firestore_available = True
except ImportError:
    logger.info("google-cloud-firestore not installed; using in-memory storage")

# ========================================
# In-Memory Fallback Storage
# ========================================
# These dicts hold data when Firestore is unavailable (local dev, demo mode).

_mem_sites: dict[str, dict] = {}
_mem_knowledge: dict[str, dict[str, dict]] = defaultdict(dict)   # site_id -> {doc_id -> doc}
_mem_sessions: dict[str, dict[str, dict]] = defaultdict(dict)    # site_id -> {session_id -> session}
_mem_stats: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))


# ========================================
# Input Validation
# ========================================

def _validate_site_id(site_id: str) -> None:
    """Validate site_id format."""
    if not re.match(r'^[a-zA-Z0-9_-]{1,50}$', site_id):
        raise ValueError(f"Invalid site_id format: {site_id}")


def _validate_content_length(content: str, max_length: int = 1000000) -> None:
    """Validate content length."""
    if len(content) > max_length:
        raise ValueError(f"Content exceeds max length of {max_length} chars")


def _get_db():
    """Lazy-initialize Firestore client.

    Connection strategies (in order of priority):
    1. Firestore Emulator   – if FIRESTORE_EMULATOR_HOST is set
    2. Cloud Firestore      – if GOOGLE_CLOUD_PROJECT is set
    3. Application Default  – try ADC (works in Cloud Run / local gcloud auth)
    """
    global _db, _db_init_attempted
    if _db is not None:
        return _db
    if _db_init_attempted or not _firestore_available:
        return None
    _db_init_attempted = True

    project = os.environ.get("GOOGLE_CLOUD_PROJECT", "").strip()
    emulator = os.environ.get("FIRESTORE_EMULATOR_HOST", "").strip()

    # Strategy 1: Emulator (local dev)
    if emulator:
        try:
            # When emulator host is set, the client auto-connects to it.
            # Project can be any string for the emulator.
            emu_project = project or "webclaw-dev"
            _db = firestore.Client(project=emu_project, database="webclaw")
            logger.info(f"Firestore connected to EMULATOR at {emulator} (project={emu_project})")
            return _db
        except Exception as e:
            logger.error(f"Failed to connect to Firestore emulator: {e}", exc_info=True)
            return None

    # Strategy 2: Explicit project
    if project:
        try:
            _db = firestore.Client(project=project, database="webclaw")
            logger.info(f"Firestore connected: project={project}, database=webclaw")
            return _db
        except Exception as e:
            logger.error(f"Failed to initialize Firestore with project={project}: {e}", exc_info=True)
            return None

    # Strategy 3: Application Default Credentials (Cloud Run, gcloud auth)
    try:
        _db = firestore.Client(database="webclaw")
        logger.info("Firestore connected via Application Default Credentials")
        return _db
    except Exception as e:
        logger.warning(
            f"Firestore unavailable (no GOOGLE_CLOUD_PROJECT, no emulator, ADC failed): {e}. "
            "Using in-memory storage only. Set GOOGLE_CLOUD_PROJECT or "
            "FIRESTORE_EMULATOR_HOST to enable persistence."
        )
        return None


def check_health() -> bool:
    """Check Firestore connectivity. Returns True if connected."""
    try:
        db = _get_db()
        if not db:
            return False
        # Try to list one document
        db.collection("sites").limit(1).stream()
        return True
    except Exception as e:
        logger.warning(f"Firestore health check failed: {e}")
        return False


# ========================================
# Site Configs
# ========================================


def firestore_get_site(site_id: str) -> dict | None:
    """Get a site config from Firestore, falling back to in-memory."""
    try:
        _validate_site_id(site_id)
        db = _get_db()
        if not db:
            return _mem_sites.get(site_id)
        doc = db.collection("sites").document(site_id).get()
        if doc.exists:
            return doc.to_dict()
        return None
    except ValueError as e:
        logger.error(f"Invalid input to firestore_get_site: {e}")
        raise
    except Exception as e:
        logger.error(f"Error getting site {site_id} from Firestore: {e}", exc_info=True)
        raise


def firestore_set_site(site_id: str, config: dict) -> None:
    """Store or update a site config in Firestore (falls back to in-memory)."""
    try:
        _validate_site_id(site_id)
        if not isinstance(config, dict):
            raise ValueError("config must be a dictionary")
        config["updated_at"] = time.time()
        # Always write to in-memory
        _mem_sites[site_id] = config
        db = _get_db()
        if not db:
            logger.info(f"In-memory: site config saved: {site_id}")
            return
        db.collection("sites").document(site_id).set(config, merge=True)
        logger.info(f"Firestore: site config saved: {site_id}")
    except ValueError as e:
        logger.error(f"Invalid input to firestore_set_site: {e}")
        raise
    except Exception as e:
        logger.error(f"Error saving site {site_id} to Firestore: {e}", exc_info=True)
        raise


def firestore_list_sites() -> list[dict]:
    """List all site configs from Firestore (falls back to in-memory)."""
    try:
        db = _get_db()
        if not db:
            return list(_mem_sites.values())
        docs = db.collection("sites").stream()
        return [doc.to_dict() for doc in docs]
    except Exception as e:
        logger.error(f"Error listing sites from Firestore: {e}", exc_info=True)
        return list(_mem_sites.values())


def firestore_delete_site(site_id: str) -> bool:
    """Delete a site config from Firestore (falls back to in-memory)."""
    try:
        _validate_site_id(site_id)
        # Always remove from in-memory
        _mem_sites.pop(site_id, None)
        db = _get_db()
        if not db:
            logger.info(f"In-memory: site deleted: {site_id}")
            return True
        db.collection("sites").document(site_id).delete()
        logger.info(f"Firestore: site deleted: {site_id}")
        return True
    except ValueError as e:
        logger.error(f"Invalid input to firestore_delete_site: {e}")
        raise
    except Exception as e:
        logger.error(f"Error deleting site {site_id} from Firestore: {e}", exc_info=True)
        raise


# ========================================
# Session History
# ========================================


def firestore_save_session(
    site_id: str,
    session_id: str,
    user_id: str,
    messages: list[dict],
    metadata: dict | None = None,
) -> None:
    """Save or append to a session's conversation history (falls back to in-memory)."""
    try:
        _validate_site_id(site_id)
        _validate_site_id(session_id)
        if not isinstance(messages, list):
            raise ValueError("messages must be a list")

        now = time.time()
        session_data: dict[str, Any] = {
            "user_id": user_id,
            "site_id": site_id,
            "session_id": session_id,
            "updated_at": now,
        }

        db = _get_db()
        if not db:
            # In-memory fallback
            existing = _mem_sessions[site_id].get(session_id, {})
            if existing:
                existing_messages = existing.get("messages", [])
                existing_messages.extend(messages)
                session_data["messages"] = existing_messages
                session_data["created_at"] = existing.get("created_at", now)
            else:
                session_data["created_at"] = now
                session_data["messages"] = messages
            if metadata:
                session_data["metadata"] = metadata
            _mem_sessions[site_id][session_id] = session_data
            return

        doc_ref = db.collection("sites").document(site_id).collection("sessions").document(session_id)
        doc = doc_ref.get()

        if doc.exists:
            existing = doc.to_dict() or {}
            existing_messages = existing.get("messages", [])
            existing_messages.extend(messages)
            session_data["messages"] = existing_messages
        else:
            session_data["created_at"] = now
            session_data["messages"] = messages

        if metadata:
            session_data["metadata"] = metadata

        doc_ref.set(session_data, merge=True)
        # Also keep in memory
        _mem_sessions[site_id][session_id] = session_data
    except ValueError as e:
        logger.error(f"Invalid input to firestore_save_session: {e}")
        raise
    except Exception as e:
        logger.error(f"Error saving session {session_id}: {e}", exc_info=True)
        raise


def firestore_get_session(site_id: str, session_id: str) -> dict | None:
    """Get a session's history (falls back to in-memory)."""
    try:
        _validate_site_id(site_id)
        _validate_site_id(session_id)
        db = _get_db()
        if not db:
            return _mem_sessions.get(site_id, {}).get(session_id)
        doc = db.collection("sites").document(site_id).collection("sessions").document(session_id).get()
        if doc.exists:
            return doc.to_dict()
        # Fall back to in-memory
        return _mem_sessions.get(site_id, {}).get(session_id)
    except ValueError as e:
        logger.error(f"Invalid input to firestore_get_session: {e}")
        raise
    except Exception as e:
        logger.error(f"Error getting session {session_id}: {e}", exc_info=True)
        return _mem_sessions.get(site_id, {}).get(session_id)


def firestore_list_sessions(
    site_id: str,
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    """List recent sessions for a site (falls back to in-memory)."""
    try:
        _validate_site_id(site_id)
        if limit < 1 or limit > 100:
            raise ValueError("limit must be 1-100")
        if offset < 0:
            raise ValueError("offset must be >= 0")
        db = _get_db()
        if not db:
            # In-memory: sort by updated_at descending
            sessions = list(_mem_sessions.get(site_id, {}).values())
            sessions.sort(key=lambda s: s.get("updated_at", 0), reverse=True)
            return sessions[offset:offset + limit]

        query = (
            db.collection("sites")
            .document(site_id)
            .collection("sessions")
            .order_by("updated_at", direction=firestore.Query.DESCENDING)
            .limit(limit)
            .offset(offset)
        )
        return [doc.to_dict() for doc in query.stream()]
    except ValueError as e:
        logger.error(f"Invalid input to firestore_list_sessions: {e}")
        raise
    except Exception as e:
        logger.error(f"Error listing sessions for {site_id}: {e}", exc_info=True)
        # Fall back to in-memory
        sessions = list(_mem_sessions.get(site_id, {}).values())
        sessions.sort(key=lambda s: s.get("updated_at", 0), reverse=True)
        return sessions[:limit]


# ========================================
# Knowledge Base (structured docs)
# ========================================


def firestore_set_knowledge(site_id: str, doc_id: str, content: str, title: str = "") -> None:
    """Store a knowledge base document for a site (falls back to in-memory)."""
    try:
        _validate_site_id(site_id)
        _validate_site_id(doc_id)
        if not isinstance(content, str):
            raise ValueError("content must be a string")
        _validate_content_length(content, max_length=50000)
        if not isinstance(title, str):
            raise ValueError("title must be a string")
        if len(title) > 500:
            raise ValueError("title exceeds max length of 500 chars")

        doc_data = {
            "title": title,
            "content": content,
            "updated_at": time.time(),
        }

        # Always write to in-memory
        _mem_knowledge[site_id][doc_id] = doc_data
        logger.info(f"Knowledge doc saved (in-memory): {site_id}/{doc_id}")

        db = _get_db()
        if not db:
            return

        db.collection("sites").document(site_id).collection("knowledge").document(doc_id).set(doc_data)
        logger.info(f"Knowledge doc saved (Firestore): {site_id}/{doc_id}")
    except ValueError as e:
        logger.error(f"Invalid input to firestore_set_knowledge: {e}")
        raise
    except Exception as e:
        logger.error(f"Error saving knowledge doc {doc_id}: {e}", exc_info=True)
        raise


def firestore_get_knowledge(site_id: str) -> list[dict]:
    """Get all knowledge base documents for a site (falls back to in-memory)."""
    try:
        _validate_site_id(site_id)
        db = _get_db()
        if not db:
            # Return from in-memory storage
            return [
                {"id": doc_id, **doc_data}
                for doc_id, doc_data in _mem_knowledge.get(site_id, {}).items()
            ]
        docs = db.collection("sites").document(site_id).collection("knowledge").stream()
        result = [{"id": doc.id, **doc.to_dict()} for doc in docs]
        # Also include any in-memory docs not in Firestore
        fs_ids = {d["id"] for d in result}
        for doc_id, doc_data in _mem_knowledge.get(site_id, {}).items():
            if doc_id not in fs_ids:
                result.append({"id": doc_id, **doc_data})
        return result
    except ValueError as e:
        logger.error(f"Invalid input to firestore_get_knowledge: {e}")
        raise
    except Exception as e:
        logger.error(f"Error getting knowledge for {site_id}: {e}", exc_info=True)
        # Fall back to in-memory
        return [
            {"id": doc_id, **doc_data}
            for doc_id, doc_data in _mem_knowledge.get(site_id, {}).items()
        ]


def firestore_delete_knowledge(site_id: str, doc_id: str) -> bool:
    """Delete a knowledge base document (falls back to in-memory)."""
    try:
        _validate_site_id(site_id)
        _validate_site_id(doc_id)
        # Always remove from in-memory
        if site_id in _mem_knowledge:
            _mem_knowledge[site_id].pop(doc_id, None)
        db = _get_db()
        if not db:
            logger.info(f"Knowledge doc deleted (in-memory): {site_id}/{doc_id}")
            return True
        db.collection("sites").document(site_id).collection("knowledge").document(doc_id).delete()
        logger.info(f"Knowledge doc deleted (Firestore): {site_id}/{doc_id}")
        return True
    except ValueError as e:
        logger.error(f"Invalid input to firestore_delete_knowledge: {e}")
        raise
    except Exception as e:
        logger.error(f"Error deleting knowledge doc {doc_id}: {e}", exc_info=True)
        raise


# ========================================
# Analytics (lightweight counters)
# ========================================


def firestore_increment_stats(site_id: str, stat_key: str, amount: int = 1) -> None:
    """Increment a site analytics counter (falls back to in-memory)."""
    try:
        _validate_site_id(site_id)
        if not isinstance(stat_key, str) or not stat_key:
            raise ValueError("stat_key must be non-empty string")
        if not isinstance(amount, int):
            raise ValueError("amount must be integer")

        # Always update in-memory
        _mem_stats[site_id][stat_key] += amount

        db = _get_db()
        if not db:
            return

        doc_ref = db.collection("sites").document(site_id).collection("stats").document("counters")
        doc_ref.set(
            {stat_key: firestore.Increment(amount), "updated_at": time.time()},
            merge=True,
        )
    except ValueError as e:
        logger.error(f"Invalid input to firestore_increment_stats: {e}")
        raise
    except Exception as e:
        logger.error(f"Error incrementing stats for {site_id}: {e}", exc_info=True)
        # Already incremented in-memory, so this is ok


def firestore_get_stats(site_id: str) -> dict:
    """Get analytics counters for a site (falls back to in-memory)."""
    try:
        _validate_site_id(site_id)
        db = _get_db()
        if not db:
            return dict(_mem_stats.get(site_id, {}))
        doc = db.collection("sites").document(site_id).collection("stats").document("counters").get()
        if doc.exists:
            return doc.to_dict() or {}
        # Fall back to in-memory
        return dict(_mem_stats.get(site_id, {}))
    except ValueError as e:
        logger.error(f"Invalid input to firestore_get_stats: {e}")
        raise
    except Exception as e:
        logger.error(f"Error getting stats for {site_id}: {e}", exc_info=True)
        return dict(_mem_stats.get(site_id, {}))
