"""
Command Interpretation Service
Converts natural language to structured commands using LLM
"""

import logging
import os
import json
from typing import Tuple

logger = logging.getLogger(__name__)

class CommandInterpreterService:
    """AI-powered command interpretation"""
    
    def __init__(self):
        """Initialize command interpreter"""
        self.openai_api_key = os.getenv('OPENAI_API_KEY')
        self.confidence_threshold = float(os.getenv('VOICE_CONFIDENCE_THRESHOLD', 0.85))
        
        # In production, initialize OpenAI client:
        # import openai
        # openai.api_key = self.openai_api_key
        
        logger.info("Command Interpreter Service initialized")
    
    async def interpret_command(self, text: str) -> Tuple[dict, float, str]:
        """
        Interpret natural language command into structured action
        
        Args:
            text: Natural language command text
        
        Returns:
            Tuple of (action_dict: dict, confidence: float, voice_response: str)
            action_dict contains: {type, parameters, requiresConfirmation}
        """
        try:
            # Normalize input
            text = text.lower().strip()
            
            if not text:
                raise ValueError("Empty command text")
            
            # Use LLM to interpret command
            action, confidence, voice_response = await self._interpret_with_llm(text)
            
            logger.info(f"Command interpreted: {text} -> {action['type']} (confidence: {confidence:.4f})")
            return action, confidence, voice_response
        except Exception as e:
            logger.error(f"Error interpreting command: {e}")
            raise
    
    async def _interpret_with_llm(self, text: str) -> Tuple[dict, float, str]:
        """
        Use OpenAI GPT to interpret command
        In production, use actual OpenAI API
        """
        # In production implementation:
        """
        import openai
        
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[{
                "role": "user",
                "content": f'''Convert this command to a structured action JSON.
                Command: "{text}"
                
                Return JSON with format:
                {{
                    "type": "OPEN_APP|CLOSE_APP|DELETE_FILE|...",
                    "parameters": {{...}},
                    "requiresConfirmation": boolean,
                    "voiceResponse": "short confirmation message"
                }}'''
            }],
            temperature=0.3
        )
        
        result = json.loads(response['choices'][0]['message']['content'])
        confidence = response.get('confidence', 0.95)
        return result, confidence, result['voiceResponse']
        """
        
        # Mock implementation for development
        action, voice_response = self._mock_interpret(text)
        
        # Calculate mock confidence based on command clarity
        if "open" in text or "close" in text or "delete" in text:
            confidence = 0.95
        else:
            confidence = 0.75
        
        return action, confidence, voice_response
    
    def _mock_interpret(self, text: str) -> Tuple[dict, str]:
        """
        Mock command interpretation for development
        """
        # Simple keyword matching for development
        text = text.lower().strip()
        
        if "open" in text and "chrome" in text:
            return {
                "type": "OPEN_APP",
                "parameters": {"appName": "chrome", "arguments": []},
                "requiresConfirmation": False
            }, "Opening Chrome"
        
        elif "open" in text and ("notepad" in text or "note" in text):
            return {
                "type": "OPEN_APP",
                "parameters": {"appName": "notepad", "arguments": []},
                "requiresConfirmation": False
            }, "Opening Notepad"
        
        elif "close" in text:
            return {
                "type": "CLOSE_APP",
                "parameters": {"appName": "chrome"},
                "requiresConfirmation": False
            }, "Closing application"
        
        elif "delete" in text and "file" in text:
            return {
                "type": "DELETE_FILE",
                "parameters": {"filePath": ""},
                "requiresConfirmation": True
            }, "Delete file. Please confirm the file path first."
        
        elif "screenshot" in text:
            return {
                "type": "SCREENSHOT",
                "parameters": {},
                "requiresConfirmation": False
            }, "Taking screenshot"
        
        elif "volume" in text:
            if "up" in text:
                return {
                    "type": "SET_VOLUME",
                    "parameters": {"volume": 80},
                    "requiresConfirmation": False
                }, "Volume increased"
            else:
                return {
                    "type": "SET_VOLUME",
                    "parameters": {"volume": 50},
                    "requiresConfirmation": False
                }, "Volume changed"
        
        else:
            return {
                "type": "CUSTOM_COMMAND",
                "parameters": {"command": text},
                "requiresConfirmation": False
            }, "Command recorded"
    
    def get_dangerous_commands(self) -> list:
        """Get list of commands requiring confirmation"""
        dangerous = os.getenv('DANGEROUS_COMMANDS', 'DELETE_FILE,SYSTEM_SHUTDOWN,SYSTEM_RESTART')
        return dangerous.split(',')
    
    def get_safe_commands(self) -> list:
        """Get list of safe commands that don't require confirmation"""
        safe = os.getenv('SAFE_COMMANDS', 'OPEN_APP,CLOSE_APP,SCREENSHOT')
        return safe.split(',')
