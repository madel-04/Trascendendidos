# Makefile para Pong Multijugador - Hito 1 (Frontend)

.PHONY: all install run clean fclean re

# Variables
FRONTEND_DIR = frontend

# Regla por defecto: Instala dependencias y lanza el servidor de desarrollo
all: install run

# Instala los paquetes de Node.js en la carpeta frontend
install:
	@echo "Instalando dependencias del Frontend..."
	@cd $(FRONTEND_DIR) && npm install

# Lanza el servidor de desarrollo de Vite
run:
	@echo "Iniciando servidor de desarrollo interactivo Vite..."
	@cd $(FRONTEND_DIR) && npm run dev -- --host

# Limpia la build generada (dist)
clean:
	@echo "Limpiando archivos construidos..."
	@rm -rf $(FRONTEND_DIR)/dist

# Limpia de forma profunda eliminando tambien los node_modules
fclean: clean
	@echo "Realizando limpieza profunda (eliminando node_modules)..."
	@rm -rf $(FRONTEND_DIR)/node_modules
	@rm -rf $(FRONTEND_DIR)/package-lock.json

# Reconstruir desde cero
re: fclean all

# Ayuda rápida
help:
	@echo "Opciones disponibles:"
	@echo "  make          - Instala lo necesario y arranca el entorno"
	@echo "  make install  - Solo instala las dependencias npm"
	@echo "  make run      - Solo levanta el servidor Vite"
	@echo "  make clean    - Borra la compilación (carpeta dist)"
	@echo "  make fclean   - Limpia dist y node_modules"
	@echo "  make re       - Limpieza profunda y arranque completo"
