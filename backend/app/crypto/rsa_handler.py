from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.backends import default_backend
from pathlib import Path
import os

class RSAHandler:
    def __init__(self, private_key_path: str = None, public_key_path: str = None):
        self.private_key_path = private_key_path
        self.public_key_path = public_key_path
        self.private_key = None
        self.public_key = None
        
        # Try to load existing keys, generate if not exist
        if private_key_path and Path(private_key_path).exists():
            self.load_keys()
        else:
            self.generate_keys()
    
    def generate_keys(self):
        """Generate RSA-2048 key pair"""
        self.private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
            backend=default_backend()
        )
        self.public_key = self.private_key.public_key()
        
        # Save keys if paths provided
        if self.private_key_path:
            self.save_keys()
    
    def save_keys(self):
        """Save keys to files"""
        # Create directory if not exists
        os.makedirs(os.path.dirname(self.private_key_path), exist_ok=True)
        
        # Save private key
        with open(self.private_key_path, 'wb') as f:
            f.write(self.private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption()
            ))
        
        # Save public key
        with open(self.public_key_path, 'wb') as f:
            f.write(self.public_key.public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo
            ))
        
        # Set secure permissions (read-only for owner)
        os.chmod(self.private_key_path, 0o600)
        os.chmod(self.public_key_path, 0o644)
    
    def load_keys(self):
        """Load keys from files"""
        with open(self.private_key_path, 'rb') as f:
            self.private_key = serialization.load_pem_private_key(
                f.read(),
                password=None,
                backend=default_backend()
            )
        
        with open(self.public_key_path, 'rb') as f:
            self.public_key = serialization.load_pem_public_key(
                f.read(),
                backend=default_backend()
            )
    
    def encrypt_aes_key(self, aes_key: bytes, recipient_public_key=None) -> bytes:
        """Encrypt AES key with RSA public key"""
        if recipient_public_key is None:
            recipient_public_key = self.public_key
        
        encrypted_key = recipient_public_key.encrypt(
            aes_key,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        )
        return encrypted_key
    
    def decrypt_aes_key(self, encrypted_aes_key: bytes) -> bytes:
        """Decrypt AES key with RSA private key"""
        aes_key = self.private_key.decrypt(
            encrypted_aes_key,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        )
        return aes_key
    
    def get_public_key_pem(self) -> str:
        """Get public key in PEM format as string"""
        return self.public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        ).decode('utf-8')
    
    def get_private_key_pem(self) -> str:
        """Get private key in PEM format (use carefully!)"""
        return self.private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        ).decode('utf-8')