FROM rust:1.85 as builder
WORKDIR /app
COPY . .
# Tell SQLx to use the generated .sqlx directory instead of a live DB
ENV SQLX_OFFLINE=true
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y libssl-dev ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/target/release/backend .
EXPOSE 3000
CMD ["./backend"]
