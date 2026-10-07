"""Pytest configuration for WebClaw Gateway tests."""

import os
import sys

# Add parent directory to path so we can import main module
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def pytest_configure(config):
    """Configure pytest."""
    # Ensure we're not using real Firestore during tests
    os.environ["GOOGLE_CLOUD_PROJECT"] = ""
