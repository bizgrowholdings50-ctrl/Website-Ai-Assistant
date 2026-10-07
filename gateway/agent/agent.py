"""WebClaw Agent: Core ADK agent definition."""

import os

from google.adk.agents import Agent

from .prompts import WEBCLAW_SYSTEM_PROMPT
from .tools import DOM_TOOLS

# Allow model override via env var.
# Default: gemini-live-2.5-flash-native-audio (stable native-audio model)
# Replaces the deprecated gemini-live-2.5-flash-preview-native-audio-09-2025
# (being removed March 19, 2026).
_MODEL = os.environ.get("WEBCLAW_MODEL", "gemini-2.5-flash-native-audio-preview-12-2025")

root_agent = Agent(
    name="webclaw_agent",
    model=_MODEL,
    description="A live website operations agent that can see, hear, speak, and act on web pages.",
    instruction=WEBCLAW_SYSTEM_PROMPT,
    tools=DOM_TOOLS,
)
