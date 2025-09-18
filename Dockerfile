# Usa una imagen base de Node.js
FROM node:18-slim

# Instala git en la imagen (necesario para la instalación de dependencias de npm)
# A veces, npm necesita git para descargar ciertos paquetes
RUN apt-get update && apt-get install -y git --no-install-recommends && rm -rf /var/lib/apt/lists/*

# Establece el directorio de trabajo
WORKDIR /usr/src/app

# Copia los archivos de tu repositorio (en vez de clonarlos)
COPY . .

# Instala las dependencias de tu servidor
RUN npm install

# Instala supergateway globalmente, que actuará como puente
RUN npm install -g supergateway

# Expón el puerto que usará supergateway
EXPOSE 8000

# El comando para arrancar el servicio
# 1. Inicia supergateway en el puerto 8000
# 2. Le dice que el servidor a ejecutar es un proceso STDIO
# 3. Especifica el comando para iniciar tu servidor MCP ("npm start")
CMD ["supergateway", "--port", "8000", "--stdio", "npm start"]