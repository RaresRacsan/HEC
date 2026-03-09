mod livekit_auth;
mod ws_chat;
pub mod db;

use axum::{
    routing::{get, post}, Router, Json, extract::{State, Path},
    http::StatusCode
};
use dotenvy::dotenv;
use std::env;
use std::net::SocketAddr;
use std::sync::Arc;
use livekit_auth::{AppState as LiveKitState, generate_token};
use ws_chat::{ws_handler, WsState};
use tower_http::cors::CorsLayer;
use sqlx::postgres::PgPoolOptions;
use tokio::sync::broadcast;
use axum::extract::FromRef;
use serde::Deserialize;

#[derive(Clone)]
pub struct AppState {
    pub livekit: LiveKitState,
    pub ws: Arc<WsState>,
}

impl FromRef<AppState> for LiveKitState {
    fn from_ref(app_state: &AppState) -> Self {
        app_state.livekit.clone()
    }
}

impl FromRef<AppState> for Arc<WsState> {
    fn from_ref(app_state: &AppState) -> Self {
        app_state.ws.clone()
    }
}

#[derive(Deserialize)]
pub struct AuthRequest {
    pub username: String,
    pub password: Option<String>,
}

#[derive(serde::Serialize)]
pub struct AuthResponse {
    pub user: db::User,
    pub token: String, // In a real app, send a JWT
}

pub async fn register_handler(
    State(state): State<Arc<WsState>>,
    Json(payload): Json<AuthRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, String)> {
    let raw_pass = payload.password.unwrap_or_else(|| "password123".into());
    let hash = bcrypt::hash(raw_pass, bcrypt::DEFAULT_COST).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    
    let user = db::create_user(&state.db, &payload.username, &hash)
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
    
    Ok(Json(AuthResponse { user, token: "mock_jwt_token".into() }))
}

pub async fn login_handler(
    State(state): State<Arc<WsState>>,
    Json(payload): Json<AuthRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, String)> {
    let user = db::get_user_by_username(&state.db, &payload.username)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::UNAUTHORIZED, "User not found".to_string()))?;
    
    let raw_pass = payload.password.unwrap_or_else(|| "".into());
    let is_valid = match &user.password_hash {
        Some(hash) => bcrypt::verify(raw_pass, hash).unwrap_or(false),
        None => true, // Fallback for old mock users
    };

    if !is_valid {
        return Err((StatusCode::UNAUTHORIZED, "Invalid password".to_string()));
    }
    
    Ok(Json(AuthResponse { user, token: "mock_jwt_token".into() }))
}

pub async fn get_servers_handler(
    Path(user_id): Path<i32>,
    State(state): State<Arc<WsState>>,
) -> Result<Json<Vec<db::Server>>, String> {
    let servers = sqlx::query_as!(
        db::Server,
        r#"
        SELECT s.id, s.name, s.created_at as "created_at!"
        FROM servers s
        JOIN server_members sm ON s.id = sm.server_id
        WHERE sm.user_id = $1
        "#,
        user_id
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;
    
    Ok(Json(servers))
}

pub async fn get_server_channels_handler(
    Path(server_id): Path<i32>,
    State(state): State<Arc<WsState>>,
) -> Result<Json<Vec<db::Channel>>, String> {
    let channels = sqlx::query_as!(
        db::Channel,
        "SELECT id, name, is_dm, server_id, channel_type, created_at FROM channels WHERE server_id = $1 ORDER BY channel_type DESC, name ASC",
        server_id
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;
    
    Ok(Json(channels))
}

pub async fn get_dms_handler(
    Path(user_id): Path<i32>,
    State(state): State<Arc<WsState>>,
) -> Result<Json<Vec<db::Channel>>, String> {
    // DM channel names follow the pattern "dm-{a}-{b}" where the user is either a or b
    let channels = sqlx::query_as!(
        db::Channel,
        r#"
        SELECT id, name, is_dm, server_id, channel_type, created_at
        FROM channels
        WHERE is_dm = true
          AND (name LIKE $1 OR name LIKE $2)
        "#,
        format!("dm-{}-%%", user_id),
        format!("dm-%%-{}", user_id)
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;
    
    Ok(Json(channels))
}

pub async fn get_server_members_handler(
    Path(server_id): Path<i32>,
    State(state): State<Arc<WsState>>,
) -> Result<Json<Vec<db::User>>, String> {
    let members = sqlx::query_as!(
        db::User,
        r#"
        SELECT u.id, u.username, u.password_hash, u.created_at as "created_at!"
        FROM users u
        JOIN server_members sm ON u.id = sm.user_id
        WHERE sm.server_id = $1
        "#,
        server_id
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;
    
    Ok(Json(members))
}

#[derive(Deserialize)]
pub struct CreateServerRequest {
    pub name: String,
    pub user_id: i32,
}

pub async fn create_server_handler(
    State(state): State<Arc<WsState>>,
    Json(payload): Json<CreateServerRequest>,
) -> Result<Json<db::Server>, (StatusCode, String)> {
    // Create the server
    let server = sqlx::query_as!(
        db::Server,
        "INSERT INTO servers (name) VALUES ($1) RETURNING id, name, created_at as \"created_at!\"",
        payload.name
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Add creator as owner
    sqlx::query!(
        "INSERT INTO server_members (server_id, user_id, role) VALUES ($1, $2, 'owner')",
        server.id, payload.user_id
    )
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(server))
}

#[derive(Deserialize)]
pub struct CreateChannelRequest {
    pub name: String,
    pub channel_type: String, // "text" or "voice"
}

pub async fn create_channel_handler(
    Path(server_id): Path<i32>,
    State(state): State<Arc<WsState>>,
    Json(payload): Json<CreateChannelRequest>,
) -> Result<Json<db::Channel>, (StatusCode, String)> {
    let channel = sqlx::query_as!(
        db::Channel,
        "INSERT INTO channels (name, is_dm, server_id, channel_type) VALUES ($1, false, $2, $3) RETURNING id, name, is_dm, server_id, channel_type, created_at as \"created_at!\"",
        payload.name,
        server_id,
        payload.channel_type
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(channel))
}

#[derive(Deserialize)]
pub struct CreateInviteRequest {
    pub user_id: i32,
}

#[derive(serde::Serialize)]
pub struct InviteResponse {
    pub code: String,
    pub invite_url: String,
}

pub async fn create_invite_handler(
    Path(server_id): Path<i32>,
    State(state): State<Arc<WsState>>,
    Json(payload): Json<CreateInviteRequest>,
) -> Result<Json<InviteResponse>, (StatusCode, String)> {
    // Generate a random 8-char alphanumeric code
    use std::time::{SystemTime, UNIX_EPOCH};
    let ts = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    let code = format!("{:08X}", (ts ^ (server_id as u128 * 0xDEAD_BEEF)) & 0xFFFF_FFFF);

    sqlx::query!(
        "INSERT INTO invite_codes (code, server_id, created_by) VALUES ($1, $2, $3)",
        code, server_id, payload.user_id
    )
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(InviteResponse {
        invite_url: format!("http://localhost:1420/invite/{}", code),
        code,
    }))
}

pub async fn join_invite_handler(
    Path(code): Path<String>,
    State(state): State<Arc<WsState>>,
    Json(payload): Json<CreateServerRequest>, // reuse: name ignored, user_id used
) -> Result<Json<db::Server>, (StatusCode, String)> {
    // Look up invite
    let invite = sqlx::query!(
        "SELECT id, server_id, uses, max_uses, expires_at FROM invite_codes WHERE code = $1",
        code
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Invite not found".to_string()))?;

    // Check expiry
    if let Some(exp) = invite.expires_at {
        if exp < chrono::Utc::now() {
            return Err((StatusCode::GONE, "Invite has expired".to_string()));
        }
    }

    // Check max uses
    let uses = invite.uses.unwrap_or(0);
    let max_uses = invite.max_uses.unwrap_or(0);
    if max_uses > 0 && uses >= max_uses {
        return Err((StatusCode::GONE, "Invite max uses reached".to_string()));
    }

    // Add to server (ignore if already member)
    sqlx::query!(
        "INSERT INTO server_members (server_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING",
        invite.server_id, payload.user_id
    )
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Increment uses
    sqlx::query!("UPDATE invite_codes SET uses = uses + 1 WHERE id = $1", invite.id)
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Return the server
    let server = sqlx::query_as!(
        db::Server,
        "SELECT id, name, created_at as \"created_at!\" FROM servers WHERE id = $1",
        invite.server_id
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(server))
}

#[derive(Deserialize)]
pub struct StartDmRequest {
    pub from_user_id: i32,
    pub to_username: String,
}

pub async fn start_dm_handler(
    State(state): State<Arc<WsState>>,
    Json(payload): Json<StartDmRequest>,
) -> Result<Json<db::Channel>, (StatusCode, String)> {
    // Find the target user
    let target = db::get_user_by_username(&state.db, &payload.to_username)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "User not found".to_string()))?;

    // DM channel name is deterministic: sorted user IDs joined by '-'
    let (a, b) = if payload.from_user_id < target.id {
        (payload.from_user_id, target.id)
    } else {
        (target.id, payload.from_user_id)
    };
    let dm_name = format!("dm-{}-{}", a, b);

    // Get or create DM channel (SELECT first, then INSERT if not found)
    let channel = if let Some(existing) = sqlx::query_as!(
        db::Channel,
        "SELECT id, name, is_dm, server_id, channel_type, created_at as \"created_at!\" FROM channels WHERE name = $1 AND is_dm = true",
        dm_name
    ).fetch_optional(&state.db).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))? {
        existing
    } else {
        sqlx::query_as!(
            db::Channel,
            "INSERT INTO channels (name, is_dm, channel_type) VALUES ($1, true, 'text') RETURNING id, name, is_dm, server_id, channel_type, created_at as \"created_at!\"",
            dm_name
        )
        .fetch_one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    };

    Ok(Json(channel))
}

pub async fn search_users_handler(
    Path(query): Path<String>,
    State(state): State<Arc<WsState>>,
) -> Result<Json<Vec<db::UserPublic>>, String> {
    let users = sqlx::query_as!(
        db::UserPublic,
        "SELECT id, username, created_at FROM users WHERE username ILIKE $1 LIMIT 10",
        format!("%{}%", query)
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(Json(users))
}

pub async fn get_user_by_id_handler(
    Path(id): Path<i32>,
    State(state): State<Arc<WsState>>,
) -> Result<Json<db::UserPublic>, (StatusCode, String)> {
    let user = sqlx::query_as!(
        db::UserPublic,
        "SELECT id, username, created_at FROM users WHERE id = $1",
        id
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "User not found".to_string()))?;

    Ok(Json(user))
}

pub async fn get_messages_handler(
    axum::extract::Path(channel_id): axum::extract::Path<i32>,
    State(state): State<Arc<WsState>>,
) -> Result<Json<Vec<ws_chat::ChatMessage>>, String> {
    let messages = sqlx::query_as!(
        ws_chat::ChatMessage,
        r#"
        SELECT m.channel_id, m.user_id, u.username, m.content
        FROM messages m
        JOIN users u ON m.user_id = u.id
        WHERE m.channel_id = $1
        ORDER BY m.created_at ASC
        "#,
        channel_id
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(Json(messages))
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();
    
    // Setup Database
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await?;

    // Setup Broadcast channel for WebSocket text chat
    let (tx, _rx) = broadcast::channel(100);

    let state = AppState {
        livekit: LiveKitState {
            livekit_api_key: env::var("LIVEKIT_API_KEY").unwrap_or_else(|_| "devkey".into()),
            livekit_api_secret: env::var("LIVEKIT_API_SECRET").unwrap_or_else(|_| "secret".into()),
            livekit_url: env::var("LIVEKIT_URL").unwrap_or_else(|_| "ws://127.0.0.1:7880".into()),
        },
        ws: Arc::new(WsState { db: pool, tx }),
    };

    let cors = CorsLayer::permissive();

    let app = Router::new()
        .route("/api/livekit/token", post(generate_token))
        .route("/api/register", post(register_handler))
        .route("/api/login", post(login_handler))
        // Servers
        .route("/api/servers", post(create_server_handler))
        .route("/api/users/{user_id}/servers", get(get_servers_handler))
        .route("/api/users/{user_id}/dms", get(get_dms_handler))
        .route("/api/servers/{server_id}/channels", get(get_server_channels_handler).post(create_channel_handler))
        .route("/api/servers/{server_id}/members", get(get_server_members_handler))
        .route("/api/servers/{server_id}/invites", post(create_invite_handler))
        // Invites
        .route("/api/invites/{code}/join", post(join_invite_handler))
        // DMs
        .route("/api/dms", post(start_dm_handler))
        // Users
        .route("/api/users/search/{query}", get(search_users_handler))
        .route("/api/users/{id}", get(get_user_by_id_handler))
        // Messages
        .route("/api/channels/{id}/messages", get(get_messages_handler))
        .route("/api/ws", get(ws_handler))
        .layer(cors)
        .with_state(state);

    let port: u16 = env::var("PORT").unwrap_or_else(|_| "3000".into()).parse().unwrap();
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    
    println!("Server running on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();

    Ok(())
}
