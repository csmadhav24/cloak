from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
import os

# Create keys directory if it doesn't exist
os.makedirs('keys', exist_ok=True)

print("Generating RSA-2048 key pair...")

# Generate private key
private_key = rsa.generate_private_key(
    public_exponent=65537,
    key_size=2048
)

# Save private key
with open('keys/private_key.pem', 'wb') as f:
    f.write(private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    ))
print("✅ Private key saved to: keys/private_key.pem")

# Save public key
public_key = private_key.public_key()
with open('keys/public_key.pem', 'wb') as f:
    f.write(public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    ))
print("✅ Public key saved to: keys/public_key.pem")

print("\n✅ RSA keys generated successfully!")