use chrono::Utc;
use rocket::{Route, serde::json::Json};

use crate::{
    CONFIG,
    api::{
        ApiResult, EmptyResult, JsonResult, PasswordOrOtpData,
        core::log_user_event,
        core::two_factor::{VerificationTokenData, generate_recover_code},
    },
    auth::{AdminHeaders, Headers, two_factor, two_factor::DuoData},
    crypto,
    db::{
        DbConn,
        models::{EventType, OrganizationId, TwoFactor, TwoFactorType, User, UserId},
    },
    error::MapResult,
    http_client::make_http_request,
};

pub fn routes() -> Vec<Route> {
    routes![
        get_duo,
        activate_duo,
        activate_duo_put,
        disable_duo,
        get_org_twofactor,
        get_org_duo,
        activate_org_duo_put,
        activate_org_duo_post,
        disable_org_duo,
    ]
}

enum DuoStatus {
    Global(DuoData),
    // Using the global duo config
    User(DuoData),
    // Using the user's config
    Disabled(bool), // True if there is a global setting
}

impl DuoStatus {
    fn data(self) -> Option<DuoData> {
        match self {
            DuoStatus::Global(data) | DuoStatus::User(data) => Some(data),
            DuoStatus::Disabled(_) => None,
        }
    }
}

const DISABLED_MESSAGE_DEFAULT: &str = "<To use the global Duo keys, please leave these fields untouched>";

#[post("/two-factor/get-duo", data = "<data>")]
async fn get_duo(data: Json<PasswordOrOtpData>, headers: Headers, conn: DbConn) -> JsonResult {
    let data: PasswordOrOtpData = data.into_inner();
    let user = headers.user;

    data.validate(&user, false, &conn).await?;

    let (enabled, duo) = match get_user_duo_data(&user.uuid, &conn).await {
        DuoStatus::Global(_) => (true, Some(DuoData::secret())),
        DuoStatus::User(data) => (true, Some(data.obscure())),
        DuoStatus::Disabled(true) => (false, Some(DuoData::msg(DISABLED_MESSAGE_DEFAULT))),
        DuoStatus::Disabled(false) => (false, None),
    };

    let duo_json = if let Some(data) = duo.as_ref() {
        json!({
            "enabled": enabled,
            "host": data.host,
            "clientSecret": data.sk,
            "clientId": data.ik,
        })
    } else {
        json!({
            "enabled": enabled,
            "host": null,
            "clientSecret": null,
            "clientId": null,
        })
    };

    Ok(Json(rocket::serde::json::json!({
        "duo": duo_json,
        "userVerificationToken": two_factor::duo_token(user.uuid, duo, enabled),
    })))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct EnableDuoData {
    host: String,
    client_secret: String,
    client_id: String,
    user_verification_token: String,
}

impl From<EnableDuoData> for DuoData {
    fn from(d: EnableDuoData) -> Self {
        Self {
            host: d.host,
            ik: d.client_id,
            sk: d.client_secret,
        }
    }
}

fn check_duo_fields_custom(data: &EnableDuoData) -> bool {
    fn empty_or_default(s: &str) -> bool {
        let st = s.trim();
        st.is_empty() || s == DISABLED_MESSAGE_DEFAULT
    }

    !empty_or_default(&data.host) && !empty_or_default(&data.client_secret) && !empty_or_default(&data.client_id)
}

#[post("/two-factor/duo", data = "<data>")]
async fn activate_duo(data: Json<EnableDuoData>, headers: Headers, conn: DbConn) -> JsonResult {
    let data: EnableDuoData = data.into_inner();
    let mut user = headers.user;

    two_factor::validate_duo(&data.user_verification_token, &user.uuid, None, false)?;

    let (data, data_str) = if check_duo_fields_custom(&data) {
        let data_req: DuoData = data.into();
        let data_str = serde_json::to_string(&data_req)?;
        duo_api_request("GET", "/auth/v2/check", "", &data_req)
            .await
            .map_res(crate::i18n::two_factor_failed_validate_duo_credentials(&headers.locale))?;
        (data_req.obscure(), data_str)
    } else {
        (DuoData::secret(), String::new())
    };

    let type_ = TwoFactorType::Duo;
    let twofactor = TwoFactor::new(user.uuid.clone(), type_, data_str);
    twofactor.save(&conn).await?;

    generate_recover_code(&mut user, &conn).await;

    log_user_event(EventType::UserUpdated2fa, &user.uuid, headers.device.atype, &headers.ip.ip, &conn).await;

    Ok(Json(json!({
        "duo": json!({
            "enabled": true,
            "host": data.host,
            "clientSecret": data.sk,
            "clientId": data.ik,
        }),
    })))
}

#[put("/two-factor/duo", data = "<data>")]
async fn activate_duo_put(data: Json<EnableDuoData>, headers: Headers, conn: DbConn) -> JsonResult {
    activate_duo(data, headers, conn).await
}

#[delete("/two-factor/duo", data = "<data>")]
async fn disable_duo(data: Json<VerificationTokenData>, headers: Headers, conn: DbConn) -> EmptyResult {
    let user = headers.user;

    if let Some(twofactor) = TwoFactor::find_by_user_and_type(&user.uuid, TwoFactorType::Duo, &conn).await {
        // Apply the same transformation than in `get_duo` to check we are disabling the correct one
        let duo = match to_user_duo_data(&twofactor) {
            DuoStatus::Global(_) => Some(DuoData::secret()),
            DuoStatus::User(data) => Some(data.obscure()),
            DuoStatus::Disabled(_) => None,
        };

        two_factor::validate_duo(&data.user_verification_token, &user.uuid, duo.as_ref(), true)?;

        twofactor.delete(&conn).await?;
        log_user_event(EventType::UserDisabled2fa, &user.uuid, headers.device.atype, &headers.ip.ip, &conn).await;
    }

    super::check_2fa_state(&user, headers.device.atype, &headers.ip.ip, &conn).await?;

    Ok(())
}

async fn duo_api_request(method: &str, path: &str, params: &str, data: &DuoData) -> EmptyResult {
    use reqwest::{Method, header};
    use std::str::FromStr;

    // https://duo.com/docs/authapi#api-details
    let url = format!("https://{}{path}", data.host);
    let dt = Utc::now().to_rfc2822();
    let username = &data.ik;
    let fields = [&dt, method, &data.host, path, params];
    let password = crypto::hmac_sign(&data.sk, &fields.join("\n"));

    let m = Method::from_str(method).unwrap_or_default();

    make_http_request(m, &url)?
        .basic_auth(username, Some(password))
        .header(header::USER_AGENT, "vaultwarden:Duo/1.0 (Rust)")
        .header(header::DATE, dt)
        .send()
        .await?
        .error_for_status()?;

    Ok(())
}

async fn get_user_duo_data(user_id: &UserId, conn: &DbConn) -> DuoStatus {
    // If the user doesn't have an entry, disabled
    let Some(twofactor) = TwoFactor::find_by_user_and_type(user_id, TwoFactorType::Duo, conn).await else {
        return DuoStatus::Disabled(DuoData::global().is_some());
    };

    to_user_duo_data(&twofactor)
}

fn to_user_duo_data(twofactor: &TwoFactor) -> DuoStatus {
    // If the user has the required values, we use those
    if let Ok(data) = serde_json::from_str(&twofactor.data) {
        return DuoStatus::User(data);
    }

    // Otherwise, we try to use the globals
    if let Some(global) = DuoData::global() {
        return DuoStatus::Global(global);
    }

    // If there are no globals configured, just disable it
    DuoStatus::Disabled(false)
}

// let (ik, sk, host) = get_duo_keys_email();
pub(crate) async fn get_duo_keys_email(email: &str, conn: &DbConn) -> ApiResult<(String, String, String)> {
    let data = match User::find_by_mail(email, conn).await {
        Some(u) => get_user_duo_data(&u.uuid, conn).await.data(),
        _ => DuoData::global(),
    }
    .map_res(crate::i18n::two_factor_cant_fetch_duo_keys(&CONFIG.default_locale()))?;

    Ok((data.ik, data.sk, data.host))
}

fn org_duo_config_path(org_id: &OrganizationId) -> Option<std::path::PathBuf> {
    let parsed = uuid::Uuid::parse_str(org_id).ok()?;
    Some(std::path::PathBuf::from(CONFIG.data_folder()).join("org_duo").join(format!("{parsed}.json")))
}

fn read_org_duo_custom(org_id: &OrganizationId) -> Option<DuoData> {
    let path = org_duo_config_path(org_id)?;
    let raw = std::fs::read_to_string(path).ok()?;
    serde_json::from_str::<DuoData>(&raw).ok()
}

fn get_org_duo_status(org_id: &OrganizationId) -> DuoStatus {
    if let Some(custom) = read_org_duo_custom(org_id) {
        DuoStatus::User(custom)
    } else if let Some(global) = DuoData::global() {
        DuoStatus::Global(global)
    } else {
        DuoStatus::Disabled(false)
    }
}

fn write_org_duo_custom(org_id: &OrganizationId, data: &DuoData) -> EmptyResult {
    let Some(path) = org_duo_config_path(org_id) else {
        err!("Invalid organization id");
    };
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_res("Failed to create org_duo directory")?;
    }
    let json = serde_json::to_string(data)?;
    std::fs::write(path, json).map_res("Failed to save organization Duo configuration")
}

fn delete_org_duo_custom(org_id: &OrganizationId) -> EmptyResult {
    if let Some(path) = org_duo_config_path(org_id)
        && path.exists()
    {
        std::fs::remove_file(path).map_res("Failed to remove organization Duo configuration")?;
    }
    Ok(())
}

fn duo_details_json(enabled: bool, data: Option<&DuoData>) -> serde_json::Value {
    if let Some(d) = data {
        json!({
            "enabled": enabled,
            "host": d.host,
            "clientSecret": d.sk,
            "clientId": d.ik,
        })
    } else {
        json!({
            "enabled": enabled,
            "host": null,
            "clientSecret": null,
            "clientId": null,
        })
    }
}

#[expect(clippy::needless_pass_by_value, reason = "Rocket request guards require owned values")]
#[get("/organizations/<org_id>/two-factor")]
fn get_org_twofactor(org_id: OrganizationId, headers: AdminHeaders) -> JsonResult {
    if org_id != headers.org_id {
        err!("Organization id's do not match");
    }

    let enabled = matches!(get_org_duo_status(&org_id), DuoStatus::Global(_) | DuoStatus::User(_));
    let providers = if enabled {
        vec![json!({
            "enabled": true,
            "type": TwoFactorType::OrganizationDuo as i32,
            "object": "twoFactorProvider",
        })]
    } else {
        Vec::new()
    };

    Ok(Json(json!({
        "data": providers,
        "object": "list",
        "continuationToken": null,
    })))
}

#[post("/organizations/<org_id>/two-factor/get-duo", data = "<data>")]
async fn get_org_duo(
    org_id: OrganizationId,
    data: Json<PasswordOrOtpData>,
    headers: AdminHeaders,
    conn: DbConn,
) -> JsonResult {
    if org_id != headers.org_id {
        err!("Organization id's do not match");
    }
    let data = data.into_inner();
    data.validate(&headers.user, false, &conn).await?;

    let (enabled, duo) = match get_org_duo_status(&org_id) {
        DuoStatus::Global(_) => (true, Some(DuoData::secret())),
        DuoStatus::User(d) => (true, Some(d.obscure())),
        DuoStatus::Disabled(has_global) => (
            false,
            if has_global {
                Some(DuoData::msg(DISABLED_MESSAGE_DEFAULT))
            } else {
                None
            },
        ),
    };

    Ok(Json(json!({
        "duo": duo_details_json(enabled, duo.as_ref()),
        "userVerificationToken": two_factor::duo_token(headers.user.uuid, duo, enabled),
        "object": "twoFactorOrganizationDuo",
    })))
}

#[put("/organizations/<org_id>/two-factor/duo", data = "<data>")]
async fn activate_org_duo_put(
    org_id: OrganizationId,
    data: Json<EnableDuoData>,
    headers: AdminHeaders,
    conn: DbConn,
) -> JsonResult {
    activate_org_duo_post(org_id, data, headers, conn).await
}

#[post("/organizations/<org_id>/two-factor/duo", data = "<data>")]
async fn activate_org_duo_post(
    org_id: OrganizationId,
    data: Json<EnableDuoData>,
    headers: AdminHeaders,
    conn: DbConn,
) -> JsonResult {
    if org_id != headers.org_id {
        err!("Organization id's do not match");
    }
    let data = data.into_inner();
    let expected = match get_org_duo_status(&org_id) {
        DuoStatus::Global(_) => (true, Some(DuoData::secret())),
        DuoStatus::User(d) => (true, Some(d.obscure())),
        DuoStatus::Disabled(_) => (false, None),
    };
    two_factor::validate_duo(&data.user_verification_token, &headers.user.uuid, expected.1.as_ref(), expected.0)?;

    let obscured = if check_duo_fields_custom(&data) {
        let req_data: DuoData = data.into();
        duo_api_request("GET", "/auth/v2/check", "", &req_data).await.map_res("Failed to validate Duo credentials")?;
        write_org_duo_custom(&org_id, &req_data)?;
        req_data.obscure()
    } else if DuoData::global().is_some() {
        delete_org_duo_custom(&org_id)?;
        DuoData::secret()
    } else {
        err!("Duo global settings are not configured and custom fields are incomplete");
    };

    headers.log_event(EventType::OrganizationUpdated, &org_id, &org_id, &conn).await;

    Ok(Json(json!({
        "duo": duo_details_json(true, Some(&obscured)),
        "object": "twoFactorOrganizationDuoUpdate",
    })))
}

#[delete("/organizations/<org_id>/two-factor/duo", data = "<data>")]
async fn disable_org_duo(
    org_id: OrganizationId,
    data: Json<VerificationTokenData>,
    headers: AdminHeaders,
    conn: DbConn,
) -> EmptyResult {
    if org_id != headers.org_id {
        err!("Organization id's do not match");
    }
    let expected = match get_org_duo_status(&org_id) {
        DuoStatus::Global(_) => (true, Some(DuoData::secret())),
        DuoStatus::User(d) => (true, Some(d.obscure())),
        DuoStatus::Disabled(_) => (false, None),
    };
    two_factor::validate_duo(&data.user_verification_token, &headers.user.uuid, expected.1.as_ref(), expected.0)?;
    delete_org_duo_custom(&org_id)?;
    headers.log_event(EventType::OrganizationUpdated, &org_id, &org_id, &conn).await;
    Ok(())
}
