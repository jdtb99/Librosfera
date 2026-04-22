#!/bin/bash

# Colores para la salida
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuración
BASE_URL="https://librosfera.onrender.com"
CLIENTE_TOKEN=""
ADMIN_TOKEN=""
ROOT_TOKEN=""
TARJETA_ID_CREDITO=""
TARJETA_ID_DEBITO=""
USER_ID_CLIENTE=""

# Función para obtener tokens de autenticación
obtener_tokens() {
    echo -e "${YELLOW}Obteniendo tokens de autenticación...${NC}"
    
    # 1. Login como usuario cliente
    echo -e "\n${YELLOW}1. Login como cliente...${NC}"
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
    
    # 3. Login como usuario root
    echo -e "\n${YELLOW}3. Login como root...${NC}"
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
}

# Función para probar el registro de una tarjeta de crédito
test_registrar_tarjeta_credito() {
    echo -e "\n${YELLOW}=== Test 1: Registrar Tarjeta de Crédito ===${NC}"
    
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/tarjetas" \
        -H "Authorization: Bearer $CLIENTE_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "numero_tarjeta": "4111111111111111",
            "nombre_titular": "JUAN PEREZ",
            "mes_expiracion": 12,
            "anio_expiracion": 2025,
            "cvv": "123",
            "tipo": "credito"
        }' \
        --write-out "\nCódigo de estado: %{http_code}")
    
    echo -e "${BLUE}Respuesta:${NC}"
    echo "$RESPONSE"
    
    # Extraer el ID de la tarjeta para pruebas posteriores
    TARJETA_ID_CREDITO=$(echo $RESPONSE | grep -o '"id_tarjeta":"[^"]*"' | cut -d':' -f2- | tr -d '"')
    
    if [ -n "$TARJETA_ID_CREDITO" ]; then
        echo -e "${GREEN}✓ Test 1 completado correctamente${NC}"
        echo -e "${BLUE}ID de la tarjeta de crédito: $TARJETA_ID_CREDITO${NC}"
    else
        echo -e "${RED}✗ Test 1 falló${NC}"
    fi
}

# Función para probar el registro de una tarjeta de débito
test_registrar_tarjeta_debito() {
    echo -e "\n${YELLOW}=== Test 2: Registrar Tarjeta de Débito ===${NC}"
    
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/tarjetas" \
        -H "Authorization: Bearer $CLIENTE_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "numero_tarjeta": "5555555555554444",
            "nombre_titular": "JUAN PEREZ",
            "mes_expiracion": 10,
            "anio_expiracion": 2030,
            "cvv": "456",
            "tipo": "debito",
            "marca": "mastercard"
        }' \
        --write-out "\nCódigo de estado: %{http_code}")
    
    echo -e "${BLUE}Respuesta:${NC}"
    echo "$RESPONSE"
    
    # Extraer el ID de la tarjeta para pruebas posteriores
    TARJETA_ID_DEBITO=$(echo $RESPONSE | grep -o '"id_tarjeta":"[^"]*"' | cut -d':' -f2- | tr -d '"')
    
    if [ -n "$TARJETA_ID_DEBITO" ]; then
        echo -e "${GREEN}✓ Test 2 completado correctamente${NC}"
        echo -e "${BLUE}ID de la tarjeta de débito: $TARJETA_ID_DEBITO${NC}"
    else
        echo -e "${RED}✗ Test 2 falló${NC}"
    fi
}

# Función para probar obtener todas las tarjetas
test_obtener_tarjetas() {
    echo -e "\n${YELLOW}=== Test 3: Obtener Todas las Tarjetas ===${NC}"
    
    RESPONSE=$(curl -s -X GET "$BASE_URL/api/v1/tarjetas" \
        -H "Authorization: Bearer $CLIENTE_TOKEN" \
        --write-out "\nCódigo de estado: %{http_code}")
    
    echo -e "${BLUE}Respuesta:${NC}"
    echo "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q "success"; then
        echo -e "${GREEN}✓ Test 3 completado correctamente${NC}"
    else
        echo -e "${RED}✗ Test 3 falló${NC}"
    fi
}

# Función para probar obtener una tarjeta específica
test_obtener_tarjeta() {
    echo -e "\n${YELLOW}=== Test 4: Obtener Tarjeta Específica ===${NC}"
    
    RESPONSE=$(curl -s -X GET "$BASE_URL/api/v1/tarjetas/$TARJETA_ID_CREDITO" \
        -H "Authorization: Bearer $CLIENTE_TOKEN" \
        --write-out "\nCódigo de estado: %{http_code}")
    
    echo -e "${BLUE}Respuesta:${NC}"
    echo "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q "success"; then
        echo -e "${GREEN}✓ Test 4 completado correctamente${NC}"
    else
        echo -e "${RED}✗ Test 4 falló${NC}"
    fi
}

# Función para probar actualizar una tarjeta
test_actualizar_tarjeta() {
    echo -e "\n${YELLOW}=== Test 5: Actualizar Tarjeta ===${NC}"
    
    RESPONSE=$(curl -s -X PUT "$BASE_URL/api/v1/tarjetas/$TARJETA_ID_CREDITO" \
        -H "Authorization: Bearer $CLIENTE_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "nombre_titular": "JUAN A PEREZ",
            "mes_expiracion": 10,
            "anio_expiracion": 2026
        }' \
        --write-out "\nCódigo de estado: %{http_code}")
    
    echo -e "${BLUE}Respuesta:${NC}"
    echo "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q "success"; then
        echo -e "${GREEN}✓ Test 5 completado correctamente${NC}"
    else
        echo -e "${RED}✗ Test 5 falló${NC}"
    fi
}

# Función para probar establecer tarjeta predeterminada
test_establecer_predeterminada() {
    echo -e "\n${YELLOW}=== Test 6: Establecer Tarjeta Predeterminada ===${NC}"
    
    RESPONSE=$(curl -s -X PATCH "$BASE_URL/api/v1/tarjetas/$TARJETA_ID_DEBITO/predeterminada" \
        -H "Authorization: Bearer $CLIENTE_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{}' \
        --write-out "\nCódigo de estado: %{http_code}")
    
    echo -e "${BLUE}Respuesta:${NC}"
    echo "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q "success"; then
        echo -e "${GREEN}✓ Test 6 completado correctamente${NC}"
    else
        echo -e "${RED}✗ Test 6 falló${NC}"
    fi
}

# Función para probar verificar tarjeta
test_verificar_tarjeta() {
    echo -e "\n${YELLOW}=== Test 7: Verificar Validez de Tarjeta ===${NC}"
    
    RESPONSE=$(curl -s -X GET "$BASE_URL/api/v1/tarjetas/$TARJETA_ID_CREDITO/verificar" \
        -H "Authorization: Bearer $CLIENTE_TOKEN" \
        --write-out "\nCódigo de estado: %{http_code}")
    
    echo -e "${BLUE}Respuesta:${NC}"
    echo "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q "success"; then
        echo -e "${GREEN}✓ Test 7 completado correctamente${NC}"
    else
        echo -e "${RED}✗ Test 7 falló${NC}"
    fi
}

# Función para probar verificar saldo
test_verificar_saldo() {
    echo -e "\n${YELLOW}=== Test 8: Verificar Saldo de Tarjeta ===${NC}"
    
    RESPONSE=$(curl -s -X GET "$BASE_URL/api/v1/tarjetas/$TARJETA_ID_DEBITO/saldo" \
        -H "Authorization: Bearer $CLIENTE_TOKEN" \
        --write-out "\nCódigo de estado: %{http_code}")
    
    echo -e "${BLUE}Respuesta:${NC}"
    echo "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q "success"; then
        echo -e "${GREEN}✓ Test 8 completado correctamente${NC}"
    else
        echo -e "${RED}✗ Test 8 falló${NC}"
    fi
}

# Función para probar modificar saldo
test_modificar_saldo() {
    echo -e "\n${YELLOW}=== Test 9: Modificar Saldo de Tarjeta ===${NC}"
    
    RESPONSE=$(curl -s -X PATCH "$BASE_URL/api/v1/tarjetas/$TARJETA_ID_DEBITO/saldo" \
        -H "Authorization: Bearer $CLIENTE_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "monto": 100,
            "descripcion": "Depósito de prueba"
        }' \
        --write-out "\nCódigo de estado: %{http_code}")
    
    echo -e "${BLUE}Respuesta:${NC}"
    echo "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q "success"; then
        echo -e "${GREEN}✓ Test 9 completado correctamente${NC}"
    else
        echo -e "${RED}✗ Test 9 falló${NC}"
    fi
}

# Función para probar obtener tarjeta predeterminada
test_obtener_predeterminada() {
    echo -e "\n${YELLOW}=== Test 10: Obtener Tarjeta Predeterminada ===${NC}"
    
    RESPONSE=$(curl -s -X GET "$BASE_URL/api/v1/tarjetas/predeterminada" \
        -H "Authorization: Bearer $CLIENTE_TOKEN" \
        --write-out "\nCódigo de estado: %{http_code}")
    
    echo -e "${BLUE}Respuesta:${NC}"
    echo "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q "success"; then
        echo -e "${GREEN}✓ Test 10 completado correctamente${NC}"
    else
        echo -e "${RED}✗ Test 10 falló${NC}"
    fi
}

# Función para probar obtener estadísticas globales (admin)
test_obtener_estadisticas() {
    echo -e "\n${YELLOW}=== Test 11: Obtener Estadísticas de Tarjetas (Admin) ===${NC}"
    
    RESPONSE=$(curl -s -X GET "$BASE_URL/api/v1/tarjetas/stats" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        --write-out "\nCódigo de estado: %{http_code}")
    
    echo -e "${BLUE}Respuesta:${NC}"
    echo "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q "success"; then
        echo -e "${GREEN}✓ Test 11 completado correctamente${NC}"
    else
        echo -e "${RED}✗ Test 11 falló${NC}"
    fi
}

# Función para probar obtener estadísticas de un usuario (admin)
test_obtener_estadisticas_usuario() {
    echo -e "\n${YELLOW}=== Test 12: Obtener Estadísticas de Tarjetas de Usuario (Admin) ===${NC}"
    
    RESPONSE=$(curl -s -X GET "$BASE_URL/api/v1/tarjetas/stats/$USER_ID_CLIENTE" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        --write-out "\nCódigo de estado: %{http_code}")
    
    echo -e "${BLUE}Respuesta:${NC}"
    echo "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q "success"; then
        echo -e "${GREEN}✓ Test 12 completado correctamente${NC}"
    else
        echo -e "${RED}✗ Test 12 falló${NC}"
    fi
}

# Función para probar retirar dinero de tarjeta
test_retirar_saldo() {
    echo -e "\n${YELLOW}=== Test 13: Retirar Saldo de Tarjeta ===${NC}"
    
    RESPONSE=$(curl -s -X PATCH "$BASE_URL/api/v1/tarjetas/$TARJETA_ID_DEBITO/saldo" \
        -H "Authorization: Bearer $CLIENTE_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "monto": -50,
            "descripcion": "Retiro de prueba"
        }' \
        --write-out "\nCódigo de estado: %{http_code}")
    
    echo -e "${BLUE}Respuesta:${NC}"
    echo "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q "success"; then
        echo -e "${GREEN}✓ Test 13 completado correctamente${NC}"
    else
        echo -e "${RED}✗ Test 13 falló${NC}"
    fi
}

# Función para probar eliminar tarjeta
test_eliminar_tarjeta() {
    echo -e "\n${YELLOW}=== Test 14: Eliminar Tarjeta ===${NC}"
    
    RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/v1/tarjetas/$TARJETA_ID_CREDITO" \
        -H "Authorization: Bearer $CLIENTE_TOKEN" \
        --write-out "\nCódigo de estado: %{http_code}")
    
    echo -e "${BLUE}Respuesta:${NC}"
    echo "$RESPONSE"
    
    if echo "$RESPONSE" | grep -q "success"; then
        echo -e "${GREEN}✓ Test 14 completado correctamente${NC}"
    else
        echo -e "${RED}✗ Test 14 falló${NC}"
    fi
}

# Función para verificar que la tarjeta se eliminó correctamente
test_verificar_eliminacion() {
    echo -e "\n${YELLOW}=== Test 15: Verificar Eliminación de Tarjeta ===${NC}"
    
    RESPONSE=$(curl -s -X GET "$BASE_URL/api/v1/tarjetas" \
        -H "Authorization: Bearer $CLIENTE_TOKEN" \
        --write-out "\nCódigo de estado: %{http_code}")
    
    echo -e "${BLUE}Respuesta:${NC}"
    echo "$RESPONSE"
    
    # Verificar que la tarjeta eliminada no aparezca como activa
    if ! echo "$RESPONSE" | grep -q "$TARJETA_ID_CREDITO"; then
        echo -e "${GREEN}✓ Test 15 completado correctamente - Tarjeta eliminada no aparece en la lista${NC}"
    else
        echo -e "${RED}✗ Test 15 falló - Tarjeta eliminada sigue apareciendo${NC}"
    fi
}

# Función principal
main() {
    echo -e "${BLUE}===== SCRIPT DE PRUEBA DE ENDPOINTS DE TARJETAS =====${NC}"
    echo -e "${BLUE}Base URL: $BASE_URL${NC}"
    
    # Obtener tokens de autenticación
    obtener_tokens
    
    # Ejecutar pruebas de endpoints
    echo -e "\n${YELLOW}Iniciando pruebas de endpoints...${NC}"
    
    # Test 1: Registrar tarjeta de crédito
    test_registrar_tarjeta_credito
    
    # Test 2: Registrar tarjeta de débito
    test_registrar_tarjeta_debito
    
    # Test 3: Obtener todas las tarjetas
    test_obtener_tarjetas
    
    # Test 4: Obtener tarjeta específica
    test_obtener_tarjeta
    
    # Test 5: Actualizar tarjeta
    test_actualizar_tarjeta
    
    # Test 6: Establecer tarjeta predeterminada
    test_establecer_predeterminada
    
    # Test 7: Verificar validez de tarjeta
    test_verificar_tarjeta
    
    # Test 8: Verificar saldo de tarjeta
    test_verificar_saldo
    
    # Test 9: Modificar saldo (incrementar)
    test_modificar_saldo
    
    # Test 10: Obtener tarjeta predeterminada
    test_obtener_predeterminada
    
    # Test 11: Obtener estadísticas (admin)
    test_obtener_estadisticas
    
    # Test 12: Obtener estadísticas de usuario (admin)
    test_obtener_estadisticas_usuario
    
    # Test 13: Retirar saldo
    test_retirar_saldo
    
    # Test 14: Eliminar tarjeta
    test_eliminar_tarjeta
    
    # Test 15: Verificar eliminación
    test_verificar_eliminacion
    
    echo -e "\n${GREEN}===== FIN DE LAS PRUEBAS =====${NC}"
}

# Ejecutar función principal
main