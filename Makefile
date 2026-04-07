# Makefile para Pong Multijugador - Ecosistema Completo (Docker Compose)

NAME = trascendendidos_pong

.PHONY: all up down clean fclean re logs install

# Regla por defecto: Levanta todo el entorno Docker
all: up

# Instala dependencias si es que aún quedan herramientas locales útiles
install:
	@echo "Instalando dependencias de frontend y backend por si se usan localmente..."
	@cd frontend && npm install
	@cd backend && npm install

# Levanta el entorno en segundo plano construyendo las imágenes si es necesario
up:
	@echo "Iniciando entorno completo (Frontend + Backend) con Docker Compose..."
	@docker compose up --build -d
	@echo "\n--------------------------------------------------------------"
	@echo "✅ ¡Entorno listo!"
	@echo "🌍 Jugar al Pong: https://localhost:5173"
	@echo "🔌 Servidor Base: https://localhost:3000"
	@echo "--------------------------------------------------------------\n"

# Apaga los contenedores y redes
down:
	@echo "Deteniendo todos los servicios..."
	@docker compose down

# Limpia contenedores
clean: down

# Limpieza profunda: elimina redes, contenedores, imágenes y volúmenes persistentes
fclean: down
	@echo "Realizando limpieza profunda (eliminando volúmenes e imágenes completas)..."
	@docker compose down -v --rmi all --remove-orphans

# Reiniciar desde el principio
re: fclean all

# Ver logs en vivo
logs:
	@docker compose logs -f

# Menú de ayuda rápida
help:
	@echo "Opciones disponibles en este Makefile:"
	@echo "--------------------------------------------------------------"
	@echo "  make o make up   - Levanta Frontend y Backend con Docker en segundo plano"
	@echo "  make down        - Detiene y elimina los contenedores activados"
	@echo "  make logs        - Observar en vivo qué están haciendo los contenedores"
	@echo "  make clean       - Hace lo que 'make down'"
	@echo "  make fclean      - Resetea todo eliminando imágenes y base de datos/volúmenes"
	@echo "  make re          - Hace fclean seguido de un make normal"
	@echo "--------------------------------------------------------------"
