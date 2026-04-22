# ===== IMAGEN BASE =====
# Usamos Node.js 20 en su variante Alpine (distribución Linux ultraligera)
# Alpine reduce el tamaño de la imagen de ~900MB a ~150MB
FROM node:20-alpine

# ===== DIRECTORIO DE TRABAJO =====
# Establecemos /app como directorio de trabajo dentro del contenedor
# Todos los comandos siguientes se ejecutarán desde esta ruta
WORKDIR /app

# ===== INSTALACIÓN DE DEPENDENCIAS =====
# Copiamos primero solo los archivos de dependencias
# Esto aprovecha la cache de Docker: si package.json no cambia, no reinstala
COPY package.json package-lock.json* ./

# npm ci: Instala dependencias exactas desde package-lock.json (reproducible)
# || npm i: Si falla (no hay lock file), usa npm install
# npm ci es más rápido y seguro para CI/CD
RUN npm ci || npm i

# ===== COPIAR CÓDIGO FUENTE =====
# Copiamos todo el código fuente al contenedor
# Esto se hace después de instalar dependencias para aprovechar cache
COPY . .

# ===== EXPONER PUERTO =====
# Documentamos que este contenedor escucha en el puerto 3000
# Nota: EXPOSE no publica el puerto, solo es documentación
# El puerto se mapea en docker-compose.yml con "ports: 3000:3000"
EXPOSE 3000

# ===== COMANDO DE INICIO =====
# Comando que se ejecuta cuando se inicia el contenedor
# npm run dev: Ejecuta tsx watch src/server.ts (hot-reload en desarrollo)
CMD ["npm", "run", "dev"]

#
#Qué hace: Define el proyecto Node y sus dependencias.
#
#Scripts:

#dev: Desarrollo con tsx watch (hot-reload)
#build: Compila TypeScript a JavaScript
#start: Ejecuta la versión compilada
#Dependencias:
#
#fastify: Framework web rápido
#@fastify/cors: Manejo de CORS
#@fastify/websocket: Soporte para WebSockets
#zod: Validación de esquemas
#DevDependencies:
#
#tsx: Ejecutor de TypeScript sin compilar
#typescript: Compilador
#