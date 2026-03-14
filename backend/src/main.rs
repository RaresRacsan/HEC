mod livekit_auth;
mod ws_chat;
pub mod db;

use axum::{
    routing::{get, post}, Router, Json, extract::{State, Path},
    http::{StatusCode, header}, response::{IntoResponse, Response}
};
use axum_extra::extract::cookie::{Cookie, CookieJar, SameSite};
use dotenvy::dotenv;
use std::env;
use std::net::SocketAddr;
use std::sync::Arc;
use livekit_auth::{AppState as LiveKitState, generate_token};
use ws_chat::{ws_handler, WsState};
use tower_http::cors::{CorsLayer, AllowOrigin};
use sqlx::postgres::PgPoolOptions;
use tokio::sync::broadcast;
use axum::extract::FromRef;
use serde::{Deserialize, Serialize};

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

#[derive(Serialize)]
pub struct AuthResponse {
    pub user: db::User,
}

// Helper to create a secure session cookie
fn create_session_cookie(user_id: i32) -> Cookie<'static> {
    Cookie::build(("blypp_session", user_id.to_string()))
        .path("/")
        .http_only(true)
        .secure(true) // Should be true in prod, but browsers allow localhost
        .same_site(SameSite::Lax) // Lax is usually better for app navigation
        .permanent()
        .build()
}

pub async fn register_handler(
    State(state): State<Arc<WsState>>,
    jar: CookieJar,
    Json(payload): Json<AuthRequest>,
) -> Result<(CookieJar, Json<AuthResponse>), (StatusCode, String)> {
    let raw_pass = payload.password.unwrap_or_else(|| "password123".into());
    let hash = bcrypt::hash(raw_pass, bcrypt::DEFAULT_COST).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    
    let user = db::create_user(&state.db, &payload.username, &hash)
        .await
        .map_err(|e| {
            if e.to_string().contains("unique constraint") {
                (StatusCode::BAD_REQUEST, "Username already exists".to_string())
            } else {
                (StatusCode::BAD_REQUEST, e.to_string())
            }
        })?;
    
    let jar = jar.add(create_session_cookie(user.id));
    Ok((jar, Json(AuthResponse { user })))
}

pub async fn login_handler(
    State(state): State<Arc<WsState>>,
    jar: CookieJar,
    Json(payload): Json<AuthRequest>,
) -> Result<(CookieJar, Json<AuthResponse>), (StatusCode, String)> {
    let user = db::get_user_by_username(&state.db, &payload.username)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::UNAUTHORIZED, "Invalid username or password".to_string()))?;
    
    let raw_pass = payload.password.unwrap_or_else(|| "".into());
    let is_valid = match &user.password_hash {
        Some(hash) if !hash.is_empty() => bcrypt::verify(raw_pass, hash).unwrap_or(false),
        _ => false,
    };

    if !is_valid {
        return Err((StatusCode::UNAUTHORIZED, "Invalid username or password".to_string()));
    }
    
    let jar = jar.add(create_session_cookie(user.id));
    Ok((jar, Json(AuthResponse { user })))
}

pub async fn logout_handler(jar: CookieJar) -> (CookieJar, StatusCode) {
    let mut cookie = Cookie::from("blypp_session");
    cookie.set_path("/");
    (jar.remove(cookie), StatusCode::OK)
}

pub async fn get_me_handler(
    State(state): State<Arc<WsState>>,
    jar: CookieJar,
) -> Result<Json<db::UserPublic>, (StatusCode, String)> {
    let user_id = jar.get("blypp_session")
        .and_then(|c| c.value().parse::<i32>().ok())
        .ok_or((StatusCode::UNAUTHORIZED, "Not logged in".to_string()))?;

    let user = sqlx::query_as!(
        db::UserPublic,
        "SELECT id, username, created_at FROM users WHERE id = $1",
        user_id
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::UNAUTHORIZED, "Session user not found".to_string()))?;

    Ok(Json(user))
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

#[derive(Serialize)]
pub struct ServerMemberResponse {
    pub id: i32,
    pub username: String,
    pub role: Option<String>,
}

pub async fn get_server_members_handler(
    Path(server_id): Path<i32>,
    State(state): State<Arc<WsState>>,
) -> Result<Json<Vec<ServerMemberResponse>>, String> {
    let members = sqlx::query_as!(
        ServerMemberResponse,
        r#"
        SELECT u.id, u.username, sm.role
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
    let server = sqlx::query_as!(
        db::Server,
        "INSERT INTO servers (name) VALUES ($1) RETURNING id, name, created_at as \"created_at!\"",
        payload.name
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    sqlx::query!(
        "INSERT INTO server_members (server_id, user_id, role) VALUES ($1, $2, 'owner')",
        server.id, payload.user_id
    )
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let code = format!("{:08X}", (server.id as u64 * 0x9E3779B97F4A7C15u64) & 0xFFFF_FFFF);
    sqlx::query!(
        "INSERT INTO invite_codes (code, server_id, created_by) VALUES ($1, $2, $3) ON CONFLICT (code) DO NOTHING",
        code, server.id, payload.user_id
    )
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(server))
}

#[derive(Deserialize)]
pub struct CreateChannelRequest {
    pub name: String,
    pub channel_type: String,
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

pub async fn get_server_invite_handler(
    Path(server_id): Path<i32>,
    State(state): State<Arc<WsState>>,
) -> Result<Json<InviteResponse>, (StatusCode, String)> {
    let existing = sqlx::query!(
        "SELECT code FROM invite_codes WHERE server_id = $1 ORDER BY id ASC LIMIT 1",
        server_id
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let code = if let Some(row) = existing {
        row.code
    } else {
        use std::time::{SystemTime, UNIX_EPOCH};
        let ts = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let new_code = format!("{:08X}", (ts ^ (server_id as u128 * 0xDEAD_BEEF)) & 0xFFFF_FFFF);
        let creator = sqlx::query!(
            "SELECT user_id FROM server_members WHERE server_id = $1 LIMIT 1",
            server_id
        )
        .fetch_one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        sqlx::query!(
            "INSERT INTO invite_codes (code, server_id, created_by) VALUES ($1, $2, $3) ON CONFLICT (code) DO NOTHING",
            new_code, server_id, creator.user_id
        )
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        new_code
    };

    Ok(Json(InviteResponse {
        invite_url: format!("https://blypp.tech/invite/{}", code),
        code,
    }))
}

#[derive(Serialize)]
pub struct InviteResponse {
    pub code: String,
    pub invite_url: String,
}

pub async fn create_invite_handler(
    Path(server_id): Path<i32>,
    State(state): State<Arc<WsState>>,
    Json(payload): Json<CreateInviteRequest>,
) -> Result<Json<InviteResponse>, (StatusCode, String)> {
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
        invite_url: format!("https://blypp.tech/invite/{}", code),
        code,
    }))
}

pub async fn join_invite_handler(
    Path(code): Path<String>,
    State(state): State<Arc<WsState>>,
    Json(payload): Json<CreateServerRequest>,
) -> Result<Json<db::Server>, (StatusCode, String)> {
    let invite = sqlx::query!(
        "SELECT id, server_id, uses, max_uses, expires_at FROM invite_codes WHERE code = $1",
        code
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Invite not found".to_string()))?;

    if let Some(exp) = invite.expires_at {
        if exp < chrono::Utc::now() {
            return Err((StatusCode::GONE, "Invite has expired".to_string()));
        }
    }

    let uses = invite.uses.unwrap_or(0);
    let max_uses = invite.max_uses.unwrap_or(0);
    if max_uses > 0 && uses >= max_uses {
        return Err((StatusCode::GONE, "Invite max uses reached".to_string()));
    }

    sqlx::query!(
        "INSERT INTO server_members (server_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING",
        invite.server_id, payload.user_id
    )
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    sqlx::query!("UPDATE invite_codes SET uses = uses + 1 WHERE id = $1", invite.id)
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

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
    let target = db::get_user_by_username(&state.db, &payload.to_username)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "User not found".to_string()))?;

    let (a, b) = if payload.from_user_id < target.id {
        (payload.from_user_id, target.id)
    } else {
        (target.id, payload.from_user_id)
    };
    let dm_name = format!("dm-{}-{}", a, b);

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

pub async fn get_voice_participants_handler(
    Path(server_id): Path<i32>,
    State(ws_state): State<Arc<WsState>>,
    State(livekit): State<LiveKitState>,
) -> Result<Json<std::collections::HashMap<String, Vec<String>>>, (StatusCode, String)> {
    let channels = sqlx::query!(
        "SELECT name FROM channels WHERE server_id = $1 AND channel_type = 'voice'",
        server_id
    )
    .fetch_all(&ws_state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let http_url = livekit.livekit_url.replace("ws://", "http://").replace("wss://", "https://");

    let room_service = livekit_api::services::room::RoomClient::with_api_key(
        &http_url,
        &livekit.livekit_api_key,
        &livekit.livekit_api_secret,
    );

    let mut result = std::collections::HashMap::new();

    for ch in channels {
        if let Ok(participants) = room_service.list_participants(&ch.name).await {
            let names: Vec<String> = participants.into_iter().map(|p| p.identity).collect();
            if !names.is_empty() {
                result.insert(ch.name, names);
            }
        }
    }

    Ok(Json(result))
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

pub async fn delete_server_handler(
    Path(server_id): Path<i32>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
    State(ws_state): State<Arc<WsState>>,
) -> Result<impl axum::response::IntoResponse, (StatusCode, String)> {
    let user_id = params.get("user_id").and_then(|id| id.parse::<i32>().ok()).unwrap_or(0);
    if user_id == 0 {
        return Err((StatusCode::UNAUTHORIZED, "User ID required".to_string()));
    }

    let member = sqlx::query!(
        "SELECT role FROM server_members WHERE server_id = $1 AND user_id = $2",
        server_id, user_id
    )
    .fetch_optional(&ws_state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if let Some(m) = member {
        if m.role.as_deref() == Some("owner") {
            sqlx::query!("DELETE FROM servers WHERE id = $1", server_id)
                .execute(&ws_state.db)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
            
            return Ok(StatusCode::NO_CONTENT);
        }
    }

    Err((StatusCode::FORBIDDEN, "Only the server owner can delete it".to_string()))
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
    
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await?;

    let (tx, _rx) = broadcast::channel(100);

    let state = AppState {
        livekit: LiveKitState {
            livekit_api_key: env::var("LIVEKIT_API_KEY").unwrap_or_else(|_| "devkey".into()),
            livekit_api_secret: env::var("LIVEKIT_API_SECRET").unwrap_or_else(|_| "secret".into()),
            livekit_url: env::var("LIVEKIT_URL").unwrap_or_else(|_| "ws://127.0.0.1:7880".into()),
        },
        ws: Arc::new(WsState {
            db: pool,
            tx,
            online_users: Arc::new(std::sync::RwLock::new(std::collections::HashSet::new())),
        }),
    };

    // Configure CORS to allow credentials and specific origin in production
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::predicate(|origin, _| {
            let o = origin.to_str().unwrap_or("");
            o == "http://localhost:1420" || o == "https://blypp.tech" || o.starts_with("tauri://")
        }))
        .allow_headers([header::CONTENT_TYPE])
        .allow_methods([axum::http::Method::GET, axum::http::Method::POST, axum::http::Method::DELETE])
        .allow_credentials(true);

    let app = Router::new()
        .route("/api/livekit/token", post(generate_token))
        .route("/api/register", post(register_handler))
        .route("/api/login", post(login_handler))
        .route("/api/logout", post(logout_handler))
        .route("/api/me", get(get_me_handler))
        // Servers
        .route("/api/servers", post(create_server_handler))
        .route("/api/users/{user_id}/servers", get(get_servers_handler))
        .route("/api/users/{user_id}/dms", get(get_dms_handler))
        .route("/api/servers/{server_id}/channels", get(get_server_channels_handler).post(create_channel_handler))
        .route("/api/servers/{server_id}", axum::routing::delete(delete_server_handler))
        .route("/api/servers/{server_id}/voice-participants", get(get_voice_participants_handler))
        .route("/api/servers/{server_id}/members", get(get_server_members_handler))
        .route("/api/servers/{server_id}/invites", post(create_invite_handler))
        .route("/api/servers/{server_id}/invite", get(get_server_invite_handler))
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
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    
    println!("Server running on http://0.0.0.0:{}", port);

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();

    Ok(())
}
