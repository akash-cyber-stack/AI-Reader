"""
Voice Verification Service using SpeechBrain
Handles speaker verification and voice profile management
"""

import numpy as np
import logging
from typing import List, Tuple
import os

logger = logging.getLogger(__name__)

class VoiceVerificationService:
    """Speaker verification using embeddings"""
    
    def __init__(self):
        """Initialize voice verification service"""
        self.similarity_threshold = float(os.getenv('VOICE_CONFIDENCE_THRESHOLD', 0.85))
        logger.info("Voice Verification Service initialized")
    
    async def enroll_voice(self, audio_samples: List[bytes], sample_rate: int = 16000) -> List[List[float]]:
        """
        Generate voice embeddings for enrollment
        
        Args:
            audio_samples: List of audio byte buffers
            sample_rate: Audio sample rate (default 16000 Hz)
        
        Returns:
            List of embedding vectors
        """
        try:
            embeddings = []
            for audio_data in audio_samples:
                # In production, use SpeechBrain or similar model
                # For now, we'll use a placeholder that generates deterministic embeddings
                embedding = self._generate_embedding(audio_data, sample_rate)
                embeddings.append(embedding)
            
            logger.info(f"Generated {len(embeddings)} voice embeddings for enrollment")
            return embeddings
        except Exception as e:
            logger.error(f"Error in voice enrollment: {e}")
            raise
    
    async def verify_voice(self, audio_data: bytes, stored_embeddings: List[List[float]], 
                          sample_rate: int = 16000) -> Tuple[bool, float]:
        """
        Verify voice against stored embeddings
        
        Args:
            audio_data: Input audio bytes
            stored_embeddings: List of reference embeddings from enrollment
            sample_rate: Audio sample rate
        
        Returns:
            Tuple of (verified: bool, similarity: float)
        """
        try:
            # Generate embedding for input audio
            input_embedding = self._generate_embedding(audio_data, sample_rate)
            
            # Calculate similarity with stored embeddings
            similarities = []
            for stored_emb in stored_embeddings:
                similarity = self._cosine_similarity(input_embedding, stored_emb)
                similarities.append(similarity)
            
            # Use average similarity
            avg_similarity = np.mean(similarities) if similarities else 0.0
            verified = avg_similarity >= self.similarity_threshold
            
            logger.info(f"Voice verification result: verified={verified}, similarity={avg_similarity:.4f}")
            return verified, float(avg_similarity)
        except Exception as e:
            logger.error(f"Error in voice verification: {e}")
            raise
    
    def _generate_embedding(self, audio_data: bytes, sample_rate: int) -> List[float]:
        """
        Generate a voice embedding from audio data
        
        In production, this would use SpeechBrain or similar model:
        from speechbrain.pretrained import SpeakerRecognition
        
        For now, using a deterministic placeholder
        """
        # Convert audio bytes to numpy array
        audio_array = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0
        
        # Extract simple features as embedding (MFCCs in production)
        # This is a simplified placeholder - in production use librosa or scipy
        embedding = [
            float(np.mean(audio_array)),
            float(np.std(audio_array)),
            float(np.max(audio_array)),
            float(np.min(audio_array)),
            float(np.median(audio_array)),
            # Add more features as needed
        ]
        
        # Pad to consistent size
        while len(embedding) < 512:
            embedding.append(0.0)
        
        return embedding[:512]
    
    def _cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """
        Calculate cosine similarity between two vectors
        """
        v1 = np.array(vec1)
        v2 = np.array(vec2)
        
        dot_product = np.dot(v1, v2)
        magnitude1 = np.linalg.norm(v1)
        magnitude2 = np.linalg.norm(v2)
        
        if magnitude1 == 0 or magnitude2 == 0:
            return 0.0
        
        return float(dot_product / (magnitude1 * magnitude2))
