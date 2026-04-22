#!/bin/bash

# Script de prueba para verificar que el endpoint 2FA funciona

echo "🧪 Test del endpoint 2FA Setup"
echo "================================"
echo ""

# Primero necesitamos un token de autenticación
# Vamos a registrar un usuario de prueba

echo "1️⃣ Registrando usuario de prueba..."
RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test2fa@example.com",
    "password": "testpassword123",
    "username": "test2fa"
  }')

echo "Respuesta: $RESPONSE"
echo ""

# Extraer el token (usando jq si está disponible, sino manualmente)
TOKEN=$(echo $RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Error: No se pudo obtener el token"
  echo "Prueba iniciando sesión con un usuario existente"
  exit 1
fi

echo "✅ Token obtenido: ${TOKEN:0:20}..."
echo ""

echo "2️⃣ Generando QR code para 2FA..."
QR_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/2fa/setup \
  -H "Authorization: Bearer $TOKEN")

echo ""
echo "Respuesta del servidor:"
echo "======================="

# Verificar si contiene data:image
if echo "$QR_RESPONSE" | grep -q "data:image"; then
  echo "✅ QR Code generado correctamente!"
  echo ""
  echo "El QR code es una imagen base64 que empieza con:"
  echo $(echo "$QR_RESPONSE" | grep -o '"qrCodeUrl":"data:image[^"]*' | cut -c1-80)...
  echo ""
  echo "Secreto:"
  SECRET=$(echo "$QR_RESPONSE" | grep -o '"secret":"[^"]*' | cut -d'"' -f4)
  echo "$SECRET"
  echo ""
  echo "🎉 ¡Todo funciona correctamente!"
  echo ""
  echo "Ahora puedes:"
  echo "1. Ir a http://localhost:5173/profile"
  echo "2. Iniciar sesión con test2fa@example.com / testpassword123"
  echo "3. Habilitar 2FA y verás el código QR"
else
  echo "❌ Error: El QR code no se generó correctamente"
  echo ""
  echo "Respuesta completa:"
  echo "$QR_RESPONSE"
fi

echo ""
echo "================================"
