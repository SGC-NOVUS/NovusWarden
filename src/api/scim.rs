use rocket::{Route, serde::json::Json};
use serde_json::{Value, json};

pub fn routes() -> Vec<Route> {
    routes![get_service_provider_config, get_resource_types, get_schemas,]
}

#[get("/v2/ServiceProviderConfig")]
fn get_service_provider_config() -> Json<Value> {
    Json(json!({
        "schemas": ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
        "documentationUri": "https://bitwarden.com/help/article/scim-provisioning/",
        "patch": {
            "supported": true
        },
        "bulk": {
            "supported": false,
            "maxOperations": 0,
            "maxPayloadSize": 0
        },
        "filter": {
            "supported": true,
            "maxResults": 100
        },
        "changePassword": {
            "supported": false
        },
        "sort": {
            "supported": false
        },
        "etag": {
            "supported": false
        },
        "authenticationSchemes": [
            {
                "name": "OAuth Bearer Token",
                "description": "Authentication scheme using the OAuth Bearer Standard",
                "specUri": "http://www.rfc-editor.org/info/rfc6750",
                "documentationUri": "https://bitwarden.com/help/article/scim-provisioning/",
                "type": "oauthbearertoken",
                "primary": true
            }
        ]
    }))
}

#[get("/v2/ResourceTypes")]
fn get_resource_types() -> Json<Value> {
    Json(json!({
        "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
        "totalResults": 2,
        "Resources": [
            {
                "schemas": ["urn:ietf:params:scim:schemas:core:2.0:ResourceType"],
                "id": "User",
                "name": "User",
                "endpoint": "/scim/v2/Users",
                "description": "User Account",
                "schema": "urn:ietf:params:scim:schemas:core:2.0:User"
            },
            {
                "schemas": ["urn:ietf:params:scim:schemas:core:2.0:ResourceType"],
                "id": "Group",
                "name": "Group",
                "endpoint": "/scim/v2/Groups",
                "description": "Group",
                "schema": "urn:ietf:params:scim:schemas:core:2.0:Group"
            }
        ]
    }))
}

#[get("/v2/Schemas")]
fn get_schemas() -> Json<Value> {
    Json(json!({
        "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
        "totalResults": 2,
        "Resources": [
            {
                "id": "urn:ietf:params:scim:schemas:core:2.0:User",
                "name": "User",
                "description": "User Account"
            },
            {
                "id": "urn:ietf:params:scim:schemas:core:2.0:Group",
                "name": "Group",
                "description": "Group"
            }
        ]
    }))
}
