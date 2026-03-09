use axum::{extract::State, Json};
use livekit_api::access_token::{AccessToken, VideoGrants};
use serde::{Deserialize, Serialize};
use std::env;

#[derive(Clone)]
pub struct AppState {
    pub livekit_api_key: String,
    pub livekit_api_secret: String,
    pub livekit_url: String,
}

#[derive(Deserialize)]
pub struct TokenRequest {
    pub room_name: String,
    pub participant_identity: String,
    pub participant_name: String,
}

#[derive(Serialize)]
pub struct TokenResponse {
    pub token: String,
    pub livekit_url: String,
}

pub async fn generate_token(
    State(state): State<AppState>,
    Json(payload): Json<TokenRequest>,
) -> Result<Json<TokenResponse>, String> {
    let mut token = AccessToken::with_api_key(&state.livekit_api_key, &state.livekit_api_secret)
        .with_identity(&payload.participant_identity)
        .with_name(&payload.participant_name)
        .with_grants(VideoGrants {
            room_join: true,
            room: payload.room_name.clone(),
            ..Default::default()
        });

    let jwt_token = token.to_jwt().map_err(|e| e.to_string())?;

    Ok(Json(TokenResponse {
        token: jwt_token,
        livekit_url: state.livekit_url.clone(),
    }))
}
