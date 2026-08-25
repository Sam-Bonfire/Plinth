use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use rand::rngs::OsRng;
use std::collections::HashMap;

use crate::clock::ClientNodeId;
use crate::mutation::MutationRecord;

#[derive(Debug, thiserror::Error)]
pub enum SecurityError {
    #[error("Signature verification failed")]
    VerificationFailed,
    #[error("Key not found in registry")]
    KeyNotFound,
    #[error("Invalid signature format")]
    InvalidFormat,
}

pub struct TerminalKeypair {
    signing_key: SigningKey,
    verifying_key: VerifyingKey,
    _terminal_id: ClientNodeId,
}

impl TerminalKeypair {
    #[must_use]
    pub fn generate(terminal_id: ClientNodeId) -> Self {
        let mut csprng = OsRng;
        let signing_key = SigningKey::generate(&mut csprng);
        let verifying_key = signing_key.verifying_key();
        Self {
            signing_key,
            verifying_key,
            _terminal_id: terminal_id,
        }
    }

    #[must_use]
    pub fn from_bytes(bytes: &[u8; 32], terminal_id: ClientNodeId) -> Self {
        let signing_key = SigningKey::from_bytes(bytes);
        let verifying_key = signing_key.verifying_key();
        Self {
            signing_key,
            verifying_key,
            _terminal_id: terminal_id,
        }
    }

    #[must_use]
    pub fn verifying_key(&self) -> &VerifyingKey {
        &self.verifying_key
    }

    #[must_use]
    pub fn sign_checksum(&self, checksum: &str) -> String {
        use base64::{engine::general_purpose::STANDARD, Engine as _};
        let signature = self.signing_key.sign(checksum.as_bytes());
        STANDARD.encode(signature.to_bytes())
    }

    #[must_use]
    pub fn sign_mutation(&self, mutation: &MutationRecord) -> String {
        self.sign_checksum(&mutation.checksum)
    }
}

pub struct TerminalKeyRegistry {
    public_keys: HashMap<ClientNodeId, VerifyingKey>,
}

impl Default for TerminalKeyRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl TerminalKeyRegistry {
    #[must_use]
    pub fn new() -> Self {
        Self {
            public_keys: HashMap::new(),
        }
    }

    pub fn register(&mut self, node_id: ClientNodeId, key: VerifyingKey) {
        self.public_keys.insert(node_id, key);
    }

    /// # Errors
    /// Returns `SecurityError` if the key is not found, or if signature is invalid
    pub fn verify_signature(
        &self,
        node_id: &ClientNodeId,
        checksum: &str,
        signature_b64: &str,
    ) -> Result<bool, SecurityError> {
        use base64::{engine::general_purpose::STANDARD, Engine as _};

        let key = self
            .public_keys
            .get(node_id)
            .ok_or(SecurityError::KeyNotFound)?;

        let sig_bytes = STANDARD
            .decode(signature_b64)
            .map_err(|_| SecurityError::InvalidFormat)?;

        let signature =
            Signature::from_slice(&sig_bytes).map_err(|_| SecurityError::InvalidFormat)?;

        key.verify(checksum.as_bytes(), &signature)
            .map(|()| true)
            .map_err(|_| SecurityError::VerificationFailed)
    }

    #[must_use]
    pub fn requires_signature(mutation_type: &str) -> bool {
        matches!(
            mutation_type,
            "OrderVoided" | "OrderDiscountApplied" | "RefundProcessed" | "StoreShiftClosed"
        )
    }
}
