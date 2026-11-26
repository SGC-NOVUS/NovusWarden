use std::{
    collections::HashMap,
    fs,
    path::PathBuf,
    sync::{LazyLock, Mutex},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use chrono::Utc;
use data_encoding::BASE64URL_NOPAD;
use reqwest::Method;
use ring::{
    aead::{AES_128_GCM, Aad, LessSafeKey, Nonce, UnboundKey},
    agreement::{ECDH_P256, EphemeralPrivateKey, UnparsedPublicKey, agree_ephemeral},
    hkdf::{HKDF_SHA256, KeyType, Salt},
    rand::{SecureRandom, SystemRandom},
    signature::{ECDSA_P256_SHA256_FIXED_SIGNING, EcdsaKeyPair, KeyPair},
};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{CONFIG, Error, http_client::make_http_request};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebPushSubscription {
    pub id: String,
    pub endpoint: String,
    pub p256dh: String,
    pub auth: String,
    pub user_agent: String,
    pub created_at: String,
}

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WebPushStore {
    vapid_pkcs8_b64: String,
    vapid_public_b64: String,
    #[serde(default)]
    users: HashMap<String, Vec<WebPushSubscription>>,
}

struct HkdfLen(usize);

impl KeyType for HkdfLen {
    fn len(&self) -> usize {
        self.0
    }
}

static WEBPUSH_STORE: LazyLock<Mutex<WebPushStore>> = LazyLock::new(|| Mutex::new(load_or_init_store()));

fn store_path() -> PathBuf {
    PathBuf::from(CONFIG.data_folder()).join("novus_webpush.json")
}

fn generate_vapid_pair() -> Result<(String, String), Error> {
    let rng = SystemRandom::new();
    let pkcs8 = EcdsaKeyPair::generate_pkcs8(&ECDSA_P256_SHA256_FIXED_SIGNING, &rng)
        .map_err(|_| Error::new("VAPID keygen failed", "Failed to generate P-256 PKCS#8 keypair"))?;
    let kp = EcdsaKeyPair::from_pkcs8(&ECDSA_P256_SHA256_FIXED_SIGNING, pkcs8.as_ref(), &rng)
        .map_err(|_| Error::new("VAPID key parse failed", "Failed to parse generated P-256 PKCS#8"))?;
    let pkcs8_b64 = BASE64URL_NOPAD.encode(pkcs8.as_ref());
    let pub_b64 = BASE64URL_NOPAD.encode(kp.public_key().as_ref());
    Ok((pkcs8_b64, pub_b64))
}

fn load_or_init_store() -> WebPushStore {
    let path = store_path();
    if let Ok(raw) = fs::read_to_string(&path)
        && let Ok(parsed) = serde_json::from_str::<WebPushStore>(&raw)
        && !parsed.vapid_pkcs8_b64.is_empty()
        && !parsed.vapid_public_b64.is_empty()
    {
        return parsed;
    }

    let (vapid_pkcs8_b64, vapid_public_b64) = generate_vapid_pair().unwrap_or_default();
    let store = WebPushStore {
        vapid_pkcs8_b64,
        vapid_public_b64,
        users: HashMap::new(),
    };
    drop(persist_store(&store));
    store
}

fn persist_store(store: &WebPushStore) -> Result<(), Error> {
    let path = store_path();
    if let Some(parent) = path.parent() {
        drop(fs::create_dir_all(parent));
    }
    let tmp_path = path.with_extension("json.tmp");
    let content = serde_json::to_string_pretty(store)
        .map_err(|e| Error::new("Failed to serialize WebPush store", e.to_string()))?;
    fs::write(&tmp_path, content).map_err(|e| Error::new("Failed to write WebPush temp file", e.to_string()))?;
    fs::rename(&tmp_path, &path).map_err(|e| Error::new("Failed to commit WebPush store", e.to_string()))?;
    Ok(())
}

pub fn get_vapid_public_key() -> String {
    let mut guard = WEBPUSH_STORE.lock().unwrap();
    if (guard.vapid_public_b64.is_empty() || guard.vapid_pkcs8_b64.is_empty())
        && let Ok((pkcs8_b64, pub_b64)) = generate_vapid_pair()
    {
        guard.vapid_pkcs8_b64 = pkcs8_b64;
        guard.vapid_public_b64 = pub_b64;
        drop(persist_store(&guard));
    }
    guard.vapid_public_b64.clone()
}

pub fn list_user_subscriptions(user_uuid: &str) -> Vec<Value> {
    let guard = WEBPUSH_STORE.lock().unwrap();
    guard
        .users
        .get(user_uuid)
        .map(|subs| {
            subs.iter()
                .map(|s| {
                    let host = url::Url::parse(&s.endpoint)
                        .ok()
                        .and_then(|u| u.host_str().map(str::to_owned))
                        .unwrap_or_else(|| "push-service".to_owned());
                    json!({
                        "id": s.id,
                        "endpointHost": host,
                        "userAgent": s.user_agent,
                        "createdAt": s.created_at,
                    })
                })
                .collect()
        })
        .unwrap_or_default()
}

pub fn upsert_subscription(
    user_uuid: &str,
    endpoint: String,
    p256dh: &str,
    auth: &str,
    user_agent: String,
) -> Result<String, Error> {
    let parsed_url =
        url::Url::parse(&endpoint).map_err(|_| Error::new("Некорректный Web Push endpoint", "Invalid endpoint URL"))?;
    if parsed_url.scheme() != "https" {
        err!("Web Push endpoint должен использовать HTTPS");
    }
    let ua_pub = BASE64URL_NOPAD
        .decode(p256dh.trim().trim_end_matches('=').as_bytes())
        .map_err(|_| Error::new("Некорректный ключ p256dh", "Invalid base64url p256dh"))?;
    if ua_pub.len() != 65 || ua_pub[0] != 0x04 {
        err!("Некорректная длина публичного ключа P-256 (ожидается 65 байт)");
    }
    let auth_bytes = BASE64URL_NOPAD
        .decode(auth.trim().trim_end_matches('=').as_bytes())
        .map_err(|_| Error::new("Некорректный секрет auth", "Invalid base64url auth"))?;
    if auth_bytes.len() != 16 {
        err!("Некорректная длина секрета auth (ожидается 16 байт)");
    }

    let clean_p256dh = BASE64URL_NOPAD.encode(&ua_pub);
    let clean_auth = BASE64URL_NOPAD.encode(&auth_bytes);

    let mut guard = WEBPUSH_STORE.lock().unwrap();
    let list = guard.users.entry(user_uuid.to_owned()).or_default();

    if let Some(existing) = list.iter_mut().find(|s| s.endpoint == endpoint) {
        existing.p256dh = clean_p256dh;
        existing.auth = clean_auth;
        existing.user_agent = user_agent;
        let id = existing.id.clone();
        persist_store(&guard)?;
        return Ok(id);
    }

    // Cap at 10 active browser subscriptions per user
    if list.len() >= 10 {
        list.remove(0);
    }

    let id = uuid::Uuid::new_v4().to_string();
    list.push(WebPushSubscription {
        id: id.clone(),
        endpoint,
        p256dh: clean_p256dh,
        auth: clean_auth,
        user_agent,
        created_at: Utc::now().format("%Y-%m-%d %H:%M:%S UTC").to_string(),
    });
    persist_store(&guard)?;
    Ok(id)
}

pub fn remove_subscription(user_uuid: &str, sub_id: &str) -> Result<bool, Error> {
    let mut guard = WEBPUSH_STORE.lock().unwrap();
    let Some(list) = guard.users.get_mut(user_uuid) else {
        return Ok(false);
    };
    let before = list.len();
    list.retain(|s| s.id != sub_id);
    let removed = list.len() != before;
    if removed {
        persist_store(&guard)?;
    }
    Ok(removed)
}

fn remove_stale_endpoint(user_uuid: &str, endpoint: &str) {
    let mut guard = WEBPUSH_STORE.lock().unwrap();
    if let Some(list) = guard.users.get_mut(user_uuid) {
        let before = list.len();
        list.retain(|s| s.endpoint != endpoint);
        if list.len() != before {
            drop(persist_store(&guard));
        }
    }
}

/// Build RFC 8292 ES256 VAPID Authorization header (`vapid t=<jwt>, k=<pub_b64>`).
fn build_vapid_auth_header(endpoint: &str, subject: &str, pkcs8_b64: &str, pub_b64: &str) -> Result<String, Error> {
    let parsed = url::Url::parse(endpoint).map_err(|e| Error::new("Invalid push endpoint", e.to_string()))?;
    let origin = format!(
        "{}://{}{}",
        parsed.scheme(),
        parsed.host_str().unwrap_or_default(),
        parsed.port().map(|p| format!(":{p}")).unwrap_or_default()
    );

    let now_secs = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or(Duration::from_secs(0)).as_secs();
    let exp = now_secs + 12 * 3600;
    let safe_sub = if subject.starts_with("mailto:") || subject.starts_with("https://") {
        subject.to_owned()
    } else {
        "mailto:admin@localhost".to_owned()
    };

    let header_b64 = BASE64URL_NOPAD.encode(br#"{"typ":"JWT","alg":"ES256"}"#);
    let claims = json!({
        "aud": origin,
        "exp": exp,
        "sub": safe_sub,
    });
    let claims_b64 = BASE64URL_NOPAD.encode(claims.to_string().as_bytes());
    let signing_input = format!("{header_b64}.{claims_b64}");

    let pkcs8_bytes =
        BASE64URL_NOPAD.decode(pkcs8_b64.as_bytes()).map_err(|e| Error::new("VAPID decode error", e.to_string()))?;
    let rng = SystemRandom::new();
    let kp = EcdsaKeyPair::from_pkcs8(&ECDSA_P256_SHA256_FIXED_SIGNING, &pkcs8_bytes, &rng)
        .map_err(|_| Error::new("VAPID key load error", "Invalid PKCS#8 key"))?;
    let sig = kp
        .sign(&rng, signing_input.as_bytes())
        .map_err(|_| Error::new("VAPID sign error", "Failed to sign ES256 VAPID JWT"))?;
    let sig_b64 = BASE64URL_NOPAD.encode(sig.as_ref());

    Ok(format!("vapid t={signing_input}.{sig_b64}, k={pub_b64}"))
}

/// Encrypt Web Push payload per RFC 8291 (`aes128gcm` content-coding).
pub fn encrypt_rfc8291_aes128gcm(ua_public: &[u8], auth_secret: &[u8], plaintext: &[u8]) -> Result<Vec<u8>, Error> {
    if ua_public.len() != 65 || ua_public[0] != 0x04 {
        err!("Invalid subscriber P-256 public key");
    }
    if auth_secret.len() != 16 {
        err!("Invalid subscriber 16-byte auth secret");
    }

    let rng = SystemRandom::new();
    let mut salt = [0u8; 16];
    rng.fill(&mut salt).map_err(|_| Error::new("RNG error", "Failed to generate 16-byte salt"))?;

    let as_private = EphemeralPrivateKey::generate(&ECDH_P256, &rng)
        .map_err(|_| Error::new("ECDH error", "Failed to generate ephemeral P-256 key"))?;
    let as_public = as_private
        .compute_public_key()
        .map_err(|_| Error::new("ECDH error", "Failed to compute ephemeral P-256 public key"))?;
    let as_pub_bytes = as_public.as_ref();

    let peer_pub = UnparsedPublicKey::new(&ECDH_P256, ua_public);
    let ecdh_secret = agree_ephemeral(as_private, &peer_pub, <[u8]>::to_vec)
        .map_err(|_| Error::new("ECDH agreement failed", "Subscriber public key rejected"))?;

    // Step 1 (RFC 8291 Section 3.3): Combine ECDH secret & auth_secret into 32-byte IKM
    let prk_key = Salt::new(HKDF_SHA256, auth_secret).extract(&ecdh_secret);
    let mut key_info = Vec::with_capacity(14 + 65 + 65);
    key_info.extend_from_slice(b"WebPush: info\0");
    key_info.extend_from_slice(ua_public);
    key_info.extend_from_slice(as_pub_bytes);
    let key_info_slices = [key_info.as_slice()];
    let mut ikm = [0u8; 32];
    prk_key
        .expand(&key_info_slices, HkdfLen(32))
        .and_then(|okm| okm.fill(&mut ikm))
        .map_err(|_| Error::new("HKDF error", "Failed to expand WebPush IKM"))?;

    // Step 2 (RFC 8188 / RFC 8291 Section 3.4): Derive CEK (16B) and Nonce (12B) from salt + IKM
    let prk = Salt::new(HKDF_SHA256, &salt).extract(&ikm);

    let cek_info: [&[u8]; 1] = [b"Content-Encoding: aes128gcm\0"];
    let mut cek = [0u8; 16];
    prk.expand(&cek_info, HkdfLen(16))
        .and_then(|okm| okm.fill(&mut cek))
        .map_err(|_| Error::new("HKDF error", "Failed to derive CEK"))?;

    let nonce_info: [&[u8]; 1] = [b"Content-Encoding: nonce\0"];
    let mut nonce_bytes = [0u8; 12];
    prk.expand(&nonce_info, HkdfLen(12))
        .and_then(|okm| okm.fill(&mut nonce_bytes))
        .map_err(|_| Error::new("HKDF error", "Failed to derive Nonce"))?;

    // Step 3: Append final record padding delimiter 0x02 and seal with AES-128-GCM
    let mut in_out = Vec::with_capacity(plaintext.len() + 1 + 16);
    in_out.extend_from_slice(plaintext);
    in_out.push(0x02);

    let unbound = UnboundKey::new(&AES_128_GCM, &cek).map_err(|_| Error::new("AEAD error", "Invalid CEK"))?;
    let sealing_key = LessSafeKey::new(unbound);
    sealing_key
        .seal_in_place_append_tag(Nonce::assume_unique_for_key(nonce_bytes), Aad::empty(), &mut in_out)
        .map_err(|_| Error::new("AEAD error", "AES-128-GCM encryption failed"))?;

    // Step 4: RFC 8188 aes128gcm header: salt(16) || rs(4, 4096) || idlen(1, 65) || keyid(65) || ciphertext
    let mut body = Vec::with_capacity(16 + 4 + 1 + 65 + in_out.len());
    body.extend_from_slice(&salt);
    body.extend_from_slice(&4096u32.to_be_bytes());
    body.push(65u8);
    body.extend_from_slice(as_pub_bytes);
    body.extend_from_slice(&in_out);

    Ok(body)
}

/// Dispatch an encrypted Web Push notification to all registered browsers of `user_uuid`.
/// Returns `(delivered_count, total_Attempted)`.
pub async fn send_web_push_to_user(
    user_uuid: &str,
    title: &str,
    body: &str,
    url_path: &str,
    tag: &str,
) -> (usize, usize) {
    if !CONFIG.web_push_enabled() {
        return (0, 0);
    }

    let (pkcs8_b64, pub_b64, subs) = {
        let guard = WEBPUSH_STORE.lock().unwrap();
        let Some(list) = guard.users.get(user_uuid) else {
            return (0, 0);
        };
        if list.is_empty() || guard.vapid_pkcs8_b64.is_empty() {
            return (0, 0);
        }
        (guard.vapid_pkcs8_b64.clone(), guard.vapid_public_b64.clone(), list.clone())
    };

    let payload = json!({
        "title": title,
        "body": body,
        "url": url_path,
        "tag": tag,
        "timestamp": Utc::now().timestamp_millis(),
    })
    .to_string();

    let subject = CONFIG.web_push_subject();
    let total = subs.len();
    let mut delivered = 0usize;

    for sub in subs {
        let Ok(ua_pub) = BASE64URL_NOPAD.decode(sub.p256dh.as_bytes()) else {
            continue;
        };
        let Ok(auth_sec) = BASE64URL_NOPAD.decode(sub.auth.as_bytes()) else {
            continue;
        };
        let Ok(encrypted) = encrypt_rfc8291_aes128gcm(&ua_pub, &auth_sec, payload.as_bytes()) else {
            continue;
        };
        let Ok(vapid_auth) = build_vapid_auth_header(&sub.endpoint, &subject, &pkcs8_b64, &pub_b64) else {
            continue;
        };

        let req = match make_http_request(Method::POST, &sub.endpoint) {
            Ok(builder) => builder
                .header("Authorization", vapid_auth)
                .header("Content-Encoding", "aes128gcm")
                .header("Content-Type", "application/octet-stream")
                .header("TTL", "3600")
                .header("Urgency", "high")
                .body(encrypted),
            Err(e) => {
                warn!("Web Push endpoint blocked or invalid for user {user_uuid}: {e}");
                continue;
            }
        };

        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                delivered += 1;
            }
            Ok(resp) if resp.status().as_u16() == 404 || resp.status().as_u16() == 410 => {
                info!("Removing expired Web Push subscription ({}) for user {user_uuid}", resp.status());
                remove_stale_endpoint(user_uuid, &sub.endpoint);
            }
            Ok(resp) => {
                warn!("Web Push service returned HTTP {} for user {user_uuid}", resp.status());
            }
            Err(e) => {
                warn!("Web Push delivery error for user {user_uuid}: {e}");
            }
        }
    }

    (delivered, total)
}

/// Fire-and-forget async Web Push helper for security events.
pub fn spawn_user_security_push(
    user_uuid: &str,
    title: String,
    body: String,
    url_path: &'static str,
    tag: &'static str,
) {
    if !CONFIG.web_push_enabled() {
        return;
    }
    let uid = user_uuid.to_owned();
    tokio::spawn(async move {
        let _ = send_web_push_to_user(&uid, &title, &body, url_path, tag).await;
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn vapid_keygen_and_jwt_header_roundtrip() {
        let (pkcs8_b64, pub_b64) = generate_vapid_pair().expect("vapid keygen");
        let pub_raw = BASE64URL_NOPAD.decode(pub_b64.as_bytes()).expect("valid b64url");
        assert_eq!(pub_raw.len(), 65);
        assert_eq!(pub_raw[0], 0x04);

        let header = build_vapid_auth_header(
            "https://fcm.googleapis.com/fcm/send/example",
            "mailto:security@sgc-novus.xyz",
            &pkcs8_b64,
            &pub_b64,
        )
        .expect("vapid jwt");
        assert!(header.starts_with("vapid t="));
        assert!(header.ends_with(&format!(", k={pub_b64}")));
    }

    #[test]
    fn rfc8291_aes128gcm_encrypt_decrypt_roundtrip() {
        let rng = SystemRandom::new();
        let ua_private = EphemeralPrivateKey::generate(&ECDH_P256, &rng).unwrap();
        let ua_public = ua_private.compute_public_key().unwrap();
        let mut auth_secret = [0u8; 16];
        rng.fill(&mut auth_secret).unwrap();

        let message = br#"{"title":"NovusWarden","body":"New login verified"}"#;
        let wire = encrypt_rfc8291_aes128gcm(ua_public.as_ref(), &auth_secret, message).expect("encrypt");

        assert!(wire.len() > 86 + message.len());
        let salt = &wire[0..16];
        let rs = u32::from_be_bytes(wire[16..20].try_into().unwrap());
        assert_eq!(rs, 4096);
        assert_eq!(wire[20], 65);
        let as_pub = &wire[21..86];
        let mut ciphertext = wire[86..].to_vec();

        // Receiver ECDH + HKDF decryption verification
        let peer_as_pub = UnparsedPublicKey::new(&ECDH_P256, as_pub);
        let shared = agree_ephemeral(ua_private, &peer_as_pub, <[u8]>::to_vec).unwrap();

        let prk_key = Salt::new(HKDF_SHA256, &auth_secret).extract(&shared);
        let mut info = Vec::new();
        info.extend_from_slice(b"WebPush: info\0");
        info.extend_from_slice(ua_public.as_ref());
        info.extend_from_slice(as_pub);
        let info_slices = [info.as_slice()];
        let mut ikm = [0u8; 32];
        prk_key.expand(&info_slices, HkdfLen(32)).unwrap().fill(&mut ikm).unwrap();

        let prk = Salt::new(HKDF_SHA256, salt).extract(&ikm);
        let mut cek = [0u8; 16];
        prk.expand(&[b"Content-Encoding: aes128gcm\0"], HkdfLen(16)).unwrap().fill(&mut cek).unwrap();
        let mut nonce = [0u8; 12];
        prk.expand(&[b"Content-Encoding: nonce\0"], HkdfLen(12)).unwrap().fill(&mut nonce).unwrap();

        let key = LessSafeKey::new(UnboundKey::new(&AES_128_GCM, &cek).unwrap());
        let plain_padded =
            key.open_in_place(Nonce::assume_unique_for_key(nonce), Aad::empty(), &mut ciphertext).unwrap();
        assert_eq!(*plain_padded.last().unwrap(), 0x02);
        assert_eq!(&plain_padded[..plain_padded.len() - 1], message);
    }
}
