use rocket::{Route, serde::json::Json};
use serde::Deserialize;

use crate::{
    CONFIG,
    api::{EmptyResult, JsonResult, core::two_factor::email::EmailTokenData},
    auth::{ClientIp, Headers},
    db::{
        DbConn,
        models::{TwoFactor, TwoFactorType, User},
    },
    telegram, webpush,
};

pub fn routes() -> Vec<Route> {
    routes![
        get_notifications_status,
        post_telegram_link_token,
        put_telegram_preferences,
        post_telegram_test,
        delete_telegram_link,
        post_telegram_2fa_challenge,
        post_telegram_2fa_poll,
        post_webpush_subscribe,
        delete_webpush_subscription,
        post_webpush_test,
    ]
}

#[get("/novus/notifications/status")]
async fn get_notifications_status(headers: Headers, conn: DbConn) -> JsonResult {
    let user_uuid = headers.user.uuid.to_string();
    let bot_configured = telegram::is_bot_configured();
    let bot_username = if bot_configured {
        telegram::fetch_bot_username().await.ok()
    } else {
        None
    };

    let link = telegram::get_user_link(&user_uuid);
    let email_2fa_enabled = TwoFactor::find_by_user_and_type(&headers.user.uuid, TwoFactorType::Email, &conn)
        .await
        .is_some_and(|tf| tf.enabled);

    let tg_json = link.as_ref().map(|u| {
        let s = u.chat_id.to_string();
        let masked = if s.len() > 4 {
            format!("{}•••{}", &s[..2], &s[s.len() - 2..])
        } else {
            s
        };
        json!({
            "username": u.username,
            "firstName": u.first_name,
            "chatIdMasked": masked,
            "linkedAt": u.linked_at,
            "otpEnabled": u.otp_enabled,
            "telegramOnlyOtp": u.telegram_only_otp,
            "loginApprovalEnabled": u.login_approval_enabled,
            "alertsEnabled": u.alerts_enabled,
        })
    });

    Ok(Json(json!({
        "telegramEnabled": bot_configured,
        "telegramBotUsername": bot_username,
        "telegram2faEnabled": CONFIG.telegram_2fa_enabled(),
        "telegramAlertsEnabled": CONFIG.telegram_alerts_enabled(),
        "telegramLinked": link.is_some(),
        "telegram": tg_json,
        "email2faEnabled": email_2fa_enabled,
        "webPushEnabled": CONFIG.web_push_enabled(),
        "vapidPublicKey": if CONFIG.web_push_enabled() { Some(webpush::get_vapid_public_key()) } else { None },
        "webPushSubscriptions": webpush::list_user_subscriptions(&user_uuid),
        "mobilePushRelayEnabled": CONFIG.push_enabled(),
    })))
}

#[post("/novus/telegram/link-token")]
async fn post_telegram_link_token(headers: Headers) -> JsonResult {
    let (token, bot_username, deep_link) =
        telegram::create_link_deep_link(&headers.user.uuid.to_string(), &headers.user.email, &headers.locale).await?;

    Ok(Json(json!({
        "token": token,
        "botUsername": bot_username,
        "deepLink": deep_link,
        "expiresInSeconds": 600,
    })))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(clippy::struct_excessive_bools)]
struct TelegramPreferencesPayload {
    otp_enabled: bool,
    #[serde(default)]
    telegram_only_otp: bool,
    login_approval_enabled: bool,
    alerts_enabled: bool,
    #[serde(default)]
    auto_enable_email_2fa: bool,
}

#[put("/novus/telegram/preferences", data = "<data>")]
async fn put_telegram_preferences(
    data: Json<TelegramPreferencesPayload>,
    headers: Headers,
    conn: DbConn,
) -> JsonResult {
    let payload = data.into_inner();
    let updated = telegram::update_user_preferences(
        &headers.user.uuid.to_string(),
        payload.otp_enabled,
        payload.telegram_only_otp,
        payload.login_approval_enabled,
        payload.alerts_enabled,
    )?;

    // Optionally enable standard Email 2FA channel automatically so Bitwarden extensions & mobile apps
    // can trigger 6-digit OTPs delivered directly into Telegram without requiring an email round-trip.
    if payload.auto_enable_email_2fa && payload.otp_enabled {
        let existing = TwoFactor::find_by_user_and_type(&headers.user.uuid, TwoFactorType::Email, &conn).await;
        if existing.is_none() {
            let tf_data = EmailTokenData::new(headers.user.email.clone(), None);
            let tf = TwoFactor::new(headers.user.uuid.clone(), TwoFactorType::Email, tf_data.to_json());
            tf.save(&conn).await?;
            let mut user = headers.user;
            if user.totp_recover.is_none() {
                user.totp_recover = Some(data_encoding::BASE32_NOPAD.encode(&crate::crypto::get_random_bytes::<20>()));
                user.save(&conn).await?;
            }
        }
    }

    Ok(Json(json!({
        "ok": true,
        "otpEnabled": updated.otp_enabled,
        "telegramOnlyOtp": updated.telegram_only_otp,
        "loginApprovalEnabled": updated.login_approval_enabled,
        "alertsEnabled": updated.alerts_enabled,
    })))
}

#[post("/novus/telegram/test")]
async fn post_telegram_test(headers: Headers) -> JsonResult {
    let Some(link) = telegram::get_user_link(&headers.user.uuid.to_string()) else {
        err!("Telegram-чат не привязан к вашему аккаунту");
    };
    let bot = telegram::send_test_message(&link.chat_id.to_string(), &headers.user.email).await?;
    Ok(Json(json!({ "ok": true, "botUsername": bot })))
}

#[expect(clippy::needless_pass_by_value, reason = "Rocket request guard")]
#[delete("/novus/telegram/link")]
fn delete_telegram_link(headers: Headers) -> EmptyResult {
    telegram::unlink_user(&headers.user.uuid.to_string())?;
    Ok(())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Telegram2faChallengeRequest {
    email: String,
    master_password_hash: String,
    device_name: Option<String>,
}

#[post("/novus/telegram/2fa/challenge", data = "<data>")]
async fn post_telegram_2fa_challenge(
    data: Json<Telegram2faChallengeRequest>,
    ip: ClientIp,
    conn: DbConn,
) -> JsonResult {
    crate::ratelimit::check_limit_login(&ip.ip)?;
    let req = data.into_inner();
    let Some(user) = User::find_by_mail(req.email.trim(), &conn).await else {
        err!("Неверные учётные данные");
    };
    if !user.enabled || !user.check_valid_password(&req.master_password_hash) {
        err!("Неверные учётные данные");
    }

    let dev_name = req.device_name.as_deref().filter(|s| !s.trim().is_empty()).unwrap_or("NovusWarden Web Vault");

    let (challenge_id, poll_secret, pin_code) =
        telegram::create_login_approval_challenge(&user.uuid, &ip.ip.to_string(), dev_name).await?;

    Ok(Json(json!({
        "challengeId": challenge_id,
        "pollSecret": poll_secret,
        "pinCode": pin_code,
        "expiresInSeconds": 180,
    })))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Telegram2faPollRequest {
    challenge_id: String,
    poll_secret: String,
}

#[post("/novus/telegram/2fa/poll", data = "<data>")]
fn post_telegram_2fa_poll(data: Json<Telegram2faPollRequest>, ip: ClientIp) -> JsonResult {
    crate::ratelimit::check_limit_unauthenticated(&ip.ip)?;
    let req = data.into_inner();
    let (status, grant_token) = telegram::poll_login_approval_challenge(&req.challenge_id, &req.poll_secret);
    Ok(Json(json!({
        "status": status,
        "grantToken": grant_token,
    })))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WebPushKeysPayload {
    p256dh: String,
    auth: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WebPushSubscribePayload {
    endpoint: String,
    keys: WebPushKeysPayload,
    user_agent: Option<String>,
}

#[expect(clippy::needless_pass_by_value, reason = "Rocket request guard")]
#[post("/novus/webpush/subscribe", data = "<data>")]
fn post_webpush_subscribe(data: Json<WebPushSubscribePayload>, headers: Headers) -> JsonResult {
    if !CONFIG.web_push_enabled() {
        err!("Web Push уведомления отключены администратором сервера");
    }
    let payload = data.into_inner();
    let ua = payload.user_agent.filter(|s| !s.trim().is_empty()).unwrap_or_else(|| headers.device.name.clone());
    let id = webpush::upsert_subscription(
        &headers.user.uuid.to_string(),
        payload.endpoint,
        &payload.keys.p256dh,
        &payload.keys.auth,
        ua,
    )?;
    Ok(Json(json!({ "ok": true, "id": id })))
}

#[expect(clippy::needless_pass_by_value, reason = "Rocket request guard")]
#[delete("/novus/webpush/subscribe/<sub_id>")]
fn delete_webpush_subscription(sub_id: &str, headers: Headers) -> JsonResult {
    let removed = webpush::remove_subscription(&headers.user.uuid.to_string(), sub_id)?;
    Ok(Json(json!({ "ok": true, "removed": removed })))
}

#[post("/novus/webpush/test")]
async fn post_webpush_test(headers: Headers) -> JsonResult {
    let (delivered, total) = webpush::send_web_push_to_user(
        &headers.user.uuid.to_string(),
        "NovusWarden Push Guard",
        "Браузерные Web Push уведомления успешно подключены и зашифрованы (RFC 8291)!",
        "/#/settings",
        "novus-push-test",
    )
    .await;
    if total == 0 {
        err!("Нет активных подписок браузера для отправки тестового уведомления");
    }
    Ok(Json(json!({
        "ok": delivered > 0,
        "delivered": delivered,
        "total": total,
    })))
}
