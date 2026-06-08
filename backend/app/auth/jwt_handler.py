from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional, Dict
import uuid

class JWTHandler:
    def __init__(self, redis_client=None):
        self.secret_key = "my-super-secret-key-2024-must-be-long-enough"
        self.algorithm = "HS256"
        self.access_token_expire_minutes = 15
        self.refresh_token_expire_days = 7
        self.redis = redis_client
        self._tokens = {}
    
    def create_access_token(self, data: Dict) -> str:
        """Create JWT access token"""
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(minutes=self.access_token_expire_minutes)
        
        # Ensure we have the correct claims
        to_encode.update({
            "exp": expire,
            "type": "access",
            "jti": str(uuid.uuid4())
        })
        
        print(f"Creating token for user: {to_encode.get('sub')}")  # Debug
        token = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
        return token
    
    def verify_token(self, token: str, token_type: str = "access") -> Optional[Dict]:
        """Verify JWT token"""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            
            print(f"Verifying token: {payload.get('sub')}")  # Debug
            
            # Check token type
            if payload.get("type") != token_type:
                print(f"Token type mismatch: expected {token_type}, got {payload.get('type')}")
                return None
            
            # Check expiration
            exp = payload.get("exp")
            if exp and datetime.utcfromtimestamp(exp) < datetime.utcnow():
                print("Token expired")
                return None
            
            return payload
        except JWTError as e:
            print(f"JWT Verification error: {str(e)}")
            return None
    
    def create_refresh_token(self, user_id: str, session_id: str) -> str:
        """Create refresh token"""
        expire = datetime.utcnow() + timedelta(days=self.refresh_token_expire_days)
        
        refresh_token = jwt.encode(
            {
                "user_id": user_id,
                "session_id": session_id,
                "exp": expire,
                "type": "refresh",
                "jti": str(uuid.uuid4())
            },
            self.secret_key,
            algorithm=self.algorithm
        )
        
        # Store in memory
        key = f"{user_id}:{session_id}"
        self._tokens[key] = refresh_token
        
        return refresh_token
    
    def revoke_refresh_token(self, user_id: str, session_id: str):
        """Revoke refresh token"""
        key = f"{user_id}:{session_id}"
        if key in self._tokens:
            del self._tokens[key]
    
    def is_refresh_token_valid(self, user_id: str, session_id: str, token: str) -> bool:
        """Check if refresh token is valid"""
        key = f"{user_id}:{session_id}"
        return self._tokens.get(key) == token