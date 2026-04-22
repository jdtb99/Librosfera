#!/bin/bash

# Matar proceso que esté usando el puerto 5000
PORT=5000
PID=$(lsof -t -i :$PORT)

if [ -n "$PID" ]; then
  echo "Matando proceso en puerto $PORT (PID $PID)..."
  kill -9 $PID
else
  echo "No hay proceso en el puerto $PORT."
fi

# Ir al directorio Backend
cd Backend || exit

# Levantar el servidor
echo "Iniciando servidor..."
npm run dev
