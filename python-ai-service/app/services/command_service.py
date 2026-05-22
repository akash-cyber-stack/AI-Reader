"""
Command Interpretation Service
Maps owner natural language (English / Hindi / Hinglish) to structured desktop actions.
"""

import logging
import os
import re
from typing import Tuple
from urllib.parse import quote_plus

logger = logging.getLogger(__name__)

# Windows launch names: spoken name -> start command / process
APP_ALIASES: dict[str, tuple[str, str, str]] = {
    "chrome": ("chrome", "chrome", "Chrome"),
    "google chrome": ("chrome", "chrome", "Chrome"),
    "क्रोम": ("chrome", "chrome", "Chrome"),
    "firefox": ("firefox", "firefox", "Firefox"),
    "edge": ("msedge", "msedge", "Edge"),
    "microsoft edge": ("msedge", "msedge", "Edge"),
    "notepad": ("notepad", "notepad", "Notepad"),
    "note pad": ("notepad", "notepad", "Notepad"),
    "नोटपैड": ("notepad", "notepad", "Notepad"),
    "calculator": ("calc", "calc", "Calculator"),
    "calc": ("calc", "calc", "Calculator"),
    "कैलकुलेटर": ("calc", "calc", "Calculator"),
    "paint": ("mspaint", "mspaint", "Paint"),
    "ms paint": ("mspaint", "mspaint", "Paint"),
    "explorer": ("explorer", "explorer", "File Explorer"),
    "file explorer": ("explorer", "explorer", "File Explorer"),
    "files": ("explorer", "explorer", "File Explorer"),
    "word": ("winword", "winword", "Word"),
    "excel": ("excel", "excel", "Excel"),
    "powerpoint": ("powerpnt", "powerpnt", "PowerPoint"),
    "outlook": ("outlook", "outlook", "Outlook"),
    "teams": ("ms-teams", "ms-teams", "Teams"),
    "spotify": ("spotify", "spotify", "Spotify"),
    "vscode": ("code", "code", "VS Code"),
    "vs code": ("code", "code", "VS Code"),
    "visual studio code": ("code", "code", "VS Code"),
    "cmd": ("cmd", "cmd", "Command Prompt"),
    "command prompt": ("cmd", "cmd", "Command Prompt"),
    "terminal": ("wt", "wt", "Terminal"),
    "windows terminal": ("wt", "wt", "Terminal"),
    "powershell": ("powershell", "powershell", "PowerShell"),
    "settings": ("ms-settings:", "SystemSettings", "Settings"),
    "control panel": ("control", "control", "Control Panel"),
    "task manager": ("taskmgr", "taskmgr", "Task Manager"),
    "photos": ("ms-photos:", "Microsoft.Photos", "Photos"),
    "camera": ("microsoft.windows.camera:", "WindowsCamera", "Camera"),
    "calendar": ("outlookcal:", "olk", "Calendar"),
    "store": ("ms-windows-store:", "WinStore.App", "Microsoft Store"),
}

URL_ALIASES: dict[str, tuple[str, str]] = {
    "youtube": ("https://www.youtube.com", "YouTube"),
    "यूट्यूब": ("https://www.youtube.com", "YouTube"),
    "google": ("https://www.google.com", "Google"),
    "गूगल": ("https://www.google.com", "Google"),
    "gmail": ("https://mail.google.com", "Gmail"),
    "whatsapp": ("https://web.whatsapp.com", "WhatsApp"),
    "chatgpt": ("https://chatgpt.com", "ChatGPT"),
    "facebook": ("https://www.facebook.com", "Facebook"),
    "instagram": ("https://www.instagram.com", "Instagram"),
    "twitter": ("https://x.com", "X"),
    "x.com": ("https://x.com", "X"),
    "linkedin": ("https://www.linkedin.com", "LinkedIn"),
    "github": ("https://github.com", "GitHub"),
    "netflix": ("https://www.netflix.com", "Netflix"),
}

FOLDER_ALIASES: dict[str, str] = {
    "desktop": "Desktop",
    "डेस्कटॉप": "Desktop",
    "downloads": "Downloads",
    "डाउनलोड": "Downloads",
    "documents": "Documents",
    "दस्तावेज": "Documents",
    "pictures": "Pictures",
    "photos": "Pictures",
    "videos": "Videos",
    "music": "Music",
    "home": "~",
}


class CommandInterpreterService:
    """Interprets owner voice commands into executable actions."""

    def __init__(self):
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        self.confidence_threshold = float(os.getenv("VOICE_CONFIDENCE_THRESHOLD", 0.85))
        logger.info("Command Interpreter Service initialized")

    async def interpret_command(self, text: str) -> Tuple[dict, float, str]:
        try:
            text = text.strip()
            if not text:
                raise ValueError("Empty command text")

            action, voice_response = self._interpret(text)
            confidence = 0.92
            logger.info("Command interpreted: %s -> %s", text, action["type"])
            return action, confidence, voice_response
        except Exception as e:
            logger.error("Error interpreting command: %s", e)
            raise

    def _normalize(self, text: str) -> str:
        n = text.lower().strip()
        replacements = {
            "ओपन": "open",
            "खोलो": "open",
            "खोल": "open",
            "चालू": "open",
            "लॉन्च": "launch",
            "बंद करो": "close",
            "बंद": "close",
            "हटाओ": "delete",
            "डिलीट": "delete",
            "स्क्रीनशॉट": "screenshot",
            "बनाओ": "create",
            "लिखो": "type",
            "टाइप": "type",
            "चलाओ": "run",
            "रन": "run",
            "शटडाउन": "shutdown",
            "रीस्टार्ट": "restart",
            "लॉक": "lock",
            "स्लीप": "sleep",
            "म्यूट": "mute",
            "आवाज": "volume",
        }
        for src, dst in replacements.items():
            n = n.replace(src, dst)
        return n

    def _user_home_placeholder(self) -> str:
        return "%USERPROFILE%"

    def _resolve_folder(self, name: str) -> str:
        key = name.strip().lower()
        if key in FOLDER_ALIASES:
            part = FOLDER_ALIASES[key]
            if part == "~":
                return self._user_home_placeholder()
            return os.path.join(self._user_home_placeholder(), part)
        if re.match(r"^[a-z]:\\", name, re.I) or name.startswith("\\\\"):
            return name
        if name.startswith("~"):
            return name.replace("~", self._user_home_placeholder(), 1)
        return os.path.join(self._user_home_placeholder(), name)

    def _extract_path(self, text: str) -> str:
        win_path = re.search(r"[a-z]:\\[^\s]+", text, re.I)
        if win_path:
            return win_path.group(0).strip('"')
        quoted = re.search(r'"([^"]+)"', text)
        if quoted:
            return quoted.group(1)
        for alias in FOLDER_ALIASES:
            if alias in text:
                return self._resolve_folder(alias)
        return ""

    def _find_app(self, text: str) -> tuple[str, str, str] | None:
        for alias, triple in sorted(APP_ALIASES.items(), key=lambda x: -len(x[0])):
            if alias in text:
                return triple
        return None

    def _interpret(self, raw: str) -> Tuple[dict, str]:
        normalized = self._normalize(raw)

        # --- Dangerous: shutdown / restart ---
        if re.search(r"\b(shutdown|shut down|power off)\b", normalized):
            return {
                "type": "SYSTEM_SHUTDOWN",
                "parameters": {},
                "requiresConfirmation": True,
            }, "Shut down the computer? Say yes to confirm."

        if re.search(r"\b(restart|reboot)\b", normalized):
            return {
                "type": "SYSTEM_RESTART",
                "parameters": {},
                "requiresConfirmation": True,
            }, "Restart the computer? Say yes to confirm."

        # --- Lock / sleep ---
        if re.search(r"\b(lock|lock screen|lock computer)\b", normalized):
            return {"type": "LOCK_SCREEN", "parameters": {}, "requiresConfirmation": False}, "Locking screen"

        if re.search(r"\b(sleep|hibernate)\b", normalized):
            return {"type": "SLEEP_SYSTEM", "parameters": {}, "requiresConfirmation": False}, "Putting computer to sleep"

        # --- Screenshot ---
        if "screenshot" in normalized or "screen shot" in normalized or "capture screen" in normalized:
            return {"type": "SCREENSHOT", "parameters": {}, "requiresConfirmation": False}, "Taking screenshot"

        # --- Volume ---
        if "mute" in normalized:
            return {"type": "MUTE_VOLUME", "parameters": {}, "requiresConfirmation": False}, "Muted"

        vol_match = re.search(r"volume\s*(\d{1,3})|(\d{1,3})\s*percent", normalized)
        if "volume" in normalized or "sound" in normalized:
            if "up" in normalized or "increase" in normalized or "loud" in normalized or "बढ़" in raw:
                return {"type": "SET_VOLUME", "parameters": {"volume": 80}, "requiresConfirmation": False}, "Volume up"
            if "down" in normalized or "decrease" in normalized or "quiet" in normalized:
                return {"type": "SET_VOLUME", "parameters": {"volume": 30}, "requiresConfirmation": False}, "Volume down"
            if vol_match:
                level = int(vol_match.group(1) or vol_match.group(2))
                level = max(0, min(100, level))
                return {"type": "SET_VOLUME", "parameters": {"volume": level}, "requiresConfirmation": False}, f"Volume set to {level}"

        # --- Run shell command (owner) ---
        run_match = re.search(r"\b(run|execute|start)\s+(command|cmd|shell)\s+(.+)", normalized, re.I)
        if run_match:
            cmd = run_match.group(3).strip()
            return {
                "type": "RUN_COMMAND",
                "parameters": {"command": cmd},
                "requiresConfirmation": False,
            }, "Running command"

        # --- Type text ---
        type_match = re.search(r"\b(type|write|enter)\s+(.+)", normalized, re.I)
        if type_match and "file" not in normalized:
            text_to_type = type_match.group(2).strip().strip('"').strip("'")
            if text_to_type:
                return {
                    "type": "TYPE_TEXT",
                    "parameters": {"text": text_to_type},
                    "requiresConfirmation": False,
                }, "Typing text"

        # --- Delete file ---
        if re.search(r"\b(delete|remove)\b", normalized) and ("file" in normalized or "folder" in normalized or "\\" in raw):
            path = self._extract_path(raw) or self._extract_path(normalized)
            if not path:
                after = re.sub(r".*\b(delete|remove)\s+(the\s+)?(file\s+)?", "", normalized).strip()
                if after:
                    path = self._resolve_folder(after) if after in FOLDER_ALIASES else after
            return {
                "type": "DELETE_FILE",
                "parameters": {"filePath": path or ""},
                "requiresConfirmation": True,
            }, "Delete this file? Say yes to confirm."

        # --- Create file ---
        create_match = re.search(
            r"\b(create|make)\s+(a\s+)?(file|note)\s+(named\s+|called\s+)?(?P<name>[^\"]+?)(?:\s+with\s+(?P<content>.+))?$",
            normalized,
            re.I,
        )
        if create_match:
            name = create_match.group("name").strip()
            content = (create_match.group("content") or "").strip().strip('"')
            folder = self._resolve_folder("documents")
            file_path = os.path.join(folder, name if name.endswith((".txt", ".md")) else f"{name}.txt")
            return {
                "type": "CREATE_FILE",
                "parameters": {"filePath": file_path, "content": content},
                "requiresConfirmation": False,
            }, f"Creating file {name}"

        # --- Open folder ---
        if re.search(r"\b(open|show)\s+(the\s+)?(folder|directory)\b", normalized) or "open my" in normalized:
            for alias in sorted(FOLDER_ALIASES.keys(), key=len, reverse=True):
                if alias in normalized:
                    return {
                        "type": "OPEN_FOLDER",
                        "parameters": {"folderPath": self._resolve_folder(alias)},
                        "requiresConfirmation": False,
                    }, f"Opening {alias}"

        folder_direct = re.search(r"\b(open|show)\s+(desktop|downloads|documents|pictures|videos|music|home)\b", normalized)
        if folder_direct:
            alias = folder_direct.group(2)
            return {
                "type": "OPEN_FOLDER",
                "parameters": {"folderPath": self._resolve_folder(alias)},
                "requiresConfirmation": False,
            }, f"Opening {alias}"

        # --- Open file ---
        if re.search(r"\b(open|show)\s+(the\s+)?file\b", normalized) or re.search(r"[a-z]:\\.*\.(txt|pdf|docx?|xlsx?|png|jpg)", raw, re.I):
            path = self._extract_path(raw)
            if path:
                return {
                    "type": "OPEN_FILE",
                    "parameters": {"filePath": path},
                    "requiresConfirmation": False,
                }, "Opening file"

        # --- WhatsApp / message URL ---
        if "message" in normalized or "msg" in normalized or "whatsapp" in normalized:
            message_text = (
                normalized.replace("whatsapp", "")
                .replace("message", "")
                .replace("msg", "")
                .replace("send", "")
                .replace("karo", "")
                .replace("bhejo", "")
                .strip()
            )
            if not message_text or message_text in ("on", "open"):
                message_text = "Hello"
            return {
                "type": "OPEN_URL",
                "parameters": {"url": f"https://web.whatsapp.com/send?text={quote_plus(message_text)}"},
                "requiresConfirmation": False,
            }, "Opening WhatsApp"

        wants_open = any(w in normalized for w in ("open", "launch", "start", "go to", "goto", "visit"))
        wants_close = any(w in normalized for w in ("close", "kill", "stop app", "exit app"))

        # --- Close app ---
        if wants_close:
            app = self._find_app(normalized)
            if app:
                _launch, process_name, label = app
                return {
                    "type": "CLOSE_APP",
                    "parameters": {"appName": process_name},
                    "requiresConfirmation": False,
                }, f"Closing {label}"
            target = re.sub(r".*\b(close|kill|stop|exit)\s+", "", normalized).strip()
            if target:
                return {
                    "type": "CLOSE_APP",
                    "parameters": {"appName": target.replace(" ", "")},
                    "requiresConfirmation": False,
                }, f"Closing {target}"

        # --- Open URL / site ---
        if wants_open:
            for alias, (url, label) in sorted(URL_ALIASES.items(), key=lambda x: -len(x[0])):
                if alias in normalized:
                    return {
                        "type": "OPEN_URL",
                        "parameters": {"url": url},
                        "requiresConfirmation": False,
                    }, f"Opening {label}"

            url_in_text = re.search(r"https?://\S+", raw, re.I)
            if url_in_text:
                return {
                    "type": "OPEN_URL",
                    "parameters": {"url": url_in_text.group(0)},
                    "requiresConfirmation": False,
                }, "Opening link"

            if re.search(r"\b(website|site|web)\b", normalized):
                site = re.sub(r".*\b(open|visit|go to)\s+(the\s+)?(website|site|web)\s*", "", normalized).strip()
                if site:
                    return {
                        "type": "OPEN_URL",
                        "parameters": {"url": f"https://{site}.com" if "." not in site else f"https://{site}"},
                        "requiresConfirmation": False,
                    }, f"Opening {site}"

            app = self._find_app(normalized)
            if app:
                launch_name, _process, label = app
                return {
                    "type": "OPEN_APP",
                    "parameters": {"appName": launch_name, "arguments": []},
                    "requiresConfirmation": False,
                }, f"Opening {label}"

            # Generic: "open <anything>" -> try as app name first
            target = re.sub(
                r"^\s*(open|launch|start|go to|goto|visit)\s+(the\s+)?(app\s+)?",
                "",
                normalized,
            ).strip()
            if target and len(target) > 1:
                if "." in target and " " not in target:
                    return {
                        "type": "OPEN_URL",
                        "parameters": {"url": f"https://{target}" if not target.startswith("http") else target},
                        "requiresConfirmation": False,
                    }, f"Opening {target}"
                safe_name = re.sub(r"[^a-z0-9\s\-_]", "", target).strip().replace(" ", "")
                if safe_name:
                    return {
                        "type": "OPEN_APP",
                        "parameters": {"appName": safe_name, "arguments": []},
                        "requiresConfirmation": False,
                    }, f"Opening {target}"

        # --- Search fallback ---
        return {
            "type": "OPEN_URL",
            "parameters": {"url": f"https://www.google.com/search?q={quote_plus(raw)}"},
            "requiresConfirmation": False,
        }, f"Searching for {raw}"

    def get_dangerous_commands(self) -> list:
        dangerous = os.getenv("DANGEROUS_COMMANDS", "DELETE_FILE,SYSTEM_SHUTDOWN,SYSTEM_RESTART")
        return [c.strip() for c in dangerous.split(",") if c.strip()]

    def get_safe_commands(self) -> list:
        safe = os.getenv(
            "SAFE_COMMANDS",
            "OPEN_APP,OPEN_URL,CLOSE_APP,SCREENSHOT,OPEN_FOLDER,OPEN_FILE,CREATE_FILE,"
            "SET_VOLUME,MUTE_VOLUME,LOCK_SCREEN,SLEEP_SYSTEM,TYPE_TEXT",
        )
        return [c.strip() for c in safe.split(",") if c.strip()]
