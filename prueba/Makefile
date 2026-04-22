# ===== MAKEFILE: Automatización de Tareas de Docker Compose =====
# Makefile simplifica comandos largos y repetitivos de Docker
# Uso: make <target> (ej: make up, make clean, make logs)

# .PHONY: Indica que estos targets no son archivos reales
# Esto evita conflictos si existe un archivo con el mismo nombre
.PHONY: all clean fclean re up down build logs restart ps env

# ===== VARIABLES =====
# COMPOSE: Comando base de Docker Compose
COMPOSE = docker compose

# ENV_FILE: Nombre del archivo de variables de entorno
ENV_FILE = .env

# ===== REGLA PRINCIPAL =====
# all: Regla por defecto (se ejecuta con solo "make")
# Crea .env si no existe y levanta todos los servicios
all: env up

# ===== CREAR ARCHIVO .ENV =====
# env: Crea .env desde .env.example si no existe
# @ → Silencia el comando (no muestra el echo en la terminal)
# [ ! -f $(ENV_FILE) ] → Verifica si el archivo NO existe
env:
	@if [ ! -f $(ENV_FILE) ]; then \
		echo "Creating .env file from .env.example..."; \
		cp .env.example $(ENV_FILE); \
	fi

# ===== CONSTRUCCIÓN =====
# build: Construye las imágenes Docker sin iniciar los servicios
# Útil para verificar que los Dockerfiles no tienen errores
build:
	$(COMPOSE) build

# ===== LEVANTAR SERVICIOS =====
# up: Construye (si es necesario) y levanta servicios en modo detached (-d)
# -d → Background mode: los contenedores corren en segundo plano
# --build → Reconstruye imágenes antes de iniciar
up: env
	$(COMPOSE) up --build -d

# ===== LEVANTAR EN FOREGROUND =====
# up-fg: Igual que 'up' pero en foreground (puedes ver los logs en tiempo real)
# Útil para debugging: presiona Ctrl+C para detener
up-fg: env
	$(COMPOSE) up --build

# ===== DETENER SERVICIOS =====
# down: Detiene y elimina contenedores, redes
# Los volúmenes e imágenes NO se eliminan (datos persisten)
down:
	$(COMPOSE) down

# ===== LIMPIEZA BÁSICA =====
# clean: Detiene contenedores y elimina imágenes locales
# --rmi local → Elimina solo las imágenes construidas localmente (no las de Docker Hub)
clean:
	$(COMPOSE) down --rmi local

# ===== LIMPIEZA COMPLETA =====
# fclean: Limpieza total del proyecto
# --rmi all → Elimina TODAS las imágenes (incluidas las descargadas)
# --volumes → Elimina volúmenes (⚠️ PIERDES DATOS DE LA BD)
# rm -f $(ENV_FILE) → Elimina el archivo .env
fclean:
	$(COMPOSE) down --rmi all --volumes
	rm -f $(ENV_FILE)

# ===== RECONSTRUIR TODO =====
# re: Limpieza completa + construcción desde cero
# Útil cuando hay problemas de cache o configuración
re: fclean all

# ===== REINICIAR SERVICIOS =====
# restart: Reinicia todos los contenedores sin reconstruir
# Útil después de cambiar variables de entorno en .env
restart:
	$(COMPOSE) restart

# ===== VER LOGS =====
# logs: Muestra logs de todos los servicios en tiempo real
# -f → Follow: sigue mostrando logs nuevos (como tail -f)
logs:
	$(COMPOSE) logs -f

# ===== LOGS POR SERVICIO =====
# logs-backend: Solo muestra logs del servicio backend
logs-backend:
	$(COMPOSE) logs -f backend

# logs-frontend: Solo muestra logs del servicio frontend
logs-frontend:
	$(COMPOSE) logs -f frontend

# logs-db: Solo muestra logs del servicio de base de datos
logs-db:
	$(COMPOSE) logs -f db

# ===== ESTADO DE SERVICIOS =====
# ps: Muestra el estado de todos los contenedores
# Similar a 'docker ps' pero solo para este proyecto
ps:
	$(COMPOSE) ps

# ===== ACCEDER A SHELLS =====
# shell-backend: Abre una shell (sh) dentro del contenedor backend
# Útil para ejecutar comandos manuales, inspeccionar archivos, etc.
# exec → Ejecuta comando en contenedor en ejecución
shell-backend:
	$(COMPOSE) exec backend sh

# shell-frontend: Abre una shell (sh) dentro del contenedor frontend
shell-frontend:
	$(COMPOSE) exec frontend sh

# shell-db: Abre psql (cliente PostgreSQL) dentro del contenedor de BD
# Permite ejecutar queries SQL directamente
shell-db:
	$(COMPOSE) exec db psql -U transcendence -d transcendence

# ===== AYUDA =====
# help: Muestra todos los comandos disponibles con descripción
# @echo → Muestra texto en la terminal
help:
	@echo "Makefile commands:"
	@echo "  make all          - Create .env and start all services"
	@echo "  make up           - Start services in detached mode"
	@echo "  make up-fg        - Start services in foreground"
	@echo "  make down         - Stop services"
	@echo "  make build        - Build services"
	@echo "  make clean        - Stop and remove containers and images"
	@echo "  make fclean       - Complete cleanup (containers, images, volumes, .env)"
	@echo "  make re           - Rebuild everything from scratch"
	@echo "  make restart      - Restart services"
	@echo "  make logs         - View logs of all services"
	@echo "  make logs-backend - View backend logs"
	@echo "  make logs-frontend- View frontend logs"
	@echo "  make logs-db      - View database logs"
	@echo "  make ps           - Show status of services"
	@echo "  make shell-backend - Open shell in backend container"
	@echo "  make shell-frontend- Open shell in frontend container"
	@echo "  make shell-db     - Open psql in database container"
	@echo "  make env          - Create .env from .env.example"
