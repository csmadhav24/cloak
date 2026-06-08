import hashlib

class IntegrityVerifier:
    @staticmethod
    def compute_sha256(data: bytes) -> str:
        """Compute SHA-256 hash of bytes data"""
        return hashlib.sha256(data).hexdigest()
    
    @staticmethod
    def verify_sha256(data: bytes, expected_hash: str) -> bool:
        """Verify data integrity against expected hash"""
        computed_hash = IntegrityVerifier.compute_sha256(data)
        
        # Use constant-time comparison to prevent timing attacks
        return secrets.compare_digest(computed_hash, expected_hash)
    
    @staticmethod
    def compute_file_hash(file_path: str, chunk_size: int = 8192) -> str:
        """
        Compute SHA-256 hash of a file efficiently
        
        Args:
            file_path: Path to file
            chunk_size: Size of chunks to read
            
        Returns:
            str: Hexadecimal hash
        """
        sha256_hash = hashlib.sha256()
        
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(chunk_size), b""):
                sha256_hash.update(byte_block)
        
        return sha256_hash.hexdigest()
    
    @staticmethod
    def compute_hash_base64(data: bytes) -> str:
        """Compute SHA-256 and return as base64"""
        import base64
        hash_bytes = hashlib.sha256(data).digest()
        return base64.b64encode(hash_bytes).decode('utf-8')

# Import secrets for constant-time comparison
import secrets