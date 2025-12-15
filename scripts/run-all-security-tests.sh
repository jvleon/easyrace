#!/bin/bash

# Script para ejecutar todas las pruebas de seguridad
# Uso: ./scripts/run-all-security-tests.sh

echo "🚀 Ejecutando todas las pruebas de seguridad..."
echo ""

# Verificar que Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js no está instalado. Por favor instálalo primero."
    exit 1
fi

# Verificar que las dependencias están instaladas
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependencias..."
    npm install
fi

# Pruebas HTTP (no requieren dependencias adicionales)
echo "📡 Ejecutando pruebas HTTP (SQL Injection, IDOR, Path Traversal, etc.)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
node scripts/security-penetration-tests.js
HTTP_EXIT_CODE=$?

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Verificar si Puppeteer está instalado para pruebas en navegador
if [ ! -d "node_modules/puppeteer" ]; then
    echo "⚠️  Puppeteer no está instalado. Instalando..."
    npm install puppeteer --save-dev
fi

# Pruebas en navegador (requieren Puppeteer)
echo "🌐 Ejecutando pruebas en navegador (XSS, API Key Exposure, etc.)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
node scripts/browser-security-tests.js
BROWSER_EXIT_CODE=$?

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Resumen final
if [ $HTTP_EXIT_CODE -eq 0 ] && [ $BROWSER_EXIT_CODE -eq 0 ]; then
    echo "✅ Todas las pruebas completadas exitosamente"
    echo ""
    echo "📄 Resultados guardados en:"
    echo "   - security-test-results.json"
    echo "   - browser-security-test-results.json"
    exit 0
else
    echo "❌ Algunas pruebas fallaron"
    echo "   HTTP Tests Exit Code: $HTTP_EXIT_CODE"
    echo "   Browser Tests Exit Code: $BROWSER_EXIT_CODE"
    exit 1
fi


