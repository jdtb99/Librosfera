#!/bin/bash

# Colores para la salida
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuración
BASE_URL="https://librosfera.onrender.com"
IMAGE_PATH="./user.jpg"
USER_ID_CLIENTE="" # Se llenará automáticamente después del login

# Verificar que existe la imagen de prueba
if [ ! -f "$IMAGE_PATH" ]; then
    echo -e "${RED}Error: No se encontró la imagen de prueba en $IMAGE_PATH${NC}"
    echo -e "${YELLOW}Creando una imagen de prueba simple...${NC}"
    
    # Intenta crear una imagen de prueba usando convert (ImageMagick)
    if command -v convert &> /dev/null; then
        convert -size 200x200 xc:blue -pointsize 20 -fill white -gravity center \
        -draw "text 0,0 'Test Image'" $IMAGE_PATH
        echo -e "${GREEN}Imagen de prueba creada en $IMAGE_PATH${NC}"
    else
        echo -e "${RED}ImageMagick no está instalado. Por favor, proporciona una imagen manualmente.${NC}"
        exit 1
    fi
fi

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
        echo "Respuesta del servidor: $ROOT_RESPONSE"
        exit 1
    else
        echo -e "${GREEN}Token de root obtenido correctamente${NC}"
    fi
    
    # 2. Login como usuario admin
    echo -e "\n${YELLOW}2. Login como admin...${NC}"
    ADMIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/users/login" \
        -H "Content-Type: application/json" \
        -d '{
            "email": "jerikdavid0789@gmail.com",
            "password": "AdminPass123!"
        }')
    
    ADMIN_TOKEN=$(echo $ADMIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d':' -f2- | tr -d '"')
    
    if [ -z "$ADMIN_TOKEN" ]; then
        echo -e "${RED}Error: No se pudo obtener el token de admin${NC}"
        echo "Respuesta del servidor: $ADMIN_RESPONSE"
        exit 1
    else
        echo -e "${GREEN}Token de admin obtenido correctamente${NC}"
    fi
    
    # 3. Login como usuario cliente
    echo -e "\n${YELLOW}3. Login como cliente...${NC}"
    CLIENTE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/users/login" \
        -H "Content-Type: application/json" \
        -d '{
            "email": "jerik.hincapie@utp.edu.co",
            "password": "Password123!"
        }')
    
    CLIENTE_TOKEN=$(echo $CLIENTE_RESPONSE | grep -o '"token":"[^"]*"' | cut -d':' -f2- | tr -d '"')
    USER_ID_CLIENTE=$(echo $CLIENTE_RESPONSE | grep -o '"_id":"[^"]*"' | cut -d':' -f2- | tr -d '"')
    
    if [ -z "$CLIENTE_TOKEN" ]; then
        echo -e "${RED}Error: No se pudo obtener el token de cliente${NC}"
        echo "Respuesta del servidor: $CLIENTE_RESPONSE"
        exit 1
    else
        echo -e "${GREEN}Token de cliente obtenido correctamente${NC}"
        echo -e "${BLUE}ID del cliente: $USER_ID_CLIENTE${NC}"
    fi
}

# Función para probar el endpoint 1.1: Subir Foto de Perfil (Usuario)
test_subir_foto_usuario() {
    echo -e "\n${YELLOW}=== Test 1.1: Subir Foto de Perfil (Usuario) ===${NC}"
    
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/users/profile/foto" \
        -H "Authorization: Bearer $CLIENTE_TOKEN" \
        -F "foto_perfil=@$IMAGE_PATH" \
        --write-out "\nCódigo de estado: %{http_code}" \
        --connect-timeout 10)
    
    echo -e "${BLUE}Respuesta:${NC}"
    echo "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q "success"; then
        echo -e "${GREEN}✓ Test 1.1 completado correctamente${NC}"
    else
        echo -e "${RED}✗ Test 1.1 falló${NC}"
    fi
}

# Función para probar el endpoint 1.2: Eliminar Foto de Perfil (Usuario)
test_eliminar_foto_usuario() {
    echo -e "\n${YELLOW}=== Test 1.2: Eliminar Foto de Perfil (Usuario) ===${NC}"
    
    RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/v1/users/profile/foto" \
        -H "Authorization: Bearer $CLIENTE_TOKEN" \
        -H "Content-Type: application/json" \
        --write-out "\nCódigo de estado: %{http_code}" \
        --connect-timeout 10)
    
    echo -e "${BLUE}Respuesta:${NC}"
    echo "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q "success"; then
        echo -e "${GREEN}✓ Test 1.2 completado correctamente${NC}"
    else
        echo -e "${RED}✗ Test 1.2 falló${NC}"
    fi
}

# Función para probar el endpoint 1.3: Subir Foto de Perfil (Admin)
test_subir_foto_admin() {
    echo -e "\n${YELLOW}=== Test 1.3: Subir Foto de Perfil (Admin) ===${NC}"
    
    if [ -z "$USER_ID_CLIENTE" ]; then
        echo -e "${RED}Error: No se pudo obtener el ID del usuario cliente${NC}"
        return
    fi
    
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/users/$USER_ID_CLIENTE/foto" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "X-Admin-Action: update_user_photo" \
        -F "foto_perfil=@$IMAGE_PATH" \
        --write-out "\nCódigo de estado: %{http_code}" \
        --connect-timeout 10)
    
    echo -e "${BLUE}Respuesta:${NC}"
    echo "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q "success"; then
        echo -e "${GREEN}✓ Test 1.3 completado correctamente${NC}"
    else
        echo -e "${RED}✗ Test 1.3 falló${NC}"
    fi
}

# Función para probar el endpoint 1.4: Eliminar Foto de Perfil (Admin)
test_eliminar_foto_admin() {
    echo -e "\n${YELLOW}=== Test 1.4: Eliminar Foto de Perfil (Admin) ===${NC}"
    
    if [ -z "$USER_ID_CLIENTE" ]; then
        echo -e "${RED}Error: No se pudo obtener el ID del usuario cliente${NC}"
        return
    fi
    
    RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/v1/users/$USER_ID_CLIENTE/foto" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -H "X-Admin-Action: remove_user_photo" \
        -H "X-Reason: Imagen de prueba" \
        --write-out "\nCódigo de estado: %{http_code}" \
        --connect-timeout 10)
    
    echo -e "${BLUE}Respuesta:${NC}"
    echo "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q "success"; then
        echo -e "${GREEN}✓ Test 1.4 completado correctamente${NC}"
    else
        echo -e "${RED}✗ Test 1.4 falló${NC}"
    fi
}

# Función para probar el mismo endpoint con token de root
test_subir_foto_root() {
    echo -e "\n${YELLOW}=== Test adicional: Subir Foto de Perfil con token de root ===${NC}"
    
    if [ -z "$USER_ID_CLIENTE" ]; then
        echo -e "${RED}Error: No se pudo obtener el ID del usuario cliente${NC}"
        return
    fi
    
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/users/$USER_ID_CLIENTE/foto" \
        -H "Authorization: Bearer $ROOT_TOKEN" \
        -H "X-Admin-Action: update_user_photo" \
        -F "foto_perfil=@$IMAGE_PATH" \
        --write-out "\nCódigo de estado: %{http_code}" \
        --connect-timeout 10)
    
    echo -e "${BLUE}Respuesta:${NC}"
    echo "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q "success"; then
        echo -e "${GREEN}✓ Test adicional con root completado correctamente${NC}"
    else
        echo -e "${RED}✗ Test adicional con root falló${NC}"
    fi
}

# Función principal
main() {
    echo -e "${BLUE}===== SCRIPT DE PRUEBA DE ENDPOINTS DE FOTOS DE PERFIL =====${NC}"
    echo -e "${BLUE}Base URL: $BASE_URL${NC}"
    echo -e "${BLUE}Imagen de prueba: $IMAGE_PATH${NC}"
    
    # Obtener tokens de autenticación
    obtener_tokens
    
    # Ejecutar pruebas de endpoints
    echo -e "\n${YELLOW}Iniciando pruebas de endpoints...${NC}"
    
    # Test 1.1: Subir Foto de Perfil (Usuario)
    test_subir_foto_usuario
    
    # Test 1.2: Eliminar Foto de Perfil (Usuario)
    test_eliminar_foto_usuario
    
    # Test 1.3: Subir Foto de Perfil (Admin)
    test_subir_foto_admin
    
    # Test 1.4: Eliminar Foto de Perfil (Admin)
    test_eliminar_foto_admin
    
    # Test adicional con token de root
    test_subir_foto_root
    
    echo -e "\n${GREEN}===== FIN DE LAS PRUEBAS =====${NC}"
}

# Ejecutar función principal
main