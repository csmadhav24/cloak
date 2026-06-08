from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
import secrets

class PasswordManager:
    def __init__(self):
        self.ph = PasswordHasher(
            time_cost=3,
            memory_cost=65536,
            parallelism=4,
            hash_len=32,
            salt_len=16
        )
    
    def hash_password(self, password: str):
        salt = secrets.token_hex(32)
        hash_result = self.ph.hash(password + salt)
        return hash_result, salt
    
    def verify_password(self, password: str, hash_val: str, salt: str) -> bool:
        try:
            self.ph.verify(hash_val, password + salt)
            return True
        except VerifyMismatchError:
            return False
    
    def validate_password_strength(self, password: str):
        issues = []
        
        if len(password) < 8:
            issues.append("Password must be at least 8 characters long")
        
        valid = len(issues) == 0
        return valid, issues
    
    def needs_rehash(self, hash_val: str) -> bool:
        try:
            return self.ph.check_needs_rehash(hash_val)
        except:
            return True