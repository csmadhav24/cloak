from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
import os

class AES256Handler:
    def __init__(self):
        self.key_size = 32  # 256 bits
        self.iv_size = 12   # 96 bits for GCM (recommended)
        self.tag_size = 16  # 128 bits authentication tag
    
    def generate_key(self) -> bytes:
        """Generate a random AES-256 key"""
        return os.urandom(self.key_size)
    
    def encrypt(self, plaintext: bytes, key: bytes = None) -> tuple:
        """
        Encrypt data with AES-256-GCM
        
        Args:
            plaintext: Data to encrypt
            key: Optional AES key (generated if not provided)
            
        Returns:
            tuple: (ciphertext, key, iv, auth_tag)
        """
        if key is None:
            key = self.generate_key()
        
        # Generate random IV
        iv = os.urandom(self.iv_size)
        
        # Create cipher
        cipher = Cipher(
            algorithms.AES(key),
            modes.GCM(iv),
            backend=default_backend()
        )
        encryptor = cipher.encryptor()
        
        # Encrypt
        ciphertext = encryptor.update(plaintext) + encryptor.finalize()
        
        return ciphertext, key, iv, encryptor.tag
    
    def decrypt(self, ciphertext: bytes, key: bytes, iv: bytes, auth_tag: bytes) -> bytes:
        """
        Decrypt data with AES-256-GCM
        
        Args:
            ciphertext: Encrypted data
            key: AES key
            iv: Initialization vector
            auth_tag: Authentication tag
            
        Returns:
            bytes: Decrypted plaintext
        """
        cipher = Cipher(
            algorithms.AES(key),
            modes.GCM(iv, auth_tag),
            backend=default_backend()
        )
        decryptor = cipher.decryptor()
        return decryptor.update(ciphertext) + decryptor.finalize()