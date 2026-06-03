#!/bin/bash
# Script de build para Render — instala tesseract para OCR de imágenes
echo "=== Instalando Tesseract OCR ==="
apt-get update -q 2>/dev/null && \
apt-get install -y -q tesseract-ocr tesseract-ocr-spa tesseract-ocr-eng 2>/dev/null && \
echo "✅ Tesseract instalado" || echo "⚠️ Tesseract no disponible (OCR de imágenes desactivado)"

echo "=== Instalando dependencias Python ==="
pip install -r requirements.txt
echo "✅ Build completado"
