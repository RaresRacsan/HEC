use sqlx::{PgPool, FromRow};
use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc};

#[derive(Serialize, Deserialize, FromRow, Clone)]
pub struct User {
    pub id: i32,
    pub username: String,
    pub password_hash: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Serialize, Deserialize, FromRow, Clone)]
pub struct Server {
    pub id: i32,
    pub name: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Serialize, Deserialize, FromRow, Clone)]
pub struct ServerMember {
    pub server_id: i32,
    pub user_id: i32,
    pub role: Option<String>,
    pub joined_at: DateTime<Utc>,
}

#[derive(Serialize, Deserialize, FromRow, Clone)]
pub struct Channel {
    pub id: i32,
    pub name: String,
    pub is_dm: bool,
    pub server_id: Option<i32>,
    pub channel_type: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Serialize, Deserialize, FromRow, Clone)]
pub struct Message {
    pub id: i32,
    pub channel_id: i32,
    pub user_id: i32,
    pub content: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Serialize, Deserialize, FromRow, Clone)]
pub struct InviteCode {
    pub id: i32,
    pub code: String,
    pub server_id: i32,
    pub created_by: i32,
    pub uses: Option<i32>,
    pub max_uses: Option<i32>,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// A user without a password hash (safe to send to frontend)
#[derive(Serialize, Deserialize, FromRow, Clone)]
pub struct UserPublic {
    pub id: i32,
    pub username: String,
    pub created_at: DateTime<Utc>,
}

/// Fetch a user by username
pub async fn get_user_by_username(pool: &PgPool, username: &str) -> Result<Option<User>, sqlx::Error> {
    sqlx::query_as!(
        User,
        r#"
        SELECT id, username, password_hash, created_at
        FROM users WHERE username ILIKE $1
        "#,
        username
    )
    .fetch_optional(pool)
    .await
}

/// Create a new user with a password hash
pub async fn create_user(pool: &PgPool, username: &str, password_hash: &str) -> Result<User, sqlx::Error> {
    sqlx::query_as!(
        User,
        r#"
        INSERT INTO users (username, password_hash)
        VALUES ($1, $2)
        RETURNING id, username, password_hash, created_at
        "#,
        username,
        password_hash
    )
    .fetch_one(pool)
    .await
}

/// Fetch a channel by name, or create it if it doesn't exist
pub async fn get_or_create_channel(pool: &PgPool, name: &str, is_dm: bool) -> Result<Channel, sqlx::Error> {
    let channel = sqlx::query_as!(
        Channel,
        r#"
        SELECT id, name, is_dm, server_id, channel_type, created_at
        FROM channels WHERE name = $1 AND is_dm = $2
        "#,
        name,
        is_dm
    )
    .fetch_optional(pool)
    .await?;

    if let Some(c) = channel {
        return Ok(c);
    }

    sqlx::query_as!(
        Channel,
        r#"
        INSERT INTO channels (name, is_dm)
        VALUES ($1, $2)
        RETURNING id, name, is_dm, server_id, channel_type, created_at
        "#,
        name,
        is_dm
    )
    .fetch_one(pool)
    .await
}

/// Add a message to a channel
pub async fn create_message(pool: &PgPool, channel_id: i32, user_id: i32, content: &str) -> Result<Message, sqlx::Error> {
    sqlx::query_as!(
        Message,
        r#"
        INSERT INTO messages (channel_id, user_id, content)
        VALUES ($1, $2, $3)
        RETURNING id, channel_id, user_id, content, created_at
        "#,
        channel_id,
        user_id,
        content
    )
    .fetch_one(pool)
    .await
}
