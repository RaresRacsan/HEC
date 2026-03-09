use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::Response,
};
use futures::{sink::SinkExt, stream::StreamExt};
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::broadcast;
use crate::db;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub channel_id: i32,
    pub user_id: i32,
    pub username: String,
    pub content: String,
}

// We use a broadcast channel so any connected WebSocket
// can receive public messages dispatched by others.
pub struct WsState {
    pub db: PgPool,
    pub tx: broadcast::Sender<String>,
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<WsState>>,
) -> Response {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: Arc<WsState>) {
    let (mut sender, mut receiver) = socket.split();
    let mut rx = state.tx.subscribe();

    // Task to forward broadcasted messages to this specific WebSocket client
    let mut send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if sender.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
        }
    });

    // Task to receive messages from this WebSocket client and broadcast them to everyone
    let tx = state.tx.clone();
    let db = state.db.clone();
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(Message::Text(text))) = receiver.next().await {
            if let Ok(chat_msg) = serde_json::from_str::<ChatMessage>(text.as_str()) {
                // Save to PostgreSQL
                if let Ok(_) = db::create_message(&db, chat_msg.channel_id, chat_msg.user_id, &chat_msg.content).await {
                    let _ = tx.send(serde_json::to_string(&chat_msg).unwrap_or_default());
                }
            }
        }
    });

    // If any task exits, abort the other one
    tokio::select! {
        _ = (&mut send_task) => recv_task.abort(),
        _ = (&mut recv_task) => send_task.abort(),
    };
}
