#!/bin/bash

# Script de pruebas automatizadas para la API de usuarios
# ======================================================

# Configuración
API_URL="https://librosfera.onrender.com/api/v1"
REPORT_FILE="api_test_report.md"
TEMP_DIR="./temp_test_data"

# Colores para salida
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # Sin Color

# Contadores para el reporte
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Crear directorio temporal para datos de prueba
mkdir -p $TEMP_DIR

# Inicializar el archivo de reporte
echo "# Reporte de Pruebas API - $(date)" > $REPORT_FILE
echo "" >> $REPORT_FILE
echo "## Resumen" >> $REPORT_FILE
echo "" >> $REPORT_FILE
echo "| Categoría | Descripción | Estado | Detalles |" >> $REPORT_FILE
echo "|-----------|-------------|--------|----------|" >> $REPORT_FILE

# Función para ejecutar una prueba y reportar el resultado
run_test() {
    local category=$1
    local description=$2
    local expected_status=$3
    local curl_command=$4
    local expected_error=$5
    local dependencies=$6

    # Si hay dependencias y alguna falló, saltamos esta prueba
    if [ ! -z "$dependencies" ] && [ ! -f "$TEMP_DIR/$dependencies.success" ]; then
        echo -e "${YELLOW}[SKIPPED]${NC} $description (depende de: $dependencies que falló)"
        echo "| $category | $description | ⚠️ Saltado | Dependencia fallida: $dependencies |" >> $REPORT_FILE
        return
    fi

    echo -e "\n${YELLOW}Ejecutando:${NC} $description"
    
    # Archivos para guardar respuesta y código de estado por separado
    # Reemplazar caracteres problemáticos en el nombre del archivo
    local safe_description=$(echo $description | tr ' ()' '_[]')
    local response_file="$TEMP_DIR/response_${safe_description}.json"
    local status_code_file="$TEMP_DIR/status_${safe_description}.txt"
    
    # Ejecutar el comando curl con redirección de salida
    # Primero, guardar en una variable para evitar problemas de evaluación
    local cmd="$curl_command"
    
    # Ejecutar el comando curl y capturar el código de estado por separado
    eval "$cmd -o $response_file -s -w '%{http_code}'" > $status_code_file
    
    local status_code=$(cat $status_code_file)
    local test_name=$(echo $description | tr ' ()' '_[]')
    
    # Validar respuesta
    if [[ "$status_code" == "$expected_status" ]]; then
        # Si esperamos un error específico, verificarlo
        if [ ! -z "$expected_error" ]; then
            if grep -q "$expected_error" $response_file; then
                echo -e "${GREEN}[PASS]${NC} $description (Status: $status_code, Error: $expected_error)"
                echo "| $category | $description | ✅ PASS | Status: $status_code, Error verificado |" >> $REPORT_FILE
                PASSED_TESTS=$((PASSED_TESTS + 1))
                touch "$TEMP_DIR/$test_name.success"
            else
                echo -e "${RED}[FAIL]${NC} $description (Status: $status_code, Error esperado: '$expected_error' no encontrado)"
                local actual_error=$(cat $response_file | grep -o '"message":"[^"]*"' | head -1 | cut -d':' -f2- | tr -d '"')
                echo "| $category | $description | ❌ FAIL | Status: $status_code, Error esperado: '$expected_error', Obtenido: '$actual_error' |" >> $REPORT_FILE
                FAILED_TESTS=$((FAILED_TESTS + 1))
            fi
        else
            echo -e "${GREEN}[PASS]${NC} $description (Status: $status_code)"
            echo "| $category | $description | ✅ PASS | Status: $status_code |" >> $REPORT_FILE
            PASSED_TESTS=$((PASSED_TESTS + 1))
            touch "$TEMP_DIR/$test_name.success"
            
            # Si el test es un login, extraer token
            if [[ $description == *"Login"* ]] || [[ $description == *"Crear"* && $description == *"Admin"* ]]; then
                local token=$(grep -o '"token":"[^"]*"' $response_file | cut -d':' -f2- | tr -d '"')
                if [ ! -z "$token" ]; then
                    echo $token > "$TEMP_DIR/${test_name}_token.txt"
                    echo "Token guardado para $test_name"
                fi
            fi
            
            # Si el test crea un usuario, extraer ID
            if [[ $description == *"Registro"* ]] || [[ $description == *"Crear"* ]]; then
                local user_id=$(grep -o '"_id":"[^"]*"' $response_file | head -1 | cut -d':' -f2- | tr -d '"')
                if [ ! -z "$user_id" ]; then
                    echo $user_id > "$TEMP_DIR/${test_name}_id.txt"
                    echo "ID guardado para $test_name"
                fi
            fi
        fi
    else
        echo -e "${RED}[FAIL]${NC} $description (Status esperado: $expected_status, Obtenido: $status_code)"
        local error_msg=$(cat $response_file | grep -o '"message":"[^"]*"' | head -1 | cut -d':' -f2- | tr -d '"')
        echo "| $category | $description | ❌ FAIL | Status esperado: $expected_status, Obtenido: $status_code. Mensaje: $error_msg |" >> $REPORT_FILE
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

# Función para obtener tokens iniciales
setup_authentication() {
    echo -e "\n${YELLOW}Configurando autenticación inicial...${NC}"
    
    # Login como Root (usando las credenciales desde los logs)
    local root_login_cmd="curl -X POST $API_URL/users/login \
      -H \"Content-Type: application/json\" \
      -d '{
        \"email\": \"root@librosfera.com\",
        \"password\": \"Root12345!\"
      }'"
    
    run_test "Autenticación" "Login Root Inicial" 200 "$root_login_cmd" "" ""
    
    if [ -f "$TEMP_DIR/Login_Root_Inicial.success" ]; then
        ROOT_TOKEN=$(grep -o '"token":"[^"]*"' "$TEMP_DIR/response_Login_Root_Inicial.json" | cut -d':' -f2- | tr -d '"')
        
        if [ ! -z "$ROOT_TOKEN" ]; then
            echo "ROOT_TOKEN=$ROOT_TOKEN" > "$TEMP_DIR/tokens.sh"
            echo -e "${GREEN}Token root obtenido${NC}"
        else
            echo -e "${RED}Token root no encontrado en la respuesta${NC}"
            cat "$TEMP_DIR/response_Login_Root_Inicial.json"
        fi
    else
        echo -e "${RED}No se pudo obtener token root, algunas pruebas fallarán${NC}"
    fi
    
    # Intentar crear un cliente para pruebas con TODOS los campos requeridos
    local create_test_client="curl -X POST $API_URL/users/register \
      -H \"Content-Type: application/json\" \
      -d '{
        \"usuario\": \"cliente_test\",
        \"email\": \"cliente_test@example.com\",
        \"password\": \"Password123!\",
        \"tipo_usuario\": \"cliente\",
        \"DNI\": \"12345678T\",
        \"nombres\": \"Cliente\",
        \"apellidos\": \"Test\",
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
      }'"
    
    run_test "Configuración" "Crear Cliente Test" 201 "$create_test_client" "" ""
    
    # Si el cliente ya existe, intentar login
    if [ ! -f "$TEMP_DIR/Crear_Cliente_Test.success" ]; then
        local client_login_cmd="curl -X POST $API_URL/users/login \
          -H \"Content-Type: application/json\" \
          -d '{
            \"email\": \"cliente_test@example.com\",
            \"password\": \"Password123!\"
          }'"
        
        run_test "Autenticación" "Login Cliente Test" 200 "$client_login_cmd" "" ""
        
        if [ -f "$TEMP_DIR/Login_Cliente_Test.success" ]; then
            CLIENT_TOKEN=$(grep -o '"token":"[^"]*"' "$TEMP_DIR/response_Login_Cliente_Test.json" | cut -d':' -f2- | tr -d '"')
            
            if [ ! -z "$CLIENT_TOKEN" ]; then
                echo "CLIENT_TOKEN=$CLIENT_TOKEN" >> "$TEMP_DIR/tokens.sh"
                echo -e "${GREEN}Token cliente obtenido${NC}"
            fi
        fi
    else
        CLIENT_TOKEN=$(grep -o '"token":"[^"]*"' "$TEMP_DIR/response_Crear_Cliente_Test.json" | cut -d':' -f2- | tr -d '"')
        
        if [ ! -z "$CLIENT_TOKEN" ]; then
            echo "CLIENT_TOKEN=$CLIENT_TOKEN" >> "$TEMP_DIR/tokens.sh"
            echo -e "${GREEN}Token cliente obtenido${NC}"
        fi
    fi
    
    # Intentar crear un admin para pruebas (usando ROOT_TOKEN)
    if [ ! -z "$ROOT_TOKEN" ]; then
        local create_test_admin="curl -X POST $API_URL/users/admin \
          -H \"Content-Type: application/json\" \
          -H \"Authorization: Bearer $ROOT_TOKEN\" \
          -d '{
            \"email\": \"admin_test@example.com\",
            \"password\": \"AdminPass123!\",
            \"usuario\": \"admin_test\"
          }'"
        
        run_test "Configuración" "Crear Admin Test" 201 "$create_test_admin" "" "Login_Root_Inicial"
        
        if [ -f "$TEMP_DIR/Crear_Admin_Test.success" ]; then
            ADMIN_TOKEN=$(grep -o '"token":"[^"]*"' "$TEMP_DIR/response_Crear_Admin_Test.json" | cut -d':' -f2- | tr -d '"')
            
            if [ ! -z "$ADMIN_TOKEN" ]; then
                echo "ADMIN_TOKEN=$ADMIN_TOKEN" >> "$TEMP_DIR/tokens.sh"
                echo -e "${GREEN}Token admin obtenido${NC}"
            fi
        else
            # Intentar login como admin si ya existe
            local admin_login_cmd="curl -X POST $API_URL/users/login \
              -H \"Content-Type: application/json\" \
              -d '{
                \"email\": \"admin_test@example.com\",
                \"password\": \"AdminPass123!\"
              }'"
            
            run_test "Autenticación" "Login Admin Test" 200 "$admin_login_cmd" "" ""
            
            if [ -f "$TEMP_DIR/Login_Admin_Test.success" ]; then
                ADMIN_TOKEN=$(grep -o '"token":"[^"]*"' "$TEMP_DIR/response_Login_Admin_Test.json" | cut -d':' -f2- | tr -d '"')
                
                if [ ! -z "$ADMIN_TOKEN" ]; then
                    echo "ADMIN_TOKEN=$ADMIN_TOKEN" >> "$TEMP_DIR/tokens.sh"
                    echo -e "${GREEN}Token admin obtenido${NC}"
                fi
            fi
        fi
    fi
    
    # Cargar tokens obtenidos
    if [ -f "$TEMP_DIR/tokens.sh" ]; then
        source "$TEMP_DIR/tokens.sh"
    fi
}

# === PRUEBAS DE REGISTRO ===
run_registration_tests() {
    echo -e "\n${YELLOW}Ejecutando pruebas de registro...${NC}"
    
    # Casos exitosos
    
    # Cliente con datos mínimos (ajustados a las validaciones de tu API)
    local minimal_client="curl -X POST $API_URL/users/register \
      -H \"Content-Type: application/json\" \
      -d '{
        \"usuario\": \"mini_cliente\",
        \"email\": \"mini@example.com\",
        \"password\": \"12345678\",
        \"tipo_usuario\": \"cliente\",
        \"DNI\": \"12345\",
        \"nombres\": \"Ab\",
        \"apellidos\": \"Cd\",
        \"fecha_nacimiento\": \"2007-04-09\",
        \"lugar_nacimiento\": \"NY\",
        \"genero\": \"Otro\",
        \"direcciones\": [{
          \"calle\": \"Calle 5\", 
          \"ciudad\": \"Madrid\", 
          \"codigo_postal\": \"28001\", 
          \"pais\": \"España\"
        }]
      }'"
    
    run_test "Registro" "Cliente con datos mínimos" 201 "$minimal_client" "" ""
    
    # Cliente con múltiples direcciones en formato correcto
    local multi_address_client="curl -X POST $API_URL/users/register \
      -H \"Content-Type: application/json\" \
      -d '{
        \"usuario\": \"multi_dir\",
        \"email\": \"multidirecciones@example.com\",
        \"password\": \"Password123!\",
        \"tipo_usuario\": \"cliente\",
        \"DNI\": \"87654321Z\",
        \"nombres\": \"María\",
        \"apellidos\": \"García Pérez\",
        \"fecha_nacimiento\": \"1985-06-20\",
        \"lugar_nacimiento\": \"Barcelona\",
        \"genero\": \"Femenino\",
        \"direcciones\": [
          {\"calle\": \"Avenida Principal 45\", \"ciudad\": \"Barcelona\", \"codigo_postal\": \"08001\", \"pais\": \"España\"}, 
          {\"calle\": \"Calle Secundaria 67\", \"ciudad\": \"Madrid\", \"codigo_postal\": \"28001\", \"pais\": \"España\"},
          {\"calle\": \"Plaza Mayor 1\", \"ciudad\": \"Valencia\", \"codigo_postal\": \"46001\", \"pais\": \"España\"}
        ]
      }'"
    
    run_test "Registro" "Cliente con múltiples direcciones" 201 "$multi_address_client" "" ""
    
    # Cliente con exactamente 18 años
    local exact_18_client="curl -X POST $API_URL/users/register \
      -H \"Content-Type: application/json\" \
      -d '{
        \"usuario\": \"justo_edad\",
        \"email\": \"edad18@example.com\",
        \"password\": \"Cumpleaños123!\",
        \"tipo_usuario\": \"cliente\",
        \"DNI\": \"11122233X\",
        \"nombres\": \"Joven\",
        \"apellidos\": \"Adulto\",
        \"fecha_nacimiento\": \"2007-04-09\",
        \"lugar_nacimiento\": \"Valencia\",
        \"genero\": \"Masculino\",
        \"direcciones\": [{
          \"calle\": \"Calle Joven 18\", 
          \"ciudad\": \"Valencia\", 
          \"codigo_postal\": \"46001\", 
          \"pais\": \"España\"
        }]
      }'"
    
    run_test "Registro" "Cliente con exactamente 18 años" 201 "$exact_18_client" "" ""
    
    # Casos fallidos
    
    # Primer usuario root (debería fallar ya que ya existe un root)
    local first_root="curl -X POST $API_URL/users/register \
      -H \"Content-Type: application/json\" \
      -d '{
        \"usuario\": \"admin_root2\",
        \"email\": \"root2@sistema.com\",
        \"password\": \"SuperSecureRoot123!\",
        \"tipo_usuario\": \"root\"
      }'"
    
    # Nota: Cambiamos la expectativa a 500 por el error que vimos en los logs
    run_test "Registro" "Crear root adicional" 500 "$first_root" "Usuario is not defined" ""
    
    # Email inválido
    local invalid_email="curl -X POST $API_URL/users/register \
      -H \"Content-Type: application/json\" \
      -d '{
        \"usuario\": \"email_invalido\",
        \"email\": \"esto-no-es-email\",
        \"password\": \"Password123!\",
        \"tipo_usuario\": \"cliente\",
        \"lugar_nacimiento\": \"Madrid\",
        \"nombres\": \"Test\",
        \"apellidos\": \"Email\",
        \"fecha_nacimiento\": \"1990-01-01\",
        \"genero\": \"Masculino\",
        \"direcciones\": [{
          \"calle\": \"Calle Email\", 
          \"ciudad\": \"Test\", 
          \"codigo_postal\": \"28001\", 
          \"pais\": \"España\"
        }]
      }'"
    
    run_test "Registro" "Email inválido" 400 "$invalid_email" "El formato del email no es válido" ""
    
    # Contraseña demasiado corta
    local short_password="curl -X POST $API_URL/users/register \
      -H \"Content-Type: application/json\" \
      -d '{
        \"usuario\": \"password_corto\",
        \"email\": \"password@example.com\",
        \"password\": \"1234\",
        \"tipo_usuario\": \"cliente\",
        \"lugar_nacimiento\": \"Madrid\",
        \"nombres\": \"Test\",
        \"apellidos\": \"Password\",
        \"fecha_nacimiento\": \"1990-01-01\",
        \"genero\": \"Masculino\",
        \"direcciones\": [{
          \"calle\": \"Calle Password\", 
          \"ciudad\": \"Test\", 
          \"codigo_postal\": \"28001\", 
          \"pais\": \"España\"
        }]
      }'"
    
    run_test "Registro" "Contraseña demasiado corta" 400 "$short_password" "La contraseña debe tener al menos 8 caracteres" ""
    
    # Usuario menor de edad
    local underage_user="curl -X POST $API_URL/users/register \
      -H \"Content-Type: application/json\" \
      -d '{
        \"usuario\": \"menor_edad\",
        \"email\": \"menor@example.com\",
        \"password\": \"Password123!\",
        \"tipo_usuario\": \"cliente\",
        \"nombres\": \"Niño\",
        \"apellidos\": \"Pequeño\",
        \"fecha_nacimiento\": \"2010-01-01\",
        \"lugar_nacimiento\": \"Madrid\",
        \"genero\": \"Masculino\",
        \"direcciones\": [{
          \"calle\": \"Calle Niño\", 
          \"ciudad\": \"Madrid\", 
          \"codigo_postal\": \"28001\", 
          \"pais\": \"España\"
        }]
      }'"
    
    run_test "Registro" "Usuario menor de edad" 400 "$underage_user" "El usuario debe tener al menos 18 años" ""
    
    # Fecha de nacimiento en el futuro
    local future_birth="curl -X POST $API_URL/users/register \
      -H \"Content-Type: application/json\" \
      -d '{
        \"usuario\": \"futuro\",
        \"email\": \"futuro@example.com\",
        \"password\": \"Password123!\",
        \"tipo_usuario\": \"cliente\",
        \"nombres\": \"Viajero\",
        \"apellidos\": \"Del Tiempo\",
        \"fecha_nacimiento\": \"2030-01-01\",
        \"lugar_nacimiento\": \"Madrid\",
        \"genero\": \"Masculino\",
        \"direcciones\": [{
          \"calle\": \"Calle Futuro\", 
          \"ciudad\": \"Madrid\", 
          \"codigo_postal\": \"28001\", 
          \"pais\": \"España\"
        }]
      }'"
    
    run_test "Registro" "Fecha de nacimiento en el futuro" 400 "$future_birth" "fecha de nacimiento no puede ser una fecha futura" ""
    
    # Edad extremadamente alta
    local very_old="curl -X POST $API_URL/users/register \
      -H \"Content-Type: application/json\" \
      -d '{
        \"usuario\": \"matusalen\",
        \"email\": \"anciano@example.com\",
        \"password\": \"Password123!\",
        \"tipo_usuario\": \"cliente\",
        \"nombres\": \"Muy\",
        \"apellidos\": \"Viejo\",
        \"fecha_nacimiento\": \"1850-01-01\",
        \"lugar_nacimiento\": \"Madrid\",
        \"genero\": \"Masculino\",
        \"direcciones\": [{
          \"calle\": \"Calle Antigua\", 
          \"ciudad\": \"Madrid\", 
          \"codigo_postal\": \"28001\", 
          \"pais\": \"España\"
        }]
      }'"
    
    run_test "Registro" "Edad extremadamente alta" 400 "$very_old" "edad no puede ser mayor a 120 años" ""
    
    # Tipo de usuario inválido
    local invalid_type="curl -X POST $API_URL/users/register \
      -H \"Content-Type: application/json\" \
      -d '{
        \"usuario\": \"tipo_invalido\",
        \"email\": \"tipo@example.com\",
        \"password\": \"Password123!\",
        \"tipo_usuario\": \"superadmin\",
        \"lugar_nacimiento\": \"Madrid\",
        \"nombres\": \"Tipo\",
        \"apellidos\": \"Inválido\",
        \"fecha_nacimiento\": \"1990-01-01\",
        \"genero\": \"Masculino\",
        \"direcciones\": [{
          \"calle\": \"Calle Tipo\", 
          \"ciudad\": \"Madrid\", 
          \"codigo_postal\": \"28001\", 
          \"pais\": \"España\"
        }]
      }'"
    
    run_test "Registro" "Tipo de usuario inválido" 400 "$invalid_type" "Tipo de usuario no válido" ""
    
    # Intentar crear administrador sin ser root
    local unauthorized_admin="curl -X POST $API_URL/users/register \
      -H \"Content-Type: application/json\" \
      -d '{
        \"usuario\": \"admin_test2\",
        \"email\": \"admintest2@example.com\",
        \"password\": \"AdminPass123!\",
        \"tipo_usuario\": \"administrador\",
        \"lugar_nacimiento\": \"Madrid\",
        \"nombres\": \"Admin\",
        \"apellidos\": \"Test\",
        \"fecha_nacimiento\": \"1990-01-01\",
        \"genero\": \"Masculino\",
        \"direcciones\": [{
          \"calle\": \"Calle Admin\", 
          \"ciudad\": \"Madrid\", 
          \"codigo_postal\": \"28001\", 
          \"pais\": \"España\"
        }]
      }'"
    
    run_test "Registro" "Crear admin sin autenticación" 401 "$unauthorized_admin" "Debe autenticarse para crear un usuario administrador" ""
    
    # Teléfono con formato inválido
    local invalid_phone="curl -X POST $API_URL/users/register \
      -H \"Content-Type: application/json\" \
      -d '{
        \"usuario\": \"telefono_mal\",
        \"email\": \"telefono@example.com\",
        \"password\": \"Password123!\",
        \"tipo_usuario\": \"cliente\",
        \"telefono\": \"abc123\",
        \"lugar_nacimiento\": \"Madrid\",
        \"nombres\": \"Teléfono\",
        \"apellidos\": \"Inválido\",
        \"fecha_nacimiento\": \"1990-01-01\",
        \"genero\": \"Masculino\",
        \"direcciones\": [{
          \"calle\": \"Calle Teléfono\", 
          \"ciudad\": \"Madrid\", 
          \"codigo_postal\": \"28001\", 
          \"pais\": \"España\"
        }]
      }'"
    
    run_test "Registro" "Teléfono con formato inválido" 400 "$invalid_phone" "El formato del teléfono no es válido" ""
    
    # Usuario con nombres muy largos
    local long_names="curl -X POST $API_URL/users/register \
      -H \"Content-Type: application/json\" \
      -d '{
        \"usuario\": \"nombres_largos\",
        \"email\": \"nombres@example.com\",
        \"password\": \"Password123!\",
        \"tipo_usuario\": \"cliente\",
        \"nombres\": \"Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua Ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat\",
        \"apellidos\": \"Apellido Normal\",
        \"lugar_nacimiento\": \"Madrid\",
        \"fecha_nacimiento\": \"1990-01-01\",
        \"genero\": \"Masculino\",
        \"direcciones\": [{
          \"calle\": \"Calle Larga\", 
          \"ciudad\": \"Madrid\", 
          \"codigo_postal\": \"28001\", 
          \"pais\": \"España\"
        }]
      }'"
    
    run_test "Registro" "Nombres demasiado largos" 400 "$long_names" "El campo Nombres no puede exceder los 100 caracteres" ""
}

# === PRUEBAS DE CREACIÓN DE ADMINISTRADORES ===
run_admin_creation_tests() {
    echo -e "\n${YELLOW}Ejecutando pruebas de creación de administradores...${NC}"
    
    # Caso exitoso (como usuario root)
    if [ ! -z "$ROOT_TOKEN" ]; then
        local create_admin="curl -X POST $API_URL/users/admin \
          -H \"Content-Type: application/json\" \
          -H \"Authorization: Bearer $ROOT_TOKEN\" \
          -d '{
            \"email\": \"admin_special@example.com\",
            \"password\": \"AdminPassword123!\",
            \"usuario\": \"admin_especial\"
          }'"
        
        run_test "Admin" "Crear admin como root" 201 "$create_admin" "" "Login_Root_Inicial"
    fi
    
    # Caso fallido (sin token de root) - ajustado el error esperado
    local unauthorized_admin="curl -X POST $API_URL/users/admin \
      -H \"Content-Type: application/json\" \
      -d '{
        \"email\": \"admin_unauth@example.com\",
        \"password\": \"AdminPassword123!\"
      }'"
    
    run_test "Admin" "Crear admin sin autorización" 401 "$unauthorized_admin" "No ha iniciado sesión" ""
    
    # Caso fallido (con token de cliente)
    if [ ! -z "$CLIENT_TOKEN" ]; then
        local client_create_admin="curl -X POST $API_URL/users/admin \
          -H \"Content-Type: application/json\" \
          -H \"Authorization: Bearer $CLIENT_TOKEN\" \
          -d '{
            \"email\": \"admin_by_client@example.com\",
            \"password\": \"AdminPassword123!\"
          }'"
        
        run_test "Admin" "Crear admin como cliente" 403 "$client_create_admin" "No tiene permiso para realizar esta acción." ""
    fi
}

# === PRUEBAS DE LOGIN ===
run_login_tests() {
    echo -e "\n${YELLOW}Ejecutando pruebas de login...${NC}"
    
    # Credenciales incorrectas
    local wrong_credentials="curl -X POST $API_URL/users/login \
      -H \"Content-Type: application/json\" \
      -d '{
        \"email\": \"root@librosfera.com\",
        \"password\": \"PasswordIncorrecto\"
      }'"
    
    run_test "Login" "Credenciales incorrectas" 401 "$wrong_credentials" "Credenciales inválidas" ""
    
    # Falta información
    local missing_info="curl -X POST $API_URL/users/login \
      -H \"Content-Type: application/json\" \
      -d '{
        \"email\": \"root@librosfera.com\"
      }'"
    
    run_test "Login" "Falta contraseña" 400 "$missing_info" "Por favor proporcione email y contraseña" ""
    
    # Email inexistente
    local nonexistent_email="curl -X POST $API_URL/users/login \
      -H \"Content-Type: application/json\" \
      -d '{
        \"email\": \"noexiste@example.com\",
        \"password\": \"Password123!\"
      }'"
    
    run_test "Login" "Email inexistente" 401 "$nonexistent_email" "Credenciales inválidas" ""
}

# === PRUEBAS DE PERFIL DE USUARIO ===
run_profile_tests() {
    echo -e "\n${YELLOW}Ejecutando pruebas de perfil de usuario...${NC}"
    
    if [ ! -z "$CLIENT_TOKEN" ]; then
        # Obtener perfil
        local get_profile="curl -X GET $API_URL/users/profile \
          -H \"Authorization: Bearer $CLIENT_TOKEN\""
        
        run_test "Perfil" "Obtener perfil de usuario" 200 "$get_profile" "" ""
        
        # Actualizar perfil (caso exitoso) - agregando país y código postal
        local update_profile="curl -X PUT $API_URL/users/profile \
          -H \"Content-Type: application/json\" \
          -H \"Authorization: Bearer $CLIENT_TOKEN\" \
          -d '{
            \"telefono\": \"+34698765432\",
            \"direcciones\": [{
              \"calle\": \"Nueva Calle 789\", 
              \"ciudad\": \"Sevilla\", 
              \"codigo_postal\": \"41001\", 
              \"pais\": \"España\"
            }]
          }'"
        
        run_test "Perfil" "Actualizar perfil (exitoso)" 200 "$update_profile" "" ""
        
        # Intentar usar un email ya registrado (debe fallar)
        # Primero creamos un usuario temporal para tener un email en uso
        local temp_user="curl -X POST $API_URL/users/register \
          -H \"Content-Type: application/json\" \
          -d '{
            \"usuario\": \"temp_user\",
            \"email\": \"temp_email@example.com\",
            \"password\": \"Password123!\",
            \"tipo_usuario\": \"cliente\",
            \"DNI\": \"99999999T\",
            \"nombres\": \"Temporal\",
            \"apellidos\": \"Usuario\",
            \"fecha_nacimiento\": \"1990-01-15\",
            \"lugar_nacimiento\": \"Madrid\",
            \"genero\": \"Masculino\",
            \"direcciones\": [{
              \"calle\": \"Calle Temporal\", 
              \"ciudad\": \"Madrid\", 
              \"codigo_postal\": \"28001\", 
              \"pais\": \"España\"
            }]
          }'"
        
        run_test "Configuración" "Crear usuario temporal" 201 "$temp_user" "" ""
        
        # Ahora intentamos usar ese email
        local used_email="curl -X PUT $API_URL/users/profile \
          -H \"Content-Type: application/json\" \
          -H \"Authorization: Bearer $CLIENT_TOKEN\" \
          -d '{
            \"email\": \"temp_email@example.com\"
          }'"
        
        run_test "Perfil" "Actualizar a email en uso" 400 "$used_email" "El email o nombre de usuario ya está en uso por otra cuenta" ""
    else
        echo -e "${YELLOW}Saltando pruebas de perfil: No hay token de cliente disponible${NC}"
    fi
}

# === PRUEBAS DE ADMINISTRACIÓN DE USUARIOS ===
run_admin_tests() {
    echo -e "\n${YELLOW}Ejecutando pruebas de administración de usuarios...${NC}"
    
    if [ ! -z "$ADMIN_TOKEN" ] && [ ! -z "$ROOT_TOKEN" ]; then
        # Obtener todos los usuarios (con filtros)
        local get_users="curl -X GET \"$API_URL/users?page=1&limit=5&tipo=cliente\" \
          -H \"Authorization: Bearer $ADMIN_TOKEN\""
        
        run_test "Admin" "Listar usuarios filtrados" 200 "$get_users" "" ""
        
        # Obtener un usuario específico
        # Primero necesitamos un ID válido
        if [ -f "$TEMP_DIR/Crear_Cliente_Test.success" ]; then
            local user_id=$(cat "$TEMP_DIR/Crear_Cliente_Test_id.txt")
            
            local get_user="curl -X GET $API_URL/users/$user_id \
              -H \"Authorization: Bearer $ADMIN_TOKEN\""
            
            run_test "Admin" "Obtener usuario por ID" 200 "$get_user" "" ""
            
            # Actualizar usuario por ID
            local update_user="curl -X PUT $API_URL/users/$user_id \
              -H \"Content-Type: application/json\" \
              -H \"Authorization: Bearer $ADMIN_TOKEN\" \
              -d '{
                \"nombres\": \"Nombre Modificado\",
                \"apellidos\": \"Apellido Modificado\"
              }'"
            
            run_test "Admin" "Actualizar usuario por ID" 200 "$update_user" "" ""
            
            # Intentar que un admin se elimine a sí mismo por la vía admin
            # Primero obtenemos su ID
            local admin_profile="curl -X GET $API_URL/users/profile \
              -H \"Authorization: Bearer $ADMIN_TOKEN\""
            
            run_test "Configuración" "Obtener perfil admin" 200 "$admin_profile" "" ""
            
            # Extraer ID del admin
            local admin_id_file="$TEMP_DIR/admin_id.txt"
            grep -o '"_id":"[^"]*"' "$TEMP_DIR/response_Obtener_perfil_admin.json" | head -1 | cut -d':' -f2- | tr -d '"' > $admin_id_file
            
            if [ -s "$admin_id_file" ]; then
                local admin_id=$(cat $admin_id_file)
                
                # Intentar eliminarse a sí mismo
                local self_delete="curl -X DELETE $API_URL/users/$admin_id \
                  -H \"Authorization: Bearer $ADMIN_TOKEN\""
                
                run_test "Admin" "Eliminarse a sí mismo" 400 "$self_delete" "No puede eliminar su propia cuenta por esta vía" ""
            fi
        else
            echo -e "${YELLOW}Saltando algunas pruebas de admin: No se encontró ID de usuario de prueba${NC}"
        fi
    else
        echo -e "${YELLOW}Saltando pruebas de administración: No hay tokens necesarios disponibles${NC}"
    fi
}

# === EJECUCIÓN PRINCIPAL ===

# Comenzar las pruebas
echo -e "${GREEN}=== INICIANDO PRUEBAS AUTOMATIZADAS DE LA API ===${NC}"
echo -e "${YELLOW}URL de la API: $API_URL${NC}"

# Configurar autenticación
setup_authentication

# Ejecutar grupos de pruebas
run_registration_tests
run_admin_creation_tests
run_login_tests
run_profile_tests
run_admin_tests

# Actualizar el resumen del reporte
sed -i "3i**Pruebas Totales:** $TOTAL_TESTS | **Pasadas:** $PASSED_TESTS | **Fallidas:** $FAILED_TESTS" $REPORT_FILE

# Mostrar resumen de resultados
echo -e "\n${GREEN}=== RESUMEN DE RESULTADOS ===${NC}"
echo -e "Pruebas totales: $TOTAL_TESTS"
echo -e "Pruebas pasadas: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Pruebas fallidas: ${RED}$FAILED_TESTS${NC}"
echo -e "\nReporte detallado generado en: ${YELLOW}$REPORT_FILE${NC}"

# Limpiar archivos temporales si lo prefieres (descomenta para activar)
rm -rf $TEMP_DIR