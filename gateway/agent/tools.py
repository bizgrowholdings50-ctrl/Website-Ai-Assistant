"""WebClaw Agent: DOM action tools for website interaction."""

import logging
import re
from typing import Any

logger = logging.getLogger(__name__)


# ========================================
# Input Validation
# ========================================

def _validate_selector(selector: str) -> None:
    """Validate CSS selector for safety and length."""
    if not selector or len(selector) > 1000:
        raise ValueError("selector must be 1-1000 characters")
    # Disallow potentially dangerous characters that could break CSS or execute code
    # Note: we allow most CSS syntax, but prevent some extreme cases
    if selector.count(';') > 10:
        raise ValueError("selector contains too many semicolons")
    if '<script' in selector.lower() or 'javascript:' in selector.lower():
        raise ValueError("selector contains invalid patterns")


def _validate_url(url: str) -> None:
    """Validate URL - only allow http/https."""
    if not url or len(url) > 2000:
        raise ValueError("url must be 1-2000 characters")
    if not (url.startswith('http://') or url.startswith('https://')):
        raise ValueError("url must start with http:// or https://")
    # Prevent javascript: URIs
    if 'javascript:' in url.lower() or 'data:' in url.lower():
        raise ValueError("url protocol not allowed")


def click_element(selector: str, description: str = "") -> dict[str, Any]:
    """Click an element on the page.

    Args:
        selector: CSS selector or aria label to identify the element.
        description: Human-readable description of what is being clicked.

    Returns:
        dict: Action result with status and details.
    """
    try:
        _validate_selector(selector)
        if len(description) > 500:
            description = description[:500]
        return {
            "action": "click",
            "selector": selector,
            "description": description,
            "status": "pending",
        }
    except ValueError as e:
        logger.error(f"Invalid input to click_element: {e}")
        raise


def type_text(selector: str, text: str, clear_first: bool = True) -> dict[str, Any]:
    """Type text into an input field.

    Args:
        selector: CSS selector or aria label of the input element.
        text: The text to type into the field.
        clear_first: Whether to clear existing content before typing.

    Returns:
        dict: Action result with status and details.
    """
    try:
        _validate_selector(selector)
        if len(text) > 10000:
            raise ValueError("text exceeds max length of 10000 characters")
        return {
            "action": "type",
            "selector": selector,
            "text": text,
            "clear_first": clear_first,
            "status": "pending",
        }
    except ValueError as e:
        logger.error(f"Invalid input to type_text: {e}")
        raise


def scroll_to(selector: str = "", direction: str = "down", amount: int = 300) -> dict[str, Any]:
    """Scroll the page or scroll to a specific element.

    Args:
        selector: CSS selector to scroll to. If empty, scrolls the page by amount.
        direction: Scroll direction - 'up' or 'down'. Only used when selector is empty.
        amount: Pixels to scroll. Only used when selector is empty.

    Returns:
        dict: Action result with status and details.
    """
    try:
        if selector:
            _validate_selector(selector)
        if direction not in ("up", "down"):
            raise ValueError("direction must be 'up' or 'down'")
        if not isinstance(amount, int) or amount < 0 or amount > 10000:
            raise ValueError("amount must be integer 0-10000")
        return {
            "action": "scroll",
            "selector": selector,
            "direction": direction,
            "amount": amount,
            "status": "pending",
        }
    except ValueError as e:
        logger.error(f"Invalid input to scroll_to: {e}")
        raise


def scroll_to_top() -> dict[str, Any]:
    """Scroll the page to the very top.

    Returns:
        dict: Action result with status and details.
    """
    return {
        "action": "scroll_to_top",
        "status": "pending",
    }


def scroll_to_bottom() -> dict[str, Any]:
    """Scroll the page to the very bottom.

    Returns:
        dict: Action result with status and details.
    """
    return {
        "action": "scroll_to_bottom",
        "status": "pending",
    }


def navigate_to(url: str) -> dict[str, Any]:
    """Navigate to a URL within the current website.

    Args:
        url: The URL or path to navigate to (relative or absolute within the site).

    Returns:
        dict: Action result with status and details.
    """
    try:
        _validate_url(url)
        return {
            "action": "navigate",
            "url": url,
            "status": "pending",
        }
    except ValueError as e:
        logger.error(f"Invalid input to navigate_to: {e}")
        raise


def highlight_element(selector: str, message: str = "") -> dict[str, Any]:
    """Highlight an element on the page to draw user attention.

    Args:
        selector: CSS selector or aria label of the element to highlight.
        message: Optional tooltip message to show near the highlighted element.

    Returns:
        dict: Action result with status and details.
    """
    try:
        _validate_selector(selector)
        if len(message) > 1000:
            message = message[:1000]
        return {
            "action": "highlight",
            "selector": selector,
            "message": message,
            "status": "pending",
        }
    except ValueError as e:
        logger.error(f"Invalid input to highlight_element: {e}")
        raise


def read_page(selector: str = "body") -> dict[str, Any]:
    """Read and extract text content from the page or a specific element.

    Args:
        selector: CSS selector of the element to read. Defaults to body (full page).

    Returns:
        dict: Action result with the extracted content.
    """
    try:
        _validate_selector(selector)
        return {
            "action": "read",
            "selector": selector,
            "status": "pending",
        }
    except ValueError as e:
        logger.error(f"Invalid input to read_page: {e}")
        raise


def select_option(selector: str, value: str) -> dict[str, Any]:
    """Select an option from a dropdown or select element.

    Args:
        selector: CSS selector of the select/dropdown element.
        value: The value or visible text of the option to select.

    Returns:
        dict: Action result with status and details.
    """
    try:
        _validate_selector(selector)
        if len(value) > 1000:
            raise ValueError("value exceeds max length of 1000 characters")
        return {
            "action": "select",
            "selector": selector,
            "value": value,
            "status": "pending",
        }
    except ValueError as e:
        logger.error(f"Invalid input to select_option: {e}")
        raise


def check_checkbox(selector: str, checked: bool = True) -> dict[str, Any]:
    """Check or uncheck a checkbox element.

    Args:
        selector: CSS selector of the checkbox element.
        checked: Whether to check (True) or uncheck (False) the checkbox.

    Returns:
        dict: Action result with status and details.
    """
    try:
        _validate_selector(selector)
        if not isinstance(checked, bool):
            raise ValueError("checked must be boolean")
        return {
            "action": "check",
            "selector": selector,
            "checked": checked,
            "status": "pending",
        }
    except ValueError as e:
        logger.error(f"Invalid input to check_checkbox: {e}")
        raise


# All tools exposed to the ADK agent
DOM_TOOLS = [
    click_element,
    type_text,
    scroll_to,
    scroll_to_top,
    scroll_to_bottom,
    navigate_to,
    highlight_element,
    read_page,
    select_option,
    check_checkbox,
]
