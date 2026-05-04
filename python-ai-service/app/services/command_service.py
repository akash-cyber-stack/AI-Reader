"""
Command Interpretation Service
Converts natural language to structured commands using simple multilingual rules.
"""

import logging
import os
from typing import Tuple
from urllib.parse import quote_plus

logger = logging.getLogger(__name__)


class CommandInterpreterService:
    """AI-powered command interpretation"""

    def __init__(self):
        """Initialize command interpreter"""
        self.openai_api_key = os.getenv('OPENAI_API_KEY')
        self.confidence_threshold = float(os.getenv('VOICE_CONFIDENCE_THRESHOLD', 0.85))
        logger.info("Command Interpreter Service initialized")

    async def interpret_command(self, text: str) -> Tuple[dict, float, str]:
        """
        Interpret natural language command into structured action.
        Supports common English, Hindi, and Hinglish open/close commands.
        """
        try:
            text = text.lower().strip()

            if not text:
                raise ValueError("Empty command text")

            action, voice_response = self._mock_interpret(text)

            command_words = ("open", "close", "delete", "message", "msg", "kholo", "khol", "band", "खोल", "बंद", "हट", "मैसेज", "संदेश")
            confidence = 0.95 if any(word in text for word in command_words) else 0.75

            logger.info(f"Command interpreted: {text} -> {action['type']} (confidence: {confidence:.4f})")
            return action, confidence, voice_response
        except Exception as e:
            logger.error(f"Error interpreting command: {e}")
            raise

    def _mock_interpret(self, text: str) -> Tuple[dict, str]:
        """Rule-based command interpretation for local development."""
        normalized = (
            text.lower().strip()
            .replace("ओपन", "open")
            .replace("खोलो", "open")
            .replace("खोल", "open")
            .replace("चालू", "open")
            .replace("बंद करो", "close")
            .replace("बंद", "close")
            .replace("हटाओ", "delete")
            .replace("डिलीट", "delete")
        )

        app_aliases = {
            "chrome": ("chrome", "chrome", "Chrome"),
            "google chrome": ("chrome", "chrome", "Chrome"),
            "क्रोम": ("chrome", "chrome", "Chrome"),
            "notepad": ("notepad", "notepad", "Notepad"),
            "note": ("notepad", "notepad", "Notepad"),
            "नोटपैड": ("notepad", "notepad", "Notepad"),
            "calculator": ("calc", "calc", "Calculator"),
            "calc": ("calc", "calc", "Calculator"),
            "कैलकुलेटर": ("calc", "calc", "Calculator"),
            "paint": ("mspaint", "mspaint", "Paint"),
            "पेंट": ("mspaint", "mspaint", "Paint"),
            "explorer": ("explorer", "explorer", "File Explorer"),
            "file explorer": ("explorer", "explorer", "File Explorer"),
            "फाइल": ("explorer", "explorer", "File Explorer"),
            "word": ("winword", "winword", "Word"),
            "excel": ("excel", "excel", "Excel"),
            "powerpoint": ("powerpnt", "powerpnt", "PowerPoint"),
        }

        url_aliases = {
            "youtube": ("https://www.youtube.com", "YouTube"),
            "यूट्यूब": ("https://www.youtube.com", "YouTube"),
            "google": ("https://www.google.com", "Google"),
            "गूगल": ("https://www.google.com", "Google"),
            "gmail": ("https://mail.google.com", "Gmail"),
            "जीमेल": ("https://mail.google.com", "Gmail"),
            "whatsapp": ("https://web.whatsapp.com", "WhatsApp"),
            "व्हाट्सएप": ("https://web.whatsapp.com", "WhatsApp"),
            "chatgpt": ("https://chatgpt.com", "ChatGPT"),
        }

        wants_open = "open" in normalized or "kholo" in normalized or "khol" in normalized
        wants_close = "close" in normalized or "band" in normalized
        wants_delete = "delete" in normalized
        wants_message = (
            "message" in normalized
            or "msg" in normalized
            or "मैसेज" in normalized
            or "संदेश" in normalized
        )

        if wants_message:
            message_text = (
                normalized
                .replace("whatsapp", "")
                .replace("व्हाट्सएप", "")
                .replace("message", "")
                .replace("msg", "")
                .replace("मैसेज", "")
                .replace("संदेश", "")
                .replace("karo", "")
                .replace("करो", "")
                .replace("bhejo", "")
                .replace("भेजो", "")
                .strip()
            )
            if not message_text:
                message_text = "Hello"

            return {
                "type": "OPEN_URL",
                "parameters": {"url": f"https://web.whatsapp.com/send?text={quote_plus(message_text)}"},
                "requiresConfirmation": False
            }, "Opening WhatsApp with your message"

        if wants_open:
            for alias, (url, label) in url_aliases.items():
                if alias in normalized:
                    return {
                        "type": "OPEN_URL",
                        "parameters": {"url": url},
                        "requiresConfirmation": False
                    }, f"Opening {label}"

            for alias, (app_name, _process_name, label) in app_aliases.items():
                if alias in normalized:
                    return {
                        "type": "OPEN_APP",
                        "parameters": {"appName": app_name, "arguments": []},
                        "requiresConfirmation": False
                    }, f"Opening {label}"

            target = (
                normalized
                .replace("open", "")
                .replace("kholo", "")
                .replace("khol", "")
                .strip()
            )
            if target:
                return {
                    "type": "OPEN_URL",
                    "parameters": {"url": f"https://www.google.com/search?q={quote_plus(target)}"},
                    "requiresConfirmation": False
                }, f"Searching for {target}"

        if wants_close:
            for alias, (_app_name, process_name, label) in app_aliases.items():
                if alias in normalized:
                    return {
                        "type": "CLOSE_APP",
                        "parameters": {"appName": process_name},
                        "requiresConfirmation": False
                    }, f"Closing {label}"

            return {
                "type": "CLOSE_APP",
                "parameters": {"appName": "chrome"},
                "requiresConfirmation": False
            }, "Closing application"

        if wants_delete and ("file" in normalized or "फाइल" in normalized):
            return {
                "type": "DELETE_FILE",
                "parameters": {"filePath": ""},
                "requiresConfirmation": True
            }, "Delete file. Please confirm the file path first."

        if "screenshot" in normalized or "स्क्रीनशॉट" in normalized:
            return {
                "type": "SCREENSHOT",
                "parameters": {},
                "requiresConfirmation": False
            }, "Taking screenshot"

        if "volume" in normalized or "आवाज" in normalized:
            if "up" in normalized or "बढ़" in normalized:
                return {
                    "type": "SET_VOLUME",
                    "parameters": {"volume": 80},
                    "requiresConfirmation": False
                }, "Volume increased"

            return {
                "type": "SET_VOLUME",
                "parameters": {"volume": 50},
                "requiresConfirmation": False
            }, "Volume changed"

        return {
            "type": "OPEN_URL",
            "parameters": {"url": f"https://www.google.com/search?q={quote_plus(normalized)}"},
            "requiresConfirmation": False
        }, f"Searching for {normalized}"

    def get_dangerous_commands(self) -> list:
        """Get list of commands requiring confirmation"""
        dangerous = os.getenv('DANGEROUS_COMMANDS', 'DELETE_FILE,SYSTEM_SHUTDOWN,SYSTEM_RESTART')
        return dangerous.split(',')

    def get_safe_commands(self) -> list:
        """Get list of safe commands that don't require confirmation"""
        safe = os.getenv('SAFE_COMMANDS', 'OPEN_APP,OPEN_URL,CLOSE_APP,SCREENSHOT')
        return safe.split(',')
