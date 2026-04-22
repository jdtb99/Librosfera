#!/bin/bash
export LANG=es_ES.UTF-8
export LC_ALL=es_ES.UTF-8
# Script de pruebas completo para el sistema de gestión de libros

# Ajuste estos parámetros a su entorno
BASE_URL="https://librosfera.onrender.com"

# Colores para mensajes en consola
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # Sin Color

# Variables globales para almacenar información
declare -a LIBRO_IDS
declare -a IMAGEN_IDS
declare -a BUSQUEDA_IDS
declare -a USER_TOKENS
declare -a CODIGOS_EJEMPLARES

declare -a LIBRO_TITULOS=(
  "El nombre del viento"
  "1984"
  "Rayuela"
  "Don Quijote de la Mancha"
  "El principito"
  "Crimen y castigo"
  "Cien años de soledad"
)
declare -a PORTADA_FILENAMES=(
  "portada_el_nombre_del_viento.jpg"
  "portada_1984.jpg"
  "portada_rayuela.jpg"
  "portada_don_quijote_de_la_mancha.jpg"
  "portada_el_principito.jpg"
  "portada_crimen_y_castigo.jpg"
  "portada_cien_anios_de_soledad.jpg"
)

# Función para obtener tokens de autenticación
obtener_tokens() {
  echo -e "${YELLOW}Obteniendo tokens de autenticación...${NC}"

  # 1. Login como usuario root
  echo -e "\n${YELLOW}1. Login como root...${NC}"
  ROOT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/users/login" \
    -H "Content-Type: application/json" \
    -d '{
      "email": "root@librosfera.com",
      "password": "Root12345!"
    }')
  
  ROOT_TOKEN=$(echo $ROOT_RESPONSE | grep -o '"token":"[^"]*"' | cut -d':' -f2- | tr -d '"')
  
  if [ -z "$ROOT_TOKEN" ]; then
    echo -e "${RED}Error: No se pudo obtener el token de root${NC}"
    exit 1
  else
    echo -e "${GREEN}Token de root obtenido correctamente${NC}"
  fi

  # 2. Crear usuario administrador (o login si ya existe)
  echo -e "\n${YELLOW}2. Creando/obteniendo usuario administrador...${NC}"
  ADMIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/users/admin" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ROOT_TOKEN" \
    -d '{
      "email": "jerikdavid0789@gmail.com",
      "password": "AdminPass123!",
      "usuario": "admin_test"
    }')
  
  ADMIN_TOKEN=$(echo $ADMIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d':' -f2- | tr -d '"')
  
  # Si no se pudo crear, intentar login
  if [ -z "$ADMIN_TOKEN" ]; then
    echo -e "${YELLOW}Administrador posiblemente ya existe, intentando login...${NC}"
    ADMIN_LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/users/login" \
      -H "Content-Type: application/json" \
      -d '{
        "email": "jerikdavid0789@gmail.com",
        "password": "AdminPass123!"
      }')
    
    ADMIN_TOKEN=$(echo $ADMIN_LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d':' -f2- | tr -d '"')
    
    if [ -z "$ADMIN_TOKEN" ]; then
      echo -e "${RED}Error: No se pudo obtener el token de administrador${NC}"
      exit 1
    else
      echo -e "${GREEN}Token de administrador obtenido por login${NC}"
    fi
  else
    echo -e "${GREEN}Token de administrador obtenido por creación${NC}"
  fi

  # 3. Crear múltiples usuarios normales
  echo -e "\n${YELLOW}3. Creando/obteniendo usuarios normales...${NC}"
  
  # Array de nombres y datos para usuarios
  USUARIOS=(
    "cliente_test1 jerik.hincapie@utp.edu.co Password123! Cliente1 Test 12345678A"
    "cliente_test2 cliente_test2@example.com Password123! Cliente2 Test 12345678B"
    "cliente_test3 cliente_test3@example.com Password123! Cliente3 Test 12345678C"
  )
  
  USER_TOKENS=()
  
  for i in "${!USUARIOS[@]}"; do
    IFS=' ' read -r usuario email password nombres apellidos dni <<< "${USUARIOS[$i]}"
    
    echo -e "\n${YELLOW}Creando/obteniendo usuario $usuario...${NC}"
    USER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/users/register" \
      -H "Content-Type: application/json" \
      -d "{
        \"usuario\": \"$usuario\",
        \"email\": \"$email\",
        \"password\": \"$password\",
        \"tipo_usuario\": \"cliente\",
        \"DNI\": \"$dni\",
        \"nombres\": \"$nombres\",
        \"apellidos\": \"$apellidos\",
        \"fecha_nacimiento\": \"1990-01-15\",
        \"lugar_nacimiento\": \"Madrid\",
        \"genero\": \"Masculino\",
        \"direcciones\": [{
          \"calle\": \"Calle Test 123\", 
          \"ciudad\": \"Madrid\", 
          \"codigo_postal\": \"28001\", 
          \"pais\": \"España\"
        }],
        \"telefono\": \"+34612345678\"
      }")
    
    USER_TOKEN=$(echo $USER_RESPONSE | grep -o '"token":"[^"]*"' | cut -d':' -f2- | tr -d '"')
    
    # Si no se pudo crear, intentar login
    if [ -z "$USER_TOKEN" ]; then
      echo -e "${YELLOW}Usuario $usuario posiblemente ya existe, intentando login...${NC}"
      USER_LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/users/login" \
        -H "Content-Type: application/json" \
        -d "{
          \"email\": \"$email\",
          \"password\": \"$password\"
        }")
      
      USER_TOKEN=$(echo $USER_LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d':' -f2- | tr -d '"')
      
      if [ -z "$USER_TOKEN" ]; then
        echo -e "${RED}Error: No se pudo obtener el token de usuario $usuario${NC}"
      else
        echo -e "${GREEN}Token de usuario $usuario obtenido por login${NC}"
        USER_TOKENS+=("$USER_TOKEN")
      fi
    else
      echo -e "${GREEN}Token de usuario $usuario obtenido por creación${NC}"
      USER_TOKENS+=("$USER_TOKEN")
    fi
  done
  
  # Uso el primer token de usuario como el principal para algunas pruebas
  USER_TOKEN="${USER_TOKENS[0]}"

  echo -e "\n${GREEN}Tokens obtenidos con éxito:${NC}"
  echo -e "ADMIN_TOKEN: ${YELLOW}$ADMIN_TOKEN${NC}"
  echo -e "USER_TOKEN (principal): ${YELLOW}$USER_TOKEN${NC}\n"
  for i in "${!USER_TOKENS[@]}"; do
    if [ $i -gt 0 ]; then
      echo -e "USER_TOKEN $((i+1)): ${YELLOW}${USER_TOKENS[$i]}${NC}"
    fi
  done
  echo -e "\n"
}

# Función para imprimir respuesta del servidor
print_response() {
  local response=$1
  local title=$2
  
  echo -e "${BLUE}--- RESPUESTA: $title ---${NC}"
  echo "$response"
  echo -e "${BLUE}--- FIN DE RESPUESTA ---${NC}\n"
}

# Función para crear un libro y subir su portada
crear_libro() {
  local titulo=$1
  local autor_nombre=$2
  local autor_apellido=$3
  local editorial=$4
  local genero=$5
  local precio=$6
  local nacionalidad=$7
  
  # Encontrar el índice del título en el array
  local index=-1
  for i in "${!LIBRO_TITULOS[@]}"; do
    if [[ "${LIBRO_TITULOS[$i]}" == "$titulo" ]]; then
      index=$i
      break
    fi
  done
  
  # Si no se encuentra el título, usar un nombre de archivo predeterminado
  local ruta_imagen="imagen.jpg"
  if [ $index -ne -1 ]; then
    ruta_imagen="${PORTADA_FILENAMES[$index]}"
  fi
  
  echo -e "${YELLOW}Creando un nuevo libro '$titulo'...${NC}"
  CREAR_RESPUESTA=$(curl -s -X POST "$BASE_URL/api/v1/libros" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -d "{
      \"titulo\": \"$titulo\",
      \"autor\": [{\"nombre\": \"$autor_nombre\", \"apellidos\": \"$autor_apellido\", \"nacionalidad\": \"$nacionalidad\"}],
      \"editorial\": \"$editorial\",
      \"genero\": \"$genero\",
      \"idioma\": \"Español\",
      \"fecha_publicacion\": \"2020-01-01\",
      \"anio_publicacion\": 2020,
      \"numero_paginas\": 300,
      \"precio\": $precio,
      \"estado\": \"nuevo\",
      \"stock\": 10,
      \"descripcion\": \"Descripción del libro $titulo escrito por $autor_nombre $autor_apellido.\"
    }")

  print_response "$CREAR_RESPUESTA" "CREAR LIBRO '$titulo'"

  # Extraer ID del libro
  LIBRO_ID=$(echo "$CREAR_RESPUESTA" | jq -r '.data._id')
  if [ ! -z "$LIBRO_ID" ] && [ "$LIBRO_ID" != "null" ]; then
    LIBRO_IDS+=("$LIBRO_ID")
    echo -e "${GREEN}ID del libro '$titulo' creado: $LIBRO_ID${NC}"
    
    # Subir imagen de portada para este libro
    echo -e "${YELLOW}Subiendo portada para el libro '$titulo'...${NC}"
    IMAGEN_RESPUESTA=$(curl -s -X POST "$BASE_URL/api/v1/libros/$LIBRO_ID/imagenes" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -F "imagen=@$ruta_imagen" \
      -F "tipo=portada" \
      -F "orden=0" \
      -F "alt_text=Portada del libro $titulo")
    
    print_response "$IMAGEN_RESPUESTA" "SUBIR IMAGEN DE PORTADA PARA '$titulo'"
    
    # Extraer ID de la imagen
    IMAGEN_ID=$(echo "$IMAGEN_RESPUESTA" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
    if [ ! -z "$IMAGEN_ID" ] && [ "$IMAGEN_ID" != "null" ]; then
      IMAGEN_IDS+=("$IMAGEN_ID")
      echo -e "${GREEN}ID de la imagen de portada: $IMAGEN_ID${NC}"
    fi
    
    return 0
  else
    echo -e "${RED}Error al crear el libro '$titulo'${NC}"
    return 1
  fi
}

# Función para verificar/crear imágenes de prueba para cada libro
verificar_imagenes_prueba() {
  echo -e "${YELLOW}Verificando/creando imágenes de portada para libros...${NC}"
  
  for i in "${!LIBRO_TITULOS[@]}"; do
    local titulo="${LIBRO_TITULOS[$i]}"
    local ruta_imagen="${PORTADA_FILENAMES[$i]}"
    
    if [ ! -f "$ruta_imagen" ]; then
      echo -e "${YELLOW}Creando imagen de portada para '$titulo'...${NC}"
      # Usar caracteres ASCII para crear un archivo simple
      echo -e "P6\n10 10\n255\n" > "temp.ppm"
      for j in {1..300}; do  # 10x10x3 bytes (RGB para cada píxel)
        printf "%c%c%c" $(($RANDOM % 256)) $(($RANDOM % 256)) $(($RANDOM % 256)) >> "temp.ppm"
      done
      
      # Intentando convertir a jpg con ImageMagick si está disponible
      if command -v convert &> /dev/null; then
        convert "temp.ppm" "$ruta_imagen"
        rm "temp.ppm"
        echo -e "${GREEN}Imagen de portada creada: $ruta_imagen${NC}"
      else
        mv "temp.ppm" "$ruta_imagen"
        echo -e "${YELLOW}ImageMagick no disponible. Usando archivo de prueba $ruta_imagen (podría no ser válido)${NC}"
      fi
    fi
  done
}

# Función para realizar una búsqueda de libros
buscar_libros() {
  local query=$1
  local token=$2
  local user_num=$3
  
  echo -e "\n${YELLOW}Usuario $user_num buscando libros con el término '$query'...${NC}"
  BUSQUEDA_RESPUESTA=$(curl -s -X GET "$BASE_URL/api/v1/libros/buscar?q=$query" \
    -H "Authorization: Bearer $token")
  
  print_response "$BUSQUEDA_RESPUESTA" "BUSCAR LIBROS '$query' (Usuario $user_num)"
  
  BUSQUEDA_ID=$(echo "$BUSQUEDA_RESPUESTA" | grep -o '"id_busqueda":"[^"]*"' | cut -d'"' -f4)
  if [ ! -z "$BUSQUEDA_ID" ] && [ "$BUSQUEDA_ID" != "null" ]; then
    BUSQUEDA_IDS+=("$BUSQUEDA_ID")
    echo -e "${GREEN}ID de búsqueda para '$query' (Usuario $user_num): $BUSQUEDA_ID${NC}"
    return 0
  else
    echo -e "${RED}No se obtuvo ID de búsqueda para '$query' (Usuario $user_num)${NC}"
    return 1
  fi
}

# Función para registrar interacción con un libro
registrar_interaccion() {
  local busqueda_id=$1
  local libro_id=$2
  local user_num=$3
  
  echo -e "\n${YELLOW}Usuario $user_num registrando interacción con el libro ID $libro_id...${NC}"
  INTERACCION_RESPUESTA=$(curl -s -X POST "$BASE_URL/api/v1/libros/buscar/$busqueda_id/interaccion/$libro_id")
  
  print_response "$INTERACCION_RESPUESTA" "REGISTRAR INTERACCIÓN (Usuario $user_num)"
}

# Función para calificar un libro
calificar_libro() {
  local libro_id=$1
  local calificacion=$2
  local token=$3
  local user_num=$4
  
  echo -e "\n${YELLOW}Usuario $user_num calificando el libro con $calificacion estrellas...${NC}"
  CALIFICAR_RESPUESTA=$(curl -s -X POST "$BASE_URL/api/v1/libros/$libro_id/calificacion" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $token" \
    -d "{
      \"calificacion\": $calificacion,
      \"comentario\": \"Calificación de prueba del usuario $user_num\",
      \"titulo_comentario\": \"Reseña de prueba\"
    }")
  
  print_response "$CALIFICAR_RESPUESTA" "CALIFICAR LIBRO (Usuario $user_num)"
}

# Función para subir imagen a un libro
subir_imagen() {
  local libro_id=$1
  local tipo=$2
  local orden=$3
  local alt_text=$4
  local custom_filename=$5  # Nombre de archivo personalizado (opcional)
  
  # Si no se especifica un nombre de archivo personalizado, usar imagen.jpg
  local filename="imagen.jpg"
  if [ ! -z "$custom_filename" ]; then
    filename="$custom_filename"
  fi
  
  echo -e "\n${YELLOW}Subiendo imagen tipo '$tipo' al libro ID $libro_id...${NC}"
  IMAGEN_RESPUESTA=$(curl -s -X POST "$BASE_URL/api/v1/libros/$libro_id/imagenes" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -F "imagen=@$filename" \
    -F "tipo=$tipo" \
    -F "orden=$orden" \
    -F "alt_text=$alt_text")
  
  print_response "$IMAGEN_RESPUESTA" "SUBIR IMAGEN"
  
  # Extraer ID de la imagen si está disponible en la respuesta
  local imagen_id_regex='"_id":"([^"]*)"'
  if [[ $IMAGEN_RESPUESTA =~ $imagen_id_regex ]]; then
    local IMAGEN_ID="${BASH_REMATCH[1]}"
    if [ ! -z "$IMAGEN_ID" ] && [ "$IMAGEN_ID" != "null" ]; then
      IMAGEN_IDS+=("$IMAGEN_ID")
      echo -e "${GREEN}ID de la imagen subida: $IMAGEN_ID${NC}"
      return 0
    fi
  fi
  
  # Si llegamos aquí, intentar una segunda forma de extracción
  IMAGEN_ID=$(echo "$IMAGEN_RESPUESTA" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [ ! -z "$IMAGEN_ID" ] && [ "$IMAGEN_ID" != "null" ]; then
    IMAGEN_IDS+=("$IMAGEN_ID")
    echo -e "${GREEN}ID de la imagen subida: $IMAGEN_ID${NC}"
    return 0
  else
    echo -e "${YELLOW}No se pudo extraer el ID de la imagen${NC}"
    return 1
  fi
}

# Función para agregar ejemplar a un libro
agregar_ejemplar() {
  local libro_id=$1
  local codigo=$2
  local estado=$3
  local ubicacion=$4
  
  echo -e "\n${YELLOW}Agregando ejemplar '$codigo' al libro ID $libro_id...${NC}"
  EJEMPLAR_RESPUESTA=$(curl -s -X POST "$BASE_URL/api/v1/libros/$libro_id/ejemplares" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -d "{
      \"codigo\": \"$codigo\",
      \"estado_fisico\": \"$estado\",
      \"ubicacion\": \"$ubicacion\"
    }")
  
  print_response "$EJEMPLAR_RESPUESTA" "AGREGAR EJEMPLAR"
  
  if [[ "$EJEMPLAR_RESPUESTA" == *"success"* ]]; then
    CODIGOS_EJEMPLARES+=("$codigo")
    echo -e "${GREEN}Ejemplar '$codigo' agregado exitosamente${NC}"
    return 0
  else
    echo -e "${RED}Error al agregar ejemplar '$codigo'${NC}"
    return 1
  fi
}

# Función para agregar descuento a un libro
agregar_descuento() {
  local libro_id=$1
  local tipo=$2
  local valor=$3
  local codigo=$4
  
  echo -e "\n${YELLOW}Agregando descuento de $valor% al libro ID $libro_id...${NC}"
  DESCUENTO_RESPUESTA=$(curl -s -X POST "$BASE_URL/api/v1/libros/$libro_id/descuentos" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -d "{
      \"tipo\": \"$tipo\",
      \"valor\": $valor,
      \"fecha_inicio\": \"2023-05-20T00:00:00.000Z\",
      \"fecha_fin\": \"2033-12-31T23:59:59.999Z\",
      \"codigo_promocion\": \"$codigo\"
    }")
  
  print_response "$DESCUENTO_RESPUESTA" "AGREGAR DESCUENTO"
}

# Función para ejecutar todas las pruebas
ejecutar_pruebas_completas() {
  # Obtener los tokens antes de ejecutar las pruebas
  obtener_tokens
  
  # Verificar que existe una imagen de prueba
  verificar_imagenes_prueba
  
  # 1. CREACIÓN DE LIBROS CON DIFERENTES DATOS
  echo -e "\n${YELLOW}==================================================${NC}"
  echo -e "${YELLOW}======= CREACIÓN DE LIBROS CON DIFERENTES DATOS =======${NC}"
  echo -e "${YELLOW}==================================================${NC}"
  
  # Crear variedad de libros con diferentes géneros, autores, precios
  crear_libro "El nombre del viento" "Patrick" "Rothfuss" "Nova" "Fantasía" 35000 "Estados Unidos"
  crear_libro "1984" "George" "Orwell" "Destino" "Ciencia Ficción" 28000 "Reino Unido"
  crear_libro "Rayuela" "Julio" "Cortázar" "Alfaguara" "Novela" 30000 "Argentina"
  crear_libro "Don Quijote de la Mancha" "Miguel" "de Cervantes" "Cátedra" "Clásico" 42000 "España"
  crear_libro "El principito" "Antoine" "de Saint-Exupéry" "Salamandra" "Infantil" 22000 "Francia"
  crear_libro "Crimen y castigo" "Fiódor" "Dostoyevski" "Alianza" "Drama" 32000 "Rusia"
  crear_libro "Cien años de soledad" "Gabriel" "García Márquez" "Sudamericana" "Realismo Mágico" 38000 "Colombia"
  
  # Guardar el primer libro para pruebas específicas
  PRIMER_LIBRO=${LIBRO_IDS[0]}
  
  # 2. OBTENCIÓN DE DETALLES DE LIBROS
  echo -e "\n${YELLOW}==================================================${NC}"
  echo -e "${YELLOW}======= OBTENCIÓN DE DETALLES DE LIBROS =======${NC}"
  echo -e "${YELLOW}==================================================${NC}"
  
  for libro_id in "${LIBRO_IDS[@]}"; do
    echo -e "\n${YELLOW}Obteniendo detalles del libro ID: $libro_id...${NC}"
    OBTENER_RESPUESTA=$(curl -s -X GET "$BASE_URL/api/v1/libros/$libro_id")
    print_response "$OBTENER_RESPUESTA" "OBTENER LIBRO $libro_id"
  done
  
  # 3. BÚSQUEDAS DE LIBROS CON DIFERENTES USUARIOS Y TÉRMINOS
  echo -e "\n${YELLOW}==================================================${NC}"
  echo -e "${YELLOW}======= BÚSQUEDAS DE LIBROS CON DIFERENTES USUARIOS =======${NC}"
  echo -e "${YELLOW}==================================================${NC}"
  
  # Usuario 1 - Busca por autor, título y géneros específicos
  buscar_libros "Rothfuss" "${USER_TOKENS[0]}" "1"
  buscar_libros "nombre%20viento" "${USER_TOKENS[0]}" "1"
  buscar_libros "Fantasia" "${USER_TOKENS[0]}" "1"
  
  # Usuario 2 - Busca por clásicos y ciencia ficción
  buscar_libros "Cervantes" "${USER_TOKENS[1]}" "2"
  buscar_libros "Orwell" "${USER_TOKENS[1]}" "2"
  buscar_libros "Clasico" "${USER_TOKENS[1]}" "2"
  buscar_libros "Ciencia%20Ficcion" "${USER_TOKENS[1]}" "2"
  
  # Usuario 3 - Busca por literatura latinoamericana
  buscar_libros "Literatura%20Sudamericana" "${USER_TOKENS[2]}" "3"
  
  # 4. REGISTRO DE INTERACCIONES CON LIBROS
  echo -e "\n${YELLOW}==================================================${NC}"
  echo -e "${YELLOW}======= REGISTRO DE INTERACCIONES CON LIBROS =======${NC}"
  echo -e "${YELLOW}==================================================${NC}"
  
  # Simulación de interacciones con libros después de búsquedas
  # Intentamos que cada usuario interactúe con libros de acuerdo a sus búsquedas
  
  # Mapeo de los indices de búsqueda a libro IDs que serían interesantes para cada usuario
  # Usuario 1 - Interesado en fantasía
  if [ ${#BUSQUEDA_IDS[@]} -ge 3 ] && [ ${#LIBRO_IDS[@]} -ge 7 ]; then
    registrar_interaccion "${BUSQUEDA_IDS[0]}" "${LIBRO_IDS[0]}" "1" # El nombre del viento
    registrar_interaccion "${BUSQUEDA_IDS[1]}" "${LIBRO_IDS[0]}" "1" # El nombre del viento
    registrar_interaccion "${BUSQUEDA_IDS[2]}" "${LIBRO_IDS[0]}" "1" # El nombre del viento
  fi
  
  # Usuario 2 - Interesado en clásicos y ciencia ficción
  if [ ${#BUSQUEDA_IDS[@]} -ge 7 ] && [ ${#LIBRO_IDS[@]} -ge 7 ]; then
    registrar_interaccion "${BUSQUEDA_IDS[3]}" "${LIBRO_IDS[3]}" "2" # Don Quijote
    registrar_interaccion "${BUSQUEDA_IDS[4]}" "${LIBRO_IDS[1]}" "2" # 1984
    registrar_interaccion "${BUSQUEDA_IDS[5]}" "${LIBRO_IDS[3]}" "2" # Don Quijote
    registrar_interaccion "${BUSQUEDA_IDS[6]}" "${LIBRO_IDS[1]}" "2" # 1984
  fi
  
  # Usuario 3 - Interesado en literatura latinoamericana
  if [ ${#BUSQUEDA_IDS[@]} -ge 11 ] && [ ${#LIBRO_IDS[@]} -ge 7 ]; then
    registrar_interaccion "${BUSQUEDA_IDS[7]}" "${LIBRO_IDS[6]}" "3" # Cien años de soledad
    registrar_interaccion "${BUSQUEDA_IDS[8]}" "${LIBRO_IDS[2]}" "3" # Rayuela
    registrar_interaccion "${BUSQUEDA_IDS[9]}" "${LIBRO_IDS[6]}" "3" # Cien años de soledad
    registrar_interaccion "${BUSQUEDA_IDS[10]}" "${LIBRO_IDS[2]}" "3" # Rayuela
  fi
  
  # 5. CALIFICACIÓN DE LIBROS CON DIFERENTES USUARIOS
  echo -e "\n${YELLOW}==================================================${NC}"
  echo -e "${YELLOW}======= CALIFICACIÓN DE LIBROS CON DIFERENTES USUARIOS =======${NC}"
  echo -e "${YELLOW}==================================================${NC}"
  
  # Usuario 1 califica libros de fantasía
  if [ ${#LIBRO_IDS[@]} -ge 1 ]; then
    calificar_libro "${LIBRO_IDS[0]}" "4.8" "${USER_TOKENS[0]}" "1" # El nombre del viento
  fi
  
  # Usuario 2 califica libros clásicos y ciencia ficción
  if [ ${#LIBRO_IDS[@]} -ge 4 ]; then
    calificar_libro "${LIBRO_IDS[1]}" "4.2" "${USER_TOKENS[1]}" "2" # 1984
    calificar_libro "${LIBRO_IDS[3]}" "4.5" "${USER_TOKENS[1]}" "2" # Don Quijote
  fi
  
  # Usuario 3 califica literatura latinoamericana
  if [ ${#LIBRO_IDS[@]} -ge 7 ]; then
    calificar_libro "${LIBRO_IDS[2]}" "4.3" "${USER_TOKENS[2]}" "3" # Rayuela
    calificar_libro "${LIBRO_IDS[6]}" "4.9" "${USER_TOKENS[2]}" "3" # Cien años de soledad
  fi
  
  # 6. PRUEBAS AVANZADAS CON EL PRIMER LIBRO (El nombre del viento)
  echo -e "\n${YELLOW}==================================================${NC}"
  echo -e "${YELLOW}======= PRUEBAS AVANZADAS CON EL PRIMER LIBRO =======${NC}"
  echo -e "${YELLOW}==================================================${NC}"
  
  # 6.1 Actualizar libro
  echo -e "\n${YELLOW}Actualizando el libro 'El nombre del viento'...${NC}"
  ACTUALIZAR_RESPUESTA=$(curl -s -X PUT "$BASE_URL/api/v1/libros/$PRIMER_LIBRO" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -d '{
      "precio": 39000,
      "stock": 15,
      "palabras_clave": ["fantasía", "magia", "aventura", "kingkiller", "rothfuss"],
      "descripcion": "Primera parte de la trilogía Crónica del Asesino de Reyes. Kvothe cuenta la historia de su vida a Cronista, desde su infancia en una troupe de artistas itinerantes, pasando por años de penurias en la ciudad de Tarbean, hasta su admisión en la Universidad."
    }')
  print_response "$ACTUALIZAR_RESPUESTA" "ACTUALIZAR LIBRO"
  
  # 6.2 Agregar ejemplares
  agregar_ejemplar "$PRIMER_LIBRO" "ENV001" "excelente" "Bodega Norte"
  agregar_ejemplar "$PRIMER_LIBRO" "ENV002" "bueno" "Bodega Sur"
  agregar_ejemplar "$PRIMER_LIBRO" "ENV003" "aceptable" "Tienda Central"
  
  # 6.3 Actualizar ejemplar
  echo -e "\n${YELLOW}Actualizando ejemplar ENV001...${NC}"
  ACTUALIZAR_EJEMPLAR_RESPUESTA=$(curl -s -X PUT "$BASE_URL/api/v1/libros/$PRIMER_LIBRO/ejemplares/ENV001" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -d '{
      "estado_fisico": "bueno",
      "ubicacion": "Tienda Principal, Estante A1"
    }')
  print_response "$ACTUALIZAR_EJEMPLAR_RESPUESTA" "ACTUALIZAR EJEMPLAR"
  
  # 6.5 Actualizar orden de imágenes (si hay suficientes imágenes)
  if [ ${#IMAGEN_IDS[@]} -ge 2 ]; then
    echo -e "\n${YELLOW}Actualizando orden de imágenes...${NC}"
    ACTUALIZAR_ORDEN_RESPUESTA=$(curl -s -X PATCH "$BASE_URL/api/v1/libros/$PRIMER_LIBRO/imagenes/orden" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -d "{
        \"ordenesNuevos\": [
          { \"id_imagen\": \"${IMAGEN_IDS[0]}\", \"orden_nuevo\": 1 },
          { \"id_imagen\": \"${IMAGEN_IDS[1]}\", \"orden_nuevo\": 0 }
        ]
      }")
    print_response "$ACTUALIZAR_ORDEN_RESPUESTA" "ACTUALIZAR ORDEN IMÁGENES"
  fi
  
  # 6.6 Eliminar una imagen (si hay suficientes imágenes)
  if [ ${#IMAGEN_IDS[@]} -ge 3 ]; then
    echo -e "\n${YELLOW}Eliminando imagen ID: ${IMAGEN_IDS[2]}...${NC}"
    ELIMINAR_IMAGEN_RESPUESTA=$(curl -s -X DELETE "$BASE_URL/api/v1/libros/$PRIMER_LIBRO/imagenes/${IMAGEN_IDS[2]}" \
      -H "Authorization: Bearer $ADMIN_TOKEN")
    print_response "$ELIMINAR_IMAGEN_RESPUESTA" "ELIMINAR IMAGEN"
  fi
  
  # 6.7 Agregar descuento
  agregar_descuento "$PRIMER_LIBRO" "porcentaje" "15" "VIENTO15"
  
  # 6.8 Reservar stock
  echo -e "\n${YELLOW}Reservando stock del libro 'El nombre del viento'...${NC}"
  RESERVAR_RESPUESTA=$(curl -s -X POST "$BASE_URL/api/v1/libros/$PRIMER_LIBRO/reservar" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $USER_TOKEN" \
    -d '{
      "cantidad": 3,
      "id_reserva": "reserva_test_user1_001"
    }')
  print_response "$RESERVAR_RESPUESTA" "RESERVAR STOCK"
  
  # 6.9 Liberar parte del stock
  echo -e "\n${YELLOW}Liberando parte del stock del libro 'El nombre del viento'...${NC}"
  LIBERAR_RESPUESTA=$(curl -s -X POST "$BASE_URL/api/v1/libros/$PRIMER_LIBRO/liberar" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $USER_TOKEN" \
    -d '{
      "cantidad": 1,
      "id_reserva": "reserva_test_user1_001"
    }')
  print_response "$LIBERAR_RESPUESTA" "LIBERAR STOCK"
  
  # 6.10 Confirmar compra
  echo -e "\n${YELLOW}Confirmando compra de libro 'El nombre del viento'...${NC}"
  COMPRA_RESPUESTA=$(curl -s -X POST "$BASE_URL/api/v1/libros/$PRIMER_LIBRO/comprar" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $USER_TOKEN" \
    -d '{
      "cantidad": 2,
      "id_transaccion": "tx_test_user1_001",
      "id_reserva": "reserva_test_user1_001"
    }')
  print_response "$COMPRA_RESPUESTA" "CONFIRMAR COMPRA"
  
  # 6.11 Eliminar un ejemplar
  if [ ${#CODIGOS_EJEMPLARES[@]} -ge 3 ]; then
    echo -e "\n${YELLOW}Eliminando ejemplar ${CODIGOS_EJEMPLARES[2]}...${NC}"
    ELIMINAR_EJEMPLAR_RESPUESTA=$(curl -s -X DELETE "$BASE_URL/api/v1/libros/$PRIMER_LIBRO/ejemplares/${CODIGOS_EJEMPLARES[2]}" \
      -H "Authorization: Bearer $ADMIN_TOKEN")
    print_response "$ELIMINAR_EJEMPLAR_RESPUESTA" "ELIMINAR EJEMPLAR"
  fi
  
  # 7. PRUEBAS CON SEGUNDOS LIBROS (DIFERENTES OPERACIONES)
  echo -e "\n${YELLOW}==================================================${NC}"
  echo -e "${YELLOW}======= PRUEBAS CON OTROS LIBROS =======${NC}"
  echo -e "${YELLOW}==================================================${NC}"
  
  # Usar otros libros para pruebas diferentes
  SEGUNDO_LIBRO=${LIBRO_IDS[1]} # 1984
  TERCER_LIBRO=${LIBRO_IDS[6]} # Cien años de soledad
  
  # 7.1 Reservas, compras y calificación para segundo libro (1984) - Usuario 2
  echo -e "\n${YELLOW}Usuario 2 - Reservando, comprando y calificando '1984'...${NC}"
  
  RESERVAR_RESPUESTA=$(curl -s -X POST "$BASE_URL/api/v1/libros/$SEGUNDO_LIBRO/reservar" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${USER_TOKENS[1]}" \
    -d '{
      "cantidad": 2,
      "id_reserva": "reserva_test_user2_001"
    }')
  print_response "$RESERVAR_RESPUESTA" "RESERVAR STOCK (Usuario 2)"
  
  COMPRA_RESPUESTA=$(curl -s -X POST "$BASE_URL/api/v1/libros/$SEGUNDO_LIBRO/comprar" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${USER_TOKENS[1]}" \
    -d '{
      "cantidad": 2,
      "id_transaccion": "tx_test_user2_001",
      "id_reserva": "reserva_test_user2_001"
    }')
  print_response "$COMPRA_RESPUESTA" "CONFIRMAR COMPRA (Usuario 2)"
  
  # 7.2 Agregar descuento al tercer libro (Cien años de soledad)
  agregar_descuento "$TERCER_LIBRO" "porcentaje" "20" "CIEN20"
  
  # 7.3 Desactivar todos los descuentos del tercer libro
  echo -e "\n${YELLOW}Desactivando todos los descuentos del libro 'Cien años de soledad'...${NC}"
  DESACTIVAR_DESCUENTOS_RESPUESTA=$(curl -s -X DELETE "$BASE_URL/api/v1/libros/$TERCER_LIBRO/descuentos" \
    -H "Authorization: Bearer $ADMIN_TOKEN")
  print_response "$DESACTIVAR_DESCUENTOS_RESPUESTA" "DESACTIVAR DESCUENTOS"
  
  # 7.4 Reserva y compra para el tercer libro (Cien años de soledad) - Usuario 3
  echo -e "\n${YELLOW}Usuario 3 - Reservando y comprando 'Cien años de soledad'...${NC}"
  
  RESERVAR_RESPUESTA=$(curl -s -X POST "$BASE_URL/api/v1/libros/$TERCER_LIBRO/reservar" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${USER_TOKENS[2]}" \
    -d '{
      "cantidad": 1,
      "id_reserva": "reserva_test_user3_001"
    }')
  print_response "$RESERVAR_RESPUESTA" "RESERVAR STOCK (Usuario 3)"
  
  COMPRA_RESPUESTA=$(curl -s -X POST "$BASE_URL/api/v1/libros/$TERCER_LIBRO/comprar" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${USER_TOKENS[2]}" \
    -d '{
      "cantidad": 1,
      "id_transaccion": "tx_test_user3_001",
      "id_reserva": "reserva_test_user3_001"
    }')
  print_response "$COMPRA_RESPUESTA" "CONFIRMAR COMPRA (Usuario 3)"
  
  # 8. CONSULTAS ESPECIALIZADAS DE LIBROS
  echo -e "\n${YELLOW}==================================================${NC}"
  echo -e "${YELLOW}======= CONSULTAS ESPECIALIZADAS DE LIBROS =======${NC}"
  echo -e "${YELLOW}==================================================${NC}"
  
  # 8.1 Listar libros con filtros específicos
  echo -e "\n${YELLOW}Listando libros con filtros...${NC}"
  
  # Filtrar por género Fantasía
  LISTAR_RESPUESTA=$(curl -s -X GET "$BASE_URL/api/v1/libros?genero=Fantasía&limit=5")
  print_response "$LISTAR_RESPUESTA" "LISTAR LIBROS - FILTRO POR GÉNERO FANTASÍA"
  
  # Filtrar por precios entre 30000 y 40000
  LISTAR_RESPUESTA=$(curl -s -X GET "$BASE_URL/api/v1/libros?precio_min=30000&precio_max=40000&limit=5")
  print_response "$LISTAR_RESPUESTA" "LISTAR LIBROS - FILTRO POR PRECIO 30000-40000"
  
  # Filtrar por autor
  LISTAR_RESPUESTA=$(curl -s -X GET "$BASE_URL/api/v1/libros?autor=García&limit=5")
  print_response "$LISTAR_RESPUESTA" "LISTAR LIBROS - FILTRO POR AUTOR GARCÍA"
  
  # 8.2 Obtener libros con descuento
  echo -e "\n${YELLOW}Obteniendo libros con descuento...${NC}"
  DESCUENTOS_RESPUESTA=$(curl -s -X GET "$BASE_URL/api/v1/libros/descuentos?limit=5")
  print_response "$DESCUENTOS_RESPUESTA" "LIBROS CON DESCUENTO"
  
  # Obtener libros con descuento mínimo de 15%
  DESCUENTOS_RESPUESTA=$(curl -s -X GET "$BASE_URL/api/v1/libros/descuentos?min_descuento=15&limit=5")
  print_response "$DESCUENTOS_RESPUESTA" "LIBROS CON DESCUENTO MÍNIMO 15%"
  
  # 8.3 Obtener libros destacados
  echo -e "\n${YELLOW}Obteniendo libros destacados...${NC}"
  DESTACADOS_RESPUESTA=$(curl -s -X GET "$BASE_URL/api/v1/libros/destacados?limit=5")
  print_response "$DESTACADOS_RESPUESTA" "LIBROS DESTACADOS"
  
  # Obtener libros destacados con calificación mínima de 4.5
  DESTACADOS_RESPUESTA=$(curl -s -X GET "$BASE_URL/api/v1/libros/destacados?min_calificacion=4.5&limit=5")
  print_response "$DESTACADOS_RESPUESTA" "LIBROS DESTACADOS - CALIFICACIÓN MÍNIMA 4.5"
  
  # 8.4 Obtener recomendaciones personalizadas para cada usuario
  echo -e "\n${YELLOW}Obteniendo recomendaciones personalizadas...${NC}"
  
  for i in "${!USER_TOKENS[@]}"; do
    echo -e "\n${YELLOW}Obteniendo recomendaciones para usuario $((i+1))...${NC}"
    RECOMENDACIONES_RESPUESTA=$(curl -s -X GET "$BASE_URL/api/v1/libros/recomendaciones?limit=3" \
      -H "Authorization: Bearer ${USER_TOKENS[$i]}")
    print_response "$RECOMENDACIONES_RESPUESTA" "RECOMENDACIONES USUARIO $((i+1))"
  done
  
  # 9. DESACTIVACIÓN DE LIBROS
  echo -e "\n${YELLOW}==================================================${NC}"
  echo -e "${YELLOW}======= DESACTIVACIÓN DE LIBROS =======${NC}"
  echo -e "${YELLOW}==================================================${NC}"
  
  # Desactivar un libro (eliminación lógica)
  ULTIMO_LIBRO=${LIBRO_IDS[4]} # El principito
  echo -e "\n${YELLOW}Desactivando el libro 'El principito'...${NC}"
  ELIMINAR_RESPUESTA=$(curl -s -X DELETE "$BASE_URL/api/v1/libros/$ULTIMO_LIBRO" \
    -H "Authorization: Bearer $ADMIN_TOKEN")
  print_response "$ELIMINAR_RESPUESTA" "DESACTIVAR LIBRO"
  
  # Verificar que el libro está desactivado al intentar obtenerlo
  echo -e "\n${YELLOW}Verificando que el libro 'El principito' está desactivado...${NC}"
  VERIFICAR_RESPUESTA=$(curl -s -X GET "$BASE_URL/api/v1/libros/$ULTIMO_LIBRO")
  print_response "$VERIFICAR_RESPUESTA" "VERIFICAR LIBRO DESACTIVADO"
  
  echo -e "\n${GREEN}==================================================${NC}"
  echo -e "${GREEN}======= PRUEBAS COMPLETAS EJECUTADAS CON ÉXITO =======${NC}"
  echo -e "${GREEN}==================================================${NC}"
}

# Ejecutar todas las pruebas
ejecutar_pruebas_completas