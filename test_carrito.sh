#!/bin/bash

# Colores para la salida
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuración
BASE_URL="https://librosfera.onrender.com"
USER_ID_CLIENTE="" # Se llenará automáticamente después del login
LIBRO_ID_1=""     # Se llenará automáticamente
LIBRO_ID_2=""     # Se llenará automáticamente
TESTS_PASSED=0
TESTS_FAILED=0

# Función para mostrar encabezado
show_header() {
    echo -e "${BLUE}================================================================${NC}"
    echo -e "${BLUE}    SCRIPT DE PRUEBA COMPLETO - SISTEMA DE CARRITOS${NC}"
    echo -e "${BLUE}================================================================${NC}"
    echo -e "${BLUE}Base URL: $BASE_URL${NC}"
    echo -e "${BLUE}Fecha: $(date)${NC}"
    echo -e "${BLUE}================================================================${NC}"
}

# Función para mostrar resultado de test
show_test_result() {
    local test_name="$1"
    local response="$2"
    local expected_success="$3"
    
    if [[ "$expected_success" == "true" ]]; then
        if echo "$response" | grep -q "success"; then
            echo -e "${GREEN}✓ $test_name - EXITOSO${NC}"
            ((TESTS_PASSED++))
        else
            echo -e "${RED}✗ $test_name - FALLÓ${NC}"
            ((TESTS_FAILED++))
        fi
    else
        if echo "$response" | grep -q "error"; then
            echo -e "${GREEN}✓ $test_name - FALLÓ COMO ESPERADO${NC}"
            ((TESTS_PASSED++))
        else
            echo -e "${RED}✗ $test_name - DEBERÍA HABER FALLADO${NC}"
            ((TESTS_FAILED++))
        fi
    fi
    
    # Mostrar código de estado si está presente
    if echo "$response" | grep -q "Código de estado:"; then
        local status_code=$(echo "$response" | grep "Código de estado:" | awk '{print $NF}')
        echo -e "${CYAN}    Código de estado: $status_code${NC}"
    fi
}

# Función para obtener tokens de autenticación
obtener_tokens() {
    echo -e "\n${YELLOW}=== OBTENIENDO TOKENS DE AUTENTICACIÓN ===${NC}"
    
    # 1. Login como usuario root
    echo -e "\n${YELLOW}1. Login como root...${NC}"
    ROOT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/users/login" \
        -H "Content-Type: application/json" \
        -d '{
            "email": "root@librosfera.com",
            "password": "Root12345!"
        }' \
        --write-out "\nCódigo de estado: %{http_code}")
    
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
        }' \
        --write-out "\nCódigo de estado: %{http_code}")
    
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
        }' \
        --write-out "\nCódigo de estado: %{http_code}")
    
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

# Función para obtener libros para pruebas
obtener_libros_para_pruebas() {
    echo -e "\n${YELLOW}=== OBTENIENDO LIBROS PARA PRUEBAS ===${NC}"
    
    LIBROS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/v1/libros?limit=5" \
        -H "Authorization: Bearer $CLIENTE_TOKEN" \
        --write-out "\nCódigo de estado: %{http_code}")
    
    # Extraer IDs de libros
    LIBRO_ID_1=$(echo $LIBROS_RESPONSE | grep -o '"_id":"[^"]*"' | head -1 | cut -d':' -f2- | tr -d '"')
    LIBRO_ID_2=$(echo $LIBROS_RESPONSE | grep -o '"_id":"[^"]*"' | head -2 | tail -1 | cut -d':' -f2- | tr -d '"')
    
    if [ -z "$LIBRO_ID_1" ] || [ -z "$LIBRO_ID_2" ]; then
        echo -e "${RED}Error: No se pudieron obtener IDs de libros para pruebas${NC}"
        echo "Respuesta: $LIBROS_RESPONSE"
        exit 1
    else
        echo -e "${GREEN}Libros obtenidos para pruebas:${NC}"
        echo -e "${BLUE}Libro 1 ID: $LIBRO_ID_1${NC}"
        echo -e "${BLUE}Libro 2 ID: $LIBRO_ID_2${NC}"
    fi
}

# ==================== TESTS DE CLIENTE ====================

# Test 1.1: Obtener Carrito del Usuario
test_1_1_obtener_carrito() {
    echo -e "\n${YELLOW}=== Test 1.1: Obtener Carrito del Usuario ===${NC}"
    
    RESPONSE=$(curl -s -X GET "$BASE_URL/api/v1/carrito" \
        -H "Authorization: Bearer $CLIENTE_TOKEN" \
        -H "Accept: application/json" \
        --write-out "\nCódigo de estado: %{http_code}" \
        --connect-timeout 10)
    
    echo -e "${BLUE}Respuesta:${NC}"
    echo "$RESPONSE"
    
    show_test_result "Obtener Carrito del Usuario" "$RESPONSE" "true"
}

# Test 1.2: Agregar Libro al Carrito
test_1_2_agregar_libro() {
    echo -e "\n${YELLOW}=== Test 1.2: Agregar Libro al Carrito ===${NC}"
    
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/carrito/agregar" \
        -H "Authorization: Bearer $CLIENTE_TOKEN" \
        -H "Content-Type: application/json" \
        -H "Accept: application/json" \
        -d "{
            \"id_libro\": \"$LIBRO_ID_1\",
            \"cantidad\": 2
        }" \
        --write-out "\nCódigo de estado: %{http_code}" \
        --connect-timeout 10)
    
    echo -e "${BLUE}Respuesta:${NC}"
    echo "$RESPONSE"
    
    show_test_result "Agregar Libro al Carrito" "$RESPONSE" "true"
}

# Test 1.3: Agregar Segundo Libro al Carrito
test_1_3_agregar_segundo_libro() {
    echo -e "\n${YELLOW}=== Test 1.3: Agregar Segundo Libro al Carrito ===${NC}"
    
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/carrito/agregar" \
        -H "Authorization: Bearer $CLIENTE_TOKEN" \
        -H "Content-Type: application/json" \
        -H "Accept: application/json" \
        -d "{
            \"id_libro\": \"$LIBRO_ID_2\",
            \"cantidad\": 1
        }" \
        --write-out "\nCódigo de estado: %{http_code}" \
        --connect-timeout 10)
    
    echo -e "${BLUE}Respuesta:${NC}"
    echo "$RESPONSE"
    
    show_test_result "Agregar Segundo Libro al Carrito" "$RESPONSE" "true"
}

# Test 1.4: Actualizar Cantidad de Item
test_1_4_actualizar_cantidad() {
    echo -e "\n${YELLOW}=== Test 1.4: Actualizar Cantidad de Item ===${NC}"
    
    RESPONSE=$(curl -s -X PUT "$BASE_URL/api/v1/carrito/item/$LIBRO_ID_1" \
        -H "Authorization: Bearer $CLIENTE_TOKEN" \
        -H "Content-Type: application/json" \
        -H "Accept: application/json" \
        -d '{
            "cantidad": 3
        }' \
        --write-out "\nCódigo de estado: %{http_code}" \
        --connect-timeout 10)
    
    echo -e "${BLUE}Respuesta:${NC}"
    echo "$RESPONSE"
    
    show_test_result "Actualizar Cantidad de Item" "$RESPONSE" "true"
}

# Test 1.5: Aplicar Código de Descuento
test_1_5_aplicar_codigo_descuento() {
    echo -e "\n${YELLOW}=== Test 1.5: Aplicar Código de Descuento ===${NC}"
    
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/carrito/codigo-descuento" \
        -H "Authorization: Bearer $CLIENTE_TOKEN" \
        -H "Content-Type: application/json" \
        -H "Accept: application/json" \
        -d '{
            "codigo_descuento": "DESCUENTO10"
        }' \
        --write-out "\nCódigo de estado: %{http_code}" \
        --connect-timeout 10)
    
    echo -e "${BLUE}Respuesta:${NC}"
    echo "$RESPONSE"
    
    show_test_result "Aplicar Código de Descuento" "$RESPONSE" "true"
}

# Test 1.6: Calcular Total del Carrito
test_1_6_calcular_total() {
    echo -e "\n${YELLOW}=== Test 1.6: Calcular Total del Carrito ===${NC}"
    
    RESPONSE=$(curl -s -X GET "$BASE_URL/api/v1/carrito/total" \
        -H "Authorization: Bearer $CLIENTE_TOKEN" \
        -H "Accept: application/json" \
        --write-out "\nCódigo de estado: %{http_code}" \
        --connect-timeout 10)
    
    echo -e "${BLUE}Respuesta:${NC}"
    echo "$RESPONSE"
    
    show_test_result "Calcular Total del Carrito" "$RESPONSE" "true"
}

# Test 1.7: Confirmar Cambios de Precio
test_1_7_confirmar_precios() {
    echo -e "\n${YELLOW}=== Test 1.7: Confirmar Cambios de Precio ===${NC}"
    
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/carrito/confirmar-precios" \
        -H "Authorization: Bearer $CLIENTE_TOKEN" \
        -H "Content-Type: application/json" \
        -H "Accept: application/json" \
        -d "{
            \"id_libro\": \"$LIBRO_ID_1\"
        }" \
        --write-out "\nCódigo de estado: %{http_code}" \
        --connect-timeout 10)
    
    echo -e "${BLUE}Respuesta:${NC}"
    echo "$RESPONSE"
    
    show_test_result "Confirmar Cambios de Precio" "$RESPONSE" "true"
}

# Test 1.8: Quitar Código de Descuento
test_1_8_quitar_codigo_descuento() {
    echo -e "\n${YELLOW}=== Test 1.8: Quitar Código de Descuento ===${NC}"
    
    RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/v1/carrito/codigo-descuento/DESCUENTO10" \
        -H "Authorization: Bearer $CLIENTE_TOKEN" \
        -H "Accept: application/json" \
        --write-out "\nCódigo de estado: %{http_code}" \
        --connect-timeout 10)
    
    echo -e "${BLUE}Respuesta:${NC}"
    echo "$RESPONSE"
    
    show_test_result "Quitar Código de Descuento" "$RESPONSE" "true"
}

# Test 1.9: Quitar Libro del Carrito
test_1_9_quitar_libro() {
    echo -e "\n${YELLOW}=== Test 1.9: Quitar Libro del Carrito ===${NC}"
    
    RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/v1/carrito/item/$LIBRO_ID_2" \
        -H "Authorization: Bearer $CLIENTE_TOKEN" \
        -H "Accept: application/json" \
        --write-out "\nCódigo de estado: %{http_code}" \
        --connect-timeout 10)
    
    echo -e "${BLUE}Respuesta:${NC}"
    echo "$RESPONSE"
    
    show_test_result "Quitar Libro del Carrito" "$RESPONSE" "true"
}

# ==================== TESTS ADMINISTRATIVOS ====================

# Test 2.1: Listar Todos los Carritos (Admin)
test_2_1_listar_carritos_admin() {
    echo -e "\n${YELLOW}=== Test 2.1: Listar Todos los Carritos (Admin) ===${NC}"
    
    RESPONSE=$(curl -s -X GET "$BASE_URL/api/v1/carrito/admin/todos?page=1&limit=5" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Accept: application/json" \
        --write-out "\nCódigo de estado: %{http_code}" \
        --connect-timeout 10)
    
    echo -e "${BLUE}Respuesta:${NC}"
    echo "$RESPONSE"
    
    show_test_result "Listar Todos los Carritos (Admin)" "$RESPONSE" "true"
}

# Test 2.2: Obtener Estadísticas de Carritos (Admin)
test_2_2_estadisticas_admin() {
    echo -e "\n${YELLOW}=== Test 2.2: Obtener Estadísticas de Carritos (Admin) ===${NC}"
    
    RESPONSE=$(curl -s -X GET "$BASE_URL/api/v1/carrito/admin/estadisticas" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Accept: application/json" \
        --write-out "\nCódigo de estado: %{http_code}" \
        --connect-timeout 10)
    
    echo -e "${BLUE}Respuesta:${NC}"
    echo "$RESPONSE"
    
    show_test_result "Obtener Estadísticas de Carritos (Admin)" "$RESPONSE" "true"
}

# Test 2.3: Obtener Producto Más Popular (Admin)
test_2_3_producto_popular_admin() {
    echo -e "\n${YELLOW}=== Test 2.3: Obtener Producto Más Popular (Admin) ===${NC}"
    
    RESPONSE=$(curl -s -X GET "$BASE_URL/api/v1/carrito/admin/producto-popular" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Accept: application/json" \
        --write-out "\nCódigo de estado: %{http_code}" \
        --connect-timeout 10)
    
    echo -e "${BLUE}Respuesta:${NC}"
    echo "$RESPONSE"
    
    show_test_result "Obtener Producto Más Popular (Admin)" "$RESPONSE" "true"
}

# Test 2.4: Vaciar Carrito de Cliente Específico (Admin)
test_2_4_vaciar_carrito_cliente_admin() {
    echo -e "\n${YELLOW}=== Test 2.4: Vaciar Carrito de Cliente Específico (Admin) ===${NC}"
    
    RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/v1/carrito/admin/cliente/$USER_ID_CLIENTE" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Accept: application/json" \
        --write-out "\nCódigo de estado: %{http_code}" \
        --connect-timeout 10)
    
    echo -e "${BLUE}Respuesta:${NC}"
    echo "$RESPONSE"
    
    show_test_result "Vaciar Carrito de Cliente Específico (Admin)" "$RESPONSE" "true"
}

# Test 2.5: Quitar Producto de Todos los Carritos (Admin)
test_2_5_quitar_producto_todos_carritos() {
    echo -e "\n${YELLOW}=== Test 2.5: Quitar Producto de Todos los Carritos (Admin) ===${NC}"
    
    # Primero agregar libro al carrito para tener algo que quitar
    curl -s -X POST "$BASE_URL/api/v1/carrito/agregar" \
        -H "Authorization: Bearer $CLIENTE_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"id_libro\": \"$LIBRO_ID_1\",
            \"cantidad\": 1
        }" > /dev/null
    
    # Ahora quitar el producto de todos los carritos
    RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/v1/carrito/admin/producto/$LIBRO_ID_1" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -H "Accept: application/json" \
        -d '{
            "razon": "Prueba automatizada - producto removido para testing"
        }' \
        --write-out "\nCódigo de estado: %{http_code}" \
        --connect-timeout 10)
    
    echo -e "${BLUE}Respuesta:${NC}"
    echo "$RESPONSE"
    
    show_test_result "Quitar Producto de Todos los Carritos (Admin)" "$RESPONSE" "true"
}

# Test 2.6: Vaciar Todos los Carritos (Root)
test_2_6_vaciar_todos_carritos_root() {
    echo -e "\n${YELLOW}=== Test 2.6: Vaciar Todos los Carritos (Root) ===${NC}"
    
    # Primero agregar algo al carrito para tener carritos que vaciar
    curl -s -X POST "$BASE_URL/api/v1/carrito/agregar" \
        -H "Authorization: Bearer $CLIENTE_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"id_libro\": \"$LIBRO_ID_2\",
            \"cantidad\": 1
        }" > /dev/null
    
    RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/v1/carrito/admin/todos" \
        -H "Authorization: Bearer $ROOT_TOKEN" \
        -H "Accept: application/json" \
        --write-out "\nCódigo de estado: %{http_code}" \
        --connect-timeout 15)
    
    echo -e "${BLUE}Respuesta:${NC}"
    echo "$RESPONSE"
    
    show_test_result "Vaciar Todos los Carritos (Root)" "$RESPONSE" "true"
}

# Test 1.10: Vaciar Carrito Completo (después de los tests admin)
test_1_10_vaciar_carrito_completo() {
    echo -e "\n${YELLOW}=== Test 1.10: Vaciar Carrito Completo ===${NC}"
    
    # Primero agregar algo al carrito
    curl -s -X POST "$BASE_URL/api/v1/carrito/agregar" \
        -H "Authorization: Bearer $CLIENTE_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"id_libro\": \"$LIBRO_ID_1\",
            \"cantidad\": 1
        }" > /dev/null
    
    RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/v1/carrito" \
        -H "Authorization: Bearer $CLIENTE_TOKEN" \
        -H "Accept: application/json" \
        --write-out "\nCódigo de estado: %{http_code}" \
        --connect-timeout 10)
    
    echo -e "${BLUE}Respuesta:${NC}"
    echo "$RESPONSE"
    
    show_test_result "Vaciar Carrito Completo" "$RESPONSE" "true"
}

# ==================== TESTS DE VALIDACIÓN (CASOS NEGATIVOS) ====================

# Test 3.1: Agregar Libro Inexistente
test_3_1_agregar_libro_inexistente() {
    echo -e "\n${YELLOW}=== Test 3.1: Agregar Libro Inexistente (Caso Negativo) ===${NC}"
    
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/carrito/agregar" \
        -H "Authorization: Bearer $CLIENTE_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "id_libro": "60d85e3a9f15d71f5019e999",
            "cantidad": 1
        }' \
        --write-out "\nCódigo de estado: %{http_code}" \
        --connect-timeout 10)
    
    echo -e "${BLUE}Respuesta:${NC}"
    echo "$RESPONSE"
    
    show_test_result "Agregar Libro Inexistente (Caso Negativo)" "$RESPONSE" "false"
}

# Test 3.2: Acceso No Autorizado a Endpoint Admin
test_3_2_acceso_no_autorizado_admin() {
    echo -e "\n${YELLOW}=== Test 3.2: Acceso No Autorizado a Endpoint Admin (Caso Negativo) ===${NC}"
    
    RESPONSE=$(curl -s -X GET "$BASE_URL/api/v1/carrito/admin/estadisticas" \
        -H "Authorization: Bearer $CLIENTE_TOKEN" \
        -H "Accept: application/json" \
        --write-out "\nCódigo de estado: %{http_code}" \
        --connect-timeout 10)
    
    echo -e "${BLUE}Respuesta:${NC}"
    echo "$RESPONSE"
    
    show_test_result "Acceso No Autorizado a Endpoint Admin (Caso Negativo)" "$RESPONSE" "false"
}

# Test 3.3: Cantidad Inválida en Carrito
test_3_3_cantidad_invalida() {
    echo -e "\n${YELLOW}=== Test 3.3: Cantidad Inválida en Carrito (Caso Negativo) ===${NC}"
    
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/carrito/agregar" \
        -H "Authorization: Bearer $CLIENTE_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"id_libro\": \"$LIBRO_ID_1\",
            \"cantidad\": 5
        }" \
        --write-out "\nCódigo de estado: %{http_code}" \
        --connect-timeout 10)
    
    echo -e "${BLUE}Respuesta:${NC}"
    echo "$RESPONSE"
    
    show_test_result "Cantidad Inválida en Carrito (Caso Negativo)" "$RESPONSE" "false"
}

# Función para mostrar resumen final
mostrar_resumen() {
    echo -e "\n${PURPLE}================================================================${NC}"
    echo -e "${PURPLE}                    RESUMEN DE PRUEBAS${NC}"
    echo -e "${PURPLE}================================================================${NC}"
    echo -e "${GREEN}Tests exitosos: $TESTS_PASSED${NC}"
    echo -e "${RED}Tests fallidos: $TESTS_FAILED${NC}"
    echo -e "${BLUE}Total de tests: $((TESTS_PASSED + TESTS_FAILED))${NC}"
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "\n${GREEN}🎉 ¡TODOS LOS TESTS PASARON EXITOSAMENTE! 🎉${NC}"
    else
        echo -e "\n${YELLOW}⚠️  Algunos tests fallaron. Revisar los resultados arriba. ⚠️${NC}"
    fi
    
    echo -e "${PURPLE}================================================================${NC}"
}

# Función principal
main() {
    show_header
    
    # Obtener tokens de autenticación
    obtener_tokens
    
    # Obtener libros para pruebas
    obtener_libros_para_pruebas
    
    echo -e "\n${CYAN}==================== INICIANDO TESTS DE CLIENTE ====================${NC}"
    
    # Tests de cliente
    test_1_1_obtener_carrito
    test_1_2_agregar_libro
    # test_1_3_agregar_segundo_libro
    test_1_4_actualizar_cantidad
    # test_1_5_aplicar_codigo_descuento
    test_1_6_calcular_total
    test_1_7_confirmar_precios
    # test_1_8_quitar_codigo_descuento
    test_1_9_quitar_libro
    
    echo -e "\n${CYAN}================== INICIANDO TESTS ADMINISTRATIVOS =================${NC}"
    
    # Tests administrativos
    test_2_1_listar_carritos_admin
    test_2_2_estadisticas_admin
    test_2_3_producto_popular_admin
    test_2_4_vaciar_carrito_cliente_admin
    test_2_5_quitar_producto_todos_carritos
    test_2_6_vaciar_todos_carritos_root
    
    # Test de vaciar carrito (después de los admin tests)
    test_1_10_vaciar_carrito_completo
    
    echo -e "\n${CYAN}================= INICIANDO TESTS DE VALIDACIÓN ==================${NC}"
    
    Tests de validación (casos negativos)
    test_3_1_agregar_libro_inexistente
    test_3_2_acceso_no_autorizado_admin
    test_3_3_cantidad_invalida
    
    # Mostrar resumen final
    mostrar_resumen
}

# Verificar que el servidor esté disponible
echo -e "${YELLOW}Verificando conectividad con el servidor...${NC}"
if ! curl -s --head "$BASE_URL/api/health" > /dev/null; then
    echo -e "${RED}Error: No se puede conectar al servidor en $BASE_URL${NC}"
    echo -e "${YELLOW}Asegúrate de que el servidor esté ejecutándose${NC}"
    exit 1
fi

# Ejecutar función principal
main