use std::{
    collections::HashMap,
    fs,
    path::PathBuf,
    sync::{LazyLock, Mutex},
    time::{Duration, Instant},
};

use chrono::Utc;
use data_encoding::{BASE64URL_NOPAD, HEXLOWER};
use reqwest::{Client, Method};
use ring::rand::{SecureRandom, SystemRandom};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{
    CONFIG, Error,
    crypto::ct_eq,
    db::{
        DbPool,
        models::{AuthRequest, AuthRequestId, UserId},
    },
    http_client::{get_reqwest_client_builder, make_http_request},
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(clippy::struct_excessive_bools)]
pub struct TelegramUserLink {
    pub user_uuid: String,
    pub email: String,
    pub chat_id: i64,
    pub username: Option<String>,
    pub first_name: Option<String>,
    pub linked_at: String,
    #[serde(default = "default_true")]
    pub otp_enabled: bool,
    #[serde(default)]
    pub telegram_only_otp: bool,
    #[serde(default = "default_true")]
    pub login_approval_enabled: bool,
    #[serde(default = "default_true")]
    pub alerts_enabled: bool,
}

const fn default_true() -> bool {
    true
}

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TelegramStore {
    #[serde(default)]
    users: HashMap<String, TelegramUserLink>,
}

#[derive(Debug, Clone)]
struct PendingLinkToken {
    user_uuid: String,
    email: String,
    locale: String,
    expires_at: Instant,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChallengeStatus {
    Pending,
    Approved,
    Rejected,
}

#[derive(Debug, Clone)]
struct LoginApprovalChallenge {
    user_uuid: String,
    ip: String,
    pin_code: String,
    poll_secret: String,
    grant_token: Option<String>,
    status: ChallengeStatus,
    expires_at: Instant,
}

#[derive(Debug, Clone)]
struct PendingAuthRequestDeny {
    auth_request_uuid: String,
    user_uuid: String,
    expires_at: Instant,
}

#[derive(Debug, Default)]
struct TelegramRuntimeState {
    bot_username_cache: Option<(String, String)>,
    link_tokens: HashMap<String, PendingLinkToken>,
    login_challenges: HashMap<String, LoginApprovalChallenge>,
    auth_req_denies: HashMap<String, PendingAuthRequestDeny>,
}

static TELEGRAM_STORE: LazyLock<Mutex<TelegramStore>> = LazyLock::new(|| Mutex::new(load_store()));
static TELEGRAM_RUNTIME: LazyLock<Mutex<TelegramRuntimeState>> =
    LazyLock::new(|| Mutex::new(TelegramRuntimeState::default()));
static POLL_CLIENT: LazyLock<Client> = LazyLock::new(|| {
    get_reqwest_client_builder(true)
        .timeout(Duration::from_secs(32))
        .build()
        .expect("Failed to build Telegram long-poll HTTP client")
});

fn store_path() -> PathBuf {
    PathBuf::from(CONFIG.data_folder()).join("novus_telegram.json")
}

fn load_store() -> TelegramStore {
    let path = store_path();
    if let Ok(raw) = fs::read_to_string(&path)
        && let Ok(parsed) = serde_json::from_str::<TelegramStore>(&raw)
    {
        return parsed;
    }
    TelegramStore::default()
}

fn persist_store(store: &TelegramStore) -> Result<(), Error> {
    let path = store_path();
    if let Some(parent) = path.parent() {
        drop(fs::create_dir_all(parent));
    }
    let tmp_path = path.with_extension("json.tmp");
    let content = serde_json::to_string_pretty(store)
        .map_err(|e| Error::new("Failed to serialize Telegram store", e.to_string()))?;
    fs::write(&tmp_path, content).map_err(|e| Error::new("Failed to write Telegram temp file", e.to_string()))?;
    fs::rename(&tmp_path, &path).map_err(|e| Error::new("Failed to commit Telegram store", e.to_string()))?;
    Ok(())
}

pub fn escape_html(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for ch in input.chars() {
        match ch {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            _ => out.push(ch),
        }
    }
    out
}

fn random_hex(bytes_len: usize) -> String {
    let rng = SystemRandom::new();
    let mut buf = vec![0u8; bytes_len];
    let _ = rng.fill(&mut buf);
    HEXLOWER.encode(&buf)
}

fn random_urlsafe(bytes_len: usize) -> String {
    let rng = SystemRandom::new();
    let mut buf = vec![0u8; bytes_len];
    let _ = rng.fill(&mut buf);
    BASE64URL_NOPAD.encode(&buf)
}

fn generate_pin_code() -> String {
    const LETTERS: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ";
    let rng = SystemRandom::new();
    let mut b = [0u8; 3];
    let _ = rng.fill(&mut b);
    let c1 = LETTERS[(b[0] as usize) % LETTERS.len()] as char;
    let c2 = (b[1] % 10) + b'0';
    let digits = (b[2] % 90) + 10;
    format!("{c1}{c2}-{digits:02}")
}

fn active_bot_token() -> Option<String> {
    if !CONFIG.telegram_enabled() {
        return None;
    }
    CONFIG.telegram_bot_token().map(|t| t.trim().to_owned()).filter(|t| !t.is_empty() && t.contains(':'))
}

pub fn is_bot_configured() -> bool {
    active_bot_token().is_some()
}

pub fn get_user_link(user_uuid: &str) -> Option<TelegramUserLink> {
    let guard = TELEGRAM_STORE.lock().unwrap();
    guard.users.get(user_uuid).cloned()
}

pub fn can_approve_login_for_user(user_uuid: &UserId) -> bool {
    if !is_bot_configured() || !CONFIG.telegram_2fa_enabled() {
        return false;
    }
    let guard = TELEGRAM_STORE.lock().unwrap();
    guard.users.get(user_uuid.as_ref()).is_some_and(|u| u.login_approval_enabled)
}

#[allow(clippy::fn_params_excessive_bools)]
pub fn update_user_preferences(
    user_uuid: &str,
    otp_enabled: bool,
    telegram_only_otp: bool,
    login_approval_enabled: bool,
    alerts_enabled: bool,
) -> Result<TelegramUserLink, Error> {
    let mut guard = TELEGRAM_STORE.lock().unwrap();
    let Some(entry) = guard.users.get_mut(user_uuid) else {
        err!("Telegram-чат ещё не привязан к вашему аккаунту");
    };
    entry.otp_enabled = otp_enabled;
    entry.telegram_only_otp = telegram_only_otp && otp_enabled;
    entry.login_approval_enabled = login_approval_enabled;
    entry.alerts_enabled = alerts_enabled;
    let updated = entry.clone();
    persist_store(&guard)?;
    Ok(updated)
}

pub fn unlink_user(user_uuid: &str) -> Result<Option<i64>, Error> {
    let mut guard = TELEGRAM_STORE.lock().unwrap();
    let removed = guard.users.remove(user_uuid).map(|u| u.chat_id);
    if removed.is_some() {
        persist_store(&guard)?;
    }
    Ok(removed)
}

fn purge_expired_ephemeral(rt: &mut TelegramRuntimeState) {
    let now = Instant::now();
    rt.link_tokens.retain(|_, v| v.expires_at > now);
    rt.login_challenges.retain(|_, v| v.expires_at > now);
    rt.auth_req_denies.retain(|_, v| v.expires_at > now);
}

pub async fn fetch_bot_username() -> Result<String, Error> {
    let Some(token) = active_bot_token() else {
        err!("Telegram-бот не настроен на сервере (проверьте TELEGRAM_ENABLED и TELEGRAM_BOT_TOKEN)");
    };

    {
        let rt = TELEGRAM_RUNTIME.lock().unwrap();
        if let Some((ref cached_tok, ref uname)) = rt.bot_username_cache
            && cached_tok == &token
            && !uname.is_empty()
        {
            return Ok(uname.clone());
        }
    }

    let url = format!("https://api.telegram.org/bot{token}/getMe");
    let resp = make_http_request(Method::GET, &url)?
        .send()
        .await
        .map_err(|e| Error::new("Ошибка подключения к Telegram Bot API", e.to_string()))?;
    let body: Value =
        resp.json().await.map_err(|e| Error::new("Некорректный ответ Telegram Bot API", e.to_string()))?;

    if !body["ok"].as_bool().unwrap_or(false) {
        let desc = body["description"].as_str().unwrap_or("Invalid bot token");
        err!(format!("Telegram API вернул ошибку: {desc}"));
    }

    let username = body["result"]["username"].as_str().unwrap_or_default().trim_start_matches('@').to_owned();
    if username.is_empty() {
        err!("Не удалось определить @username Telegram-бота");
    }

    {
        let mut rt = TELEGRAM_RUNTIME.lock().unwrap();
        rt.bot_username_cache = Some((token, username.clone()));
    }
    Ok(username)
}

pub async fn create_link_deep_link(
    user_uuid: &str,
    email: &str,
    locale: &str,
) -> Result<(String, String, String), Error> {
    let bot_username = fetch_bot_username().await?;
    let token = random_urlsafe(18);
    {
        let mut rt = TELEGRAM_RUNTIME.lock().unwrap();
        purge_expired_ephemeral(&mut rt);
        // Remove previous link tokens for this user
        rt.link_tokens.retain(|_, v| v.user_uuid != user_uuid);
        rt.link_tokens.insert(
            token.clone(),
            PendingLinkToken {
                user_uuid: user_uuid.to_owned(),
                email: email.to_owned(),
                locale: locale.to_owned(),
                expires_at: Instant::now() + Duration::from_secs(600),
            },
        );
    }
    let deep_link = format!("https://t.me/{bot_username}?start={token}");
    Ok((token, bot_username, deep_link))
}

async fn send_telegram_message_raw(
    chat_id: &str,
    html_text: &str,
    reply_markup: Option<Value>,
) -> Result<Value, Error> {
    let Some(token) = active_bot_token() else {
        err!("Telegram-бот отключён или токен не задан");
    };
    let url = format!("https://api.telegram.org/bot{token}/sendMessage");
    let mut payload = json!({
        "chat_id": chat_id,
        "text": html_text,
        "parse_mode": "HTML",
        "disable_web_page_preview": true,
    });
    if let Some(markup) = reply_markup {
        payload["reply_markup"] = markup;
    }

    let resp = make_http_request(Method::POST, &url)?
        .json(&payload)
        .send()
        .await
        .map_err(|e| Error::new("Не удалось отправить сообщение в Telegram", e.to_string()))?;
    let body: Value = resp.json().await.map_err(|e| Error::new("Ошибка разбора ответа Telegram API", e.to_string()))?;

    if !body["ok"].as_bool().unwrap_or(false) {
        let desc = body["description"].as_str().unwrap_or("Unknown Telegram API error");
        err!(format!("Ошибка Telegram Bot API: {desc}"));
    }
    Ok(body)
}

async fn answer_callback(token: &str, callback_query_id: &str, text: &str, show_alert: bool) {
    let url = format!("https://api.telegram.org/bot{token}/answerCallbackQuery");
    if let Ok(req) = make_http_request(Method::POST, &url) {
        drop(
            req.json(&json!({
                "callback_query_id": callback_query_id,
                "text": text,
                "show_alert": show_alert,
            }))
            .send()
            .await,
        );
    }
}

async fn edit_message_after_action(token: &str, chat_id: i64, message_id: i64, updated_html: &str) {
    let url = format!("https://api.telegram.org/bot{token}/editMessageText");
    if let Ok(req) = make_http_request(Method::POST, &url) {
        drop(
            req.json(&json!({
                "chat_id": chat_id,
                "message_id": message_id,
                "text": updated_html,
                "parse_mode": "HTML",
                "disable_web_page_preview": true,
            }))
            .send()
            .await,
        );
    }
}

/// Deliver 6-digit 2FA OTP to Telegram if the user linked a chat and enabled OTP delivery.
/// Returns `Ok(true)` if the code was delivered AND `telegram_only_otp` is set (so caller may skip email).
pub async fn try_send_2fa_otp(user_id: &UserId, code: &str) -> Result<bool, Error> {
    if !is_bot_configured() || !CONFIG.telegram_2fa_enabled() {
        return Ok(false);
    }
    let Some(link) = get_user_link(&user_id.to_string()) else {
        return Ok(false);
    };
    if !link.otp_enabled {
        return Ok(false);
    }

    let safe_code = escape_html(code);
    let safe_domain = escape_html(&CONFIG.domain());
    let html = format!(
        "🔐 <b>Код двухфакторной аутентификации NovusWarden</b>\n\n\
        Ваш одноразовый код: <code>{safe_code}</code>\n\n\
        • Сервер: {safe_domain}\n\
        • Никому не сообщайте этот код. Если вы не запрашивали вход, немедленно смените мастер-пароль."
    );

    match send_telegram_message_raw(&link.chat_id.to_string(), &html, None).await {
        Ok(_) => Ok(link.telegram_only_otp),
        Err(e) => {
            warn!("Failed to deliver Telegram 2FA OTP for user {user_id}: {e}");
            Err(e)
        }
    }
}

/// Create an interactive 1-click Telegram 2FA login approval challenge (`✅ Подтвердить` / `❌ Заблокировать`).
pub async fn create_login_approval_challenge(
    user_id: &UserId,
    ip: &str,
    device_name: &str,
) -> Result<(String, String, String), Error> {
    if !is_bot_configured() || !CONFIG.telegram_2fa_enabled() {
        err!("Подтверждение входа через Telegram отключено на сервере");
    }
    let Some(link) = get_user_link(&user_id.to_string()) else {
        err!("К аккаунту не привязан Telegram-чат");
    };
    if !link.login_approval_enabled {
        err!("Интерактивное подтверждение входа в Telegram отключено в настройках профиля");
    }

    let challenge_id = random_hex(8); // 16 hex chars -> callback_data "2fa_ok:<16>" = 23 bytes (< 64B limit)
    let poll_secret = random_urlsafe(24);
    let pin_code = generate_pin_code();

    {
        let mut rt = TELEGRAM_RUNTIME.lock().unwrap();
        purge_expired_ephemeral(&mut rt);
        rt.login_challenges.insert(
            challenge_id.clone(),
            LoginApprovalChallenge {
                user_uuid: user_id.to_string(),
                ip: ip.to_owned(),
                pin_code: pin_code.clone(),
                poll_secret: poll_secret.clone(),
                grant_token: None,
                status: ChallengeStatus::Pending,
                expires_at: Instant::now() + Duration::from_secs(180),
            },
        );
    }

    let now_str = Utc::now().format("%Y-%m-%d %H:%M:%S UTC").to_string();
    let html = format!(
        "🛡 <b>Запрос на вход в сейф NovusWarden</b>\n\n\
        • Аккаунт: <b>{}</b>\n\
        • Устройство: <code>{}</code>\n\
        • IP-адрес: <code>{}</code>\n\
        • Время: <code>{}</code>\n\
        • Проверочный пин на экране: <b><code>{}</code></b>\n\n\
        Убедитесь, что проверочный код совпадает с окном входа в браузере:",
        escape_html(&link.email),
        escape_html(device_name),
        escape_html(ip),
        now_str,
        escape_html(&pin_code),
    );

    let markup = json!({
        "inline_keyboard": [[
            { "text": format!("✅ Подтвердить ({pin_code})"), "callback_data": format!("2fa_ok:{challenge_id}") },
            { "text": "❌ Заблокировать", "callback_data": format!("2fa_no:{challenge_id}") }
        ]]
    });

    if let Err(e) = send_telegram_message_raw(&link.chat_id.to_string(), &html, Some(markup)).await {
        let mut rt = TELEGRAM_RUNTIME.lock().unwrap();
        rt.login_challenges.remove(&challenge_id);
        return Err(e);
    }

    Ok((challenge_id, poll_secret, pin_code))
}

pub fn poll_login_approval_challenge(challenge_id: &str, poll_secret: &str) -> (&'static str, Option<String>) {
    let mut rt = TELEGRAM_RUNTIME.lock().unwrap();
    purge_expired_ephemeral(&mut rt);
    let Some(ch) = rt.login_challenges.get_mut(challenge_id) else {
        return ("expired", None);
    };
    if !ct_eq(&ch.poll_secret, poll_secret) {
        return ("expired", None);
    }
    match ch.status {
        ChallengeStatus::Pending => ("pending", None),
        ChallengeStatus::Rejected => ("rejected", None),
        ChallengeStatus::Approved => {
            let token = ch
                .grant_token
                .get_or_insert_with(|| format!("nw_tg_approve:{}:{}", challenge_id, random_urlsafe(24)))
                .clone();
            ("approved", Some(token))
        }
    }
}

/// Validate and single-use-consume an approved Telegram 2FA grant token during `/identity/connect/token`.
pub fn consume_approved_2fa_token(user_id: &UserId, ip: &str, provided_token: &str) -> Result<(), Error> {
    let Some(rest) = provided_token.strip_prefix("nw_tg_approve:") else {
        err!("Invalid Telegram 2FA grant format");
    };
    let Some((challenge_id, _secret)) = rest.split_once(':') else {
        err!("Malformed Telegram 2FA grant token");
    };

    let mut rt = TELEGRAM_RUNTIME.lock().unwrap();
    purge_expired_ephemeral(&mut rt);
    let Some(ch) = rt.login_challenges.get(challenge_id) else {
        err!("Время ожидания подтверждения в Telegram истекло. Повторите запрос.");
    };

    let valid = ch.status == ChallengeStatus::Approved
        && ch.user_uuid == user_id.to_string()
        && ch.ip == ip
        && ch.grant_token.as_deref().is_some_and(|gt| ct_eq(gt, provided_token));

    if !valid {
        err!("Подтверждение входа через Telegram недействительно или уже использовано");
    }

    rt.login_challenges.remove(challenge_id);
    Ok(())
}

/// Send user security alert (fire-and-forget) when `alerts_enabled` is active.
pub fn notify_user_security_event(user_uuid: &str, title: &str, details_lines: Vec<String>) {
    if !is_bot_configured() || !CONFIG.telegram_alerts_enabled() {
        return;
    }
    let Some(link) = get_user_link(user_uuid) else {
        return;
    };
    if !link.alerts_enabled {
        return;
    }
    let body_lines = details_lines.into_iter().map(|l| format!("• {l}")).collect::<Vec<_>>().join("\n");
    let html = format!("🔔 <b>{}</b>\n\n{}", escape_html(title), body_lines);
    let chat_id = link.chat_id.to_string();
    tokio::spawn(async move {
        drop(send_telegram_message_raw(&chat_id, &html, None).await);
    });
}

/// Notify user in Telegram about a Zero-Knowledge Login-with-Device (`AuthRequest`) with an instant Reject button.
pub fn notify_auth_request_created(user_uuid: &str, auth_request_uuid: &str, device_type: &str, request_ip: &str) {
    if !is_bot_configured() || !CONFIG.telegram_alerts_enabled() {
        return;
    }
    let Some(link) = get_user_link(user_uuid) else {
        return;
    };
    if !link.alerts_enabled && !link.login_approval_enabled {
        return;
    }

    let short_id = random_hex(8);
    {
        let mut rt = TELEGRAM_RUNTIME.lock().unwrap();
        purge_expired_ephemeral(&mut rt);
        rt.auth_req_denies.insert(
            short_id.clone(),
            PendingAuthRequestDeny {
                auth_request_uuid: auth_request_uuid.to_owned(),
                user_uuid: user_uuid.to_owned(),
                expires_at: Instant::now() + Duration::from_secs(600),
            },
        );
    }

    let vault_url = format!("{}/#/settings", CONFIG.domain().trim_end_matches('/'));
    let html = format!(
        "📲 <b>Запрос «Вход с другого устройства»</b>\n\n\
        • Устройство: <code>{}</code>\n\
        • IP-адрес: <code>{}</code>\n\
        • Время: <code>{}</code>\n\n\
        Для передачи Zero-Knowledge ключа откройте активный сейф или мгновенно отклоните запрос ниже:",
        escape_html(device_type),
        escape_html(request_ip),
        Utc::now().format("%Y-%m-%d %H:%M:%S UTC"),
    );
    let markup = json!({
        "inline_keyboard": [[
            { "text": "🔐 Открыть сейф", "url": vault_url },
            { "text": "❌ Отклонить запрос", "callback_data": format!("ar_no:{short_id}") }
        ]]
    });

    let chat_id = link.chat_id.to_string();
    tokio::spawn(async move {
        drop(send_telegram_message_raw(&chat_id, &html, Some(markup)).await);
    });
}

/// Send instant Admin Control Plane login / lockout alerts to `TELEGRAM_ADMIN_CHAT_ID`.
pub fn notify_admin_alert(
    is_lockout: bool,
    ip: &str,
    location: &str,
    user_agent: &str,
    datetime: &str,
    unlock_url: Option<&str>,
) {
    if !is_bot_configured() {
        return;
    }
    let Some(admin_chat) = CONFIG.telegram_admin_chat_id().map(|s| s.trim().to_owned()).filter(|s| !s.is_empty())
    else {
        return;
    };

    let (html, markup) = if is_lockout {
        let text = format!(
            "🚨 <b>КРИТИЧЕСКАЯ ТРЕВОГА: Панель администратора заблокирована!</b>\n\n\
            Зафиксированы 2 неверные попытки ввода ADMIN_TOKEN.\n\
            • IP-адрес: <code>{}</code>\n\
            • Локация: <code>{}</code>\n\
            • User-Agent: <code>{}</code>\n\
            • Время: <code>{}</code>",
            escape_html(ip),
            escape_html(location),
            escape_html(user_agent),
            escape_html(datetime),
        );
        let kb = unlock_url.map(|u| {
            json!({
                "inline_keyboard": [[{ "text": "🔓 Разблокировать Control Plane", "url": u }]]
            })
        });
        (text, kb)
    } else {
        let text = format!(
            "🛡 <b>Вход в NovusWarden Control Plane</b>\n\n\
            • IP-адрес: <code>{}</code>\n\
            • Локация: <code>{}</code>\n\
            • User-Agent: <code>{}</code>\n\
            • Время: <code>{}</code>",
            escape_html(ip),
            escape_html(location),
            escape_html(user_agent),
            escape_html(datetime),
        );
        (text, None)
    };

    tokio::spawn(async move {
        drop(send_telegram_message_raw(&admin_chat, &html, markup).await);
    });
}

pub async fn send_test_message(chat_id: &str, label: &str) -> Result<String, Error> {
    let bot_username = fetch_bot_username().await?;
    let html = format!(
        "✅ <b>Проверка связи NovusWarden Telegram Guard</b>\n\n\
        • Бот: <code>@{bot_username}</code>\n\
        • Канал: <b>{}</b>\n\
        • Домен: <code>{}</code>\n\
        • Время: <code>{}</code>\n\n\
        Доставка OTP-кодов, кнопок подтверждения входа и уведомлений безопасности работает штатно!",
        escape_html(label),
        escape_html(&CONFIG.domain()),
        Utc::now().format("%Y-%m-%d %H:%M:%S UTC"),
    );
    send_telegram_message_raw(chat_id, &html, None).await?;
    Ok(bot_username)
}

/// Process a single incoming Telegram Update (`message` or `callback_query`).
pub async fn process_telegram_update(token: &str, update: &Value, pool: &DbPool) {
    if let Some(msg) = update.get("message") {
        let Some(chat_id) = msg["chat"]["id"].as_i64() else {
            return;
        };
        let text = msg["text"].as_str().unwrap_or_default().trim();
        let username = msg["from"]["username"].as_str().map(str::to_owned);
        let first_name = msg["from"]["first_name"].as_str().map(str::to_owned);

        if let Some(arg) = text.strip_prefix("/start") {
            let link_tok = arg.trim();
            if link_tok.is_empty() {
                let html = "🛡 <b>NovusWarden Telegram Guard</b>\n\n\
                    Для привязки аккаунта откройте <b>Web Vault → Настройки → Безопасность и KDF → Telegram Guard</b> и нажмите <b>«Подключить Telegram»</b>.\n\n\
                    Доступные команды:\n\
                    • /status — проверить статус привязки\n\
                    • /unlink — отвязать этот чат от хранилища";
                drop(send_telegram_message_raw(&chat_id.to_string(), html, None).await);
                return;
            }

            let pending = {
                let mut rt = TELEGRAM_RUNTIME.lock().unwrap();
                purge_expired_ephemeral(&mut rt);
                rt.link_tokens.remove(link_tok)
            };

            let Some(pending) = pending else {
                let html = "⚠️ <b>Ссылка привязки недействительна или истекла (10 минут).</b>\nСгенерируйте новую ссылку в настройках NovusWarden.";
                drop(send_telegram_message_raw(&chat_id.to_string(), html, None).await);
                return;
            };

            let link = TelegramUserLink {
                user_uuid: pending.user_uuid.clone(),
                email: pending.email.clone(),
                chat_id,
                username,
                first_name,
                linked_at: Utc::now().format("%Y-%m-%d %H:%M:%S UTC").to_string(),
                otp_enabled: true,
                telegram_only_otp: false,
                login_approval_enabled: true,
                alerts_enabled: true,
            };

            let save_res = {
                let mut store = TELEGRAM_STORE.lock().unwrap();
                store.users.insert(pending.user_uuid.clone(), link);
                persist_store(&store)
            };

            if save_res.is_ok() {
                drop(pending.locale);
                let html = format!(
                    "✅ <b>Аккаунт успешно привязан к NovusWarden!</b>\n\n\
                    • Профиль: <b>{}</b>\n\
                    • Chat ID: <code>{chat_id}</code>\n\
                    • Коды 2FA (OTP): <b>Включены</b>\n\
                    • Вход в 1 клик (Push Approval): <b>Включён</b>\n\
                    • Уведомления безопасности: <b>Включены</b>\n\n\
                    Теперь вы можете управлять режимами доставки прямо в настройках сейфа.",
                    escape_html(&pending.email),
                );
                drop(send_telegram_message_raw(&chat_id.to_string(), &html, None).await);
            }
        } else if text.starts_with("/status") {
            let found = {
                let store = TELEGRAM_STORE.lock().unwrap();
                store.users.values().find(|u| u.chat_id == chat_id).cloned()
            };
            let html = if let Some(u) = found {
                format!(
                    "🛡 <b>Статус NovusWarden Telegram Guard</b>\n\n\
                    • Привязан к: <b>{}</b>\n\
                    • Chat ID: <code>{chat_id}</code>\n\
                    • 2FA OTP коды: <b>{}</b>\n\
                    • Подтверждение входа в 1 клик: <b>{}</b>\n\
                    • Уведомления безопасности: <b>{}</b>",
                    escape_html(&u.email),
                    if u.otp_enabled {
                        "ВКЛ"
                    } else {
                        "ВЫКЛ"
                    },
                    if u.login_approval_enabled {
                        "ВКЛ"
                    } else {
                        "ВЫКЛ"
                    },
                    if u.alerts_enabled {
                        "ВКЛ"
                    } else {
                        "ВЫКЛ"
                    },
                )
            } else {
                format!(
                    "ℹ️ Этот чат (<code>{chat_id}</code>) пока не привязан к учётной записи NovusWarden.\nИспользуйте этот <code>Chat ID</code> для <code>TELEGRAM_ADMIN_CHAT_ID</code> или привяжите личный сейф в настройках Web Vault."
                )
            };
            drop(send_telegram_message_raw(&chat_id.to_string(), &html, None).await);
        } else if text.starts_with("/unlink") {
            let unlinked_email = {
                let mut store = TELEGRAM_STORE.lock().unwrap();
                let target_uuid = store.users.iter().find(|(_, u)| u.chat_id == chat_id).map(|(k, _)| k.clone());
                if let Some(uid) = target_uuid {
                    let removed = store.users.remove(&uid).map(|u| u.email);
                    drop(persist_store(&store));
                    removed
                } else {
                    None
                }
            };
            let html = match unlinked_email {
                Some(email) => format!("🔓 Чат успешно отвязан от аккаунта <b>{}</b>.", escape_html(&email)),
                None => "ℹ️ Этот чат не привязан ни к одному аккаунту.".to_owned(),
            };
            drop(send_telegram_message_raw(&chat_id.to_string(), &html, None).await);
        }
        return;
    }

    if let Some(cb) = update.get("callback_query") {
        let Some(cb_id) = cb["id"].as_str() else {
            return;
        };
        let Some(from_id) = cb["from"]["id"].as_i64() else {
            return;
        };
        let data = cb["data"].as_str().unwrap_or_default();
        let msg_chat_id = cb["message"]["chat"]["id"].as_i64().unwrap_or(from_id);
        let msg_id = cb["message"]["message_id"].as_i64().unwrap_or(0);
        let orig_text = cb["message"]["text"].as_str().unwrap_or_default();

        if let Some(challenge_id) = data.strip_prefix("2fa_ok:").or_else(|| data.strip_prefix("2fa_no:")) {
            let approve = data.starts_with("2fa_ok:");
            let outcome = {
                let store = TELEGRAM_STORE.lock().unwrap();
                let mut rt = TELEGRAM_RUNTIME.lock().unwrap();
                purge_expired_ephemeral(&mut rt);

                if let Some(ch) = rt.login_challenges.get_mut(challenge_id) {
                    let owner_ok = store.users.get(&ch.user_uuid).is_some_and(|u| u.chat_id == from_id);
                    if !owner_ok {
                        Err("Доступ запрещён")
                    } else if ch.status != ChallengeStatus::Pending {
                        Err("Решение по этому входу уже принято")
                    } else {
                        ch.status = if approve {
                            ChallengeStatus::Approved
                        } else {
                            ChallengeStatus::Rejected
                        };
                        Ok(ch.pin_code.clone())
                    }
                } else {
                    Err("Запрос входа истёк")
                }
            };

            match outcome {
                Ok(pin) => {
                    if approve {
                        answer_callback(token, cb_id, "✅ Вход в NovusWarden подтверждён!", false).await;
                        if msg_id > 0 {
                            let updated = format!(
                                "{}\n\n✅ <b>Подтверждено пользователем ({pin}) в {}</b>",
                                escape_html(orig_text),
                                Utc::now().format("%H:%M:%S UTC")
                            );
                            edit_message_after_action(token, msg_chat_id, msg_id, &updated).await;
                        }
                    } else {
                        answer_callback(token, cb_id, "🛑 Попытка входа заблокирована!", true).await;
                        if msg_id > 0 {
                            let updated = format!(
                                "{}\n\n🛑 <b>Вход ЗАБЛОКИРОВАН пользователем в {}</b>",
                                escape_html(orig_text),
                                Utc::now().format("%H:%M:%S UTC")
                            );
                            edit_message_after_action(token, msg_chat_id, msg_id, &updated).await;
                        }
                    }
                }
                Err(reason) => {
                    answer_callback(token, cb_id, reason, true).await;
                }
            }
        } else if let Some(short_id) = data.strip_prefix("ar_no:") {
            let entry = {
                let mut rt = TELEGRAM_RUNTIME.lock().unwrap();
                purge_expired_ephemeral(&mut rt);
                rt.auth_req_denies.remove(short_id)
            };

            let Some(entry) = entry else {
                answer_callback(token, cb_id, "Запрос уже обработан или истёк", true).await;
                return;
            };

            let owner_ok = get_user_link(&entry.user_uuid).is_some_and(|u| u.chat_id == from_id);
            if !owner_ok {
                answer_callback(token, cb_id, "Недостаточно прав", true).await;
                return;
            }

            if let Ok(conn) = pool.get().await {
                let ar_id: AuthRequestId = entry.auth_request_uuid.into();
                if let Some(ar) = AuthRequest::find_by_uuid(&ar_id, &conn).await
                    && ar.user_uuid.to_string() == entry.user_uuid
                {
                    drop(ar.delete(&conn).await);
                }
            }

            answer_callback(token, cb_id, "🛑 Запрос входа с устройства отклонён!", false).await;
            if msg_id > 0 {
                let updated = format!(
                    "{}\n\n🛑 <b>Запрос входа отклонён через Telegram в {}</b>",
                    escape_html(orig_text),
                    Utc::now().format("%H:%M:%S UTC")
                );
                edit_message_after_action(token, msg_chat_id, msg_id, &updated).await;
            }
        }
    }
}

/// Long-polling background loop that automatically activates whenever `TELEGRAM_ENABLED=true` and `TELEGRAM_BOT_TOKEN` is configured.
pub async fn run_poller_loop(pool: DbPool) {
    let mut offset: i64 = 0;
    let mut last_token = String::new();

    loop {
        let Some(token) = active_bot_token() else {
            tokio::time::sleep(Duration::from_secs(5)).await;
            continue;
        };

        if token != last_token {
            offset = 0;
            // Ensure no stale webhook blocks getUpdates when switching to built-in long polling
            let del_url = format!("https://api.telegram.org/bot{token}/deleteWebhook");
            if let Ok(req) = make_http_request(Method::POST, &del_url) {
                drop(req.send().await);
            }
            last_token.clone_from(&token);
            info!("Telegram Guard long-polling worker active.");
        }

        let poll_url = format!(
            "https://api.telegram.org/bot{token}/getUpdates?offset={offset}&timeout=20&allowed_updates=%5B%22message%22,%22callback_query%22%5D"
        );

        match POLL_CLIENT.get(&poll_url).send().await {
            Ok(resp) if resp.status().is_success() => {
                if let Ok(body) = resp.json::<Value>().await
                    && body["ok"].as_bool().unwrap_or(false)
                    && let Some(arr) = body["result"].as_array()
                {
                    for upd in arr {
                        if let Some(uid) = upd["update_id"].as_i64()
                            && uid >= offset
                        {
                            offset = uid + 1;
                        }
                        process_telegram_update(&token, upd, &pool).await;
                    }
                }
            }
            Ok(resp) if resp.status().as_u16() == 401 || resp.status().as_u16() == 404 => {
                warn!("Telegram Bot API returned {} during getUpdates; backing off 30s", resp.status());
                tokio::time::sleep(Duration::from_secs(30)).await;
            }
            Ok(_) | Err(_) => {
                tokio::time::sleep(Duration::from_secs(5)).await;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn html_escape_prevents_broken_tags() {
        assert_eq!(
            escape_html("Mozilla/5.0 <Linux & x64> \"Chrome\""),
            "Mozilla/5.0 &lt;Linux &amp; x64&gt; &quot;Chrome&quot;"
        );
    }

    #[test]
    fn login_challenge_single_use_and_ip_bound() {
        let user_id: UserId = uuid::Uuid::new_v4().to_string().into();
        let challenge_id = "deadbeefcafebabe".to_owned();
        let poll_secret = "secret-poll-123".to_owned();

        {
            let mut rt = TELEGRAM_RUNTIME.lock().unwrap();
            rt.login_challenges.insert(
                challenge_id.clone(),
                LoginApprovalChallenge {
                    user_uuid: user_id.to_string(),
                    ip: "203.0.113.42".to_owned(),
                    pin_code: "K7-42".to_owned(),
                    poll_secret: poll_secret.clone(),
                    grant_token: None,
                    status: ChallengeStatus::Pending,
                    expires_at: Instant::now() + Duration::from_secs(60),
                },
            );
        }

        assert_eq!(poll_login_approval_challenge(&challenge_id, &poll_secret), ("pending", None));

        {
            let mut rt = TELEGRAM_RUNTIME.lock().unwrap();
            rt.login_challenges.get_mut(&challenge_id).unwrap().status = ChallengeStatus::Approved;
        }

        let (status, grant) = poll_login_approval_challenge(&challenge_id, &poll_secret);
        assert_eq!(status, "approved");
        let grant = grant.expect("grant token minted");
        assert!(grant.starts_with("nw_tg_approve:"));

        // Wrong IP must fail without consuming valid challenge? No, wrong IP fails check:
        assert!(consume_approved_2fa_token(&user_id, "198.51.100.9", &grant).is_err());
        // Matching user + IP succeeds once:
        assert!(consume_approved_2fa_token(&user_id, "203.0.113.42", &grant).is_ok());
        // Replay fails:
        assert!(consume_approved_2fa_token(&user_id, "203.0.113.42", &grant).is_err());
    }
}
