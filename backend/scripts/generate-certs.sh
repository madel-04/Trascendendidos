#!/bin/sh
# generate-certs.sh
# Generates a self-signed TLS certificate with Subject Alternative Names (SAN).
# Runs at container startup. If certs already exist in the volume, skips generation.

CERT_DIR="/certs"
CERT_FILE="$CERT_DIR/server.cert"
KEY_FILE="$CERT_DIR/server.key"

mkdir -p "$CERT_DIR"

if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
  echo "[SSL] Certificates already exist at $CERT_DIR — skipping generation."
else
  echo "[SSL] Generating self-signed certificate with SAN for localhost..."

  # Write a minimal openssl config with SAN (required by Chrome/Edge/Firefox)
  cat > /tmp/openssl.cnf << EOF
[req]
default_bits       = 2048
prompt             = no
default_md         = sha256
distinguished_name = dn
x509_extensions    = v3_req

[dn]
C  = ES
ST = Madrid
L  = Madrid
O  = Trascendendidos
CN = localhost

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
IP.1  = 127.0.0.1
EOF

  openssl req -x509 -nodes -newkey rsa:2048 \
    -keyout "$KEY_FILE" \
    -out    "$CERT_FILE" \
    -days   365 \
    -config /tmp/openssl.cnf

  echo "[SSL] Certificate generated successfully."
  echo "[SSL]   Key:  $KEY_FILE"
  echo "[SSL]   Cert: $CERT_FILE"
fi

# Hand off to the main server process
exec "$@"
