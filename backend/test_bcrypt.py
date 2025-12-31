"""Test bcrypt verification inside container"""
from passlib.context import CryptContext

# Standard bcrypt hash for password "test123"
stored_hash = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdpQQKN.iB5pC5C"
test_password = "test123"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

print(f"Hash: {stored_hash}")
print(f"Hash length: {len(stored_hash)}")
print(f"Password: {test_password}")

try:
    result = pwd_context.verify(test_password, stored_hash)
    print(f"Verification result: {result}")
except Exception as e:
    print(f"Error: {e}")
    
# Also test generating a new hash
print("\nGenerating new hash...")
new_hash = pwd_context.hash(test_password)
print(f"New hash: {new_hash}")
print(f"New hash length: {len(new_hash)}")

# Verify the new hash
result2 = pwd_context.verify(test_password, new_hash)
print(f"New hash verification: {result2}")
