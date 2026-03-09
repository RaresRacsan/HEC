use sqlx::postgres::PgPoolOptions;
use tokio;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let pool = PgPoolOptions::new()
        .connect("postgres://hec_user:hec_password@127.0.0.1:5432/hec_db")
        .await?;

    let rows = sqlx::query!("SELECT id, username, password_hash FROM users")
        .fetch_all(&pool)
        .await?;

    for user in rows {
        println!("User: id={}, name={}, hash='{:?}'", user.id, user.username, user.password_hash);
    }

    Ok(())
}
